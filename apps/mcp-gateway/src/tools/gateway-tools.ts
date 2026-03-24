import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ProxyManager } from "../gateway/proxy-manager.js";

/** Meta tools for inspecting gateway status */
export const GATEWAY_TOOLS: Tool[] = [
  {
    name: "gateway__list_servers",
    description:
      "List all configured downstream MCP servers and their connection status, including tool/resource/prompt counts.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "gateway__server_status",
    description:
      "Get detailed status of a specific downstream MCP server by its key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        server_key: {
          type: "string",
          description: "The server key (identifier) to get status for",
        },
      },
      required: ["server_key"],
    },
  },
];

/** Handle a gateway meta-tool call */
export function handleGatewayToolCall(
  toolName: string,
  args: Record<string, unknown>,
  proxyManager: ProxyManager,
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  switch (toolName) {
    case "gateway__list_servers": {
      const statuses = proxyManager.getConnectionStatuses();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(statuses, null, 2),
          },
        ],
      };
    }

    case "gateway__server_status": {
      const serverKey = args.server_key as string;
      if (!serverKey) {
        return {
          content: [
            { type: "text", text: "Missing required parameter: server_key" },
          ],
          isError: true,
        };
      }

      const statuses = proxyManager.getConnectionStatuses();
      const status = statuses[serverKey];

      if (!status) {
        return {
          content: [
            {
              type: "text",
              text: `Server not found: ${serverKey}. Available servers: ${Object.keys(statuses).join(", ") || "none"}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ [serverKey]: status }, null, 2),
          },
        ],
      };
    }

    default:
      return {
        content: [
          { type: "text", text: `Unknown gateway tool: ${toolName}` },
        ],
        isError: true,
      };
  }
}
