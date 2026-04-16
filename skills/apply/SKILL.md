---
name: apply
description: Apply an AI agent, instruction, or skill configuration to the current workspace
user-invocable: true
---

# apply

Apply an AI agent, instruction, or skill configuration to the current workspace.

## Usage

/apply <agent-name-or-query>

## Description

Searches the catalog for the specified entry, downloads it, and installs it to the appropriate directory. Supports all catalog types.

## Examples

/apply grumpy-reviewer
/apply react frontend
/apply ADR Generator

## How It Works

1. Search the catalog for the specified name or query
2. If multiple matches, present options and let the user choose
3. Call MCP tool `download_agent` to fetch and install
4. Report success with activation instructions

## Installation Paths by Type

| Type | Install Location | Activation |
|------|-----------------|------------|
| Agent | `.claude/agents/` | Auto-appears in /agents |
| Skill | `.claude/skills/` | Auto-discovered when relevant |
| Instruction | `.github/instructions/` | Loaded for matching file patterns |

## MCP Tools Used

- `search_agents` — Find the entry by name
- `get_agent_details` — Preview the agent before installing
- `download_agent` — Download and install to workspace
- `validate_agent` — Verify installed agent structure

## Important Notes

- awesome-copilot agents are auto-converted to Claude Code subagent format
- gh-aw agents are installed as-is (already compatible)
- If a file already exists, ask the user before overwriting
- After install, explain what the agent does and how to trigger it
