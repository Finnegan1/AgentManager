import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SkillManagementConfig, DownstreamServerConfig } from "@repo/shared-types";
import { DownstreamConnection } from "./downstream-connection.js";
import { ToolRegistry } from "./tool-registry.js";
import { ResourceRegistry } from "./resource-registry.js";
import { PromptRegistry } from "./prompt-registry.js";
import type { ConfigStore } from "../config/config-store.js";

/**
 * Orchestrates all downstream MCP server connections.
 * Manages the lifecycle of connections and updates registries
 * when config changes or servers connect/disconnect.
 */
export class ProxyManager {
  readonly toolRegistry = new ToolRegistry();
  readonly resourceRegistry = new ResourceRegistry();
  readonly promptRegistry = new PromptRegistry();

  private connections = new Map<string, DownstreamConnection>();
  private server: Server | null = null;

  constructor(private configStore: ConfigStore) {}

  /** Set the gateway server instance (for sending notifications) */
  setServer(server: Server): void {
    this.server = server;
  }

  /** Initialize connections based on current config */
  async initialize(): Promise<void> {
    const config = this.configStore.config;

    for (const [serverKey, serverConfig] of Object.entries(config.servers)) {
      if (serverConfig.enabled) {
        await this.addConnection(serverKey, serverConfig);
      }
    }

    // Watch for config changes
    this.configStore.on("changed", (newConfig, oldConfig) => {
      this.handleConfigChange(newConfig, oldConfig).catch((err) => {
        console.error("Error handling config change:", err);
      });
    });
  }

  /** Shut down all connections */
  async shutdown(): Promise<void> {
    const disconnects = Array.from(this.connections.values()).map((conn) =>
      conn.disconnect(),
    );
    await Promise.allSettled(disconnects);
    this.connections.clear();
  }

  /** Get status of all connections */
  getConnectionStatuses(): Record<
    string,
    {
      connected: boolean;
      toolCount: number;
      resourceCount: number;
      promptCount: number;
      error?: string;
    }
  > {
    const statuses: Record<
      string,
      {
        connected: boolean;
        toolCount: number;
        resourceCount: number;
        promptCount: number;
        error?: string;
      }
    > = {};

    for (const [key, conn] of this.connections) {
      statuses[key] = {
        connected: conn.status === "connected",
        toolCount: conn.capabilities.tools.length,
        resourceCount: conn.capabilities.resources.length,
        promptCount: conn.capabilities.prompts.length,
        error: conn.error,
      };
    }

    return statuses;
  }

  /** Add and connect a new downstream server */
  private async addConnection(
    serverKey: string,
    config: DownstreamServerConfig,
  ): Promise<void> {
    const connection = new DownstreamConnection(serverKey, config);

    connection.setStatusChangeHandler((_key, status) => {
      if (status === "connected") {
        this.toolRegistry.registerConnection(serverKey, connection);
        this.resourceRegistry.registerConnection(serverKey, connection);
        this.promptRegistry.registerConnection(serverKey, connection);
        this.notifyListChanged();
      } else if (status === "disconnected" || status === "error") {
        // Registries still hold the reference, but capabilities are empty
        // when disconnected, so listTools/etc. will skip this server
        this.notifyListChanged();
      }
    });

    connection.setCapabilitiesChangedHandler((_key) => {
      this.notifyListChanged();
    });

    this.connections.set(serverKey, connection);
    this.toolRegistry.registerConnection(serverKey, connection);
    this.resourceRegistry.registerConnection(serverKey, connection);
    this.promptRegistry.registerConnection(serverKey, connection);

    // Connect in the background (don't block initialization)
    connection.connect().catch((err) => {
      console.error(`[${serverKey}] Initial connection failed:`, err);
    });
  }

  /** Remove and disconnect a downstream server */
  private async removeConnection(serverKey: string): Promise<void> {
    const connection = this.connections.get(serverKey);
    if (!connection) return;

    await connection.disconnect();
    this.connections.delete(serverKey);
    this.toolRegistry.unregisterConnection(serverKey);
    this.resourceRegistry.unregisterConnection(serverKey);
    this.promptRegistry.unregisterConnection(serverKey);
    this.notifyListChanged();
  }

  /** Handle config file changes by diffing old and new configs */
  private async handleConfigChange(
    newConfig: SkillManagementConfig,
    oldConfig: SkillManagementConfig,
  ): Promise<void> {
    const oldKeys = new Set(Object.keys(oldConfig.servers));
    const newKeys = new Set(Object.keys(newConfig.servers));

    // Remove servers that were deleted or disabled
    for (const key of oldKeys) {
      const newServer = newConfig.servers[key];
      if (!newServer || !newServer.enabled) {
        await this.removeConnection(key);
      }
    }

    // Add new servers or update changed ones
    for (const key of newKeys) {
      const newServer = newConfig.servers[key]!;
      const oldServer = oldConfig.servers[key];

      if (!newServer.enabled) continue;

      if (!oldServer || !oldKeys.has(key)) {
        // New server
        await this.addConnection(key, newServer);
      } else if (JSON.stringify(newServer) !== JSON.stringify(oldServer)) {
        // Server config changed - reconnect
        await this.removeConnection(key);
        await this.addConnection(key, newServer);
      }
    }
  }

  /** Send list-changed notifications to the connected MCP client */
  private notifyListChanged(): void {
    if (!this.server) return;

    // Fire and forget - these are notifications
    this.server.sendToolListChanged().catch(() => {});
    this.server.sendResourceListChanged().catch(() => {});
    this.server.sendPromptListChanged().catch(() => {});
  }
}
