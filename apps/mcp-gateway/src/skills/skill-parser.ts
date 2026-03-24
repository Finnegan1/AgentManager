import matter from "gray-matter";
import type { Skill, SkillMetadata, SkillFileInfo } from "@repo/shared-types";

/**
 * Parse a skill's SKILL.md file with YAML frontmatter.
 *
 * Expected format:
 * ---
 * name: "Skill Name"
 * description: "Short description"
 * tags: ["tag1", "tag2"]
 * version: "1.0"
 * author: "Author"
 * created: "2026-01-01"
 * updated: "2026-01-01"
 * # Optional Claude Code fields:
 * allowed-tools: "Read, Grep, Glob"
 * disable-model-invocation: true
 * user-invocable: false
 * context: fork
 * agent: Explore
 * model: haiku
 * argument-hint: "<file>"
 * ---
 *
 * # Markdown content here...
 */
export function parseSkillFile(
  fileContent: string,
  fileId: string,
  files: SkillFileInfo[] = [],
): Skill {
  const { data, content } = matter(fileContent);

  const metadata: SkillMetadata = {
    id: fileId,
    name: typeof data.name === "string" ? data.name : fileId,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    description:
      typeof data.description === "string" ? data.description : "",
    version: typeof data.version === "string" ? data.version : "1.0",
    author: typeof data.author === "string" ? data.author : "",
    created:
      typeof data.created === "string"
        ? data.created
        : new Date().toISOString().split("T")[0]!,
    updated:
      typeof data.updated === "string"
        ? data.updated
        : new Date().toISOString().split("T")[0]!,
    // Claude Code-specific fields (use kebab-case keys from YAML)
    allowedTools:
      typeof data["allowed-tools"] === "string"
        ? data["allowed-tools"]
        : undefined,
    disableModelInvocation:
      typeof data["disable-model-invocation"] === "boolean"
        ? data["disable-model-invocation"]
        : undefined,
    userInvocable:
      typeof data["user-invocable"] === "boolean"
        ? data["user-invocable"]
        : undefined,
    context:
      typeof data.context === "string" ? data.context : undefined,
    agent: typeof data.agent === "string" ? data.agent : undefined,
    model: typeof data.model === "string" ? data.model : undefined,
    argumentHint:
      typeof data["argument-hint"] === "string"
        ? data["argument-hint"]
        : undefined,
  };

  return {
    metadata,
    content: content.trim(),
    files,
  };
}

/**
 * Extract just the metadata from a skill file.
 */
export function parseSkillMetadata(
  fileContent: string,
  fileId: string,
): SkillMetadata {
  return parseSkillFile(fileContent, fileId).metadata;
}

/**
 * Serialize skill metadata and content back to a frontmatter + markdown string.
 * Used for migration and saving.
 */
export function serializeSkill(
  metadata: SkillMetadata,
  content: string,
): string {
  const lines: string[] = ["---"];

  lines.push(`name: "${metadata.name}"`);
  lines.push(
    `description: "${metadata.description.replace(/"/g, '\\"')}"`,
  );
  lines.push(
    `tags: [${metadata.tags.map((t) => `"${t}"`).join(", ")}]`,
  );
  lines.push(`version: "${metadata.version}"`);
  if (metadata.author) {
    lines.push(`author: "${metadata.author}"`);
  }
  if (metadata.created) {
    lines.push(`created: "${metadata.created}"`);
  }
  if (metadata.updated) {
    lines.push(`updated: "${metadata.updated}"`);
  }

  // Claude Code-specific fields
  if (metadata.allowedTools !== undefined) {
    lines.push(`allowed-tools: "${metadata.allowedTools}"`);
  }
  if (metadata.disableModelInvocation !== undefined) {
    lines.push(
      `disable-model-invocation: ${metadata.disableModelInvocation}`,
    );
  }
  if (metadata.userInvocable !== undefined) {
    lines.push(`user-invocable: ${metadata.userInvocable}`);
  }
  if (metadata.context !== undefined) {
    lines.push(`context: ${metadata.context}`);
  }
  if (metadata.agent !== undefined) {
    lines.push(`agent: ${metadata.agent}`);
  }
  if (metadata.model !== undefined) {
    lines.push(`model: ${metadata.model}`);
  }
  if (metadata.argumentHint !== undefined) {
    lines.push(`argument-hint: "${metadata.argumentHint}"`);
  }

  lines.push("---");
  lines.push("");
  lines.push(content);

  return lines.join("\n");
}
