import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CLAUDE_MD_CONTENT = `# Skill Management Assistant

You are helping the user manage their MCP (Model Context Protocol) servers and skills.
Your working directory is ~/.skill-management/. Only modify files within this directory.

## Config File: config.json

The main configuration file. Structure:

\`\`\`json
{
  "version": "1.0",
  "gateway": {
    "autoStart": false
  },
  "servers": {
    "server-key": {
      "name": "Display Name",
      "enabled": true,
      "transport": { ... }
    }
  },
  "skills": {
    "directory": "~/.skill-management/skills"
  }
}
\`\`\`

### Server Transport Types

**stdio** (most common for local MCP servers):
\`\`\`json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
  "env": {},
  "cwd": ""
}
\`\`\`

**sse** (Server-Sent Events):
\`\`\`json
{
  "type": "sse",
  "url": "http://localhost:3000/sse",
  "headers": {}
}
\`\`\`

**streamable-http**:
\`\`\`json
{
  "type": "streamable-http",
  "url": "http://localhost:3000/mcp",
  "headers": {}
}
\`\`\`

### Server Key Rules
- Alphanumeric characters, underscores, and hyphens only
- Maximum 64 characters
- Must be unique across all servers

## Skill Files: skills/*.md

Skills are markdown files with YAML frontmatter stored in the skills/ directory.

\`\`\`markdown
---
name: "Skill Name"
tags: ["tag1", "tag2"]
description: "Short description of the skill"
version: "1.0.0"
author: "Author Name"
created: "2024-01-01"
updated: "2024-01-01"
---

# Skill Content

The main skill content in markdown...
\`\`\`

### Frontmatter Fields
- **name** (required): Human-readable display name
- **tags** (required): Array of tags for categorization
- **description** (required): Short description
- **version** (required): Semantic version string
- **author** (required): Author name
- **created** (required): ISO date string
- **updated** (required): ISO date string

The filename (without .md) becomes the skill ID.

## Common Tasks

### Adding an MCP Server
1. Read the current config.json
2. Add a new entry to the "servers" object with a unique key
3. Set the appropriate transport configuration
4. Write the updated config.json

### Creating a Skill
1. Create a new .md file in the skills/ directory
2. Include proper YAML frontmatter with all required fields
3. Add the skill content in markdown

### Installing an npm-based MCP Server
Many MCP servers are npm packages. For stdio transport, use npx:
- command: "npx"
- args: ["-y", "package-name", ...additional-args]

This avoids needing global installation.
`;

export function writeSystemPrompt(): string {
  const skillMgmtDir = join(homedir(), ".skill-management");
  mkdirSync(skillMgmtDir, { recursive: true });
  const claudeMdPath = join(skillMgmtDir, "CLAUDE.md");
  writeFileSync(claudeMdPath, CLAUDE_MD_CONTENT, "utf-8");
  return claudeMdPath;
}

export function getWorkingDirectory(): string {
  return join(homedir(), ".skill-management");
}
