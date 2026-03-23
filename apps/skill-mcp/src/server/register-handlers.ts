import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ProxyManager } from "../gateway/proxy-manager.js";
import type { SkillManager } from "../skills/skill-manager.js";
import type { SkillSymlinker } from "../skills/skill-symlink.js";
import { handleSkillToolCall } from "../tools/skill-tools.js";
import { handleGatewayToolCall } from "../tools/gateway-tools.js";

/**
 * Register all MCP request handlers on a Server instance.
 * Merges tools/resources/prompts from a global ProxyManager
 * and an optional project-scoped ProxyManager.
 */
export function registerRequestHandlers(
  server: Server,
  globalProxy: ProxyManager,
  projectProxy: ProxyManager | null,
  skillManager: SkillManager,
  symlinker?: SkillSymlinker,
): void {
  // Tools: List — merge global + project tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const globalTools = globalProxy.toolRegistry.listTools();
    const projectTools = projectProxy
      ? projectProxy.toolRegistry.listTools()
      : [];
    return { tools: [...globalTools, ...projectTools] };
  });

  // Tools: Call — try project first, then global
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, unknown>;

    // Check if it's a native skill tool
    if (name.startsWith("skills__")) {
      return handleSkillToolCall(name, toolArgs, skillManager, symlinker);
    }

    // Check if it's a gateway meta-tool
    if (name.startsWith("gateway__")) {
      return handleGatewayToolCall(name, toolArgs, globalProxy);
    }

    // Try project proxy first (project-scoped tools take priority)
    if (projectProxy) {
      const resolved = projectProxy.toolRegistry.resolveToolCall(name);
      if (resolved) {
        return await resolved.connection.callTool(
          resolved.originalName,
          toolArgs,
        );
      }
    }

    // Fall back to global proxy
    const resolved = globalProxy.toolRegistry.resolveToolCall(name);
    if (!resolved) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return await resolved.connection.callTool(resolved.originalName, toolArgs);
  });

  // Resources: List — merge global + project
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const globalResources = globalProxy.resourceRegistry.listResources();
    const projectResources = projectProxy
      ? projectProxy.resourceRegistry.listResources()
      : [];
    return { resources: [...globalResources, ...projectResources] };
  });

  // Resources: List Templates — merge global + project
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    const globalTemplates =
      globalProxy.resourceRegistry.listResourceTemplates();
    const projectTemplates = projectProxy
      ? projectProxy.resourceRegistry.listResourceTemplates()
      : [];
    return {
      resourceTemplates: [...globalTemplates, ...projectTemplates],
    };
  });

  // Resources: Read — try project first, then global
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (projectProxy) {
      const resolved =
        projectProxy.resourceRegistry.resolveResourceRead(uri);
      if (resolved) {
        return await resolved.connection.readResource(resolved.originalUri);
      }
    }

    const resolved = globalProxy.resourceRegistry.resolveResourceRead(uri);
    if (!resolved) {
      throw new Error(`Unknown resource URI: ${uri}`);
    }

    return await resolved.connection.readResource(resolved.originalUri);
  });

  // Prompts: List — merge global + project
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const globalPrompts = globalProxy.promptRegistry.listPrompts();
    const projectPrompts = projectProxy
      ? projectProxy.promptRegistry.listPrompts()
      : [];
    return { prompts: [...globalPrompts, ...projectPrompts] };
  });

  // Prompts: Get — try project first, then global
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (projectProxy) {
      const resolved = projectProxy.promptRegistry.resolvePromptGet(name);
      if (resolved) {
        return await resolved.connection.getPrompt(
          resolved.originalName,
          args as Record<string, string> | undefined,
        );
      }
    }

    const resolved = globalProxy.promptRegistry.resolvePromptGet(name);
    if (!resolved) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    return await resolved.connection.getPrompt(
      resolved.originalName,
      args as Record<string, string> | undefined,
    );
  });
}
