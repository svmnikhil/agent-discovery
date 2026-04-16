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

Create a coordinated team of Claude Code agents with:
- **Agentic team lead** — autonomous coordinator with self-validating loops
- **Teammates** — agents from catalog + Claude Code built-ins (Explore, Plan, General-purpose)

Two modes:
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
        "label": "Research and analysis",
        "description": "Multi-perspective investigation and synthesis"
      },
      {
        "label": "Custom",
        "description": "I'll describe the team's focus myself"
      }
    ]
  }]
}
```

4. **Ask about built-in agents integration:**

```json
{
  "questions": [{
    "question": "Should Claude Code's built-in agents be included in the team?",
    "header": "Built-ins",
    "multiSelect": true,
    "options": [
      {
        "label": "Explore agent",
        "description": "Fast read-only agent for codebase search and discovery (Haiku model)"
      },
      {
        "label": "Plan agent",
        "description": "Research agent for gathering context before implementation"
      },
      {
        "label": "General-purpose",
        "description": "Capable agent for complex multi-step tasks requiring exploration + action"
      },
      {
        "label": "None",
        "description": "Only use agents from the catalog"
      }
    ]
  }]
}
```

5. **Check if TeamCreate is available** (experimental teams enabled)

### Team Composition Requirements

**Every team MUST have an agentic leader** for self-validating and self-correcting loops.

The team lead is NOT a passive coordinator. It:
- **Autonomously assigns tasks** based on teammate capabilities
- **Monitors progress** and reassigns when teammates get stuck
- **Validates outputs** against quality criteria before marking tasks complete
- **Requests revisions** from teammates when work doesn't meet standards
- **Synthesizes results** into cohesive deliverables
- **Minimizes human-in-the-loop** by making judgment calls autonomously

**Team composition template:**
```
Team Lead (agentic): Claude instance with coordination + quality gates
Teammates:
  - [catalog-agent-1]: [specific focus/lens]
  - [catalog-agent-2]: [specific focus/lens]
  - [built-in-agent]: [specific purpose]
```

### If TeamCreate Available (Experimental Teams ON):

Use **TeamCreate** built-in tool with the agentic leader configuration:

```json
{
  "teamName": "Code Quality Squad",
  "focus": "[team focus from AskUserQuestion]",
  "lead": {
    "model": "sonnet",
    "instructions": "You are an agentic team lead with autonomous coordination authority.\n\nYour responsibilities:\n1. Assign tasks to teammates based on their capabilities\n2. Monitor progress via idle notifications and check-ins\n3. Validate all outputs before marking tasks complete\n4. Request revisions with specific feedback when work doesn't meet standards\n5. Synthesize results into cohesive deliverables\n6. Make judgment calls autonomously to minimize human-in-the-loop\n\nQuality gates:\n- Code changes must pass review before commit\n- Research must be comprehensive, not surface-level\n- Tests must cover edge cases, not just happy paths\n- All deliverables must be actionable and specific\n\nYou are NOT a passive relay. You actively ensure quality."
  },
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

**Note on built-in agents:** When using built-in agents (Explore, Plan, General-purpose), reference them by name in the teammate list:
```json
{
  "name": "explore",
  "description": "Fast codebase search and file discovery"
}
```

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

LEAD: Agentic Coordinator (autonomous quality gates)
  - Model: sonnet
  - Self-validating loops: enabled
  - Human-in-the-loop: minimized

TEAMMATES:
  - [agent-1] — [role description]
  - [agent-2] — [role description]
  - [built-in] — [role description] (if selected)

---

To start your team:

1. Add to your Claude Code settings.json:
   {
     "env": {
       "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
     }
   }

2. Restart Claude Code

3. Run this prompt:
   """
   Create an agent team for [team focus].
   
   Team lead instructions: You are an agentic coordinator with autonomous 
   authority. Assign tasks, monitor progress, validate outputs against 
   quality criteria, request revisions when work falls short, and synthesize 
   results. Minimize human-in-the-loop by making judgment calls yourself.
   
   Teammates:
   - [agent-1] for [focus-1]
   - [agent-2] for [focus-2]
   - [built-in] for [focus-3] (if included)
   
   Spawn each teammate and have them work in parallel.
   """

4. Claude will create the team with an agentic lead and coordinate work
```

#### If "Use as subagents":

Install all agents and explain:

```
✅ Agents installed as subagents

You can now use them individually:
- "Use the [agent-1] subagent to [task]"
- "Use the [agent-2] subagent to [task]"
- "Use the Explore subagent to search the codebase"
- "Use the Plan subagent to research before implementing"

Note: Subagents work within a single session and report back to you.
They don't coordinate with each other like agent teams do.
```

#### If "Just install":

Install all agents and end flow.

## Claude Code Built-in Agents

These agents are always available and can be included in teams:

| Agent | Model | Purpose | When to include |
|-------|-------|---------|----------------|
| **Explore** | Haiku | Fast read-only codebase search and file discovery | Research tasks, file finding, code search |
| **Plan** | Inherits | Research agent for gathering context before implementation | Planning phase, architecture decisions |
| **General-purpose** | Inherits | Complex multi-step tasks requiring exploration + action | Implementation tasks, debugging |

**How to use them:**
- Reference by name in teammate list: `"explore"`, `"plan"`, `"general-purpose"`
- They inherit from the session but have built-in tool restrictions (Explore is read-only)
- Great for supplementing catalog agents with Claude Code's native capabilities

## Team Design Guidelines

- **3-5 members** is the sweet spot (token cost scales linearly)
- **Distinct lenses** — each teammate should have a unique focus
- **Avoid file conflicts** — teammates should own different areas
- **Name teammates explicitly** — so they can reference each other
- **Built-in + catalog combo** — mix Claude Code's built-ins with specialized catalog agents
- **Agentic lead is mandatory** — ensures quality without constant human oversight

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
- `AskUserQuestion` — interactive picker for team focus and built-in selection

## Example Flow

```
/team grumpy-reviewer test-writer
→ Fetch both agent configs
→ Install to .claude/agents/
→ AskUserQuestion: "What should the team focus on?" → "Code quality review"
→ AskUserQuestion: "Include built-in agents?" → [Explore, None]
→ Check TeamCreate availability
→ [If available] TeamCreate with agentic lead + grumpy-reviewer + test-writer + Explore
→ [If not available] Show fallback options
```