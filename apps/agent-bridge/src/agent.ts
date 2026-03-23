import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import type { ServerMessage } from "./protocol.js";
import { writeSystemPrompt, getWorkingDirectory } from "./system-prompt.js";

export type SendFn = (msg: ServerMessage) => void;
export type PermissionResolver = {
  resolve: (optionId: string) => void;
  reject: (err: Error) => void;
};

export class AgentManager {
  private queryHandle: Query | null = null;
  private sessionId: string | null = null;
  private pendingPermissions = new Map<string, PermissionResolver>();
  private permissionCounter = 0;

  async initialize(send: SendFn): Promise<void> {
    writeSystemPrompt();
    send({ type: "ready", sessionId: "" });
  }

  async handlePrompt(text: string, send: SendFn): Promise<void> {
    try {
      const options: Record<string, unknown> = {
        cwd: getWorkingDirectory(),
        settingSources: ["project"],
        includePartialMessages: true,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
        },
        canUseTool: async (
          toolName: string,
          input: Record<string, unknown>,
        ) => {
          const requestId = `perm_${++this.permissionCounter}`;

          const description =
            toolName === "Bash"
              ? String(input.command ?? "")
              : JSON.stringify(input, null, 2);

          send({
            type: "permission_request",
            requestId,
            title: toolName,
            description,
            options: [
              { optionId: "allow", name: "Allow", kind: "allow" },
              { optionId: "deny", name: "Deny", kind: "reject" },
            ],
          });

          return new Promise<
            | { behavior: "allow"; updatedInput: Record<string, unknown> }
            | { behavior: "deny"; message: string }
          >((resolve, reject) => {
            this.pendingPermissions.set(requestId, {
              resolve: (optionId: string) => {
                if (optionId === "allow") {
                  resolve({ behavior: "allow", updatedInput: input });
                } else {
                  resolve({
                    behavior: "deny",
                    message: "User denied this action",
                  });
                }
              },
              reject,
            });
          });
        },
      };

      if (this.sessionId) {
        options.resume = this.sessionId;
      }

      const q = query({ prompt: text, options: options as any });
      this.queryHandle = q;

      // Track content blocks from stream events for tool call mapping
      const toolNames = new Map<string, string>();

      for await (const message of q) {
        switch (message.type) {
          case "system":
            if ((message as any).subtype === "init") {
              this.sessionId = message.session_id;
            }
            break;

          case "stream_event": {
            const event = (message as any).event;
            if (!event) break;

            if (event.type === "content_block_start") {
              const block = event.content_block;
              if (block?.type === "tool_use") {
                toolNames.set(block.id, block.name);
                send({
                  type: "tool_call",
                  toolCallId: block.id,
                  title: block.name,
                  status: "running",
                });
              }
            } else if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta?.type === "text_delta" && delta.text) {
                send({ type: "text", content: delta.text });
              } else if (delta?.type === "thinking_delta" && delta.thinking) {
                send({ type: "thinking", content: delta.thinking });
              }
            }
            break;
          }

          case "user": {
            // Tool results come back as user messages
            const content = (message as any).message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (
                  block.type === "tool_result" &&
                  typeof block.tool_use_id === "string"
                ) {
                  const resultContent =
                    typeof block.content === "string"
                      ? [block.content]
                      : Array.isArray(block.content)
                        ? block.content
                        : undefined;
                  send({
                    type: "tool_call_update",
                    toolCallId: block.tool_use_id,
                    status: block.is_error ? "error" : "completed",
                    content: resultContent,
                  });
                }
              }
            }
            break;
          }

          case "result":
            send({
              type: "turn_complete",
              stopReason: (message as any).subtype ?? "end_turn",
            });
            break;
        }
      }

      this.queryHandle = null;
    } catch (err) {
      send({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async handleCancel(): Promise<void> {
    if (this.queryHandle) {
      try {
        await this.queryHandle.interrupt();
      } catch {
        // Ignore interrupt errors
      }
    }
  }

  handlePermissionResponse(requestId: string, optionId: string): void {
    const pending = this.pendingPermissions.get(requestId);
    if (pending) {
      pending.resolve(optionId);
      this.pendingPermissions.delete(requestId);
    }
  }

  async destroy(): Promise<void> {
    for (const [, pending] of this.pendingPermissions) {
      pending.reject(new Error("Agent shutting down"));
    }
    this.pendingPermissions.clear();

    if (this.queryHandle) {
      try {
        this.queryHandle.close();
      } catch {
        // Ignore close errors
      }
      this.queryHandle = null;
    }
  }
}
