import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { ConfigStore } from "./config/config-store.js";
import { SkillManager } from "./skills/skill-manager.js";
import { ProxyManager } from "./gateway/proxy-manager.js";
import { SessionManager } from "./server/session-manager.js";
import { ProjectConnectionPool } from "./server/project-connection-pool.js";
import { createHttpServer } from "./server/http-server.js";
import type { GatewayStatus } from "@repo/shared-types";

const STATUS_PATH = path.join(os.homedir(), ".skill-management", "status.json");
const DEFAULT_PORT = 24842;
const DEFAULT_HOST = "127.0.0.1";

// --- Parse CLI arguments ---

const args = process.argv.slice(2);
const portArgIndex = args.indexOf("--port");
const port =
  portArgIndex !== -1 && args[portArgIndex + 1]
    ? parseInt(args[portArgIndex + 1]!, 10)
    : DEFAULT_PORT;

// --- Initialize shared core components ---

const configStore = new ConfigStore();
const skillManager = new SkillManager(configStore.config.skills.directory);

// Update skill manager when config changes
configStore.on("changed", (newConfig) => {
  skillManager.setDirectory(newConfig.skills.directory);
});

// Log config store errors instead of crashing (unhandled "error" events
// on EventEmitter cause the process to exit)
configStore.on("error", (err) => {
  console.error("Config store error:", err);
});

// --- Status file management ---

let globalProxy: ProxyManager | undefined;
let sessionManager: SessionManager | undefined;

function writeStatusFile(): void {
  const status: GatewayStatus = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    port,
    url: `http://${DEFAULT_HOST}:${port}/mcp`,
    activeSessions: sessionManager?.sessionCount ?? 0,
    servers: globalProxy?.getConnectionStatuses() ?? {},
  };

  try {
    const dir = path.dirname(STATUS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = STATUS_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(status, null, 2), "utf-8");
    fs.renameSync(tmpPath, STATUS_PATH);
  } catch (err) {
    console.error("Failed to write status file:", err);
  }
}

function removeStatusFile(): void {
  try {
    if (fs.existsSync(STATUS_PATH)) {
      fs.unlinkSync(STATUS_PATH);
    }
  } catch {
    // Ignore removal errors
  }
}

// --- Main startup ---

async function main() {
  const hostname = DEFAULT_HOST;
  const url = `http://${hostname}:${port}/mcp`;

  // Create global proxy (only manages global-scope servers)
  globalProxy = new ProxyManager(configStore, { scopeFilter: "global" });

  // Create project connection pool
  const projectPool = new ProjectConnectionPool(configStore);

  // Create session manager
  sessionManager = new SessionManager(globalProxy, skillManager, projectPool);

  // Wire up the global proxy to broadcast via session manager
  globalProxy.setBroadcaster(sessionManager);

  // Initialize global proxy (connects to global-scope servers)
  await globalProxy.initialize();

  // Start watching config for changes
  configStore.startWatching();

  // Create HTTP server
  const httpServer = createHttpServer({
    port,
    hostname,
    sessionManager,
    onSessionInitialized: async (sessionId: string) => {
      // After initialize, try to query the client for its project root
      // via the MCP roots/list protocol
      // For now, we rely on the X-Project-Root header as primary mechanism
      // TODO: Implement roots/list request once SDK exposes server-to-client requests
      console.log(
        `[HTTP] Session ${sessionId} initialized, waiting for project root header`,
      );
    },
  });

  // Start the HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, hostname, () => {
      resolve();
    });
  });

  // Start session cleanup timer
  sessionManager.startCleanupTimer();

  // Write initial status and periodically update
  writeStatusFile();
  const statusInterval = setInterval(writeStatusFile, 5000);

  // Graceful shutdown
  const shutdown = async () => {
    clearInterval(statusInterval);
    configStore.stopWatching();
    await sessionManager!.shutdown();
    await projectPool.shutdown();
    await globalProxy!.shutdown();
    httpServer.close();
    removeStatusFile();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.error(`Skill Gateway MCP server started`);
  console.error(`  URL: ${url}`);
  console.error(`  Port: ${port}`);
  console.error(`  Host: ${hostname}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  removeStatusFile();
  process.exit(1);
});
