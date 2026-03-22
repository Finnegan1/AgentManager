/** Transport configuration for a downstream MCP server using stdio */
export interface StdioTransportConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/** Transport configuration for a downstream MCP server using SSE */
export interface SseTransportConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

/** Transport configuration for a downstream MCP server using Streamable HTTP */
export interface StreamableHttpTransportConfig {
  type: "streamable-http";
  url: string;
  headers?: Record<string, string>;
}

/** Union type for all supported transport configurations */
export type TransportConfig =
  | StdioTransportConfig
  | SseTransportConfig
  | StreamableHttpTransportConfig;

/** Configuration for a single downstream MCP server */
export interface DownstreamServerConfig {
  /** Human-readable name, also used as namespace prefix in the gateway */
  name: string;
  /** Whether this server is currently enabled */
  enabled: boolean;
  /** Transport configuration for connecting to this server */
  transport: TransportConfig;
}
