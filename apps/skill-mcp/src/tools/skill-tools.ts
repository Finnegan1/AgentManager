import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SkillManager } from "../skills/skill-manager.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/** Native skill tools that are always available on the gateway */
export const SKILL_TOOLS: Tool[] = [
  {
    name: "skills__list",
    description:
      "List all available skills with their metadata (name, tags, description). Use this to discover what skills are available.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "skills__search",
    description:
      "Search for skills by query string. Matches against name, tags, description, and content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to match against skill metadata and content",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "skills__get",
    description:
      "Retrieve the full content of a specific skill by its ID. Use skills__list or skills__search first to find skill IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The skill ID (filename without .md extension)",
        },
      },
      required: ["id"],
    },
  },
];

/** Handle a skill tool call and return the MCP result */
export function handleSkillToolCall(
  toolName: string,
  args: Record<string, unknown>,
  skillManager: SkillManager,
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  switch (toolName) {
    case "skills__list": {
      const skills = skillManager.listSkills();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(skills, null, 2),
          },
        ],
      };
    }

    case "skills__search": {
      const query = args.query as string;
      if (!query) {
        return {
          content: [{ type: "text", text: "Missing required parameter: query" }],
          isError: true,
        };
      }
      const results = skillManager.searchSkills(query);
      return {
        content: [
          {
            type: "text",
            text:
              results.length > 0
                ? JSON.stringify(results, null, 2)
                : `No skills found matching "${query}"`,
          },
        ],
      };
    }

    case "skills__get": {
      const id = args.id as string;
      if (!id) {
        return {
          content: [{ type: "text", text: "Missing required parameter: id" }],
          isError: true,
        };
      }
      const skill = skillManager.getSkill(id);
      if (!skill) {
        return {
          content: [{ type: "text", text: `Skill not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `# ${skill.metadata.name}\n\n**Tags:** ${skill.metadata.tags.join(", ")}\n**Description:** ${skill.metadata.description}\n**Version:** ${skill.metadata.version}\n**Author:** ${skill.metadata.author}\n\n---\n\n${skill.content}`,
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown skill tool: ${toolName}` }],
        isError: true,
      };
  }
}
