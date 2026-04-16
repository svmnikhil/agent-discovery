# Feature Grooming: Interactive Recommend Flow, Agent Reviews & Team Assembly

**Date:** 2026-04-16  
**Plugin:** agent-discovery v0.1.0 → v0.2.0  
**Author:** Jerry (for Nikhil)

---

## Overview

Transform `/agent-discovery:recommend` from a "here's a list, go install them yourself" experience into a **single-command guided workflow**. After recommendations are shown, the interactive experience launches automatically — no extra user input needed to trigger it.

Three enhancements, all triggered from `/recommend`:

1. **Interactive Questions** — AskUserQuestion picker auto-launches after results, offering Review / Install / Team / Done
2. **Agent Reviews** — Browse agent markdown inline, edit in $EDITOR, install customized version
3. **Team Assembly** — Programmatic team creation via `TeamCreate` tool (if experimental teams enabled), or natural-language prompt (if not)

**One command. Full flow. Zero dead ends.**

---

## Feature 1: Interactive Questions After Recommend

### Current Flow
```
/recommend → [shows top 5 agents] → "Run /apply <name> to install"
```
Dead end. User has to manually decide what to do next.

### Proposed Flow (Single-Command)
```
/recommend [query]
  → [analyzes workspace, calls recommend MCP tool, ranks results]
  → [presents top 5 recommendations]
  → AskUserQuestion AUTO-LAUNCHES (no user trigger needed):
     "What would you like to do with these recommendations?"
     ├── Review → AskUserQuestion: "Which agent?" → inline summary + AskUserQuestion: [Edit | Install | Pass]
     │   └── Edit → $EDITOR opens → AskUserQuestion: [Install customized | Re-edit | Discard]
     ├── Install → AskUserQuestion (multiSelect): "Which agents?" → download_agent for each
     ├── Assemble Team → AskUserQuestion (multiSelect): "Which agents?" → team creation flow
     └── Done → graceful exit
```

**Key: The AskUserQuestion fires automatically after the recommendation list. The user doesn't have to type anything to trigger the interactive flow.**

### How It Works: AskUserQuestion Tool

**This is a built-in Claude Code tool** (since v2.0.22+), NOT SDK-only. It renders as an **inline interactive multiple-choice picker** right in the terminal — the same UI you see when Claude asks for permission choices.

