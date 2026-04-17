---
name: edit
description: Edit an installed agent, skill, instruction, or team
user-invocable: true
---

# edit

Edit an installed agent, skill, instruction, or team configuration.

## Usage

```
/agent-discovery:edit <name>
/agent-discovery:edit grumpy-reviewer
/agent-discovery:edit code-quality-team
```

## Description

Opens the specified entry for editing. Behavior depends on entry type:

| Type | Edit Action |
|------|-------------|
| **Agent** | Open in `$EDITOR`, customize system prompt/tools, save |
| **Skill** | Open `SKILL.md` in `$EDITOR` |
| **Instruction** | Open in `$EDITOR` |
| **Team** | Interactive flow to add/remove teammates, change focus, modify lead |

## How It Works

### Agents / Skills / Instructions

1. Find the entry by name in its install location
2. Write to temp file: `~/.claude/agent-discovery-edit/<name>.md`
3. Open in `$EDITOR`
4. Wait for editor to close
5. Show preview of changes
6. AskUserQuestion: "Apply changes?"
   - **Apply** — Write to original location
   - **Re-edit** — Open editor again
   - **Discard** — Cancel without changes

```json
{
  "questions": [{
    "question": "Apply these changes to <name>?",
    "header": "Save",
    "multiSelect": false,
    "options": [
      {"label": "Apply changes", "description": "Save edited version"},
      {"label": "Re-edit", "description": "Open editor again"},
      {"label": "Discard", "description": "Cancel without changes"}
    ]
  }]
}
```

### Teams

For teams, use AskUserQuestion to determine edit scope:

```json
{
  "questions": [{
    "question": "What would you like to edit?",
    "header": "Team Edit",
    "multiSelect": true,
    "options": [
      {"label": "Add teammates", "description": "Add agents from catalog"},
      {"label": "Remove teammates", "description": "Remove agents from team"},
      {"label": "Change focus", "description": "Update team's focus area"},
      {"label": "Modify lead", "description": "Edit agentic lead configuration"}
    ]
  }]
}
```

**If "Add teammates":**
1. AskUserQuestion with catalog search: "Which agent to add?"
2. Call `download_agent` if not already installed
3. Update team configuration

**If "Remove teammates":**
1. AskUserQuestion with current teammates list
2. Remove selected from team config

**If "Change focus":**
1. AskUserQuestion: "New focus area?"
   ```json
   {
     "questions": [{
       "question": "What should the team focus on?",
       "header": "Focus",
       "multiSelect": false,
       "options": [
         {"label": "Code quality review", "description": "Security, performance, test coverage"},
         {"label": "Feature development", "description": "Parallel implementation"},
         {"label": "Research & analysis", "description": "Multi-perspective investigation"},
         {"label": "Custom", "description": "Describe your own focus"}
       }
     }]
   }
   ```
2. Update team configuration

**If "Modify lead":**
1. Open lead config in `$EDITOR`
2. Parse modified config
3. Validate JSON/YAML format
4. Save to team configuration

## Redirect Entirely (Best Practice)

For complex edits that require fresh context, use **streaming input redirect**:

Instead of returning `{ behavior: "allow" }` or `{ behavior: "deny" }` in the approval callback, redirect the agent entirely by sending a new instruction:

```typescript
// In canUseTool callback
if (userWantsToStartOver) {
  // Redirect: send completely new instruction
  yield {
    type: "user",
    message: {
      role: "user",
      content: "Actually, let's do something different. List all installed agents instead."
    }
  };
  // The agent never sees the original tool request
}
```

This is useful when:
- User cancels and wants to pivot
- Edit reveals need for different approach
- Complex multi-step edit requires fresh context

## MCP Tools Used

- `search_agents` — Find agents when adding teammates
- `download_agent` — Install agents when adding to team
- `get_agent_details` — Preview agent before adding

## Important Notes

- Always preview changes before saving
- Create backup before destructive edits
- Team edits require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Use `/agent-discovery:list` to see available entries