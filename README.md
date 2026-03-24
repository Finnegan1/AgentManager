# Skill Gateway

A unified MCP (Model Context Protocol) gateway and skill management system. Manage reusable AI knowledge as markdown files, proxy multiple MCP servers through a single endpoint, and configure everything from a native desktop app.

## What's Inside

This is a **Turborepo** monorepo using **Bun** as the package manager.

### Apps

- **`mcp-gateway`** — MCP gateway server that serves skills and proxies downstream MCP servers. Supports stdio, SSE, and HTTP streaming transports.
- **`agent-manager`** — Native desktop app (Tauri + React) for managing skills, servers, and monitoring gateway status.
- **`docs`** — Documentation site built with TanStack Start and Fumadocs.

### Packages

- **`shared-types`** — Shared TypeScript types (skills, config, server definitions)
- **`ui`** — Shared React component library
- **`eslint-config`** — Shared ESLint configurations
- **`typescript-config`** — Shared `tsconfig.json` presets

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.3.11
- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/) (for the Tauri desktop app)

### Install

```sh
bun install
```

### Development

Run all apps in dev mode:

```sh
turbo dev
```

Or run a specific app:

```sh
turbo dev --filter=mcp-gateway
turbo dev --filter=agent-manager
turbo dev --filter=docs
```

### Build

```sh
turbo build
```

### Lint & Format

```sh
turbo lint
turbo check-types
bun run format
```

## Architecture

```
AI Client (e.g. Claude Code)
    ↓ MCP protocol (stdio)
MCP Gateway Server (mcp-gateway)
    ├─ Reads ~/.agent-manager/config.json (hot-reload)
    ├─ Reads ~/.agent-manager/skills/*.md
    ├─ Writes ~/.agent-manager/status.json
    └─ Proxies downstream MCP servers

Desktop App (agent-manager)
    ├─ Reads config, skills, and status files
    ├─ Writes config and skill files via Tauri
    └─ UI for managing everything
```

Communication between the gateway and the desktop app is file-based — no direct process coupling.

## Key Features

- **Skills as Markdown** — YAML frontmatter for metadata, plain markdown for content
- **MCP Gateway** — Proxy tools, resources, and prompts from multiple downstream servers with automatic namespacing
- **Hot-Reload Config** — Changes to `~/.agent-manager/config.json` are picked up without restarting the gateway
- **Native Desktop App** — Dashboard, server management, skill editor with CodeMirror and Vim keybindings
- **Full Documentation** — Searchable docs site covering concepts, architecture, and configuration

## Tech Stack

| Layer | Technology |
|---|---|
| Package Manager | Bun |
| Monorepo | Turborepo |
| Language | TypeScript |
| MCP SDK | @modelcontextprotocol/sdk |
| Frontend | React 19, Tailwind CSS, shadcn/ui |
| Desktop | Tauri 2 (Rust) |
| Docs | TanStack Start, Fumadocs |
