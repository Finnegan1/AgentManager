import * as fs from "node:fs";
import * as path from "node:path";
import type { Skill, SkillMetadata } from "@repo/shared-types";
import { parseSkillFile, parseSkillMetadata } from "./skill-parser.js";

/**
 * Manages skill markdown files on disk.
 * Provides list, search, and get operations.
 */
export class SkillManager {
  constructor(private skillsDirectory: string) {}

  /** Update the skills directory path (e.g., after config change) */
  setDirectory(dir: string): void {
    this.skillsDirectory = dir;
  }

  /** List all available skills (metadata only) */
  listSkills(): SkillMetadata[] {
    const files = this.getSkillFiles();
    const skills: SkillMetadata[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(
          path.join(this.skillsDirectory, file),
          "utf-8",
        );
        const id = path.basename(file, ".md");
        skills.push(parseSkillMetadata(content, id));
      } catch (err) {
        console.error(`Failed to parse skill file ${file}:`, err);
      }
    }

    return skills;
  }

  /**
   * Search skills by query string.
   * Matches against name, tags, description, and content (case-insensitive).
   */
  searchSkills(query: string): SkillMetadata[] {
    const lowerQuery = query.toLowerCase();
    const files = this.getSkillFiles();
    const results: SkillMetadata[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(
          path.join(this.skillsDirectory, file),
          "utf-8",
        );
        const id = path.basename(file, ".md");
        const skill = parseSkillFile(content, id);

        const searchable = [
          skill.metadata.name,
          skill.metadata.description,
          ...skill.metadata.tags,
          skill.content,
        ]
          .join(" ")
          .toLowerCase();

        if (searchable.includes(lowerQuery)) {
          results.push(skill.metadata);
        }
      } catch (err) {
        console.error(`Failed to parse skill file ${file}:`, err);
      }
    }

    return results;
  }

  /** Get a single skill by its ID (filename without .md) */
  getSkill(skillId: string): Skill | null {
    const filePath = path.join(this.skillsDirectory, `${skillId}.md`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return parseSkillFile(content, skillId);
    } catch (err) {
      console.error(`Failed to read skill ${skillId}:`, err);
      return null;
    }
  }

  /** Get all .md files in the skills directory */
  private getSkillFiles(): string[] {
    if (!fs.existsSync(this.skillsDirectory)) {
      return [];
    }

    return fs.readdirSync(this.skillsDirectory).filter((f) => f.endsWith(".md"));
  }
}
