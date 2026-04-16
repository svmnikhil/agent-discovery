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

1. Analyze workspace context (files, tech stack, existing configs)
2. Call MCP tool `recommend` with query + context to get candidates
3. Review the candidates and rank them based on the user's specific needs
4. Present top 5 recommendations with explanations of *why* each fits
5. **Automatically launch AskUserQuestion for interactive next steps**
6. Guide user through Review → Install → Team Assembly flow based on their choice

## ⚡ Post-Recommendation Interactive Workflow (REQUIRED)

**After presenting recommendations, you MUST use AskUserQuestion to guide the user through next steps.** This happens automatically — the user doesn't need to trigger it.

### Step 1: Main Action Picker

Use AskUserQuestion tool with this format:

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

#### If "Assemble a team":

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
