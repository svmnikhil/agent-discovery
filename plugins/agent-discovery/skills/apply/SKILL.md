---
name: apply
description: Download and install an agent, skill, or instruction from the awesome-copilot catalog into the project
---

Download and install an agent, skill, or instruction from the awesome-copilot catalog.

## When to Use

- User wants to install a specific agent, skill, or instruction
- User approved a recommendation and wants to apply it
- User says "add agent X", "install agent X", or "apply skill Y"

## How

1. Use `get_agent_details` to confirm the entry details
2. Use `download_agent` to install it — it routes to the correct directory automatically:
   - **Agents** → `.claude/agents/` (Claude Code native format, appears in `/agents`)
   - **Skills** → `.claude/skills/` (auto-discovered by Claude Code)
   - **Instructions** → `.github/instructions/` (loaded for matching file patterns)
3. Confirm the installation and explain what happens next

## Activation

After installation, tell the user how the item activates:

- **Agents**: "This agent now appears in `/agents` automatically. Type `/agents` to see it. Claude Code will invoke it based on the description field."
- **Skills**: "This skill is auto-discovered by Claude Code. It will be suggested when relevant to your task."
- **Instructions**: "This instruction is loaded automatically for matching file patterns."

## Tips

- Always confirm before downloading (entry name could be ambiguous)
- The tool handles format conversion for agents (awesome-copilot → Claude Code subagent format)
- Skills and instructions are now supported, not just agents
- Warn if a file with the same name already exists