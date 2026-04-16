# IMPLEMENTATION_PLAN_v0.2.0.md

**Single-Command Interactive Flow with Team Assembly**

---

## The Plan: One Command → Full Interactive Flow

`/agent-discovery:recommend` (or just `/recommend` with plugin)
  → Analyze workspace
  → Call recommend MCP tool
  → Rank & present top 5 agents
  → **AskUserQuestion auto-launches:** "What would you like to do?"
    ├── **Review** → Pick agent → Inline summary → "Edit, Install, or Pass?"
    │   └── Edit → $EDITOR → "Install customized, Re-edit, or Discard?"
    ├── **Install** → Multi-select agents → download_agent for each
    ├── **Assemble Team** → Multi-select agents → Team focus → **TeamCreate (if enabled)**
    └── **Done** → Exit

**Key changes from previous:**
- No user trigger needed for AskUserQuestion — it fires automatically after results
- TeamCreate is a **built-in tool** (not just copy-paste prompt) when experimental teams is enabled
- Two paths: programmatic (`TeamCreate`) vs natural language (prompt to paste)

---

## How Team Assembly Actually Works

### When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is SET:

**Programmatic creation via `TeamCreate` tool:**

The skill instructs Claude to:
1. Install selected agents → `.claude/agents/` via `download_agent` MCP
2. Use **built-in `TeamCreate` tool** to create the team:
   ```json
   {
     "teamName": "Code Quality Squad",
     "focus": "Security, performance, and test coverage review",
     "teammates": [
       {"name": "grumpy-reviewer", "description": "Security and code quality lens"},
       {"name": "test-writer", "description": "Generate comprehensive test coverage"},
       {"name": "adr-writer", "description": "Document architecture decisions"}
     ]
   }
   ```
3. Teammates reference the installed subagent definitions by name
4. Claude spawns the lead + teammates immediately
5. **No manual copy-paste needed** — team starts right away

### When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is NOT set:

**Fallback to natural language prompt:**

AskUserQuestion offers:
- "Enable & start" → provide instructions to add env var, then team creation prompt
- "Use as subagents" → just install, use individually
- "Just install" → install agents, user handles teams later

---

## Implementation Order

| # | Task | File(s) | Notes |
|---|------|---------|-------|
| 1 | Update recommend SKILL.md | `skills/recommend/SKILL.md` | Add auto-trigger AskUserQuestion post-recommendation flow |
| 2 | Create review SKILL.md | `skills/review/SKILL.md` | New skill: inline summary + AskUserQuestion + $EDITOR workflow |
| 3 | Create team SKILL.md | `skills/team/SKILL.md` | New skill: TeamCreate (if enabled) or natural language fallback |
| 4 | Create marketplace.json | `.claude-plugin/marketplace.json` | Self-hosted marketplace config |
| 5 | Bump plugin.json version | `.claude-plugin/plugin.json` | 0.1.0 → 0.2.0 |
| 6 | Update plugin.json skills | `.claude-plugin/plugin.json` | Add "review" and "team" to skills array |
| 7 | Test | — | `--plugin-dir` with test repo |
| 8 | Commit & push | — | Tag v0.2.0 |

---

## Key Technical Details

### AskUserQuestion Format (Built-in Tool)

```json
{
  "questions": [{
    "question": "What would you like to do with these recommendations?",
    "header": "Next step",          // max 12 chars
    "multiSelect": false,           // true for picking multiple agents
    "options": [
      {
        "label": "Review an agent",
        "description": "Browse & edit markdown before installing"
      },
      {
        "label": "Install agents",
        "description": "Apply selected agents directly to workspace"
      },
      {
        "label": "Assemble a team",
        "description": "Combine agents into a coordinated team"
      },
      {
        "label": "Done",
        "description": "End the recommendation flow"
      }
    ]
  }]
}
```

### TeamCreate Format (Built-in Tool, Gated)

Available only when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set.

```json
{
  "teamName": "string",
  "focus": "string",
  "teammates": [
    {
      "name": "grumpy-reviewer",
      "description": "Security and code quality reviewer"
    }
  ]
}
```

**Teammate names** reference subagent definitions in `.claude/agents/`.

### MCP Tools (Unchanged)

- `recommend` — fetch ranked recommendations
- `search_agents` — find agents by name
- `get_agent_details` — fetch full markdown
- `download_agent` — install to `.claude/agents/`

---

## Critical Implementation Notes

1. **AskUserQuestion is a "free action"** — doesn't require user permission, fires immediately
2. **TeamCreate may fail if experimental teams is off** — skill must handle this gracefully
3. **Plugin agents can't use hooks/mcpServers/permissionMode** — but this is fine for team use since teammates inherit from the session anyway
4. **Temp review files** — `~/.claude/agent-discovery-review/*.md`, cleaned up after 24h
5. **$EDITOR fallback** — use `nano` if $EDITOR is unset

---

## File Changes

```
plugins/agent-discovery/
├── .claude-plugin/
│   ├── plugin.json              # UPDATED: version 0.2.0, skills array
│   └── marketplace.json         # NEW: self-hosted marketplace
├── skills/
│   ├── recommend/SKILL.md       # UPDATED: auto-trigger AskUserQuestion
│   ├── apply/SKILL.md           # unchanged
│   ├── review/SKILL.md          # NEW: inline browse + $EDITOR + install
│   └── team/SKILL.md            # NEW: TeamCreate or natural language
└── .mcp.json                    # unchanged
```

---

**Ready to implement.** 🫡