import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { DownstreamConnection } from "./downstream-connection.js";
import { sanitizeServerKey } from "./sanitize.js";

export interface NamespacedTool extends Tool {
  /** The original tool name (without namespace prefix) */
  _originalName: string;
  /** The server key this tool belongs to */
  _serverKey: string;
}

/**
 * Aggregates tools from all downstream servers with namespace prefixing.
 * Tool names become: `serverKey__originalToolName`
 */
export class ToolRegistry {
  private nativeTools: Tool[] = [];
  private connections = new Map<string, DownstreamConnection>();

  /** Set native tools (e.g., skill tools, gateway tools) */
  setNativeTools(tools: Tool[]): void {
    this.nativeTools = tools;
  }

  /** Register a downstream connection */
  registerConnection(serverKey: string, connection: DownstreamConnection): void {
    this.connections.set(serverKey, connection);
  }

  /** Unregister a downstream connection */
  unregisterConnection(serverKey: string): void {
    this.connections.delete(serverKey);
  }

  /** Get the aggregated list of all tools (native + proxied) */
  listTools(): Tool[] {
    const tools: Tool[] = [...this.nativeTools];

    for (const [serverKey, connection] of this.connections) {
      if (connection.status !== "connected") continue;
      const safeKey = sanitizeServerKey(serverKey);

      for (const tool of connection.capabilities.tools) {
        tools.push({
          ...tool,
          name: `${safeKey}__${tool.name}`,
          description: tool.description
            ? `[${serverKey}] ${tool.description}`
            : `[${serverKey}] ${tool.name}`,
        });
      }
    }

    return tools;
  }

  /**
   * Resolve a namespaced tool name to its downstream connection and original name.
   * Returns null for native tools (which should be handled separately).
   */
  resolveToolCall(namespacedName: string): {
    connection: DownstreamConnection;
    originalName: string;
    serverKey: string;
  } | null {
    // Check if it's a native tool
    if (this.nativeTools.some((t) => t.name === namespacedName)) {
      return null;
    }

    // Parse namespace: sanitizedServerKey__toolName
    const separatorIndex = namespacedName.indexOf("__");
    if (separatorIndex === -1) return null;

    const safeKey = namespacedName.slice(0, separatorIndex);
    const originalName = namespacedName.slice(separatorIndex + 2);

    // Find the connection whose sanitized key matches
    for (const [serverKey, connection] of this.connections) {
      if (sanitizeServerKey(serverKey) === safeKey) {
        return { connection, originalName, serverKey };
      }
    }

    return null;
  }
}
