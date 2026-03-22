/** Metadata extracted from a skill's YAML frontmatter */
export interface SkillMetadata {
  /** Unique identifier derived from filename (without .md extension) */
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

/** A skill with its full content */
export interface Skill {
  /** Metadata from frontmatter */
  metadata: SkillMetadata;
  /** Raw markdown content (without frontmatter) */
  content: string;
}
