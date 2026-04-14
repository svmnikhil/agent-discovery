---
name: recommend
description: Recommend agents, skills, and instructions from awesome-copilot catalog based on project context
---

Recommend agents, skills, and instructions from the awesome-copilot catalog based on a user's project context.

## When to Use

- User asks for agent recommendations
- User wants to enhance their Copilot or Claude Code setup
- User describes a problem and wants to know if an agent/skill can help
- User says "recommend", "suggest", or "what agents should I use?"

## How

1. Use the `search_agents` tool to find entries matching the user's needs
2. Search with specific domain terms (e.g., "kubernetes", "security", "react", "testing")
3. If no results, try broader terms
4. Review results and pick the most relevant ones
5. Present recommendations with name, type, description, and relevance explanation
6. Offer to download/apply any that seem useful

## Type Descriptions

When presenting results, explain what each type means:

- **Agent** [🤖]: Full AI assistant persona with tools and expertise. Installed to `.claude/agents/`, appears in `/agents` command.
- **Skill** [🔧]: Reusable capability for specific tasks. Auto-discovered by Claude Code when relevant.
- **Instruction** [📋]: Project-level coding guidelines. Loaded automatically for matching file patterns.

## Tips

- Always explain *why* an entry is recommended, not just *that* it exists
- Consider the user's tech stack when making recommendations
- Suggest combinations (e.g., "For a React project, you might want the React agent + TypeScript instruction + testing skill")