---
name: recommend
description: Discover, review, and install AI agents — or assemble them into a coordinated team
user-invocable: true
---

# recommend

Single-command interactive workflow to discover, review, install, and assemble AI agents.

## Usage

/recommend [query]

## Description

**One command. Full flow.**

1. **Discover** — Analyze workspace and recommend agents from the catalog
2. **Review** — Browse agent markdown inline, edit in $EDITOR if desired
3. **Install** — Apply agents directly or with customizations
4. **Assemble** — Combine agents into a coordinated team with an agentic lead

The catalog includes 687+ entries from multiple sources:
- **awesome-copilot** — GitHub's community catalog
- **gh-aw** — GitHub's Agent Factory

No setup required — catalog is bundled with the plugin.

## Examples

```
/recommend
/recommend react frontend
/recommend I need help with code reviews
```

---

## How It Works

### Phase 0: Pre-Flight Teams Check

Check if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled. This is best-effort — look for TeamCreate tool availability or agent teams context.

**If teams disabled:**

```json
{
  "questions": [{
    "question": "Agent teams are currently disabled. Enable experimental teams for team assembly?",
    "header": "Teams",
    "multiSelect": false,
    "options": [
      {"label": "Yes, enable teams", "description": "Show me how to enable CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"},
      {"label": "No, continue without", "description": "Agents will work as subagents only"}
    ]
  }]
}
```

**If "Yes, enable teams":** Show instructions and pause:

```
🔧 Enable Agent Teams

Add to Claude Code settings.json:
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}

Then restart Claude Code and re-run /recommend.
```

**If "No, continue without":** Proceed but disable team assembly option.

---

### Phase 1: Discover

1. Analyze workspace context (files, tech stack, configs)
2. Call MCP tool `recommend` with query + context
3. Rank candidates based on user's needs
4. Present **top 5 recommendations** with explanations

---

### Phase 2: Interactive Action Picker (AUTO-TRIGGERS)

**After presenting recommendations, AskUserQuestion fires automatically:**

**Teams enabled:**
```json
{
  "questions": [{
    "question": "What would you like to do with these recommendations?",
    "header": "Next step",
    "multiSelect": false,
    "options": [
      {"label": "Review an agent", "description": "Browse and edit agent markdown before installing"},
      {"label": "Install agents", "description": "Apply selected agents directly"},
      {"label": "Assemble a team", "description": "Combine agents into a coordinated team with agentic lead"},
      {"label": "Done", "description": "End the flow"}
    ]
  }]
}
```

**Teams disabled:**
```json
{
  "questions": [{
    "question": "What would you like to do with these recommendations?",
    "header": "Next step",
    "multiSelect": false,
    "options": [
      {"label": "Review an agent", "description": "Browse and edit agent markdown before installing"},
      {"label": "Install agents", "description": "Apply selected agents directly"},
      {"label": "Assemble a team (disabled)", "description": "Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"},
      {"label": "Done", "description": "End the flow"}
    ]
  }]
}
```

---

### Phase 3A: Review Flow

**If "Review an agent":**

1. AskUserQuestion: "Which agent?"
   ```json
   {
     "questions": [{
       "question": "Which agent would you like to review?",
       "header": "Review",
       "multiSelect": false,
       "options": [
         {"label": "agent-1", "description": "Role: [from candidate]"},
         {"label": "agent-2", "description": "Role: [from candidate]"}
       ]
     }]
   }
   ```

2. Call `get_agent_details` for selected agent

3. Display **inline summary**:
   - Name, Role, Tools, Model, Source
   - First 20 lines of system prompt

4. AskUserQuestion: "What to do?"
   ```json
   {
     "questions": [{
       "question": "What would you like to do with this agent?",
       "header": "Action",
       "multiSelect": false,
       "options": [
         {"label": "Open in editor", "description": "Open in $EDITOR to customize before installing"},
         {"label": "Install as-is", "description": "Install directly without changes"},
         {"label": "Pass", "description": "Skip this agent"}
       ]
     }]
   }
   ```

5. **If "Open in editor":**
   - Write to temp file: `~/.claude/agent-discovery-review/<agent-name>.md`
   - Run: `$EDITOR ~/.claude/agent-discovery-review/<agent-name>.md`
   - Wait for editor to close
   - Read modified file
   - AskUserQuestion: "Install customized version?"
     ```json
     {
       "questions": [{
         "question": "You've edited the agent. Ready to install?",
         "header": "Install",
         "multiSelect": false,
         "options": [
           {"label": "Install customized", "description": "Install your edited version"},
           {"label": "Re-edit", "description": "Open editor again"},
           {"label": "Discard", "description": "Don't install"}
         ]
       }]
     }
     ```
   - If "Install customized": Write to `.claude/agents/<agent-name>.md`

6. **If "Install as-is":** Call `download_agent` MCP tool

---

### Phase 3B: Install Flow

**If "Install agents":**

1. AskUserQuestion (multiSelect):
   ```json
   {
     "questions": [{
       "question": "Which agents would you like to install?",
       "header": "Install",
       "multiSelect": true,
       "options": [
         {"label": "agent-1", "description": "[role]"},
         {"label": "agent-2", "description": "[role]"}
       ]
     }]
   }
   ```

