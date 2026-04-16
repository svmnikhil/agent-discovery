---
name: recommend
description: Recommend AI agent configurations based on the current workspace context
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
5. If similar agents exist across sources, note the alternatives

## MCP Tools Used

- `recommend` — Broad catalog search returning candidates for LLM re-ranking
- `search_agents` — Focused keyword search when the user's need is specific
- `get_agent_details` — Get full details of a specific agent before recommending
- `catalog_info` — Show catalog stats if the user asks about available agents

## Important Notes

- The `recommend` tool returns candidates with descriptions — you do the ranking
- When multiple similar agents exist from different sources, explain the differences
- Always suggest next steps: "Run /apply <name> to install"
