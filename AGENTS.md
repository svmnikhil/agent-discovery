# Agent Instructions — agent-discovery

This file configures AI agents working in the agent-discovery codebase.

## Project Context

agent-discovery is a Claude Code plugin **and** GitHub Copilot Chat extension that helps developers discover, search, install, and assemble AI agent configurations from curated catalogs (awesome-copilot, gh-aw).

Two parallel surfaces share one catalog:

- **VS Code Copilot Chat extension** (`extensions/vscode-copilot/`) — a chat participant `@agent-discovery` that handles three commands plus a default search.
- **Claude Code plugin** (`src/` + `.claude-plugin/` + `skills/`) — an MCP server exposing five tools, plus three user-invocable skills (`recommend`, `list`, `edit`).

## Architecture

### Catalog (shared across both surfaces)

- `catalog/catalog.db` — SQLite catalog built at publish time by `scripts/build-catalog.ts`. ~248 KB. Two tables: `agents` (392 rows today — 213 agents, 178 instructions, 1 skill) and `catalog_meta`.
- `src/catalog.ts` — SQLite reader using sql.js. Loads all rows into memory and ranks with application-level token scoring (name×10, tag×8, tool×3, description×1.5, prefix bonuses). **Not FTS5** — FTS5 isn't in the default sql.js WASM build. For ~400 entries the in-memory scan is instantaneous.
- `src/types.ts` — `CatalogEntry`, `SearchResult`, `SourceConfig`, etc.
- `src/converter.ts` — converts awesome-copilot `.agent.md` frontmatter to Claude Code subagent frontmatter (`name`, `description`, `tools`).
- `sources.json` — declares the two upstream catalogs (`awesome-copilot` via llms.txt, `gh-aw` via GitHub directory listing).
- `src/adapters/llms-txt.ts`, `src/adapters/github-dir.ts` — source fetchers used by the catalog build step.

### Claude Code plugin surface

- `.claude-plugin/plugin.json` — plugin manifest; declares `skills: "./skills/"`.
- `.claude-plugin/marketplace.json` — marketplace listing.
- `.mcp.json` — registers two MCP servers: `agent-discovery` (this repo) and `github` (gh copilot mcp-server).
- `src/mcp-server.ts` — MCP server exposing five tools:
  - `search_agents` — token-scored search; supports type filter and limit.
  - `recommend` — broad search (up to 30 candidates) intended for LLM re-ranking.
  - `get_agent_details` — fetches the entry's content from `raw.githubusercontent.com`.
  - `download_agent` — downloads and installs to `.claude/agents/`, `.claude/skills/`, or `.github/instructions/` based on entry type. Auto-runs `convertToClaudeSubagent` for awesome-copilot agents.
  - `catalog_info` — version, build date, source list, type counts; optional duplicate-cluster stats.
- `skills/recommend/SKILL.md` — orchestrates a one-command interactive flow (Discover → Review → Install → Assemble) via `AskUserQuestion`. Team assembly path requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- `skills/list/SKILL.md` — lists installed agents/skills/instructions/teams.
- `skills/edit/SKILL.md` — opens an installed entry in `$EDITOR` (or runs interactive team edits).

### VS Code Copilot extension surface

Entry point: `extensions/vscode-copilot/src/extension.ts` (single chat participant `agent-discovery.discover`).

Commands:

| Command | Behavior |
|---|---|
| `@agent-discovery <query>` | Token-scored catalog search (`catalog.ts:searchCatalog`) over `catalog-data.json`. Suggests `/review` when results are sparse and a workspace is open. |
| `@agent-discovery /review` | Scans the workspace and recommends agents tailored to the detected tech stack. Writes `docs/codebase/STACK.md` and a `docs/codebase/recommended.txt` sidecar (top 20 catalog IDs by score). |
| `@agent-discovery /install <name>` | Resolves `<name>` via `findByName`, fetches content, writes to `.claude/agents/<name>.md` (skills → `.claude/skills/`, instructions → `.github/instructions/`). |
| `@agent-discovery /assemble` | Unions locally installed entries with the `recommended.txt` sidecar, emits `apm.yml`. Exposes an "Install agents now (apm install)" button that ensures the APM binary and runs it. |

`/review` pipeline (the heart of the extension):

