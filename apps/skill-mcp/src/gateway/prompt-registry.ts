import type { Prompt } from "@modelcontextprotocol/sdk/types.js";
import type { DownstreamConnection } from "./downstream-connection.js";
import { sanitizeServerKey } from "./sanitize.js";

/**
 * Aggregates prompts from all downstream servers with namespace prefixing.
 * Prompt names become: `serverKey__originalPromptName`
 */
export class PromptRegistry {
  private connections = new Map<string, DownstreamConnection>();

  /** Register a downstream connection */
  registerConnection(
    serverKey: string,
    connection: DownstreamConnection,
  ): void {
    this.connections.set(serverKey, connection);
  }

  /** Unregister a downstream connection */
  unregisterConnection(serverKey: string): void {
    this.connections.delete(serverKey);
  }

  /** Get the aggregated list of all prompts from downstream servers */
  listPrompts(): Prompt[] {
    const prompts: Prompt[] = [];

    for (const [serverKey, connection] of this.connections) {
      if (connection.status !== "connected") continue;
      const safeKey = sanitizeServerKey(serverKey);

      for (const prompt of connection.capabilities.prompts) {
        prompts.push({
          ...prompt,
          name: `${safeKey}__${prompt.name}`,
          description: prompt.description
            ? `[${serverKey}] ${prompt.description}`
            : `[${serverKey}] ${prompt.name}`,
        });
      }
    }

    return prompts;
  }

  /**
   * Resolve a namespaced prompt name to its downstream connection and original name.
   */
  resolvePromptGet(namespacedName: string): {
    connection: DownstreamConnection;
    originalName: string;
    serverKey: string;
  } | null {
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
