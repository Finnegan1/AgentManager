import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { ConfigStore } from "./config/config-store.js";
import { SkillManager } from "./skills/skill-manager.js";
import { ProxyManager } from "./gateway/proxy-manager.js";
import { SKILL_TOOLS, handleSkillToolCall } from "./tools/skill-tools.js";
import { GATEWAY_TOOLS, handleGatewayToolCall } from "./tools/gateway-tools.js";
import type { GatewayStatus } from "@repo/shared-types";

const STATUS_PATH = path.join(os.homedir(), ".skill-management", "status.json");

// --- Initialize core components ---

const configStore = new ConfigStore();
const skillManager = new SkillManager(configStore.config.skills.directory);
const proxyManager = new ProxyManager(configStore);

// Update skill manager when config changes
configStore.on("changed", (newConfig) => {
  skillManager.setDirectory(newConfig.skills.directory);
});

// --- Create the low-level MCP Server ---

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

// Give proxy manager a reference to the server for notifications
proxyManager.setServer(server);

// Set native tools on the tool registry
proxyManager.toolRegistry.setNativeTools([...SKILL_TOOLS, ...GATEWAY_TOOLS]);

// --- Register MCP Request Handlers ---

// Tools: List
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = proxyManager.toolRegistry.listTools();
  return { tools };
});

// Tools: Call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args ?? {}) as Record<string, unknown>;

  // Check if it's a native skill tool
  if (name.startsWith("skills__")) {
    return handleSkillToolCall(name, toolArgs, skillManager);
  }

  // Check if it's a gateway meta-tool
  if (name.startsWith("gateway__")) {
    return handleGatewayToolCall(name, toolArgs, proxyManager);
  }

  // Try to resolve as a proxied tool
  const resolved = proxyManager.toolRegistry.resolveToolCall(name);
  if (!resolved) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  return await resolved.connection.callTool(resolved.originalName, toolArgs);
});

// Resources: List
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = proxyManager.resourceRegistry.listResources();
  return { resources };
});

// Resources: List Templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  const resourceTemplates =
    proxyManager.resourceRegistry.listResourceTemplates();
  return { resourceTemplates };
});

// Resources: Read
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const resolved = proxyManager.resourceRegistry.resolveResourceRead(uri);
  if (!resolved) {
    throw new Error(`Unknown resource URI: ${uri}`);
  }

  return await resolved.connection.readResource(resolved.originalUri);
});

// Prompts: List
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts = proxyManager.promptRegistry.listPrompts();
  return { prompts };
});

// Prompts: Get
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const resolved = proxyManager.promptRegistry.resolvePromptGet(name);
  if (!resolved) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  return await resolved.connection.getPrompt(
    resolved.originalName,
    args as Record<string, string> | undefined,
  );
});

// --- Status file management ---

function writeStatusFile(): void {
  const status: GatewayStatus = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    servers: proxyManager.getConnectionStatuses(),
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
  // Initialize proxy connections from config
  await proxyManager.initialize();

  // Start watching config for changes
  configStore.startWatching();

  // Write initial status
  writeStatusFile();

  // Periodically update status file
  const statusInterval = setInterval(writeStatusFile, 5000);

  // Connect MCP server to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  const shutdown = async () => {
    clearInterval(statusInterval);
    configStore.stopWatching();
    await proxyManager.shutdown();
    removeStatusFile();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.error("Skill Gateway MCP server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  removeStatusFile();
  process.exit(1);
});
