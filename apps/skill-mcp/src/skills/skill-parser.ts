import matter from "gray-matter";
import type { Skill, SkillMetadata } from "@repo/shared-types";

/**
 * Parse a skill markdown file with YAML frontmatter.
 *
 * Expected format:
 * ---
 * name: "Skill Name"
 * tags: ["tag1", "tag2"]
 * description: "Short description"
 * version: "1.0"
 * author: "Author"
 * created: "2026-01-01"
 * updated: "2026-01-01"
 * ---
 *
 * # Markdown content here...
 */
export function parseSkillFile(fileContent: string, fileId: string): Skill {
  const { data, content } = matter(fileContent);

  const metadata: SkillMetadata = {
    id: fileId,
    name: typeof data.name === "string" ? data.name : fileId,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    description: typeof data.description === "string" ? data.description : "",
    version: typeof data.version === "string" ? data.version : "1.0",
    author: typeof data.author === "string" ? data.author : "Unknown",
    created: typeof data.created === "string" ? data.created : new Date().toISOString().split("T")[0]!,
    updated: typeof data.updated === "string" ? data.updated : new Date().toISOString().split("T")[0]!,
  };

  return {
    metadata,
    content: content.trim(),
  };
}

/**
 * Extract just the metadata from a skill file (faster than full parse when content not needed).
 */
export function parseSkillMetadata(
  fileContent: string,
  fileId: string,
): SkillMetadata {
  return parseSkillFile(fileContent, fileId).metadata;
}
