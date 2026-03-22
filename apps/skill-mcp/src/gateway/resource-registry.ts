import type {
  Resource,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/types.js";
import type { DownstreamConnection } from "./downstream-connection.js";

/**
 * Aggregates resources from all downstream servers with namespace prefixing.
 * Resource URIs become: `serverKey://originalUri`
 */
export class ResourceRegistry {
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

  /** Get the aggregated list of all resources from downstream servers */
  listResources(): Resource[] {
    const resources: Resource[] = [];

    for (const [serverKey, connection] of this.connections) {
      if (connection.status !== "connected") continue;

      for (const resource of connection.capabilities.resources) {
        resources.push({
          ...resource,
          uri: `${serverKey}://${resource.uri}`,
          name: resource.name
            ? `[${serverKey}] ${resource.name}`
            : `[${serverKey}] ${resource.uri}`,
        });
      }
    }

    return resources;
  }

  /** Get the aggregated list of all resource templates from downstream servers */
  listResourceTemplates(): ResourceTemplate[] {
    const templates: ResourceTemplate[] = [];

    for (const [serverKey, connection] of this.connections) {
      if (connection.status !== "connected") continue;

      for (const template of connection.capabilities.resourceTemplates) {
        templates.push({
          ...template,
          uriTemplate: `${serverKey}://${template.uriTemplate}`,
          name: template.name
            ? `[${serverKey}] ${template.name}`
            : `[${serverKey}] ${template.uriTemplate}`,
        });
      }
    }

    return templates;
  }

  /**
   * Resolve a namespaced resource URI to its downstream connection and original URI.
   * URI format: `serverKey://originalUri`
   */
  resolveResourceRead(namespacedUri: string): {
    connection: DownstreamConnection;
    originalUri: string;
    serverKey: string;
  } | null {
    const protocolEnd = namespacedUri.indexOf("://");
    if (protocolEnd === -1) return null;

    const serverKey = namespacedUri.slice(0, protocolEnd);
    const originalUri = namespacedUri.slice(protocolEnd + 3);

    const connection = this.connections.get(serverKey);
    if (!connection) return null;

    return { connection, originalUri, serverKey };
  }
}
