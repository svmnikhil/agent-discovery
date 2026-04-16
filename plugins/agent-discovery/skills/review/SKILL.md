---
name: review
description: Review and optionally edit an agent's markdown before installing
user-invocable: true
---

# review

Fetch an agent's full markdown, display a structured summary inline, then use AskUserQuestion to guide through edit/install decisions.

## Usage

/review [agent-name]

## Description

Review an agent's complete configuration before installing. Shows:
- Role, tools, model, source
- First 20 lines of the system prompt
- Full markdown available to edit in $EDITOR
- Interactive picker to decide: Edit, Install, or Pass

## How It Works

1. Call MCP tool `get_agent_details` to fetch the full agent markdown
2. Display a **structured summary** inline:
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

### If "Open in editor":

1. Create temp directory: `mkdir -p ~/.claude/agent-discovery-review`
2. Write raw markdown to: `~/.claude/agent-discovery-review/<agent-name>.md`
3. Use Bash tool to open: `$EDITOR ~/.claude/agent-discovery-review/<agent-name>.md`
   (falls back to `nano` if $EDITOR is not set)
4. Wait for editor to close
5. Read the (possibly modified) file back
6. Use AskUserQuestion again:

```json
{
  "questions": [{
    "question": "You've edited the agent. Ready to install?",
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
        "label": "Discard and pass",
        "description": "Don't install, discard changes"
      }
    ]
  }]
}
```

- If "Install customized": Write edited content to `.claude/agents/<agent-name>.md`
- If "Re-edit": Reopen $EDITOR with the temp file
- If "Discard": Delete temp file, end flow

### If "Install as-is":

Use `download_agent` MCP tool to install the unmodified version to `.claude/agents/`.

### If "Pass":

End the flow gracefully.

## Important Notes

- Temp files are at `~/.claude/agent-discovery-review/<agent-name>.md`
- Clean up old review files (>24h) on next review
- Respect user modifications to frontmatter (model, tools, etc.)
- The edited version is what gets installed, not the original

## MCP Tools Used

- `get_agent_details` — fetch full markdown from catalog source
- `search_agents` — if name is ambiguous, find the right entry
- `download_agent` — for installing unmodified versions

## Example Flow

```
/review grumpy-reviewer
→ Fetch agent details
→ Display summary:
  Name: grumpy-reviewer
  Role: Senior code reviewer who gives brutally honest feedback
  Tools: Read, Grep, Glob
  Model: sonnet
  Source: awesome-copilot
  Preview: "You are a senior software engineer..."
→ AskUserQuestion: [Open in editor | Install as-is | Pass]
→ User picks "Open in editor"
→ nano opens with full markdown
→ User edits (changes model to haiku), saves
→ AskUserQuestion: [Install customized | Re-edit | Discard]
→ User picks "Install customized"
→ ✅ Installed grumpy-reviewer (customized) to .claude/agents/
```
