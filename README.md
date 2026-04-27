# Agent Discovery

**Discover, browse, and install AI agents from curated catalogs — in Claude Code and GitHub Copilot.**

[![npm](https://img.shields.io/badge/npm-v0.2.0-blue)](https://www.npmjs.com/package/agent-discovery) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![GitHub stars](https://img.shields.io/github/stars/svmnikhil/agent-discovery?style=flat&color=yellow)](https://github.com/svmnikhil/agent-discovery/stargazers) [![Anthropic Marketplace](https://img.shields.io/badge/Anthropic%20Marketplace-Accepted-blueviolet)](https://github.com/svmnikhil/agent-discovery)

> **Accepted into Anthropic's official Claude Code plugin marketplace** — proving real developer demand for AI agent discovery tooling.

## The Problem

Developers spend hours searching for the right AI agent configurations. The awesome-copilot catalog has 700+ entries, but finding the right one means browsing GitHub repos, reading docs, and manually copying files. And once you find the right agents — there's no way to share that setup with your team.

Agent Discovery solves both problems:

1. **Instant Search** — BM25-ranked search over 700+ agents, skills, and instructions from awesome-copilot and GitHub's Agent Factory. No runtime fetching, no API keys.
2. **One-Command Install** — Download agents directly to `.claude/agents/`, skills to `.claude/skills/`, instructions to `.github/instructions/`.
3. **Team Portability via APM** — Generate an `apm.yml` manifest so every developer who clones your repo gets the same agent setup with `apm install`.

---

## Install

### Option 1 — GitHub Copilot Chat (VS Code)

Type `@agent-discovery` in the GitHub Copilot Chat panel.

**Prerequisites:** VS Code 1.100+, GitHub Copilot subscription.

**Install from source (dev mode):**

```bash
git clone https://github.com/svmnikhil/agent-discovery.git
cd agent-discovery/extensions/vscode-copilot
npm run prepare   # exports catalog + builds
code --extensionDevelopmentPath=$(pwd) /your/project
```

Then open GitHub Copilot Chat and type `@agent-discovery`.

### Option 2 — Claude Code (plugin marketplace)

**Prerequisites:** Claude Code v1.0.33+ (`claude --version`).

```bash
/plugin marketplace add svmnikhil/agent-discovery
/plugin install agent-discovery
```

Restart Claude Code (or `/reload-plugins`).

**Verify:**
```
/agent-discovery:recommend
```

<details>
<summary>Local development install (Claude Code)</summary>

```bash
git clone https://github.com/svmnikhil/agent-discovery.git
cd agent-discovery
npm run build
claude --plugin-dir .
```

</details>

---

## Usage

### GitHub Copilot Chat (`@agent-discovery`)

| Command | What it does |
|---|---|
| `@agent-discovery <query>` | Search the catalog and return ranked results |
| `@agent-discovery /install <name>` | Download and install an agent to your workspace |
| `@agent-discovery /apm` | Generate an `apm.yml` manifest for your installed agents |

**Examples:**
```
@agent-discovery code review
@agent-discovery react frontend testing
@agent-discovery azure deployment
@agent-discovery /install grumpy-reviewer
@agent-discovery /apm
```

### Claude Code (slash commands)

| Slash Command | What it does |
|---|---|
| `/agent-discovery:recommend [query]` | Discover, review, install, or assemble agents from catalog |
| `/agent-discovery:list` | List installed agents, skills, instructions, and teams |
| `/agent-discovery:edit <name>` | Edit an installed entry or modify a team |

---

## Team Portability with APM

After discovering and installing the agents your team needs, generate a portable manifest:

```
@agent-discovery /apm
```

This produces an `apm.yml` like:

```yaml
name: my-project
version: 1.0.0
dependencies:
  apm:
    - github/awesome-copilot/agents/grumpy-reviewer.agent.md
    - github/awesome-copilot/agents/expert-react-frontend-engineer.agent.md
```

Commit it to your repo. Every developer who clones it runs `apm install` and gets the same agent setup — portable, reproducible, security-scanned.

**Install APM CLI:** `curl -sSL https://aka.ms/apm-unix | sh`

---

## Architecture

```
agent-discovery/
├── .claude-plugin/
│   ├── plugin.json                    # Claude Code plugin manifest
│   └── marketplace.json               # Marketplace listing
├── .mcp.json                          # MCP server config
├── apm.yml                            # APM manifest for this project
├── AGENTS.md                          # Agent instructions for AI working in this codebase
├── extensions/
│   └── vscode-copilot/
│       ├── src/
│       │   ├── extension.ts           # VS Code chat participant
│       │   ├── catalog.ts             # BM25 search (pure JS, no WASM)
│       │   └── catalog-data.json      # Pre-exported catalog (164KB)
│       ├── scripts/
│       │   └── export-catalog.mjs     # Build: catalog.db → catalog-data.json
│       └── package.json
├── skills/
│   ├── recommend/SKILL.md             # Interactive discover+install flow
│   ├── list/SKILL.md                  # List installed entries
│   └── edit/SKILL.md                  # Edit entries/teams
├── src/
│   ├── mcp-server.ts                  # MCP tools (5 total)
│   ├── catalog.ts                     # SQLite BM25 catalog reader
│   └── types.ts                       # TypeScript interfaces
└── catalog/
    └── catalog.db                     # Pre-built SQLite catalog (687 entries)
```

### Catalog

- **Sources:** awesome-copilot (676 entries) + GitHub gh-aw Agent Factory (11 entries)
- **Search:** BM25-style scoring — name 10x, tags 8x, description 1.5x per hit
- **Deduplication:** Jaccard similarity clustering across sources
- **Zero runtime fetch:** Catalog loads instantly (SQLite in Claude Code; JSON bundle in VS Code extension)

### MCP Tools (Claude Code)

| Tool | Description |
|------|-------------|
| `search_agents` | Search catalog by query and type filter |
| `recommend` | Get recommendations based on project context |
| `get_agent_details` | Get full agent content |
| `download_agent` | Download and install an entry |
| `catalog_info` | Get catalog statistics and source info |

---

## Development

```bash
# Install dependencies
npm install

# Build TypeScript (Claude Code plugin)
npm run build

# Rebuild catalog from sources (requires GITHUB_TOKEN for gh-aw)
npm run build-catalog

# Build VS Code extension
cd extensions/vscode-copilot
npm run prepare      # export catalog JSON + compile
npm run build        # compile only
npm run package      # create .vsix
```

---

## License

MIT
