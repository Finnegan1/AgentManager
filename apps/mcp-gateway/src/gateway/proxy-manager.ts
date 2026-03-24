import type { SkillManagementConfig, DownstreamServerConfig, ServerScope } from "@repo/shared-types";
import { DownstreamConnection } from "./downstream-connection.js";
import { ToolRegistry } from "./tool-registry.js";
import { ResourceRegistry } from "./resource-registry.js";
import { PromptRegistry } from "./prompt-registry.js";
import type { ConfigStore } from "../config/config-store.js";

/** Options for controlling which servers the ProxyManager manages */
export interface ProxyManagerOptions {
  /** Filter servers by scope: "global" or "project" */
  scopeFilter: ServerScope;
  /**
   * Project root path for project-scoped ProxyManagers.
   * When set, downstream stdio connections use this as their cwd.
   */
  projectRoot?: string;
}

/** Interface for broadcasting notifications to all connected sessions */
export interface NotificationBroadcaster {
  broadcastToolListChanged(): void;
  broadcastResourceListChanged(): void;
  broadcastPromptListChanged(): void;
}

/**
 * Orchestrates downstream MCP server connections.
 * Manages the lifecycle of connections and updates registries
 * when config changes or servers connect/disconnect.
 *
 * Each ProxyManager instance manages either global-scope or
 * project-scope servers, determined by the scopeFilter option.
 */
export class ProxyManager {
  readonly toolRegistry = new ToolRegistry();
  readonly resourceRegistry = new ResourceRegistry();
  readonly promptRegistry = new PromptRegistry();

  private connections = new Map<string, DownstreamConnection>();
  private broadcaster: NotificationBroadcaster | null = null;
  private scopeFilter: ServerScope;
  private projectRoot: string | undefined;

  constructor(
    private configStore: ConfigStore,
    options: ProxyManagerOptions,
  ) {
    this.scopeFilter = options.scopeFilter;
    this.projectRoot = options.projectRoot;
  }

  /** Set the broadcaster for sending notifications to all connected sessions */
  setBroadcaster(broadcaster: NotificationBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  /** Check if a server config matches this manager's scope filter */
  private matchesScope(config: DownstreamServerConfig): boolean {
    const serverScope = config.scope ?? "global";
    return serverScope === this.scopeFilter;
  }

  /** Initialize connections based on current config */
  async initialize(): Promise<void> {
    const config = this.configStore.config;

    for (const [serverKey, serverConfig] of Object.entries(config.servers)) {
      if (serverConfig.enabled && this.matchesScope(serverConfig)) {
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
    // For project-scoped managers, override cwd on stdio transports
    let effectiveConfig = config;
    if (this.projectRoot && config.transport.type === "stdio") {
      effectiveConfig = {
        ...config,
        transport: {
          ...config.transport,
          cwd: this.projectRoot,
        },
      };
    }

    const connection = new DownstreamConnection(serverKey, effectiveConfig);

    connection.setStatusChangeHandler((_key, status) => {
      if (status === "connected") {
        this.toolRegistry.registerConnection(serverKey, connection);
        this.resourceRegistry.registerConnection(serverKey, connection);
        this.promptRegistry.registerConnection(serverKey, connection);
        this.notifyListChanged();
      } else if (status === "disconnected" || status === "error") {
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

    // Remove servers that were deleted, disabled, or no longer match scope
    for (const key of oldKeys) {
      const newServer = newConfig.servers[key];
      if (!newServer || !newServer.enabled || !this.matchesScope(newServer)) {
        if (this.connections.has(key)) {
          await this.removeConnection(key);
        }
      }
    }

    // Add new servers or update changed ones
    for (const key of newKeys) {
      const newServer = newConfig.servers[key]!;
      const oldServer = oldConfig.servers[key];

      if (!newServer.enabled || !this.matchesScope(newServer)) continue;

      if (!oldServer || !oldKeys.has(key) || !this.matchesScope(oldServer)) {
        await this.addConnection(key, newServer);
      } else if (JSON.stringify(newServer) !== JSON.stringify(oldServer)) {
        await this.removeConnection(key);
        await this.addConnection(key, newServer);
      }
    }
  }

  /** Broadcast list-changed notifications to all connected sessions */
  private notifyListChanged(): void {
    if (!this.broadcaster) return;

    this.broadcaster.broadcastToolListChanged();
    this.broadcaster.broadcastResourceListChanged();
    this.broadcaster.broadcastPromptListChanged();
  }
}
