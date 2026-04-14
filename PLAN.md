# Claude Code Plugin: Agent Discovery

A plugin for Claude Code that enables discovering, browsing, and applying AI agent configurations from curated catalogs.

---

## 1. Directory Structure

```
claude-agent-discovery/
├── .claude-plugin/
│   └── marketplace.json         # Plugin catalog (lists THIS plugin for marketplace)
├── README.md                    # Basic description
├── plugins/
│   └── agent-discovery/         # The actual plugin
│       ├── .claude-plugin/
│       │   └── plugin.json      # Plugin manifest
│       ├── .mcp.json            # MCP server configuration (plugin-level)
│       ├── skills/
│       │   ├── recommend/
│       │   │   └── SKILL.md     # Recommend agents based on context
│       │   └── apply/
│       │       └── SKILL.md     # Apply agent config to workspace
│       ├── src/
│       │   └── mcp-server.ts   # MCP server implementation
│       ├── package.json
│       └── tsconfig.json
```

---

## 2. File Contents

### 2.1 `.claude-plugin/marketplace.json`

This is the **plugin catalog** — it describes what plugins are available for installation from this repository.

```json
{
  "name": "nikhil-plugins",
  "owner": {
    "name": "Nikhil Sivapuram"
  },
  "plugins": [
    {
      "name": "agent-discovery",
      "source": "./plugins/agent-discovery",
      "description": "Discover and apply AI agents",
      "version": "0.1.0",
      "author": {
        "name": "Nikhil Sivapuram"
      }
    }
  ]
}
```

### 2.2 `plugins/agent-discovery/.claude-plugin/plugin.json`

Plugin manifest — describes THIS plugin and its capabilities.

```json
{
  "name": "agent-discovery",
  "version": "0.1.0",
  "description": "Discover and apply AI agent configurations from curated catalogs",
  "author": {
    "name": "Nikhil Sivapuram"
  }
}
```

### 2.3 `plugins/agent-discovery/.mcp.json`

MCP server configuration — lives at the plugin level (not repo root) since it's specific to this plugin.

```json
{
  "mcpServers": {
    "agent-discovery": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp-server.js"],
      "env": {
        "CLAUDE_PLUGIN_ROOT": "${CLAUDE_PLUGIN_ROOT}",
        "CACHE_DIR": "${CLAUDE_PLUGIN_ROOT}/.cache"
      }
    }
  }
}
```

---

## 3. Architecture: Skills vs MCP Server

This is the core architectural distinction. Get this wrong and nothing works.

### Skills = User Interface & Intelligence

Skills are SKILL.md files that Claude reads and follows. They define the **conversation flow** — what to ask the user, how to present results, when to confirm. Skills use Claude's own LLM reasoning to analyze context, make suggestions, and format output.

**Skills do:**
- Parse user commands (`/recommend`, `/apply`)
- Analyze workspace context (read files, detect tech stack)
- Call MCP tools to get data
- Present results to the user in natural language
- Ask clarifying questions, get confirmations
- Explain *why* an agent is a good fit

**Skills do NOT:**
- Fetch remote URLs
- Manage caches
- Download or write files directly
- Parse llms.txt format

### MCP Server = Backend Operations

The MCP server is a standalone Node process that handles all **technical operations** — fetching, caching, downloading, file I/O. Skills call MCP tools; the MCP server does the work and returns structured results.

**MCP server does:**
- Fetch agent catalog from awesome-copilot llms.txt
- Parse and normalize the llms.txt format
- Cache catalog data locally (`.cache/` directory)
- Search the cached catalog
- Download agent files from source URLs
- Write agent files to `.github/agents/`
- Validate agent configurations

