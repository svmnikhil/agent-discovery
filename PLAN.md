# Agent Discovery Plugin — v2.0 Architecture

An MCP server plugin for Claude Code that helps developers discover, search, and install AI agents, instructions, and skills from curated catalogs.

**Zero setup. Zero auth. Install and search.**

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│  CI/CD Pipeline (at publish time)   │
│                                     │
│  sources.json                       │
│    ├→ LlmsTxtAdapter                │
│    │    fetch awesome-copilot/llms.txt │
│    ├→ GitHubDirAdapter               │
│    │    fetch gh-aw/.github/agents/  │
│    │    (uses CI bot token)          │
│    └→ (future sources...)           │
│                                     │
│  → Normalize → catalog.db           │
│  → Bundle in npm package            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  User's Machine (at runtime)        │
│                                     │
│  catalog.db (read-only, bundled)    │
│    ↓                                │
│  search_agents → token search (local) │
│  recommend   → broad search + LLM  │
│  download_agent → raw.githubusercontent.com │
│                  (one GET, no auth) │
│                                     │
│  No auth. No API keys. No setup.    │
└─────────────────────────────────────┘
```

## Key Design Decisions

1. **Pre-built catalog** — built at publish time, bundled in npm package. No runtime fetching needed.
2. **sql.js (WASM SQLite)** — zero native deps, works everywhere. Read-only at runtime.
3. **No FTS5** — default sql.js WASM doesn't include FTS5. Application-level token search + BM25-style scoring instead (instant for ~700 entries).
4. **Metadata-only DB** — ~248KB for 687 entries. Full markdown fetched on-demand from raw.githubusercontent.com.
5. **Multi-source** — awesome-copilot (llms.txt) + gh-aw (GitHub directory). Extensible via source adapters.
6. **Cross-source dedup** — Jaccard similarity + name overlap heuristic clusters similar entries across sources.
7. **raw.githubusercontent.com** for content — no auth needed, generous rate limits, always points to latest main branch.

---

## Directory Structure

```
plugins/agent-discovery/
├── catalog/
│   └── catalog.db          # Pre-built SQLite DB (bundled in npm package)
├── scripts/
│   └── build-catalog.ts    # Build script (runs at publish time, requires GITHUB_TOKEN for gh-aw)
├── sources.json            # Source definitions
├── src/
│   ├── mcp-server.ts       # MCP server (5 tools)
│   ├── catalog.ts          # SQLite catalog reader + search engine
│   ├── types.ts            # Type definitions
│   ├── converter.ts        # Format conversion (awesome-copilot → Claude Code)
│   └── adapters/
│       ├── llms-txt.ts     # LlmsTxtAdapter
│       └── github-dir.ts   # GitHubDirAdapter
├── skills/
│   ├── recommend/SKILL.md  # /recommend skill
│   └── apply/SKILL.md      # /apply skill
├── .claude-plugin/plugin.json
├── .mcp.json
├── package.json
└── tsconfig.json
```

---

## MCP Tools (5 total)

### search_agents
Search the local catalog using tokenized keyword matching + BM25-style scoring. No network required.

**Input:** query (string), type (agent|instruction|skill|all), limit (number)
**Output:** Matched entries with name, description, source, type, URL. Includes cross-source alternatives for similar entries.

### recommend
Broad catalog search returning up to 30 candidates with descriptions for LLM re-ranking. Use when making semantic recommendations.

**Input:** query (string), context (optional string)
**Output:** Candidate list with descriptions, tools, tags. Includes prompt to LLM for re-ranking.

### get_agent_details
Fetch full markdown content for a specific entry from raw.githubusercontent.com. One GET, no auth.

**Input:** name (string)
**Output:** Full agent content including frontmatter and instructions.

### download_agent
Download and install a catalog entry. Routes by type: agents → .claude/agents/, instructions → .github/instructions/, skills → .claude/skills/. Auto-converts awesome-copilot agents to Claude Code subagent format.

**Input:** name (string), targetDir (string, default "."), overwrite (boolean, default false)
**Output:** Installation path, type, activation instructions.

### catalog_info
Show catalog metadata: version, entry count by type, source list, build date, and duplicate cluster stats.

**Input:** none (or --stats for duplicate cluster info)
**Output:** Version, build date, sources, entry counts, type breakdown.

---

## Sources

### awesome-copilot (676 entries)
- **URL:** https://awesome-copilot.github.com/llms.txt
- **Type:** llms-txt (markdown index with name + description per entry)
- **Contents:** 203 agents, 177 instructions, 296 skills
- **Note:** URL is `awesome-copilot.github.com` (NOT www. — that DNS fails)

### gh-aw (11 entries)
- **Repo:** github/gh-aw
- **Path:** .github/agents/
- **Type:** github-directory (fetched via GitHub Contents API at build time)
- **Contents:** 9 agents, 2 instructions

---

## Search Engine

Application-level token search with BM25-style scoring:

- **Name matches** get 10x weight
- **Tag matches** get 8x weight
- **Prefix matches** get partial weight (5x for name, 4x for tags)
- **Description frequency** gets 1.5x per occurrence
- **Tool matches** get 3x weight

### Dedup Clustering

Cross-source entries are clustered when:
1. Description Jaccard similarity > 0.25 (with name overlap bonus)
2. OR: both score high for the same query AND share significant name tokens AND descriptions have some overlap (> 0.05 Jaccard)

Clustered entries show the higher-ranked as primary with "⚡ Also available from:" alternatives.

---

## Build Pipeline

```bash
# Build the catalog (requires GITHUB_TOKEN for gh-aw source)
GITHUB_TOKEN=xxx npm run build-catalog

# Build the TypeScript
npm run build

# Test
node dist/mcp-server.js  # starts MCP server on stdio
```

---

## Future Work

1. **More sources** — add via sources.json + new adapter (no code changes to MCP server)
2. **Embeddings** — consider if catalog grows past 5K entries
3. **Custom WASM build** — if FTS5 is needed at scale
4. **Version tracking** — detect when downloaded agents have been updated at source
5. **list_installed / remove_item** — agent management tools

---

*Version: 2.0.0 | Plugin: agent-discovery | Repo: https://github.com/svmnikhil/claude-agent-discovery*