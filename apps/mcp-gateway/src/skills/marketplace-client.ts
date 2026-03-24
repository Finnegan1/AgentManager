import * as fs from "node:fs";
import * as path from "node:path";

export interface ParsedInstallCommand {
  owner: string;
  repo: string;
  skillName: string;
}

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public code:
      | "INVALID_COMMAND"
      | "SKILL_NOT_FOUND"
      | "NETWORK_ERROR"
      | "ALREADY_EXISTS",
  ) {
    super(message);
    this.name = "MarketplaceError";
  }
}

/**
 * Parse a skills.sh install command into its components.
 *
 * Supports formats like:
 *   npx skills add https://github.com/{owner}/{repo} --skill {name}
 *   $ npx skills add https://github.com/{owner}/{repo} --skill {name}
 *   npx skills@latest add https://github.com/{owner}/{repo} --skill {name}
 */
export function parseInstallCommand(command: string): ParsedInstallCommand {
  // Strip leading $ and whitespace
  const cleaned = command.replace(/^\s*\$?\s*/, "").trim();

  // Extract GitHub URL
  const urlMatch = cleaned.match(
    /https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)/,
  );
  if (!urlMatch) {
    throw new MarketplaceError(
      'Invalid install command: no GitHub URL found. Expected format: npx skills add https://github.com/{owner}/{repo} --skill {name}',
      "INVALID_COMMAND",
    );
  }

  const owner = urlMatch[1]!;
  const repo = urlMatch[2]!;

  // Extract skill name from --skill or -s flag
  const skillMatch = cleaned.match(/(?:--skill|-s)\s+(\S+)/);
  if (!skillMatch) {
    throw new MarketplaceError(
      'Invalid install command: no --skill flag found. Expected format: npx skills add https://github.com/{owner}/{repo} --skill {name}',
      "INVALID_COMMAND",
    );
  }

  const skillName = skillMatch[1]!;

  return { owner, repo, skillName };
}

/**
 * Fetch a SKILL.md from GitHub raw content.
 * Tries multiple paths ({skillName}/SKILL.md and skills/{skillName}/SKILL.md)
 * and branches (main, master).
 */
export async function fetchSkillFromGitHub(
  owner: string,
  repo: string,
  skillName: string,
): Promise<string> {
  const pathVariants = [
    `${skillName}/SKILL.md`,
    `skills/${skillName}/SKILL.md`,
  ];

  for (const branch of ["main", "master"]) {
    for (const skillPath of pathVariants) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillPath}`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          return await response.text();
        }
        if (response.status !== 404) {
          throw new MarketplaceError(
            `GitHub returned ${response.status} for ${url}`,
            "NETWORK_ERROR",
          );
        }
      } catch (err) {
        if (err instanceof MarketplaceError) throw err;
        throw new MarketplaceError(
          `Network error fetching skill: ${err}`,
          "NETWORK_ERROR",
        );
      }
    }
  }

  throw new MarketplaceError(
    `Skill not found: ${owner}/${repo}/${skillName}. No SKILL.md found on main or master branch.`,
    "SKILL_NOT_FOUND",
  );
}

/**
 * Install a skill from a skills.sh install command.
 * Parses the command, fetches SKILL.md from GitHub, and saves it locally.
 */
export async function installSkillFromCommand(
  command: string,
  skillsDirectory: string,
): Promise<{ skillName: string; source: string }> {
  const { owner, repo, skillName } = parseInstallCommand(command);

  const skillDir = path.join(skillsDirectory, skillName);

  if (fs.existsSync(skillDir)) {
    throw new MarketplaceError(
      `Skill "${skillName}" already exists locally. Delete it first if you want to reinstall.`,
      "ALREADY_EXISTS",
    );
  }

  const content = await fetchSkillFromGitHub(owner, repo, skillName);

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");

  return { skillName, source: `${owner}/${repo}` };
}