2. For each selected agent, call `download_agent` MCP tool

3. Confirm installation:
   ```
   ✅ Installed: agent-1, agent-2
   
   Use them as subagents:
   - "Use the agent-1 subagent to [task]"
   ```

---

### Phase 3C: Team Assembly Flow

**If "Assemble a team" (and teams enabled):**

#### Step 1: Select Team Members

```json
{
  "questions": [{
    "question": "Which agents should be on the team?",
    "header": "Team",
    "multiSelect": true,
    "options": [
      {"label": "agent-1", "description": "[role - e.g., Security & code quality]"},
      {"label": "agent-2", "description": "[role - e.g., Test coverage]"}
    ]
  }]
}
```

#### Step 2: Team Focus

```json
{
  "questions": [{
    "question": "What should the team focus on?",
    "header": "Focus",
    "multiSelect": false,
    "options": [
      {"label": "Code quality review", "description": "Security, performance, and test coverage review"},
      {"label": "Feature development", "description": "Parallel implementation of different aspects"},
      {"label": "Research & analysis", "description": "Multi-perspective investigation"},
      {"label": "Custom", "description": "I'll describe the focus myself"}
    ]
  }]
}
```

#### Step 3: Built-in Agents (Optional)

```json
{
  "questions": [{
    "question": "Include Claude Code's built-in agents?",
    "header": "Built-ins",
    "multiSelect": true,
    "options": [
      {"label": "Explore", "description": "Fast read-only codebase search (Haiku)"},
      {"label": "Plan", "description": "Research agent for pre-implementation context"},
      {"label": "General-purpose", "description": "Complex multi-step tasks"},
      {"label": "None", "description": "Only catalog agents"}
    ]
  }]
}
```

#### Step 4: Create Team

**Install selected catalog agents:**
- For each catalog agent selected, call `download_agent` MCP tool

**Create the team:**

**If TeamCreate available (experimental teams ON):**

Use `TeamCreate` with agentic lead configuration:

```json
{
  "teamName": "[Team name based on focus]",
  "focus": "[focus from Step 2]",
  "lead": {
    "model": "sonnet",
    "instructions": "You are an agentic team lead with autonomous coordination authority.\n\nResponsibilities:\n1. Assign tasks to teammates based on their capabilities\n2. Monitor progress and reassign when stuck\n3. Validate outputs against quality criteria before completion\n4. Request revisions when work falls short\n5. Synthesize results into cohesive deliverables\n6. Make judgment calls autonomously to minimize human-in-the-loop\n\nQuality gates:\n- Code changes must pass review before commit\n- Research must be comprehensive\n- Tests must cover edge cases\n- All deliverables must be actionable\n\nYou are NOT a passive relay. You actively ensure quality."
  },
  "teammates": [
    {"name": "[catalog-agent-1]", "description": "[role]"},
    {"name": "[catalog-agent-2]", "description": "[role]"},
    {"name": "explore", "description": "[role]"} // if selected
  ]
}
```

**If TeamCreate NOT available:**

Show instructions:
```
🏗️ Team Ready: [team-name]

LEAD: Agentic Coordinator (autonomous quality gates)
TEAMMATES:
  - [agent-1] — [role]
  - [agent-2] — [role]

To start:
1. Add to settings.json:
   { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
2. Restart Claude Code
3. Run:
   "Create an agent team for [focus].
    Teammates: [agent-1] for [focus], [agent-2] for [focus].
    Team lead should autonomously validate and coordinate."
```

---

### Phase 3D: Done

Exit gracefully:
```
✅ Recommendation flow complete.

Run /recommend anytime to discover more agents.

**Manage installed entries:**
- `/agent-discovery:list` — See all installed agents/teams
- `/agent-discovery:edit <name>` — Modify any entry
```

---

## Claude Code Built-in Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| **Explore** | Haiku | Fast read-only codebase search |
| **Plan** | Inherits | Pre-implementation research |
| **General-purpose** | Inherits | Complex multi-step tasks |

---

## Agentic Team Lead

Every team has an **agentic lead** that:
- Autonomously assigns tasks based on capabilities
- Monitors progress and reassigns when stuck
- Validates outputs against quality criteria
- Requests revisions when work falls short
- Synthesizes results into cohesive deliverables
- Minimizes human-in-the-loop with autonomous judgment

---

## MCP Tools Used

- `recommend` — Catalog search
- `search_agents` — Keyword search
- `get_agent_details` — Fetch full agent markdown
- `download_agent` — Install to `.claude/agents/`

## Built-in Tools Used

- `AskUserQuestion` — Interactive pickers throughout the flow
- `TeamCreate` — Programmatic team creation (when available)
- `Bash` — Open $EDITOR for agent customization

---

## Important Notes

- AskUserQuestion fires **automatically** after recommendations
- No dead ends — every path leads to action or graceful exit
- Agents can be customized before installation
- Teams include agentic lead by default
- Built-in agents supplement catalog agents when selected