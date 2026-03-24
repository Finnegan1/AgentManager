import type {
  SkillManagementConfig,
  DownstreamServerConfig,
} from "@repo/shared-types";
import { ProxyManager } from "../gateway/proxy-manager.js";
import type { ConfigStore } from "../config/config-store.js";

interface ProjectPool {
  proxyManager: ProxyManager;
  refCount: number;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

/** How long to keep a project pool alive after the last session disconnects */
const POOL_CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Manages per-project-root ProxyManager instances.
 * Sessions sharing the same project root share a single ProxyManager
 * (and thus the same downstream connections).
 */
export class ProjectConnectionPool {
  private pools = new Map<string, ProjectPool>();
  private configStoreListenerSetUp = false;

  constructor(private configStore: ConfigStore) {}

  /** Get all active project roots and their connection statuses */
  getPoolStatuses(): Record<
    string,
    { refCount: number; servers: ReturnType<ProxyManager["getConnectionStatuses"]> }
  > {
    const statuses: Record<
      string,
      { refCount: number; servers: ReturnType<ProxyManager["getConnectionStatuses"]> }
    > = {};

    for (const [rootUri, pool] of this.pools) {
      statuses[rootUri] = {
        refCount: pool.refCount,
        servers: pool.proxyManager.getConnectionStatuses(),
      };
    }

    return statuses;
  }

  /**
   * Acquire a ProxyManager for a project root.
   * Creates one if it doesn't exist, increments refCount if it does.
   * The returned ProxyManager only manages servers with scope === "project".
   */
  async acquire(
    rootUri: string,
    notifyCallback?: () => void,
  ): Promise<ProxyManager> {
    const existing = this.pools.get(rootUri);

    if (existing) {
      // Cancel any pending cleanup
      if (existing.cleanupTimer) {
        clearTimeout(existing.cleanupTimer);
        existing.cleanupTimer = null;
      }
      existing.refCount++;
      return existing.proxyManager;
    }

    // Create a new ProxyManager for this project root
    const proxyManager = new ProxyManager(this.configStore, {
      scopeFilter: "project",
      projectRoot: this.uriToPath(rootUri),
    });

    await proxyManager.initialize();

    const pool: ProjectPool = {
      proxyManager,
      refCount: 1,
      cleanupTimer: null,
    };

    this.pools.set(rootUri, pool);

    // Set up config change listener once
    if (!this.configStoreListenerSetUp) {
      this.configStoreListenerSetUp = true;
      this.configStore.on("changed", (newConfig, oldConfig) => {
        this.handleConfigChange(newConfig, oldConfig).catch((err) => {
          console.error(
            "[ProjectConnectionPool] Error handling config change:",
            err,
          );
        });
      });
    }

    return proxyManager;
  }

  /**
   * Release a reference to a project root's ProxyManager.
   * When refCount reaches 0, starts a cleanup timer.
   */
  release(rootUri: string): void {
    const pool = this.pools.get(rootUri);
    if (!pool) return;

    pool.refCount--;

    if (pool.refCount <= 0) {
      pool.refCount = 0;

      // Start cleanup timer — shutdown after delay
      pool.cleanupTimer = setTimeout(async () => {
        // Double-check refCount hasn't increased
        if (pool.refCount <= 0) {
          await pool.proxyManager.shutdown();
          this.pools.delete(rootUri);
          console.log(
            `[ProjectConnectionPool] Cleaned up pool for ${rootUri}`,
          );
        }
      }, POOL_CLEANUP_DELAY_MS);
    }
  }

  /** Shut down all project pools */
  async shutdown(): Promise<void> {
    const shutdowns = Array.from(this.pools.values()).map(async (pool) => {
      if (pool.cleanupTimer) {
        clearTimeout(pool.cleanupTimer);
      }
      await pool.proxyManager.shutdown();
    });
    await Promise.allSettled(shutdowns);
    this.pools.clear();
  }

  /**
   * Handle config changes by re-initializing all active project pools.
   * This ensures new project-scope servers are picked up.
   */
  private async handleConfigChange(
    _newConfig: SkillManagementConfig,
    _oldConfig: SkillManagementConfig,
  ): Promise<void> {
    // ProxyManager's own config change handler (set up in initialize())
    // already handles the diffing and reconnection logic.
    // No additional work needed here — each pool's ProxyManager
    // listens to configStore changes independently.
  }

  /** Convert a file:// URI to a filesystem path */
  private uriToPath(uri: string): string {
    if (uri.startsWith("file://")) {
      return decodeURIComponent(uri.slice(7));
    }
    return uri;
  }
}