1. `skill-runner.ts:runAcquireCodebaseKnowledge` verifies `python3`, spawns the bundled `scan.py` against the workspace, writes `.codebase-scan.txt`.
2. The scan output + STACK.md template are sent to Copilot's `LanguageModelChat`. The LM must return populated STACK.md, a `<!-- AGENT-DISCOVERY-QUERIES -->` marker, and a fenced JSON block with up to 10 stack-adapted queries.
3. `stack-md-parser.ts:parseStackMd` extracts `languages`, `frameworks`, `testFrameworks`, `infra`, `ci` from STACK.md (table + bullet extraction, whole-doc keyword sweep).
4. `query-mapping.ts:proposeStaticQueries` Cartesian-expands the summary (tech × CORE_CONCERNS, frontend/backend concerns when applicable, plus CI/infra-specific queries and an `ALWAYS_ON` cross-cutting set).
5. `mergeQueries(static, lmSuggested)` dedupes (static wins), sorts by `QueryGroup` order (`tech` → `cross-cutting` → `stack-adapted`), caps at `MAX_QUERIES = 35`.
6. Each query runs through `catalog.ts:searchCatalog` (`limit: 3`). Hits are bucketed by group/label and rendered as cards.
7. Top 20 hits by score are persisted to `docs/codebase/recommended.txt`.

Other extension files:

- `extensions/vscode-copilot/src/catalog.ts` — pure-JS port of the catalog scorer over the bundled `catalog-data.json`. No sql.js / WASM in the extension host.
- `extensions/vscode-copilot/src/catalog-data.json` — pre-exported catalog (~164 KB) produced by `scripts/export-catalog.mjs`.
- `extensions/vscode-copilot/src/apm.ts` — downloads, caches, and runs the APM CLI binary on demand (button in `/assemble` output).
- `extensions/vscode-copilot/bundled-skill/` — vendored copy of the awesome-copilot `acquire-codebase-knowledge` skill (`SKILL.md`, `scripts/scan.py`, `assets/templates/STACK.md`). Fetched at build time by `scripts/fetch-skill.mjs` and copied into `dist/bundled-skill/` by `esbuild.js`.
- `extensions/vscode-copilot/esbuild.js` — bundles `extension.ts` → `dist/extension.js`, copies `bundled-skill/`.

### Catalog Schema

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,       -- "{source}:{filename}"
  source TEXT,               -- "awesome-copilot" | "gh-aw"
  name TEXT,
  type TEXT,                 -- "agent" | "instruction" | "skill"
  description TEXT,
  url TEXT,                  -- raw.githubusercontent.com URL
  filename TEXT,
  tools TEXT,                -- JSON array
  tags TEXT,                 -- JSON array
  fetched_at TEXT
);

CREATE TABLE catalog_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Note: the `catalog_meta.entry_count` value (currently 687) is a stale pre-dedup count baked in at build time. The authoritative count is `SELECT COUNT(*) FROM agents` (392).

## Key Rules

1. The catalog is built at publish time — `src/mcp-server.ts` never fetches catalog data at runtime; it only fetches **entry content** from `raw.githubusercontent.com` on demand.
2. The VS Code extension uses `catalog-data.json` exported from `catalog.db` — never load sql.js / WASM in the extension host.
3. Entry-content fetches hit `raw.githubusercontent.com` — no auth required.
4. `download_agent` and `installEntry` (extension) route by type: `agent` → `.claude/agents/`, `skill` → `.claude/skills/`, `instruction` → `.github/instructions/`. For `awesome-copilot` agents, content is rewritten by `convertToClaudeSubagent` before write.
5. `/review` writes `docs/codebase/STACK.md` and `docs/codebase/recommended.txt`. `/assemble` reads both and emits `apm.yml`. The sidecar is the contract between the two commands — preserve it if you refactor.
6. `MAX_QUERIES = 35` in `query-mapping.ts` caps the per-`/review` search budget. Adding a new query source means deciding what gets dropped (static currently wins on key collision).
7. `/review` refuses to run inside the agent-discovery repo itself (self-recursion guard in `extension.ts`).

## Common Tasks

```bash
# Claude Code plugin (root)
npm install
npm run build               # tsc → dist/
npm run build-catalog       # rebuild catalog.db from sources.json (needs GITHUB_TOKEN for gh-aw)
npm run test:e2e

# VS Code extension
cd extensions/vscode-copilot
npm run prepare             # fetch-skill.mjs → export-catalog.mjs → esbuild
npm run build               # esbuild only
npm run build:catalog       # re-export catalog.db → catalog-data.json
npm run package             # produce .vsix via @vscode/vsce
npm test                    # vitest
```
