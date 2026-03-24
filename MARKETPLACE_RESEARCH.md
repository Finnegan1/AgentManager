# MCP Skill Marketplace Research

> Research conducted 2026-03-23 — exploring existing MCP marketplaces and how to integrate them into Agent Manager.

## Landscape Overview

There are **13+ marketplaces** in the MCP ecosystem, spanning two categories that map directly to what Agent Manager manages:

| Agent Manager Concept | Marketplace Equivalent |
|---|---|
| **Skills** (markdown files with YAML frontmatter) | **Smithery Skills** (128k+ skills, markdown-based `SKILL.md`) |
| **MCP Servers** (downstream connections proxied through gateway) | **Official MCP Registry**, **Smithery MCPs**, **Docker MCP Catalog** |

---

## Major Marketplaces

### 1. Official MCP Registry (by Anthropic / MCP Community)

- **URL**: https://registry.modelcontextprotocol.io/
- **GitHub**: https://github.com/modelcontextprotocol/registry
- **Scope**: MCP servers only (no skills)
- **Backed by**: Anthropic, GitHub, Microsoft, PulseMCP
- **API**: REST at `https://registry.modelcontextprotocol.io/v0.1/` — **no auth needed** for reading
- **API frozen** at v0.1 (Oct 2025) — no breaking changes guaranteed

#### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /v0.1/servers` | List/search servers. Params: `search`, `updated_since`, `version` (`latest`), cursor-based pagination |
| `GET /v0.1/servers/{name}/versions` | List all versions of a server |
| `GET /v0.1/servers/{name}/versions/{version}` | Get specific version (use `latest`) |
| `GET /health` | Health check |
| `GET /ping` | Ping |
| `GET /version` | API version |
| `POST /validate` | Validate a server manifest |
| `POST /publish/*` | Publishing (requires auth via DNS/HTTP challenge) |

#### Response Shape (server entry)

```json
{
  "server": {
    "name": "io.github.example/my-server",
    "description": "...",
    "version": "1.0.0",
    "repository": { "url": "https://github.com/...", "source": "github" },
    "packages": [
      {
        "registryType": "npm",
        "identifier": "@scope/package-name",
        "version": "1.0.0",
        "transport": { "type": "stdio" },
        "environmentVariables": [
          { "name": "API_KEY", "description": "...", "isRequired": true }
        ]
      }
    ],
    "remotes": [
      {
        "type": "streamable-http",
        "url": "https://server.smithery.ai/@org/server/mcp",
        "headers": [{ "name": "Authorization", "value": "Bearer {key}" }]
      }
    ]
  },
  "_meta": {
    "io.modelcontextprotocol.registry/official": {
      "status": "active",
      "publishedAt": "...",
      "updatedAt": "...",
      "isLatest": true
    }
  }
}
```

### 2. Smithery

- **URL**: https://smithery.ai/
- **Scope**: MCP servers **and** Skills (128k+ skills)
- **Features**: Hosting, deployment, verification badges, usage stats, semantic search, CLI (`npx @smithery/cli@latest`)

#### MCP Server API (`registry.smithery.ai`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /servers?q={query}&pageSize=20` | None | Search servers. Supports filters: `owner:`, `repo:`, `is:deployed`, `is:verified` |
| `GET /servers/{qualifiedName}` | None | Full server detail with tool schemas, connection config, deployment URL |

**Server search response shape:**

```json
{
  "servers": [
    {
      "id": "uuid",
      "qualifiedName": "github",
      "displayName": "GitHub",
      "description": "...",
      "iconUrl": "https://api.smithery.ai/servers/github/icon",
      "verified": true,
      "useCount": 5284,
      "remote": true,
      "isDeployed": true,
      "homepage": "https://smithery.ai/servers/github"
    }
  ],
  "pagination": { "currentPage": 1, "pageSize": 20, "totalPages": 40, "totalCount": 800 }
}
```

**Server detail response includes:**
- `connections[]` with `type` ("http") and `deploymentUrl`
- `tools[]` with full `name`, `description`, and `inputSchema`
- `configSchema` for server configuration