**MCP server does NOT:**
- Talk to the user
- Make recommendations (that's the LLM's job via skills)
- Decide what to apply (that's the skill + user)

### Why This Separation?

1. **Skills run in Claude's context** — they have the LLM's reasoning, the user's workspace, and conversation history. Perfect for understanding intent and presenting information.
2. **MCP tools run in a separate process** — they're deterministic, testable, and don't need LLM reasoning. Perfect for HTTP fetches, file operations, and data transformations.
3. **Skill → MCP tool → result → skill presents** is the clean loop. Skills orchestrate; MCP executes.

---

## 4. Skill Definitions

### 4.1 `skills/recommend/SKILL.md`

```markdown
# recommend

Recommend AI agent configurations based on the current workspace context.

## Usage

/recommend [query]

## Description

Analyzes the current workspace (file structure, technologies detected, existing configs) and queries the agent catalog to recommend relevant agent configurations that could enhance the project.

## Examples

/recommend
/recommend react frontend
/recommend python data science

## How It Works

1. Analyze workspace context (files, tech stack, existing configs)
2. Call MCP tool `search_agents` with query + context
3. Present recommendations with explanations to the user

## MCP Tools Used

- `search_agents` — Search for agents matching criteria
- `get_agent_details` — Get full details of a specific agent
```

### 4.2 `skills/apply/SKILL.md`

```markdown
# apply

Apply an AI agent configuration to the current workspace.

## Usage

/apply <agent-id-or-name>

## Description

Downloads and installs the specified agent configuration into the workspace at `.github/agents/`.

## Examples

/apply claude-code-reviewer
/apply python-linter-agent

## How It Works

1. Confirm the target agent with the user
2. Call MCP tool `download_agent` to fetch and install files
3. Report success and suggest next steps

## MCP Tools Used

- `download_agent` — Download agent files from source
- `validate_agent` — Verify agent configuration integrity

## Target Location

Agents are installed to: `.github/agents/<agent-name>/`
```

---

## 5. MCP Server Tool Definitions

The MCP server (`src/mcp-server.ts`) exposes the following tools. Each tool is a pure backend operation — no LLM reasoning, no user interaction.

### 5.1 `fetch_catalog`

Fetches the agent catalog from awesome-copilot llms.txt, parses it, and caches it locally. Called implicitly by `search_agents` if cache is stale, or explicitly to force-refresh.

```typescript
{
  name: "fetch_catalog",
  description: "Fetch and cache the agent catalog from awesome-copilot llms.txt",
  inputSchema: {
    type: "object",
    properties: {
      forceRefresh: {
        type: "boolean",
        description: "Force refresh even if cache is valid",
        default: false
      }
    }
  },
  // Returns:
  // { success: boolean, cached: boolean, agentCount: number, timestamp: string }
}
```

### 5.2 `search_agents`

Searches the **cached** agent catalog. If cache is missing or stale, internally calls `fetch_catalog` first.

```typescript
{
  name: "search_agents",
  description: "Search the cached agent catalog for agents matching query and context",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (keywords, tags, tech stack)"
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags to filter by"
      },
      limit: {
        type: "number",
        description: "Maximum results to return",
        default: 5
      }
    },
    required: ["query"]
  },
  // Returns:
  // { results: Array<{ id, name, description, tags, sourceUrl, readme }> }
}
```

### 5.3 `get_agent_details`

Returns full details for a single agent from the cached catalog.

```typescript
{
  name: "get_agent_details",
  description: "Get full details of a specific agent from the catalog",
  inputSchema: {
    type: "object",
    properties: {
      agentId: {
        type: "string",
        description: "Unique agent identifier"
      }
    },
    required: ["agentId"]
  },
  // Returns:
  // { id, name, description, author, version, tags, files: [{path, url}], readme, requirements }
}
```

### 5.4 `download_agent`

Downloads agent files from their source URL and writes them to the target directory in the workspace.

```typescript
{
  name: "download_agent",
  description: "Download agent files and write to target directory",
  inputSchema: {
    type: "object",
    properties: {
      agentId: {
        type: "string",
        description: "Agent to download"
      },
      targetDir: {
        type: "string",
        description: "Installation directory",
        default: ".github/agents"
      }
    },
    required: ["agentId"]
  },
  // Returns:
  // { success: boolean, installedPath: string, files: string[], warnings?: string[] }
}
```

### 5.5 `validate_agent`

Validates that an installed agent configuration has all required fields and correct structure.

```typescript
{
  name: "validate_agent",
  description: "Validate an installed agent configuration",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to agent directory"
      }
    },
    required: ["path"]
  },
  // Returns:
  // { valid: boolean, errors: string[], warnings: string[] }
}
```

---

## 6. Data Flow

### 6.1 `/recommend` — End to End

```
User types: /recommend react frontend

┌─────────────────────────────────────────────────────┐
│  SKILL: recommend/SKILL.md                          │
│  (Claude reads this and follows instructions)       │
│                                                     │
│  1. Parse user query → "react frontend"             │
│  2. Gather workspace context:                       │
│     - Read package.json, detect React                │
│     - Check existing .github/agents/                 │
│  3. Call MCP tool: search_agents                    │
│     { query: "react frontend", tags: ["react"] }    │
│                                                     │
│            ──── MCP boundary ────                    │
│                                                     │
│  MCP SERVER (Node process):                         │
│  4. Check cache → stale or missing                  │
│  5. fetch_catalog() internally:                      │
│     - HTTP GET awesome-copilot/llms.txt             │
│     - Parse llms.txt format                         │
│     - Normalize into agent entries                  │
│     - Write to .cache/catalog.json                  │
│  6. Search cached catalog with query                │
│  7. Return matched agents →                         │
│                                                     │
│            ──── MCP boundary ────                    │
│                                                     │
│  SKILL continues:                                   │
│  8. Present recommendations to user:                │
│     - "Here are 3 agents for React projects..."     │
│     - Agent name, description, why it matches       │
│     - "Run /apply <name> to install"                │
└─────────────────────────────────────────────────────┘
```

### 6.2 `/apply` — End to End

```
User types: /apply react-component-linter

┌─────────────────────────────────────────────────────┐
│  SKILL: apply/SKILL.md                              │
│  (Claude reads this and follows instructions)       │
│                                                     │
│  1. Confirm with user: "Install react-component-    │
│     linter to .github/agents/?"                      │
│  2. Call MCP tool: download_agent                   │
│     { agentId: "react-component-linter",             │
│       targetDir: ".github/agents" }                  │
│                                                     │
│            ──── MCP boundary ────                   │
│                                                     │
│  MCP SERVER (Node process):                         │
│  3. Look up agent in cached catalog                 │
│  4. Resolve source URLs for agent files             │
│  5. Download each file (HTTP GET)                   │
│  6. Write to .github/agents/react-component-linter/ │
│  7. Call validate_agent internally                  │
│  8. Return { success, installedPath, files } →      │
│                                                     │
│            ──── MCP boundary ────                    │
│                                                     │
│  SKILL continues:                                   │
│  9. Report to user:                                 │
│     - "Installed to .github/agents/..."             │
│     - List files written                            │
│     - Suggest next steps (activation, config)       │
└─────────────────────────────────────────────────────┘
```

---

## 7. Cache Structure

The MCP server manages its own cache, separate from `marketplace.json`.

```
plugins/agent-discovery/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── .mcp.json              # MCP server config (plugin-level)

.cache/                     # MCP server cache (NOT in marketplace.json)
├── catalog.json           # Parsed & normalized agent catalog
├── catalog-meta.json      # { lastFetched, etag, source, agentCount }
└── agents/                # Downloaded agent file cache
    └── <agent-id>/
        └── ...

.claude-plugin/
└── marketplace.json       # Plugin catalog (for marketplace discovery)
```

### Cache Details

- **`catalog.json`**: The parsed agent catalog from awesome-copilot llms.txt, normalized into a uniform structure regardless of source format.
- **`catalog-meta.json`**: Metadata about the fetch — when it was last fetched, the source URL, ETag for conditional requests, and agent count.
- **TTL**: 1 hour for catalog, 24 hours for agent files.
- **Key**: SHA256 of source URL (for future multi-source support).

**This cache is an implementation detail of the MCP server.** Skills never read or write the cache directly — they always go through MCP tools.

---

## 8. Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_PLUGIN_ROOT` | Runtime plugin path | Set by Claude Code |
| `CACHE_DIR` | Cache location | `${CLAUDE_PLUGIN_ROOT}/.cache` |
| `DEFAULT_CATALOG` | Primary catalog URL | `https://awesome-copilot.github.com/llms.txt` |

---

## 9. Implementation Phases

### Phase 1 (MVP)
- Single source: awesome-copilot llms.txt
- Hardcoded apply target: `.github/agents/`
- Basic keyword search
- File-based caching with TTL
- `fetch_catalog`, `search_agents`, `get_agent_details`, `download_agent`, `validate_agent`

### Phase 2 (Future)
- GitHub API integration for plugin discovery
- Semantic search (embeddings)
- Multiple catalog sources
- Configurable apply targets
- Agent versioning and updates

---

## 10. Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}
```

---

*Version: 0.1.0 | Plugin: agent-discovery | Repo: claude-agent-discovery*