import { useState, useEffect, useRef, useCallback } from "react";
import { startAgentBridge } from "@/lib/tauri-commands";
import { useAppConfig, useAppSkills } from "@/contexts/app-context";

// --- Types ---

export interface ToolCallInfo {
  id: string;
  title: string;
  status: string;
  content?: unknown[];
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "tool"; tool: ToolCallInfo };

export interface AssistantMessage {
  role: "assistant";
  parts: ContentPart[];
  thinking: string;
  isStreaming: boolean;
}

export interface UserMessage {
  role: "user";
  text: string;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface PermissionRequest {
  requestId: string;
  title: string;
  description: string;
  options: Array<{ optionId: string; name: string; kind: string }>;
}

// --- Protocol types (must match agent-bridge) ---

interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

// --- Hook ---

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [pendingPermission, setPendingPermission] =
    useState<PermissionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const { reload: reloadConfig } = useAppConfig();
  const { reload: reloadSkills } = useAppSkills();

  const updateCurrentAssistant = useCallback(
    (updater: (prev: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          const updated = updater(last);
          return [...prev.slice(0, -1), updated];
        }
        return prev;
      });
    },
    [],
  );

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "ready":
          setIsConnected(true);
          setIsInitializing(false);
          break;

        case "text":
          updateCurrentAssistant((prev) => {
            const parts = [...prev.parts];
            const last = parts[parts.length - 1];
            // Append to existing text part, or create a new one
            if (last && last.type === "text") {
              parts[parts.length - 1] = {
                type: "text",
                text: last.text + (msg.content as string),
              };
            } else {
              parts.push({ type: "text", text: msg.content as string });
            }
            return { ...prev, parts };
          });
          break;

        case "thinking":
          updateCurrentAssistant((prev) => ({
            ...prev,
            thinking: prev.thinking + (msg.content as string),
          }));
          break;

        case "tool_call": {
          const tc: ToolCallInfo = {
            id: msg.toolCallId as string,
            title: msg.title as string,
            status: (msg.status as string) ?? "running",
            content: msg.content as unknown[] | undefined,
          };
          updateCurrentAssistant((prev) => ({
            ...prev,
            parts: [...prev.parts, { type: "tool" as const, tool: tc }],
          }));
          break;
        }

        case "tool_call_update": {
          const id = msg.toolCallId as string;
          updateCurrentAssistant((prev) => ({
            ...prev,
            parts: prev.parts.map((part) => {
              if (part.type === "tool" && part.tool.id === id) {
                return {
                  type: "tool" as const,
                  tool: {
                    ...part.tool,
                    ...(msg.title != null && { title: msg.title as string }),
                    ...(msg.status != null && { status: msg.status as string }),
                    ...(msg.content != null && {
                      content: msg.content as unknown[],
                    }),
                  },
                };
              }
              return part;
            }),
          }));
          break;
        }

        case "turn_complete":
          updateCurrentAssistant((prev) => ({
            ...prev,
            isStreaming: false,
          }));
          setIsStreaming(false);
          reloadConfig();
          reloadSkills();
          break;

        case "permission_request":
          setPendingPermission({
            requestId: msg.requestId as string,
            title: msg.title as string,
            description: msg.description as string,
            options: msg.options as PermissionRequest["options"],
          });
          break;

        case "error":
          setError(msg.message as string);
          setIsStreaming(false);
          setIsInitializing(false);
          break;
      }
    },
    [updateCurrentAssistant, reloadConfig, reloadSkills],
  );

  // Connect to agent-bridge WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsInitializing(true);
    setError(null);

    try {
      const port = await startAgentBridge();
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);

      ws.onopen = () => {
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setIsConnected(false);
        setIsStreaming(false);
      };

      ws.onerror = () => {
        setError("WebSocket connection failed");
        setIsInitializing(false);
      };

      wsRef.current = ws;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsInitializing(false);
    }
  }, [handleServerMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!text.trim()) return;

    const userMsg: UserMessage = { role: "user", text };
    const assistantMsg: AssistantMessage = {
      role: "assistant",
      parts: [],
      thinking: "",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    wsRef.current.send(JSON.stringify({ type: "prompt", text }));
  }, []);

  const cancelTurn = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "cancel" }));
  }, []);

  const respondToPermission = useCallback(
    (requestId: string, optionId: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({ type: "permission_response", requestId, optionId }),
      );
      setPendingPermission(null);
    },
    [],
  );

  return {
    messages,
    isConnected,
    isStreaming,
    isInitializing,
    pendingPermission,
    error,
    connect,
    sendMessage,
    cancelTurn,
    respondToPermission,
  };
}
