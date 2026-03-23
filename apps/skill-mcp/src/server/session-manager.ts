import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import type { ProxyManager } from "../gateway/proxy-manager.js";
import type { SkillManager } from "../skills/skill-manager.js";
import { SKILL_TOOLS } from "../tools/skill-tools.js";
import { GATEWAY_TOOLS } from "../tools/gateway-tools.js";
import { registerRequestHandlers } from "./register-handlers.js";
import type { ProjectConnectionPool } from "./project-connection-pool.js";

/** How long a session can be inactive before it is cleaned up */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** How often to check for inactive sessions */
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export interface SessionEntry {
  server: Server;
  transport: StreamableHTTPServerTransport;
  projectRoot: string | null;
  projectProxy: ProxyManager | null;
  lastActivity: number;
}

/**
 * Manages multiple MCP client sessions.
 * Each session gets its own Server + StreamableHTTPServerTransport pair,
 * but they share the global ProxyManager and SkillManager singletons.
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private globalProxy: ProxyManager,
    private skillManager: SkillManager,
    private projectPool: ProjectConnectionPool,
  ) {}

  /** Get the number of active sessions */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /** Get a transport by session ID */
  getTransport(sessionId: string): StreamableHTTPServerTransport | undefined {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActivity = Date.now();
    }
    return entry?.transport;
  }

  /** Check if a session exists */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Create a new session with global tools only.
   * Project-scoped tools are added later via attachProjectRoot().
   */
  async createSession(): Promise<{
    sessionId: string;
    entry: SessionEntry;
  }> {
    const server = new Server(
      { name: "skill-gateway", version: "0.1.0" },
      {
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true },
          prompts: { listChanged: true },
        },
      },
    );

    // Register handlers with global proxy only (project proxy added later)
    registerRequestHandlers(server, this.globalProxy, null, this.skillManager);

    // Set native tools on global proxy (idempotent)
    this.globalProxy.toolRegistry.setNativeTools([
      ...SKILL_TOOLS,
      ...GATEWAY_TOOLS,
    ]);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        // This is called after the initialize handshake completes
        // We register the session entry here with the real session ID
        const entry: SessionEntry = {
          server,
          transport,
          projectRoot: null,
          projectProxy: null,
          lastActivity: Date.now(),
        };
        this.sessions.set(sessionId, entry);
        console.log(
          `[SessionManager] Session initialized: ${sessionId} (total: ${this.sessions.size})`,
        );
      },
    });

    // Handle transport close
    transport.onclose = () => {
      const sessionId = this.findSessionId(transport);
      if (sessionId) {
        this.removeSession(sessionId);
      }
    };

    // Connect server to transport
    await server.connect(transport);

    // Return a placeholder — the real session ID comes from onsessioninitialized
    // The caller should use the transport directly for the initial request
    return {
      sessionId: "", // Will be set by onsessioninitialized
      entry: {
        server,
        transport,
        projectRoot: null,
        projectProxy: null,
        lastActivity: Date.now(),
      },
    };
  }

  /**
   * Attach a project root to an existing session.
   * This spawns project-scoped downstream connections and
   * re-registers handlers to include project tools.
   */
  async attachProjectRoot(
    sessionId: string,
    projectRoot: string,
  ): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      console.error(
        `[SessionManager] Cannot attach project root: session ${sessionId} not found`,
      );
      return;
    }

    if (entry.projectRoot === projectRoot) {
      return; // Already attached to this root
    }

    // Release previous project proxy if any
    if (entry.projectRoot && entry.projectProxy) {
      this.projectPool.release(entry.projectRoot);
    }

    // Acquire project proxy
    const projectProxy = await this.projectPool.acquire(projectRoot, () => {
      // When project proxy capabilities change, notify this session
      entry.server.sendToolListChanged().catch(() => {});
      entry.server.sendResourceListChanged().catch(() => {});
      entry.server.sendPromptListChanged().catch(() => {});
    });

    entry.projectRoot = projectRoot;
    entry.projectProxy = projectProxy;

    // Re-register handlers with the project proxy
    registerRequestHandlers(
      entry.server,
      this.globalProxy,
      projectProxy,
      this.skillManager,
    );

    // Notify the client that the tool list has changed
    entry.server.sendToolListChanged().catch(() => {});
    entry.server.sendResourceListChanged().catch(() => {});
    entry.server.sendPromptListChanged().catch(() => {});

    console.log(
      `[SessionManager] Attached project root ${projectRoot} to session ${sessionId}`,
    );
  }

  /** Remove a session and release its resources */
  removeSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    // Release project connections
    if (entry.projectRoot) {
      this.projectPool.release(entry.projectRoot);
    }

    // Close the server
    entry.server.close().catch(() => {});

    this.sessions.delete(sessionId);
    console.log(
      `[SessionManager] Session removed: ${sessionId} (total: ${this.sessions.size})`,
    );
  }

  /** Broadcast tool list changed notification to all sessions */
  broadcastToolListChanged(): void {
    for (const [, entry] of this.sessions) {
      entry.server.sendToolListChanged().catch(() => {});
    }
  }

  /** Broadcast resource list changed notification to all sessions */
  broadcastResourceListChanged(): void {
    for (const [, entry] of this.sessions) {
      entry.server.sendResourceListChanged().catch(() => {});
    }
  }

  /** Broadcast prompt list changed notification to all sessions */
  broadcastPromptListChanged(): void {
    for (const [, entry] of this.sessions) {
      entry.server.sendPromptListChanged().catch(() => {});
    }
  }

  /** Start the periodic cleanup timer */
  startCleanupTimer(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, entry] of this.sessions) {
        if (now - entry.lastActivity > SESSION_TIMEOUT_MS) {
          console.log(
            `[SessionManager] Session ${sessionId} timed out (inactive for ${Math.round((now - entry.lastActivity) / 1000 / 60)}min)`,
          );
          this.removeSession(sessionId);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  /** Stop the cleanup timer */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Shut down all sessions */
  async shutdown(): Promise<void> {
    this.stopCleanupTimer();

    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      this.removeSession(sessionId);
    }
  }

  /** Find a session ID by its transport (for onclose handler) */
  private findSessionId(
    transport: StreamableHTTPServerTransport,
  ): string | null {
    for (const [sessionId, entry] of this.sessions) {
      if (entry.transport === transport) {
        return sessionId;
      }
    }
    return null;
  }
}
