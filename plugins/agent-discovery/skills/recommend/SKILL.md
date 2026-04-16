---
name: recommend
description: Recommend AI agent configurations based on the current workspace context
user-invocable: true
---

# recommend

Recommend AI agent configurations based on the current workspace context.

## Usage

/recommend [query]

## Description

Analyzes the current workspace (file structure, technologies detected, existing configs) and queries the pre-built agent catalog to recommend relevant agents, instructions, or skills.

The catalog includes 687+ entries from multiple sources:
- **awesome-copilot** — GitHub's community catalog (agents, instructions, skills)
- **gh-aw** — GitHub's Agent Factory (agents)

No setup required — catalog is bundled with the plugin.

## Examples

/recommend
/recommend react frontend
/recommend python data science
/recommend I need help writing architecture decision records

## How It Works

1. **Check if agent teams are enabled** — look for `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable
2. **If teams not enabled** — use AskUserQuestion to offer enabling before continuing
3. Analyze workspace context (files, tech stack, existing configs)
4. Call MCP tool `recommend` with query + context to get candidates
5. Review the candidates and rank them based on the user's specific needs
6. Present top 5 recommendations with explanations of *why* each fits
7. **Automatically launch AskUserQuestion for interactive next steps**
8. Guide user through Review → Install → Team Assembly flow based on their choice

## 🔍 Pre-Flight Teams Check (OPTIONAL but RECOMMENDED)

**At the start of the /recommend command**, check if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set to `1`.

This check is **best-effort** — the skill can't directly read env vars, but Claude's context will show if teams features are available. Look for:
- Any mention of agent teams in the context
- Whether TeamCreate tool is available in the tool list

### If teams appear to be disabled:

Use AskUserQuestion **before** running the main recommendation:

```json
{
  "questions": [{
    "question": "Agent teams are currently disabled. Enable experimental teams for the best experience?",
    "header": "Teams",
    "multiSelect": false,
    "options": [
      {
        "label": "Yes, enable teams",
        "description": "Show me how to enable CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS for team assembly"
      },
      {
        "label": "No, continue without teams",
        "description": "Run recommendation without team features (agents work as subagents)"
      }
    ]
  }]
}
```

#### If "Yes, enable teams":

Provide instructions and **pause the flow**:

```
🔧 Enable Agent Teams

To use team assembly features, add this to your Claude Code settings:

1. Open settings: Claude Code → Settings → Open Settings File
2. Add to the JSON:
   {
     "env": {
       "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
     }
   }
3. Restart Claude Code
4. Re-run /recommend

You can also set it in your shell:
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

Once enabled, you'll be able to:
- Assemble agents into coordinated teams
- Create teams programmatically with TeamCreate
- Have teammates work in parallel on different aspects

