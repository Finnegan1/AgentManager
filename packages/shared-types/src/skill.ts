/** Base metadata shared across all AI agent platforms */
export interface BaseSkillMetadata {
  /** Unique identifier derived from directory name */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Tags for categorization and search */
  tags: string[];
  /** Short description of the skill */
  description: string;
  /** Semantic version string */
  version: string;
  /** Author of the skill */
  author: string;
  /** ISO date string of creation */
  created: string;
  /** ISO date string of last update */
  updated: string;
}

/** Claude Code-specific metadata (extends base with Claude Code frontmatter fields) */
export interface ClaudeSkillMetadata extends BaseSkillMetadata {
  /** Pre-approved tools, e.g. "Read, Grep, Glob, Bash" */
  allowedTools?: string;
  /** If true, only users can invoke via /name (Claude cannot auto-trigger) */
  disableModelInvocation?: boolean;
  /** If false, only Claude can invoke (background knowledge, not user-invocable) */
  userInvocable?: boolean;
  /** Execution context, e.g. "fork" to run in isolated subagent */
  context?: string;
  /** Agent type when forked, e.g. "Explore" */
  agent?: string;
  /** Model override, e.g. "haiku", "sonnet" */
  model?: string;
  /** Hint for arguments, e.g. "<file> [--verbose]" */
  argumentHint?: string;
}

/**
 * Current skill metadata type.
 * Extensible for future platforms (e.g. CodexSkillMetadata).
 */
export type SkillMetadata = ClaudeSkillMetadata;

/** Information about a file within a skill directory */
export interface SkillFileInfo {
  /** Relative path within the skill directory (e.g. "references/api.md") */
  relativePath: string;
  /** Whether this entry is a directory */
  isDirectory: boolean;
  /** File size in bytes (0 for directories) */
  size: number;
}

/** A skill with its full content and file listing */
export interface Skill {
  /** Metadata from SKILL.md frontmatter */
  metadata: SkillMetadata;
  /** Raw markdown content of SKILL.md (without frontmatter) */
  content: string;
  /** All files in the skill directory (excluding SKILL.md) */
  files: SkillFileInfo[];
}
