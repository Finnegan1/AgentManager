import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const SKILL_FILE = "SKILL.md";
const CLAUDE_SKILLS_DIR = path.join(os.homedir(), ".claude", "skills");

/**
 * Manages symlinks from ~/.claude/skills/<name> → source skills directory.
 *
 * This allows Claude Code to auto-discover skills created in the Skill Gateway.
 * Only creates/removes symlinks — never touches non-symlink entries in the
 * target directory (user may have manually created skills there).
 */
export class SkillSymlinker {
  constructor(
    private sourceDir: string,
    private targetDir: string = CLAUDE_SKILLS_DIR,
  ) {}

  /** Update the source directory (e.g., after config change) */
  setSourceDir(dir: string): void {
    this.sourceDir = dir;
  }

  /**
   * Sync all symlinks: create missing ones, remove stale ones.
   */
  syncAll(): void {
    // Ensure target directory exists
    if (!fs.existsSync(this.targetDir)) {
      fs.mkdirSync(this.targetDir, { recursive: true });
    }

    const sourceSkills = this.getSourceSkillIds();
    const existingLinks = this.getExistingSymlinks();

    // Create symlinks for skills that don't have one yet
    for (const skillId of sourceSkills) {
      if (!existingLinks.has(skillId)) {
        this.linkOne(skillId);
      } else {
        // Verify existing symlink still points to the right place
        const linkPath = path.join(this.targetDir, skillId);
        try {
          const target = fs.readlinkSync(linkPath);
          const expectedTarget = path.join(this.sourceDir, skillId);
          if (path.resolve(target) !== path.resolve(expectedTarget)) {
            // Symlink points somewhere else — update it
            fs.unlinkSync(linkPath);
            this.linkOne(skillId);
          }
        } catch {
          // readlink failed — re-create
          try {
            fs.unlinkSync(linkPath);
          } catch {
            // ignore
          }
          this.linkOne(skillId);
        }
      }
    }

    // Remove symlinks that point into our source dir but no longer have a source
    for (const linkName of existingLinks) {
      if (!sourceSkills.has(linkName)) {
        this.unlinkOne(linkName);
      }
    }
  }

  /** Create a symlink for a single skill */
  linkOne(skillId: string): void {
    const sourcePath = path.join(this.sourceDir, skillId);
    const linkPath = path.join(this.targetDir, skillId);

    try {
      // Don't overwrite non-symlinks
      if (fs.existsSync(linkPath)) {
        const stat = fs.lstatSync(linkPath);
        if (!stat.isSymbolicLink()) {
          console.error(
            `[symlink] Skipping ${skillId}: non-symlink entry already exists at ${linkPath}`,
          );
          return;
        }
        // Remove existing symlink to recreate
        fs.unlinkSync(linkPath);
      }

      fs.symlinkSync(sourcePath, linkPath, "dir");
      console.error(`[symlink] Linked ${skillId} → ${sourcePath}`);
    } catch (err) {
      console.error(`[symlink] Failed to link ${skillId}:`, err);
    }
  }

  /** Remove a symlink for a single skill (only if it's actually a symlink) */
  unlinkOne(skillId: string): void {
    const linkPath = path.join(this.targetDir, skillId);

    try {
      if (!fs.existsSync(linkPath)) return;

      const stat = fs.lstatSync(linkPath);
      if (!stat.isSymbolicLink()) {
        // Never remove non-symlinks
        return;
      }

      // Only remove if it points into our source directory
      const target = fs.readlinkSync(linkPath);
      const resolvedTarget = path.resolve(path.dirname(linkPath), target);
      if (resolvedTarget.startsWith(path.resolve(this.sourceDir))) {
        fs.unlinkSync(linkPath);
        console.error(`[symlink] Unlinked ${skillId}`);
      }
    } catch (err) {
      console.error(`[symlink] Failed to unlink ${skillId}:`, err);
    }
  }

  /** Get all skill IDs from the source directory (directories containing SKILL.md) */
  private getSourceSkillIds(): Set<string> {
    if (!fs.existsSync(this.sourceDir)) {
      return new Set();
    }

    const ids = new Set<string>();
    const entries = fs.readdirSync(this.sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(this.sourceDir, entry.name, SKILL_FILE);
      if (fs.existsSync(skillMd)) {
        ids.add(entry.name);
      }
    }

    return ids;
  }

  /**
   * Get symlinks in the target directory that point into our source directory.
   * Returns a set of link names.
   */
  private getExistingSymlinks(): Set<string> {
    const links = new Set<string>();

    if (!fs.existsSync(this.targetDir)) {
      return links;
    }

    const entries = fs.readdirSync(this.targetDir, { withFileTypes: true });

    for (const entry of entries) {
      const linkPath = path.join(this.targetDir, entry.name);
      try {
        const stat = fs.lstatSync(linkPath);
        if (!stat.isSymbolicLink()) continue;

        const target = fs.readlinkSync(linkPath);
        const resolvedTarget = path.resolve(
          path.dirname(linkPath),
          target,
        );
        if (resolvedTarget.startsWith(path.resolve(this.sourceDir))) {
          links.add(entry.name);
        }
      } catch {
        // Skip entries we can't inspect
      }
    }

    return links;
  }
}
