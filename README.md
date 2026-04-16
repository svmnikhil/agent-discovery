# Agent Discovery

**Discover, browse, and install AI agents from curated catalogs.**

[![npm](https://img.shields.io/badge/npm-v2.0.0-blue)](https://www.npmjs.com/package/agent-discovery) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![GitHub stars](https://img.shields.io/github/stars/svmnikhil/claude-agent-discovery?style=flat&color=yellow)](https://github.com/svmnikhil/claude-agent-discovery/stargazers)

## The Problem

Developers spend hours searching for the right AI agent configurations. Awesome-copilot has 640+ entries, but finding the right one means browsing GitHub repos, reading docs, and manually copying files. There's no unified way to discover what's available or install it with a single command.

Agent Discovery solves this with:

1. **Pre-built Catalog** — SQLite + FTS5 index of 640+ agents, skills, and instructions from awesome-copilot and GitHub's Pelis Agent Factory. No runtime fetching, instant search.
2. **Intelligent Recommendations** — Analyze your project's tech stack (package.json, README, configs) and get relevant suggestions.
3. **One-Command Install** — Download and install agents directly to `.claude/agents/`, skills to `.claude/skills/`, instructions to `.github/instructions/`.

## Install

### Claude Code — plugin marketplace

**Prerequisites:** Claude Code v1.0.33+ (`claude --version`). If `/plugin` is not recognized, update first: `brew upgrade claude-code` or `npm update -g @anthropic-ai/claude-code`.

**Install:**

```bash
/plugin marketplace add svmnikhil/claude-agent-discovery
/plugin install agent-discovery@claude-agent-discovery
```

Restart Claude Code (or run `/reload-plugins`).

**Verify:**

```
/agent-discovery:recommend
```

Should respond with recommendations based on your project context.

<details>
<summary>Alternative — Local development install</summary>

```bash
git clone https://github.com/svmnikhil/claude-agent-discovery.git
cd claude-agent-discovery
npm run build
claude --plugin-dir .
```

This gives you the plugin with both slash commands. Good for development and testing.

</details>

## Usage

| Slash Command | What it does |
|---|---|
| `/agent-discovery:recommend [query]` | Analyze workspace and suggest relevant agents, or search by query. |
| `/agent-discovery:apply <name>` | Install an agent from the catalog to your project. |

### `/agent-discovery:recommend`

Get agent, skill, or instruction recommendations:

```
/agent-discovery:recommend                    # Analyze workspace and suggest relevant items
/agent-discovery:recommend react frontend     # Search for React-focused agents
/agent-discovery:recommend python testing     # Search for Python testing entries
```

The command:
1. Detects your project's tech stack (package.json, README, language configs)
2. Searches the catalog for matching entries
3. Returns ranked recommendations with explanations
4. Provides activation guidance

### `/agent-discovery:apply <name>`

Install an entry from the catalog:

```
/agent-discovery:apply Expert React Frontend Engineer
/agent-discovery:apply Autoresearch
```

Items are installed to the correct directory automatically:

| Type | Install Location | Activation |
|------|-----------------|------------|
| **Agent** | `.claude/agents/` | Appears in `/agents` command automatically |
| **Skill** | `.claude/skills/` | Auto-discovered by Claude Code |
| **Instruction** | `.github/instructions/` | Loaded for matching file patterns |

## Architecture

```
claude-agent-discovery/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest
│   └── marketplace.json         # Marketplace listing
├── .mcp.json                    # MCP server config
├── skills/
│   ├── recommend/SKILL.md       # Recommend command
│   └── apply/SKILL.md           # Apply command
├── dist/                        # Compiled JavaScript
├── src/
│   ├── mcp-server.ts            # MCP tools
│   ├── catalog.ts               # SQLite + FTS5 catalog
│   └── types.ts                 # TypeScript interfaces
├── catalog/
│   └── catalog.db               # Pre-built catalog (640+ entries)
└── package.json
```

### Pre-built Catalog

The plugin ships with a pre-built SQLite database:

- **Sources:** awesome-copilot (llms.txt) + GitHub Pelis Agent Factory
- **Search:** FTS5 full-text search with BM25 ranking
- **Deduplication:** Cross-source duplicate detection
- **Zero runtime fetch:** Catalog loads instantly from disk

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_agents` | Search catalog by query and type filter |
| `recommend` | Get recommendations based on project context |
| `get_agent_details` | Get full content for a specific entry |
| `download_agent` | Download and install an entry |
| `catalog_info` | Get catalog statistics and source info |

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build catalog from sources
npm run build-catalog

# Run tests
npm test
```

## License

MIT