#### Skills API (`registry.smithery.ai`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /skills?q={query}&pageSize=20` | None | Search skills. Returns metadata + pagination |
| `GET /skills/{namespace}/{slug}` | None | Skill detail with metadata |

**Skill search response shape:**

```json
{
  "skills": [
    {
      "id": "uuid",
      "qualifiedName": "anthropics/frontend-design",
      "namespace": "anthropics",
      "slug": "frontend-design",
      "displayName": "frontend-design",
      "description": "Create distinctive, production-grade frontend interfaces...",
      "categories": ["Design", "Coding"],
      "gitUrl": "https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design",
      "verified": true,
      "externalStars": 63077,
      "totalActivations": 1319,
      "uniqueUsers": 683,
      "qualityScore": 1.01
    }
  ],
  "pagination": { "currentPage": 1, "pageSize": 20, "totalPages": 94, "totalCount": 1880 }
}
```

**Important**: The API returns metadata only, not the actual skill markdown content. The `gitUrl` points to the GitHub source. To fetch content:

```
gitUrl:  https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design
raw URL: https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md
```

### 3. Docker MCP Catalog & Toolkit

- **URL**: https://hub.docker.com/mcp
- **Docs**: https://docs.docker.com/ai/mcp-catalog-and-toolkit/
- **GitHub**: https://github.com/docker/mcp-registry
- **Scope**: 300+ verified MCP servers as Docker containers
- **Features**: Cryptographic signatures, provenance tracking, SBOMs, MCP Gateway (single HTTP SSE endpoint for multiple servers)
- **API**: Docker Hub browsing + MCP Gateway for runtime. No dedicated REST search API.

### 4. Cline MCP Marketplace

- **URL**: https://cline.bot/mcp-marketplace
- **GitHub**: https://github.com/cline/mcp-marketplace
- **Scope**: Client-specific (Cline VS Code extension)
- **API**: No public REST API. Submission via GitHub issue.
- **Install**: Cline autonomously clones repos and configures servers.

### 5. Glama

- **URL**: https://glama.ai/mcp
- **Scope**: Largest directory at 17,000+ MCP server entries
- **Features**: Security scanning, compatibility ranking, daily updates, usage metrics
- **API**: Web-only. No documented public REST API.

### 6. PulseMCP

- **URL**: https://www.pulsemcp.com/
- **Scope**: 12,430+ servers, 394+ clients, weekly newsletter
- **API**: Has an MCP server (`pulsemcp-server`) for programmatic search — useful for agent-driven discovery but not REST.

### 7. mcp.so

- **URL**: https://mcp.so/
- **GitHub**: https://github.com/chatmcp/mcpso
- **Scope**: 18,871+ servers. Open-source (Next.js + Supabase).
- **API**: No public REST API. Could self-host for full access.

### 8. LobeHub MCP Marketplace

- **URL**: https://lobehub.com/mcp
- **Features**: Natural language search (pgvector), server comparisons, reviews
- **API**: REST at `/api/v1` with `search_servers`, `get_server_details`, `compare_servers`. Requires auth (register/login).

### 9. Composio

- **URL**: https://mcp.composio.dev/
- **Scope**: 300+ apps, 850+ toolkits, 11,000+ tools via single MCP endpoint
- **Features**: Dynamic tool routing, SOC 2/ISO 27001 compliant, automatic auth management
- **API**: Single MCP endpoint with dynamic tool routing. Managed platform.

### 10. Pipedream

- **URL**: https://mcp.pipedream.com/
- **Scope**: 3,000+ APIs, 10,000+ prebuilt tools
- **API**: npm package `@pipedream/mcp`, REST via Pipedream Connect

### 11. Community Lists

- **awesome-mcp-servers**: https://github.com/punkpeye/awesome-mcp-servers
- **mcpservers.org**: https://mcpservers.org
- **mcpmarket.com**: https://mcpmarket.com/
- **mcpserverfinder.com**: https://www.mcpserverfinder.com/

---

## Recommended Integration Strategy

