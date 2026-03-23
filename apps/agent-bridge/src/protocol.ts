/**
 * WebSocket protocol message types shared between agent-bridge and frontend.
 */

// --- Client -> Server (frontend -> agent-bridge) ---

export interface PromptMessage {
  type: "prompt";
  text: string;
}

export interface CancelMessage {
  type: "cancel";
}

export interface PermissionResponseMessage {
  type: "permission_response";
  requestId: string;
  optionId: string;
}

export type ClientMessage =
  | PromptMessage
  | CancelMessage
  | PermissionResponseMessage;

// --- Server -> Client (agent-bridge -> frontend) ---

export interface ReadyMessage {
  type: "ready";
  sessionId: string;
}

export interface TextMessage {
  type: "text";
  content: string;
  messageId?: string;
}

export interface ThinkingMessage {
  type: "thinking";
  content: string;
}

export interface ToolCallMessage {
  type: "tool_call";
  toolCallId: string;
  title: string;
  status?: string;
  content?: unknown[];
}

export interface ToolCallUpdateMessage {
  type: "tool_call_update";
  toolCallId: string;
  title?: string;
  status?: string;
  content?: unknown[];
}

export interface TurnCompleteMessage {
  type: "turn_complete";
  stopReason: string;
}

export interface PermissionRequestMessage {
  type: "permission_request";
  requestId: string;
  title: string;
  description: string;
  options: Array<{ optionId: string; name: string; kind: string }>;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage =
  | ReadyMessage
  | TextMessage
  | ThinkingMessage
  | ToolCallMessage
  | ToolCallUpdateMessage
  | TurnCompleteMessage
  | PermissionRequestMessage
  | ErrorMessage;
