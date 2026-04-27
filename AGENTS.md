# Agent Instructions — agent-discovery

This file configures AI agents working in the agent-discovery codebase.

## Project Context

agent-discovery is a Claude Code plugin and GitHub Copilot Chat extension that helps developers discover, search, and install AI agent configurations from curated catalogs (awesome-copilot, gh-aw).

**Plugin:** Accepted into Anthropic's official Claude Code plugin marketplace.
**Extension:** Available as a VS Code GitHub Copilot Chat participant (`@agent-discovery`).

## Architecture

- `src/catalog.ts` — SQLite BM25 search engine (sql.js WASM)
- `src/mcp-server.ts` — MCP server exposing 5 tools
- `extensions/vscode-copilot/` — VS Code Copilot Chat extension
- `catalog/catalog.db` — Pre-built SQLite catalog (248KB, 687 entries)
- `skills/` — Claude Code slash command definitions

## Key Rules

1. The catalog is built at publish time — never fetch at runtime in the MCP server
2. The VS Code extension uses `catalog-data.json` (exported from catalog.db) — no WASM in the extension host
3. All content is fetched from `raw.githubusercontent.com` on demand — no auth required
4. `download_agent` converts awesome-copilot agents to Claude Code subagent format via `converter.ts`

## Catalog Schema

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,       -- "{source}:{filename}"
  source TEXT,               -- "awesome-copilot" | "gh-aw"
  name TEXT,                 -- Human-readable name
  type TEXT,                 -- "agent" | "instruction" | "skill"
  description TEXT,
  url TEXT,                  -- raw.githubusercontent.com URL
  filename TEXT,             -- File name
  tools TEXT,                -- JSON array
  tags TEXT,                 -- JSON array
  fetched_at TEXT
);
```

## Common Tasks

- **Rebuild catalog:** `npm run build-catalog` (requires GITHUB_TOKEN for gh-aw source)
- **Build plugin:** `npm run build`
- **Build extension:** `cd extensions/vscode-copilot && npm run prepare`
- **Export catalog JSON:** `cd extensions/vscode-copilot && npm run build:catalog`