### Architecture

```
┌─────────────────────────────────────────────┐
│          Agent Manager Desktop App           │
│                                              │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │  Skills Tab    │  │   Servers Tab      │  │
│  │               │  │                    │  │
│  │ [My Skills]   │  │  [My Servers]      │  │
│  │ [Marketplace] │  │  [Marketplace]     │  │
│  └───────┬───────┘  └────────┬───────────┘  │
└──────────┼───────────────────┼──────────────┘
           │                   │
           ▼                   ▼
┌──────────────────┐ ┌─────────────────────────┐
│ Smithery Skills   │ │ Official MCP Registry    │
│ Registry API      │ │ API (no auth)            │
│ (no auth needed)  │ │                          │
│                   │ │ + Smithery Server API    │
│ + GitHub Raw API  │ │   (hosted MCPs, no auth) │
│ (fetch SKILL.md)  │ │                          │
└──────────────────┘ └─────────────────────────┘
```

### Primary APIs to Integrate

| Purpose | API | Auth | Why |
|---|---|---|---|
| **Skill search & metadata** | Smithery Skills API | None | Only marketplace with a skills registry. 128k+ skills. |
| **Skill content download** | GitHub Raw Content API | None (public repos) | Smithery stores `gitUrl` → convert to raw GitHub URL to fetch `SKILL.md` |
| **MCP server search** | Official MCP Registry | None | Canonical, community-owned, API frozen (stable). Backed by Anthropic. |
| **MCP server detail (hosted)** | Smithery Server API | None | Provides deployment URLs for hosted servers (zero-config install) |

### One-Click Install Flow: Skills

1. User opens "Marketplace" tab in Skills section
2. App calls `GET https://registry.smithery.ai/skills?q={query}&pageSize=20`
3. Display results with name, description, categories, stars, installs, verified badge
4. User clicks "Install" on a skill
5. App calls `GET https://registry.smithery.ai/skills/{namespace}/{slug}` to get `gitUrl`
6. Convert `gitUrl` to GitHub raw URL, fetch `SKILL.md` content
7. Convert to Agent Manager frontmatter format (add/map YAML fields) and save to `~/.agent-manager/skills/`
8. Gateway auto-detects the new skill file via hot-reload

### One-Click Install Flow: MCP Servers

1. User opens "Marketplace" tab in Servers section
2. App calls `GET https://registry.modelcontextprotocol.io/v0.1/servers?search={query}&version=latest`
3. Display results with name, description, version, repository info
4. User clicks "Install" on a server
5. Parse the response:
   - **If `remotes[]` exists**: Add as streamable-http transport to `config.json` (zero-config, instant connect)
   - **If `packages[]` exists (npm/pypi)**: Show install dialog, run package install, add as stdio transport to `config.json`
6. Gateway hot-reloads and connects to the new server

### Skill Format Mapping

Smithery `SKILL.md` → Agent Manager format:

| Smithery Field | Agent Manager Frontmatter |
|---|---|
| `displayName` | `name` |
| `description` | `description` |
| `categories` | `tags` |
| `namespace/slug` | derive `author` |
| Content from GitHub | markdown body |
| — | `version: "1.0"` (default) |
| — | `created` / `updated` (set to install date) |

---

## Key Considerations

- **No auth needed** for both Smithery and Official Registry read APIs — enables immediate integration
- **Smithery requires auth** (Bearer token) only for publishing, not browsing
- **Skills content lives on GitHub** — 2-step fetch needed (metadata from Smithery → content from GitHub raw)
- **Rate limits**: GitHub raw API has rate limits for unauthenticated requests (60/hour). Consider caching or optional GitHub token support.
- **MCPB bundles** are the emerging standard for one-click MCP server packaging (ZIP with `manifest.json`). Consider supporting them for future-proofing.
- **Smithery Connect** offers managed remote MCP server hosting — could enable "one-click remote connect" without any local installation
- The Agent Manager's skill format (YAML frontmatter + markdown) is very close to Smithery's `SKILL.md` format — minimal conversion needed