Reference implementation: [severity1/claude-code-prompt-improver](https://github.com/severity1/claude-code-prompt-improver) uses `AskUserQuestion` in its skill to present 1-6 grounded clarification questions after a hook determines a prompt is vague.

**AskUserQuestion Format:**
```json
{
  "questions": [
    {
      "question": "Clear, specific question ending with ?",
      "header": "Short label (max 12 chars)",
      "multiSelect": false,
      "options": [
        {
          "label": "Concise choice (1-5 words)",
          "description": "Context about this option, trade-offs, implications"
        },
        {
          "label": "Another choice",
          "description": "Why this option, when to use it"
        }
      ]
    }
  ]
}
```

**Key fields:**
- `question` — Must end with `?`. Conversational and clear.
- `header` — Max 12 chars. Visual label/tag in the UI (e.g., "Next step", "Agent", "Team")
- `multiSelect` — `false` for single choice, `true` for multi-select (e.g., picking multiple agents for a team)
- `options` — 2-4 options, each with `label` (1-5 words) and `description` (trade-offs)
- User can always type "Other" for custom input
- **No permission required** — AskUserQuestion is a free action (not gated by permissions)

### Implementation: Update `recommend` SKILL.md

The skill instructions tell Claude to use the `AskUserQuestion` tool after presenting recommendations:

```markdown
---
name: recommend
description: Recommend AI agent configurations based on the current workspace context
user-invocable: true
---

# recommend

## How It Works

1. Analyze workspace context (files, tech stack, existing configs)
2. Call MCP tool `recommend` with query + context to get candidates
3. Review the candidates and rank them based on the user's specific needs
4. Present top 5 recommendations with explanations of *why* each fits

## ⚡ Post-Recommendation Workflow (REQUIRED)

After presenting recommendations, you MUST use the AskUserQuestion tool
to guide the user through next steps. Do NOT just say "run /apply to install".

### Step 1: What would you like to do next?

Use AskUserQuestion with:
- question: "What would you like to do with these recommendations?"
- header: "Next step"
- multiSelect: false
- options:
  - "Review an agent" — Open agent markdown to browse & edit before installing
  - "Install agents" — Apply selected agents directly to the workspace
  - "Assemble a team" — Combine agents into a coordinated team (if 2+ recommended)
  - "Done" — End the recommendation flow

### Step 2: Based on selection

**If "Review an agent":**
Use AskUserQuestion to ask which agent:
- question: "Which agent would you like to review?"
- header: "Agent"
- multiSelect: false
- options: [each recommended agent with description from research]
Then proceed with /agent-discovery:review <agent-name>

**If "Install agents":**
Use AskUserQuestion to ask which agents (multiSelect: true):
- question: "Which agents would you like to install?"
- header: "Install"
- multiSelect: true
- options: [each recommended agent]
Then call download_agent for each selected agent.

**If "Assemble a team":**
Use AskUserQuestion to ask which agents for the team (multiSelect: true):
- question: "Which agents should be on the team?"
- header: "Team"
- multiSelect: true
- options: [each recommended agent]
Then proceed with /agent-discovery:team <agent1> <agent2> ...

**If "Done":** End the flow gracefully.
```

### Why AskUserQuestion vs Natural Conversation

| Approach | UX | Control |
|----------|----|--------|
| AskUserQuestion tool | Inline interactive picker with labeled options | Structured, 2-4 choices, predictable |
| Natural conversation ("what do you want?") | Free-form text response | Open-ended, user may not know options |

**AskUserQuestion is strictly better** for our use case because:
- Users see **labeled options** with descriptions — they know exactly what they can do
- `multiSelect: true` lets them pick multiple agents for install/team in one shot
- It's the same pattern the prompt-improver plugin uses successfully
- It renders as a native Claude Code UI element (arrow-key navigable picker)
- No permission prompt required (free action)

### MCP Tools Needed
No new MCP tools required. Existing tools suffice:
- `get_agent_details` — already fetches full markdown from raw.githubusercontent.com
- `download_agent` — already handles installation
- `recommend` / `search_agents` — already return candidate lists

---

## Feature 2: Agent Reviews (Interactive Browse & Edit)

### Current State
`get_agent_details` exists but is only used internally. Users never see the raw agent markdown — they just get name + description in search results and have to install blindly.

### The User's Ask

**Review AND edit** agent markdown files before installing. Not just "preview" — the user wants to:
1. **Browse** the full agent content interactively
2. **Edit** it (customize the system prompt, adjust tools, tweak model) using nano or vim
3. **Then** decide to install the (possibly modified) version

### What Claude Code Supports

**AskUserQuestion** — Built-in tool (since v2.0.22+) that renders as an **inline interactive multiple-choice picker** in the terminal. Arrow-key navigable, descriptions for each option, supports multiSelect.

This is NOT just an SDK API — it's a first-class tool Claude can invoke in any session. The `severity1/claude-code-prompt-improver` plugin uses it to ask 1-6 clarification questions after hook evaluation.

**For file editing:** Claude Code supports opening files in the user's `$EDITOR` via the Bash tool. No inline TUI browser exists, but the combination of AskUserQuestion (for choices) + $EDITOR (for editing) is powerful.

### Proposed Implementation

#### A. `review` skill — Interactive Browse + Edit workflow

New skill at `skills/review/SKILL.md`:

```markdown
---
name: review
description: Review and optionally edit an agent's markdown before installing
user-invocable: true
argument-hint: [agent-name]
---

# review

Fetch an agent's full markdown, display a structured summary inline,
then use AskUserQuestion to offer browse/edit/install options.

## Usage
/agent-discovery:review [agent-name]

## How It Works

1. Call MCP tool `get_agent_details` to fetch the full agent markdown
2. Display a **structured summary** inline in the conversation:
   - **Name** — agent identifier
   - **Role** — what it does (from description)
   - **Tools** — which tools it can use
   - **Model** — sonnet, haiku, opus, inherit
   - **Source** — awesome-copilot or gh-aw
   - **Preview** — first 20 lines of the system prompt body

3. Use **AskUserQuestion** to ask what to do next:

   ```json
   {
     "questions": [{
       "question": "What would you like to do with this agent?",
       "header": "Action",
       "multiSelect": false,
       "options": [
         {
           "label": "Open in editor",
           "description": "Open the full markdown in $EDITOR (nano/vim) to review and customize before installing"
         },
         {
           "label": "Install as-is",
           "description": "Install the agent directly without modifications"
         },
         {
           "label": "Pass",
           "description": "Skip this agent, don't install"
         }
       ]
     }]
   }
   ```

4. **If "Open in editor":**
   - Write the raw markdown to a temp file:
     `~/.claude/agent-discovery-review/<agent-name>.md`
   - Use Bash tool to open: `$EDITOR ~/.claude/agent-discovery-review/<agent-name>.md`
     (falls back to `nano` if $EDITOR is not set)
   - Wait for the editor to close
   - Read the (possibly modified) file back
   - Use AskUserQuestion again:
     ```json
     {
       "questions": [{
         "question": "You've edited the agent. Ready to install your customized version?",
         "header": "Install",
         "multiSelect": false,
         "options": [
           {
             "label": "Install customized",
             "description": "Install your edited version to .claude/agents/"
           },
           {
             "label": "Re-edit",
             "description": "Open the editor again to make more changes"
           },
           {
             "label": "Discard & pass",
             "description": "Don't install, discard changes"
           }
         ]
       ]}
     }
     ```
   - If "Install customized": write the edited file to `.claude/agents/<agent-name>.md`
   - Confirm: "✅ Installed <agent-name> (customized) to .claude/agents/"

5. **If "Install as-is":** Use `download_agent` MCP tool
6. **If "Pass":** End gracefully

## Important Notes

- The temp file path is predictable so users can find it later
- Always clean up old review files (delete anything >24h old on next review)
- If the user modifies frontmatter (e.g., changes `model: sonnet` to `model: haiku`),
  respect their changes — don't overwrite
- The edited version is what gets installed, not the original catalog version

## MCP Tools Used
- `get_agent_details` — fetch full markdown from catalog source
- `search_agents` — if name is ambiguous, find the right entry
- `download_agent` — for installing unmodified versions
```

#### B. Enrich recommendation output with review hints

In the `recommend` SKILL.md, add a post-recommendation note:

```
## Top Recommendations

1. **grumpy-reviewer** ⭐ Best match
   - Role: Senior code reviewer who gives brutally honest feedback
   - Tools: Read, Grep, Glob (read-only)
   - Model: sonnet
   - 📝 Run /agent-discovery:review grumpy-reviewer to browse & edit before installing
```

#### C. Why AskUserQuestion + $EDITOR (Not Inline TUI)

| Approach | Works? | UX |
|----------|--------|----|
| AskUserQuestion for choices | ✅ Yes | Native inline picker, arrow-key navigable |
| Claude displays markdown inline | ✅ Yes | Read-only summary, good for scanning |
| $EDITOR (nano/vim) for editing | ✅ Yes | Full edit capability, familiar UX |
| Plugin renders a TUI browser | ❌ No | Claude Code has no plugin TUI framework |

**The right answer:** AskUserQuestion handles the decision points (review? install? edit? pass?), the conversation shows the summary, and `$EDITOR` handles the full content editing. This is the pattern the prompt-improver plugin uses successfully.

### Why a Separate `review` Skill?
- **User-invocable** — `/agent-discovery:review <name>` works standalone
- **Composeable** — recommend suggests it, but users can review any agent anytime
- **Clean separation** — recommend = search + rank, review = inspect + edit + install
- **Editor-native** — respects `$EDITOR`, works with nano/vim/code/any editor

### MCP Tools Needed
No new tools. `get_agent_details` fetches the content, `download_agent` installs unmodified versions, and the Bash tool handles `$EDITOR` invocation.

---

## Feature 3: Team Assembly (Experimental + Interactive)

### The Opportunity

Claude Code's agent teams feature lets you coordinate multiple Claude Code instances as a team:
- **Team lead** — coordinates, assigns tasks, synthesizes results
- **Teammates** — independent Claude Code instances with specific roles
- **Shared task list** — self-coordinating work queue
- **Direct messaging** — teammates communicate with each other

The killer insight: **subagent definitions from our plugin can be used as teammate types**. When we install agents to `.claude/agents/`, they become available as both subagents AND team member types.

### How Team Assembly Works in Our Plugin

```
/recommend → [5 agents recommended] → AskUserQuestion: "Assemble a team?"
  → AskUserQuestion (multiSelect: true): "Which agents for the team?"
  → User selects 2-4 agents
  → Plugin installs agents + creates team configuration
  → AskUserQuestion: "Ready to start the team?" → [Start | Just install for now]
```

### Interactive Flow with AskUserQuestion

**Step 1:** After recommend, if user picks "Assemble a team":
```json
{
  "questions": [{
    "question": "Which agents should be on the team?",
    "header": "Team",
    "multiSelect": true,
    "options": [
      {"label": "grumpy-reviewer", "description": "Security & code quality lens, read-only"},
      {"label": "adr-writer", "description": "Architecture decisions, read+write"},
      {"label": "test-writer", "description": "Test coverage, read+write"}
    ]
  }]
}
```

**Step 2:** After installing selected agents:
```json
{
  "questions": [{
    "question": "Team ready! What should the team's focus be?",
    "header": "Team focus",
    "multiSelect": false,
    "options": [
      {"label": "Code quality review", "description": "Security, performance & coverage review of the codebase"},
      {"label": "Feature development", "description": "Parallel implementation of different feature aspects"},
      {"label": "Custom", "description": "I'll describe the team's focus myself"}
    ]
  }]
}
```

**Step 3:** Generate team startup instructions and offer to launch.

### The Implementation Path

**Phase A: Interactive Team Assembly (SKILL.md instructions)**

Add a `team` skill at `skills/team/SKILL.md`:

```markdown
---
name: team
description: Assemble recommended agents into a coordinated Claude Code team
user-invocable: true
argument-hint: [agent1] [agent2] ...
---

# team

Assemble selected agents into a coordinated team using Claude Code's
experimental agent teams feature.

⚠️ Agent teams are experimental. Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
setting enabled.

## Usage
/agent-discovery:team [agent1] [agent2] ...

## How It Works

1. For each agent name, call `get_agent_details` to fetch full config
2. Install all agents to `.claude/agents/` using `download_agent`
3. Use AskUserQuestion to determine team focus:
   ```json
   {
     "questions": [{
       "question": "What should the team's focus be?",
       "header": "Team focus",
       "multiSelect": false,
       "options": [
         {"label": "Code quality review", "description": "Security, performance & coverage review"},
         {"label": "Feature development", "description": "Parallel implementation of different aspects"},
         {"label": "Custom", "description": "I'll describe the focus myself"}
       ]
     }]}
   ```
4. Create team configuration and startup instructions:
   - Designate one agent as the team lead (or create a lead prompt)
   - Assign each agent as a teammate with its specific role
   - Define how teammates should coordinate
5. Use AskUserQuestion to confirm:
   ```json
   {
     "questions": [{
       "question": "Ready to start the team?",
       "header": "Launch",
       "multiSelect": false,
       "options": [
         {"label": "Start team now", "description": "Launch the team immediately with the focus above"},
         {"label": "Just install for now", "description": "Install agents, I'll start the team manually later"}
       ]
     }]}
   ```
6. If "Start team now", provide the natural language prompt to paste:

   ```
   🏗️ Team Assembled: [team-name]

   Lead: [lead-agent] — coordinates and synthesizes
   Teammates:
     - [agent-1] — [role description]
     - [agent-2] — [role description]

   To start your team:
   1. Ensure CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 is set
   2. Tell Claude: "Create an agent team using these agents as teammates:
      [agent-1] for [role-1], [agent-2] for [role-2], with [lead] as lead.
      Focus on [team focus]."
   3. Claude will spawn the team and coordinate work
   ```

## Team Design Guidelines

- **3-5 members** is the sweet spot (scales linearly in token cost)
- **Avoid file conflicts** — ensure each teammate owns different files
- **Give each a distinct lens** — security, performance, testing, etc.
- **Name teammates explicitly** so they can reference each other
- **Include task-specific context** in the spawn prompt

## Fallback (No Experimental Teams)

If the user doesn't have CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS enabled,
use AskUserQuestion to suggest alternatives:
```json
{
  "questions": [{
    "question": "Agent teams require experimental mode. What would you prefer?",
    "header": "Teams?",
    "multiSelect": false,
    "options": [
      {"label": "Enable teams", "description": "I'll add CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 to settings"},
      {"label": "Use as subagents", "description": "Use agents individually as subagents instead"},
      {"label": "Just install", "description": "Install agents, no team setup"}
    ]
  }]}
```

## MCP Tools Used
- `get_agent_details` — fetch agent configs for team design
- `download_agent` — install agents to .claude/agents/
- `search_agents` — find agents by name if ambiguous
```

**Phase B: Smart Team Suggestions (LLM-powered)**

The `recommend` skill can suggest logical team compositions using AskUserQuestion:

```json
{
  "questions": [{
    "question": "I can suggest a team composition. Want to see it?",
    "header": "Suggest",
    "multiSelect": false,
    "options": [
      {"label": "Yes, suggest a team", "description": "Analyze agents and suggest optimal team composition"},
      {"label": "I'll pick myself", "description": "Skip suggestion, let me select agents manually"}
    ]
  }]}
```

If "Yes", Claude suggests:
```
🏗️ Suggested Team: "Code Quality Squad"
- grumpy-reviewer → Security & code quality lens
- adr-writer → Architecture decisions
- test-writer → Test coverage lens

This team works well because:
- Each agent has a distinct review perspective
- No file conflicts (read-only vs write roles)
- Covers the full quality pipeline
```

**Phase C: Agent-to-Teammate Bridging (if Claude Code adds team APIs)**

If Claude Code eventually exposes team creation as an MCP-callable tool, we can automate the full flow. For now, we **generate the instructions** and the user executes them.

### Key Constraints (from docs)

1. **Experimental** — requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings.json or env
2. **No programmatic API** — teams are created via natural language in Claude Code, not via MCP tools
3. **Subagent definitions work as teammates** — agents installed to `.claude/agents/` are referenceable by name
4. **Plugin subagents can't use `hooks`, `mcpServers`, or `permissionMode`** — these frontmatter fields are ignored for plugin-sourced agents (security restriction)
5. **Teammates inherit project skills and MCP servers** — even if the subagent definition doesn't list them
6. **Session resumption issues** — known limitation, teams may not resume cleanly
7. **Token cost scales linearly** — each teammate is a full Claude instance

### Why This Approach Works for Our Plugin

- **We don't need a team API** — we install agents as subagent definitions, and Claude Code's natural language interface handles team creation
- **Our value-add is curation + assembly** — we pick the right agents and suggest the right team structure
- **Graceful degradation** — if teams aren't enabled, agents still work individually as subagents
- **No special code** — the entire workflow lives in SKILL.md instructions

---

## Feature 4: Marketplace Submission (Side Note)

### Official Submission Process

Per Claude Code docs, there are two paths:

#### Path 1: Official Anthropic Marketplace
Submit via Anthropic's in-app forms:
- **Claude.ai**: [claude.ai/settings/plugins/submit](https://claude.ai/settings/plugins/submit)
- **Console**: [platform.claude.com/plugins/submit](https://platform.claude.com/plugins/submit)

This gets your plugin into the official Anthropic-managed marketplace (reserved names like `claude-code-marketplace` are blocked for third parties).

#### Path 2: Self-Hosted Marketplace (what we should do first)
Create your own marketplace for distribution:

1. **Create marketplace.json** in your repo at `.claude-plugin/marketplace.json`:

```json
{
  "name": "agent-discovery-marketplace",
  "owner": {
    "name": "Nikhil Sivapuram",
    "email": "nikhil@example.com"
  },
  "plugins": [
    {
      "name": "agent-discovery",
      "source": "./plugins/agent-discovery",
      "description": "Discover and apply AI agent configurations from curated catalogs",
      "version": "0.2.0",
      "author": { "name": "Nikhil Sivapuram" },
      "homepage": "https://github.com/svmnikhil/claude-agent-discovery#readme",
      "repository": "https://github.com/svmnikhil/claude-agent-discovery",
      "license": "MIT",
      "keywords": ["mcp", "agents", "discovery", "awesome-copilot"],
      "category": "developer-tools"
    }
  ]
}
```

2. **Push to GitHub** — users add your marketplace with:
   ```
   /plugin marketplace add svmnikhil/claude-agent-discovery
   ```

3. **Users install with:**
   ```
   /plugin install agent-discovery@agent-discovery-marketplace
   ```

#### Recommended Strategy
1. **Ship v0.2.0** with interactive features first
2. **Self-host marketplace** immediately — you control distribution, no approval wait
3. **Submit to official Anthropic marketplace** in parallel for broader reach
4. **Gather feedback** from self-hosted users before official submission

### Reserved Names (can't use)
- `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`
- `anthropic-marketplace`, `anthropic-plugins`
- `agent-skills`, `knowledge-work-plugins`, `life-sciences`
- Anything impersonating official (e.g., `official-claude-plugins`)

---

## Implementation Plan

### v0.2.0 Scope

| Feature | Effort | Files Changed |
|---------|--------|---------------|
| Interactive recommend flow | Small | `skills/recommend/SKILL.md` |
| Agent review skill (browse + edit) | Medium | New `skills/review/SKILL.md` |
| Team assembly skill | Medium | New `skills/team/SKILL.md` |
| Marketplace config | Small | New `.claude-plugin/marketplace.json` |
| Updated plugin.json | Small | `.claude-plugin/plugin.json` (version bump) |

### No MCP Server Changes Required 🎉

All three features are **skill-layer only**. The MCP server already provides:
- `get_agent_details` → powers agent reviews
- `download_agent` → powers team installation
- `recommend` / `search_agents` → powers the initial recommendation

The intelligence is in the **skill instructions**, not in new MCP tools.

### File Changes

```
plugins/agent-discovery/
├── .claude-plugin/
│   ├── plugin.json              # bump to 0.2.0
│   └── marketplace.json         # NEW — self-hosted marketplace
├── skills/
│   ├── recommend/SKILL.md       # UPDATED — interactive post-flow
│   ├── apply/SKILL.md           # unchanged
│   ├── review/SKILL.md          # NEW — browse + edit agent markdown
│   └── team/SKILL.md            # NEW — team assembly workflow
├── .mcp.json                    # unchanged
└── ...
```

### Execution Order

1. **Update `recommend/SKILL.md`** — add interactive post-flow instructions
2. **Create `review/SKILL.md`** — agent browse + edit skill (writes temp file, opens $EDITOR)
3. **Create `team/SKILL.md`** — team assembly skill  
4. **Create `marketplace.json`** — self-hosted marketplace config
5. **Bump `plugin.json`** — version 0.1.0 → 0.2.0
6. **Test** — `--plugin-dir` with each skill
7. **Commit & push** — tag v0.2.0
8. **Submit** — Anthropic marketplace form + self-hosted marketplace

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Teams feature changes/breaks | Medium (experimental) | Graceful fallback to subagents |
| SKILL.md instructions too verbose | Low | Claude follows concise instructions well |
| Users confused by "review" vs "apply" | Low | Clear naming + flow ordering (review → edit → install) |
| Marketplace name conflict | Low | Use `agent-discovery-marketplace` (not reserved) |
| Agent markdown too long for context | Low | `get_agent_details` returns raw, skill summarizes |

---

*Groomed by Jerry 🫡 | Ready for implementation approval*