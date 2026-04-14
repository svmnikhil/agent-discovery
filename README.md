# Claude Agent Discovery Plugin

A Claude Code plugin for discovering, browsing, and installing AI agents, skills, and instructions from curated catalogs like [awesome-copilot](https://github.com/github/awesome-copilot).

## What It Does

- **Discover**: Browse and search the awesome-copilot catalog (640+ entries)
- **Recommend**: Get intelligent recommendations based on your project's tech stack
- **Apply**: Install agents, skills, and instructions directly to your project

## Installation

```bash
# Register the marketplace (if not already registered)
copilot plugin marketplace add github/awesome-copilot

# Install the plugin
copilot plugin install agent-discovery@nikhil-plugins
```

Or test locally:
```bash
claude --plugin-dir ~/Documents/GitHub/claude-agent-discovery/plugins/agent-discovery --print "list all slash commands"
```

## Usage

### `/agent-discovery:recommend [query]`

Get agent, skill, or instruction recommendations:

```
/agent-discovery:recommend                    # Analyze workspace and suggest relevant items
/agent-discovery:recommend react frontend     # Search for React-focused agents
/agent-discovery:recommend python testing     # Search for Python testing entries
```

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

## How It Works

1. **Skills** (`.md` files) define the conversational interface — they guide Claude in understanding user intent and presenting results
2. **MCP Server** handles the backend — fetching catalogs, caching data, downloading and converting entries

The plugin fetches the agent catalog from `https://awesome-copilot.github.com/llms.txt`, caches it locally, and makes it searchable.

### Format Conversion

Agents from awesome-copilot use `.agent.md` format. The plugin automatically converts them to Claude Code's native subagent format when installing:

- Adds `name` (kebab-case), `description`, and `tools` frontmatter fields
- Renames file from `.agent.md` to `.md`
- Places in `.claude/agents/` so it appears in `/agents` immediately

## Architecture

```
plugins/agent-discovery/
├── .claude-plugin/plugin.json  # Plugin manifest
├── .mcp.json                   # MCP server config
├── skills/
│   ├── recommend/SKILL.md      # Recommend command
│   └── apply/SKILL.md          # Apply command
└── src/
    ├── mcp-server.ts           # MCP tools (fetch_catalog, search_agents, etc.)
    ├── parser.ts               # llms.txt parser
    ├── cache.ts                # Local caching
    └── types.ts                # TypeScript interfaces
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `fetch_catalog` | Fetch and cache the awesome-copilot catalog |
| `search_agents` | Search catalog by query and type |
| `get_agent_details` | Get full content for a specific entry |
| `download_agent` | Download and install an entry (agents, skills, instructions) |
| `validate_agent` | Validate an agent file's structure |

## License

MIT