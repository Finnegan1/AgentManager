import * as fs from "node:fs";
import * as path from "node:path";
import type { Skill, SkillMetadata, SkillFileInfo } from "@repo/shared-types";
import { parseSkillFile, parseSkillMetadata } from "./skill-parser.js";

const SKILL_FILE = "SKILL.md";

/**
 * Manages directory-based skills on disk.
 *
 * Each skill is a directory containing a SKILL.md file and optional
 * subdirectories (references/, scripts/, assets/, etc.).
 *
 * Layout:
 *   <skillsDirectory>/
 *     <skill-id>/
 *       SKILL.md          (required - main content with frontmatter)
 *       references/        (optional)
 *       scripts/           (optional)
 *       assets/            (optional)
 */
export class SkillManager {
  constructor(private skillsDirectory: string) {}

  /** Update the skills directory path (e.g., after config change) */
  setDirectory(dir: string): void {
    this.skillsDirectory = dir;
  }

  /** Get the current skills directory path */
  getDirectory(): string {
    return this.skillsDirectory;
  }

  /** List all available skills (metadata only) */
  listSkills(): SkillMetadata[] {
    const dirs = this.getSkillDirectories();
    const skills: SkillMetadata[] = [];

    for (const dirName of dirs) {
      try {
        const skillMdPath = path.join(
          this.skillsDirectory,
          dirName,
          SKILL_FILE,
        );
        const content = fs.readFileSync(skillMdPath, "utf-8");
        skills.push(parseSkillMetadata(content, dirName));
      } catch (err) {
        console.error(`Failed to parse skill ${dirName}:`, err);
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
    const dirs = this.getSkillDirectories();
    const results: SkillMetadata[] = [];

    for (const dirName of dirs) {
      try {
        const skillMdPath = path.join(
          this.skillsDirectory,
          dirName,
          SKILL_FILE,
        );
        const fileContent = fs.readFileSync(skillMdPath, "utf-8");
        const files = this.listSkillFilesInternal(dirName);
        const skill = parseSkillFile(fileContent, dirName, files);

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
        console.error(`Failed to parse skill ${dirName}:`, err);
      }
    }

    return results;
  }

  /** Get a single skill by its ID (directory name) */
  getSkill(skillId: string): Skill | null {
    const skillDir = path.join(this.skillsDirectory, skillId);
    const skillMdPath = path.join(skillDir, SKILL_FILE);

    if (!fs.existsSync(skillMdPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const files = this.listSkillFilesInternal(skillId);
      return parseSkillFile(content, skillId, files);
    } catch (err) {
      console.error(`Failed to read skill ${skillId}:`, err);
      return null;
    }
  }

  /** List all files in a skill directory (excluding SKILL.md), recursively */
  listSkillFiles(skillId: string): SkillFileInfo[] {
    return this.listSkillFilesInternal(skillId);
  }

  /** Get all subdirectories in the skills directory that contain SKILL.md */
  private getSkillDirectories(): string[] {
    if (!fs.existsSync(this.skillsDirectory)) {
      return [];
    }

    return fs
      .readdirSync(this.skillsDirectory, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        const skillMd = path.join(
          this.skillsDirectory,
          entry.name,
          SKILL_FILE,
        );
        return fs.existsSync(skillMd);
      })
      .map((entry) => entry.name);
  }

  /** Recursively list files within a skill directory (excluding SKILL.md) */
  private listSkillFilesInternal(skillId: string): SkillFileInfo[] {
    const skillDir = path.join(this.skillsDirectory, skillId);
    if (!fs.existsSync(skillDir)) {
      return [];
    }

    const results: SkillFileInfo[] = [];
    const walk = (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relativePath = prefix
          ? `${prefix}/${entry.name}`
          : entry.name;

        // Skip SKILL.md at root level
        if (!prefix && entry.name === SKILL_FILE) continue;

        if (entry.isDirectory()) {
          results.push({
            relativePath,
            isDirectory: true,
            size: 0,
          });
          walk(path.join(dir, entry.name), relativePath);
        } else {
          const stat = fs.statSync(path.join(dir, entry.name));
          results.push({
            relativePath,
            isDirectory: false,
            size: stat.size,
          });
        }
      }
    };

    walk(skillDir, "");
    return results;
  }
}
