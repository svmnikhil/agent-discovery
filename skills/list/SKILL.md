---
name: list
description: List installed agents, skills, instructions, and teams
user-invocable: true
---

# list

List all installed agents, skills, instructions, and assembled teams in the current workspace.

## Usage

```
/agent-discovery:list
```

## Description

Scans the workspace for installed catalog entries and displays them organized by type:
- **Agents** — installed in `.claude/agents/`
- **Skills** — installed in `.claude/skills/`
- **Instructions** — installed in `.github/instructions/`
- **Teams** — stored in Claude Code settings (if experimental teams enabled)

## Output Format

```
Installed Agents (3):
  • grumpy-reviewer — Code quality & security reviewer
  • test-coverage — Test coverage analysis
  • react-expert — React frontend specialist

Teams (1):
  • code-quality-team (3 members)
    └─ Lead: Agentic Coordinator
    └─ Focus: Code quality review
    └─ Members: grumpy-reviewer, test-coverage, Explore

Skills (2):
  • custom-git — Git workflow helpers
  • deploy — Deployment automation

Instructions (4):
  • typescript.md — TypeScript conventions
  • react-components.md — React component patterns
  • testing.md — Testing guidelines
  • api-design.md — API design standards
```

## How It Works

1. Scan `.claude/agents/` for `.md` files with agent frontmatter
2. Scan `.claude/skills/` for `SKILL.md` files
3. Scan `.github/instructions/` for instruction files
4. Check Claude Code settings for saved teams (experimental)
5. Parse metadata and display organized summary

## MCP Tools Used

- `catalog_info` — Get catalog statistics
- `list_installed` — List installed entries (if available)

## Important Notes

- Shows entries installed from the catalog AND locally created entries
- Teams are only shown when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled
- Use `/agent-discovery:edit <name>` to modify any listed entry