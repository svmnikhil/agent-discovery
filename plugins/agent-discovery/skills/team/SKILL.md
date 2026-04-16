---
name: team
description: Assemble agents into a coordinated Claude Code team
user-invocable: true
---

# team

Assemble agents into a coordinated team using Claude Code's agent teams feature.

## Usage

/team [agent1] [agent2] ...

## Description

Create a coordinated team of Claude Code agents. Two modes:
- **Programmatic** — uses `TeamCreate` tool (when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **Natural language** — provides copy-paste prompt (when experimental teams not enabled)

## How It Works

1. For each agent name, call `get_agent_details` to fetch full config
2. Install all agents to `.claude/agents/` using `download_agent`
3. Use AskUserQuestion to determine team focus:

```json
{
  "questions": [{
    "question": "What should the team focus on?",
    "header": "Focus",
    "multiSelect": false,
    "options": [
      {
        "label": "Code quality review",
        "description": "Security, performance, and test coverage review of the codebase"
      },
      {
        "label": "Feature development",
        "description": "Parallel implementation of different feature aspects"
      },
      {
        "label": "Documentation",
        "description": "Generate docs, ADRs, and technical writing"
      },
      {
        "label": "Custom",
        "description": "I'll describe the team's focus myself"
      }
    ]
  }]
}
```

4. **Check if TeamCreate is available** (experimental teams enabled)

### If TeamCreate Available (Experimental Teams ON):

Use **TeamCreate** built-in tool:

```json
{
  "teamName": "Code Quality Squad",
  "focus": "[team focus from AskUserQuestion]",
  "teammates": [
    {
      "name": "grumpy-reviewer",
      "description": "Security and code quality reviewer"
    },
    {
      "name": "test-writer",
      "description": "Test coverage specialist"
    },
    {
      "name": "adr-writer",
      "description": "Architecture decision recorder"
    }
  ]
}
```

**Teammate names reference the installed subagent definitions** in `.claude/agents/`.

The team starts immediately — no manual copy-paste needed.

### If TeamCreate NOT Available (Experimental Teams OFF):

Use AskUserQuestion to offer alternatives:

```json
{
  "questions": [{
    "question": "Agent teams require experimental mode. What would you prefer?",
    "header": "Teams?",
    "multiSelect": false,
    "options": [
      {
        "label": "Enable and start",
        "description": "I'll add CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 to settings, then create the team"
      },
      {
        "label": "Use as subagents",
        "description": "Install agents as subagents instead (works without experimental mode)"
      },
      {
        "label": "Just install",
        "description": "Install agents only, I'll set up the team later"
      }
    ]
  }]
}
```

#### If "Enable and start":

Provide these instructions:

```
🏗️ Team Assembled: [team-name]

Lead: Claude (coordinator)
Teammates:
  - [agent-1] — [role description]
  - [agent-2] — [role description]
  - [agent-3] — [role description]

To start your team:
1. Add to your Claude Code settings.json:
   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
2. Restart Claude Code
3. Tell Claude:
   "Create an agent team with these teammates:
    - [agent-1] for [focus]
    - [agent-2] for [focus]
    - [agent-3] for [focus]
    Focus on [team focus]."
4. Claude will spawn the team and coordinate work
```

#### If "Use as subagents":

Install all agents and explain:

```
✅ Agents installed as subagents

You can now use them individually:
- "Use the [agent-1] subagent to [task]"
- "Use the [agent-2] subagent to [task]"

Teams mode not enabled, so they can't coordinate automatically, but they work
perfectly as standalone subagents.
```

#### If "Just install":

Install all agents and end flow.

## Team Design Guidelines

- **3-5 members** is the sweet spot (token cost scales linearly)
- **Distinct lenses** — each teammate should have a unique focus
- **Avoid file conflicts** — teammates should own different areas
- **Name teammates explicitly** — so they can reference each other

## Key Constraints

- Requires Claude Code v2.1.32+
- `TeamCreate` only available when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set
- Plugin-sourced agents can't use `hooks`, `mcpServers`, or `permissionMode` in frontmatter
- Teammates inherit project skills and MCP servers from the session
- Known limitations: session resumption issues, task coordination complexities

## MCP Tools Used

- `get_agent_details` — fetch agent configs for team design
- `download_agent` — install agents to .claude/agents/
- `search_agents` — find agents by name if ambiguous

## Built-in Tools Used

- `TeamCreate` — create the team programmatically (when available)
- `AskUserQuestion` — interactive picker for team focus and fallback options

## Example Flow

```
/team grumpy-reviewer test-writer
→ Fetch both agent configs
→ Install to .claude/agents/
→ AskUserQuestion: "What should the team focus on?"
→ User picks "Code quality review"
→ Check TeamCreate availability
→ [If available] Use TeamCreate, team starts immediately
→ [If not available] Show fallback options
```
