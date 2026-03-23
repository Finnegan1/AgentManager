import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SkillManager } from "../skills/skill-manager.js";
import type { SkillSymlinker } from "../skills/skill-symlink.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { installSkillFromCommand, MarketplaceError } from "../skills/marketplace-client.js";

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
      "Retrieve the full content of a specific skill by its ID, including a list of additional files in the skill directory. Use skills__list or skills__search first to find skill IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The skill ID (directory name)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "skills__sync",
    description:
      "Manually trigger a symlink sync from the skills directory to ~/.claude/skills/. Useful after creating or deleting skills.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "skills__marketplace_install",
    description:
      "Install a skill from the skills.sh marketplace. Paste the install command from skills.sh (e.g., npx skills add https://github.com/mattpocock/skills --skill grill-me).",
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description:
            'The install command from skills.sh, e.g. "npx skills add https://github.com/owner/repo --skill skill-name"',
        },
      },
      required: ["command"],
    },
  },
];

/** Handle a skill tool call and return the MCP result */
export async function handleSkillToolCall(
  toolName: string,
  args: Record<string, unknown>,
  skillManager: SkillManager,
  symlinker?: SkillSymlinker,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
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

      // Build file listing if there are additional files
      let filesSection = "";
      if (skill.files.length > 0) {
        const filesList = skill.files
          .map((f) => `- ${f.isDirectory ? "📁" : "📄"} ${f.relativePath}${f.isDirectory ? "/" : ` (${f.size} bytes)`}`)
          .join("\n");
        filesSection = `\n\n---\n\n**Files in skill directory:**\n${filesList}`;
      }

      return {
        content: [
          {
            type: "text",
            text: `# ${skill.metadata.name}\n\n**Tags:** ${skill.metadata.tags.join(", ")}\n**Description:** ${skill.metadata.description}\n**Version:** ${skill.metadata.version}\n**Author:** ${skill.metadata.author}\n\n---\n\n${skill.content}${filesSection}`,
          },
        ],
      };
    }

    case "skills__sync": {
      if (!symlinker) {
        return {
          content: [{ type: "text", text: "Symlinker not available" }],
          isError: true,
        };
      }
      symlinker.syncAll();
      const skills = skillManager.listSkills();
      return {
        content: [
          {
            type: "text",
            text: `Symlink sync complete. ${skills.length} skill(s) linked to ~/.claude/skills/:\n${skills.map((s) => `- ${s.id}`).join("\n")}`,
          },
        ],
      };
    }

    case "skills__marketplace_install": {
      const command = args.command as string;
      if (!command) {
        return {
          content: [{ type: "text", text: "Missing required parameter: command" }],
          isError: true,
        };
      }
      try {
        const result = await installSkillFromCommand(
          command,
          skillManager.getDirectory(),
        );
        if (symlinker) {
          symlinker.syncAll();
        }
        return {
          content: [
            {
              type: "text",
              text: `Successfully installed skill "${result.skillName}" from ${result.source}. It is now available in ~/.claude/skills/.`,
            },
          ],
        };
      } catch (err) {
        const message =
          err instanceof MarketplaceError
            ? err.message
            : `Failed to install skill: ${err}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown skill tool: ${toolName}` }],
        isError: true,
      };
  }
}