Run /recommend again after enabling.
```

**Do not proceed with recommendation until user confirms they've enabled it or chosen to continue without.**

#### If "No, continue without teams":

Proceed with recommendation, but **note in the post-recommendation AskUserQuestion**:
- Change "Assemble a team" option to:
  ```json
  {
    "label": "Assemble a team (disabled)",
    "description": "Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1. Install as subagents instead?"
  }
  ```
- If selected, offer to install agents as subagents

### If teams are already enabled (or user chose to skip check):

Proceed directly to recommendation + post-recommendation AskUserQuestion with full "Assemble a team" option enabled.

## ⚡ Post-Recommendation Interactive Workflow (REQUIRED)

**After presenting recommendations, you MUST use AskUserQuestion to guide the user through next steps.** This happens automatically — the user doesn't need to trigger it.

### Step 1: Main Action Picker

**If teams ARE enabled:** Use this format:

```json
{
  "questions": [{
    "question": "What would you like to do with these recommendations?",
    "header": "Next step",
    "multiSelect": false,
    "options": [
      {
        "label": "Review an agent",
        "description": "Browse and edit agent markdown before installing"
      },
      {
        "label": "Install agents",
        "description": "Apply selected agents directly to the workspace"
      },
      {
        "label": "Assemble a team",
        "description": "Combine multiple agents into a coordinated team"
      },
      {
        "label": "Done",
        "description": "End the recommendation flow"
      }
    ]
  }]
}
```

**If teams are NOT enabled:** Use this format (team option shows as disabled):

```json
{
  "questions": [{
    "question": "What would you like to do with these recommendations?",
    "header": "Next step",
    "multiSelect": false,
    "options": [
      {
        "label": "Review an agent",
        "description": "Browse and edit agent markdown before installing"
      },
      {
        "label": "Install agents",
        "description": "Apply selected agents directly to the workspace"
      },
      {
        "label": "Assemble a team (enable first)",
        "description": "Requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1. Show me how to enable."
      },
      {
        "label": "Done",
        "description": "End the recommendation flow"
      }
    ]
  }]
}
```

### Step 2: Branch Based on Selection

#### If "Review an agent":

Use AskUserQuestion to let the user pick which agent:

```json
{
  "questions": [{
    "question": "Which agent would you like to review?",
    "header": "Review",
    "multiSelect": false,
    "options": [
      {"label": "agent-name-1", "description": "Role: [description from candidate]"},
      {"label": "agent-name-2", "description": "Role: [description from candidate]"}
      // ... for each recommended agent
    ]
  }]
}
```

Then delegate to `/agent-discovery:review <agent-name>`.

#### If "Install agents":

Use AskUserQuestion with multiSelect to pick agents:

```json
{
  "questions": [{
    "question": "Which agents would you like to install?",
    "header": "Install",
    "multiSelect": true,
    "options": [
      {"label": "agent-name-1", "description": "[brief role description]"},
      {"label": "agent-name-2", "description": "[brief role description]"}
    ]
  }]
}
```

Then for each selected agent, call `download_agent` MCP tool.

#### If "Assemble a team" or "Assemble a team (enable first)":

**If teams are enabled:**

Use AskUserQuestion with multiSelect to pick team members:

```json
{
  "questions": [{
    "question": "Which agents should be on the team?",
    "header": "Team",
    "multiSelect": true,
    "options": [
      {"label": "agent-name-1", "description": "[role - e.g., Security & code quality]"},
      {"label": "agent-name-2", "description": "[role - e.g., Test coverage]"}
    ]
  }]
}
```

Then delegate to `/agent-discovery:team <agent1> <agent2> ...`.

**If teams are NOT enabled:**

Show the enable instructions again:

```
🔧 Enable Agent Teams

To assemble teams, you need to enable experimental teams:

1. Open Claude Code settings (Cmd/Ctrl + ,)
2. Add to settings.json:
   {
     "env": {
       "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
     }
   }
3. Restart Claude Code
4. Re-run /recommend

Or set in your shell:
   export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

Alternatively, you can install agents individually as subagents:
- "Install agents" → pick agents → use as subagents
```

Then use AskUserQuestion:

```json
{
  "questions": [{
    "question": "What would you like to do instead?",
    "header": "Alternative",
    "multiSelect": false,
    "options": [
      {
        "label": "Install as subagents",
        "description": "Install agents individually (works without team mode)"
      },
      {
        "label": "Done for now",
        "description": "End the flow, I'll enable teams later"
      }
    ]
  }]
}
```

If "Install as subagents", proceed with the install flow.

#### If "Done":

Exit gracefully with a closing message.

### Why AskUserQuestion?

- **Structured choices** — users see exactly what they can do
- **multiSelect support** — pick multiple agents for install/team in one shot
- **Inline picker** — arrow-key navigable, no typing required
- **No permission needed** — free action, fires immediately

## MCP Tools Used

- `recommend` — Broad catalog search returning candidates for LLM re-ranking
- `search_agents` — Focused keyword search when the user's need is specific
- `get_agent_details` — Get full details of a specific agent before recommending
- `catalog_info` — Show catalog stats if the user asks about available agents

## Important Notes

- The `recommend` tool returns candidates with descriptions — you do the ranking
- When multiple similar agents exist from different sources, explain the differences
- Always launch AskUserQuestion after presenting recommendations
- Never just say "Run /apply to install" and stop — that's a dead end
- The interactive flow keeps users engaged and guides them to action
