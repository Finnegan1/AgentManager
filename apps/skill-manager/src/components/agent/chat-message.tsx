import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { ChatMessage, ToolCallInfo, ContentPart } from "@/hooks/use-agent";
import type { ToolUIPart } from "ai";
import { Loader2 } from "lucide-react";

interface AgentMessageProps {
  message: ChatMessage;
}

/** Map our tool status strings to ai-elements ToolUIPart states */
function mapToolState(status: string): ToolUIPart["state"] {
  switch (status) {
    case "running":
      return "input-available";
    case "completed":
      return "output-available";
    case "error":
      return "output-error";
    default:
      return "input-streaming";
  }
}

function AgentToolCall({ toolCall }: { toolCall: ToolCallInfo }) {
  const state = mapToolState(toolCall.status);
  const hasOutput = toolCall.content && toolCall.content.length > 0;

  return (
    <Tool>
      <ToolHeader
        type={`tool-${toolCall.id}`}
        state={state}
        title={toolCall.title}
      />
      {hasOutput && (
        <ToolContent>
          <ToolOutput
            output={toolCall.content}
            errorText={
              toolCall.status === "error"
                ? String(toolCall.content?.[0] ?? "Error")
                : undefined
            }
          />
        </ToolContent>
      )}
    </Tool>
  );
}

function renderPart(part: ContentPart, index: number, isStreaming: boolean) {
  if (part.type === "text") {
    return (
      <MessageResponse key={`text-${index}`} isAnimating={isStreaming}>
        {part.text}
      </MessageResponse>
    );
  }
  return <AgentToolCall key={part.tool.id} toolCall={part.tool} />;
}

export function AgentMessage({ message }: AgentMessageProps) {
  if (message.role === "user") {
    return (
      <Message from="user">
        <MessageContent>
          <p>{message.text}</p>
        </MessageContent>
      </Message>
    );
  }

  const isEmpty = message.parts.length === 0 && message.isStreaming;
  // Only the last text part should animate
  const lastTextIdx = message.parts.reduce(
    (acc, part, i) => (part.type === "text" ? i : acc),
    -1,
  );

  return (
    <Message from="assistant">
      <MessageContent>
        {isEmpty && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
            <Loader2 className="size-4 animate-spin" />
            Thinking...
          </div>
        )}
        {message.parts.map((part, i) =>
          renderPart(
            part,
            i,
            message.isStreaming && part.type === "text" && i === lastTextIdx,
          ),
        )}
      </MessageContent>
    </Message>
  );
}
