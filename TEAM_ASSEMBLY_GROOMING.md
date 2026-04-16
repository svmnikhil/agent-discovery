# TEAM_ASSEMBLY_GROOMING.md

**Date:** 2026-04-16  
**Feature:** Team Assembly (within `/recommend` single-command flow)  
**Status:** Groomed and integrated into recommend skill

---

## Design Decision: Single-Command Flow

**All flows are now triggered from `/recommend`:**
- `/review` — DELETED, integrated into recommend
- `/team` — DELETED, integrated into recommend
- `/apply` — KEPT for direct installation (optional use)

**User experience:**
```
/recommend [query]
  → Discover agents
  → AskUserQuestion auto-fires: Review | Install | Team | Done
  → Each branch handles the full flow inline
```

---

## Team Assembly Design (Integrated into `/recommend`)

### Flow Summary

1. **Phase 0:** Pre-flight teams check
2. **Phase 1:** Discover agents
3. **Phase 2:** AskUserQuestion (Review | Install | Team | Done)
4. **Phase 3C:** If "Team":
   - Select team members (multiSelect)
   - Team focus picker
   - Built-in agents picker (optional)
   - Create team with TeamCreate or provide natural language prompt

---

## Enhancement 1: Agentic Team Lead ✅ INTEGRATED

**Implemented in `/recommend`:**

The team lead configuration is included in the TeamCreate call:
```json
{
  "lead": {
    "model": "sonnet",
    "instructions": "You are an agentic team lead with autonomous coordination authority..."
  }
}
```

**Agentic lead responsibilities:**
- Autonomously assigns tasks
- Monitors progress and reassigns when stuck
- Validates outputs against quality criteria
- Requests revisions when work falls short
- Synthesizes results
- Minimizes human-in-the-loop

---

## Enhancement 2: Built-in Agents ✅ INTEGRATED

**Implemented in `/recommend`:**

AskUserQuestion after team focus selection:
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
  }]}
```

**Built-in agents table:**

| Agent | Model | Purpose | When to Include |
|-------|-------|---------|----------------|
| **Explore** | Haiku | Fast read-only search | Research, file discovery |
| **Plan** | Inherits | Pre-implementation research | Architecture, planning |
| **General-purpose** | Inherits | Complex tasks | Implementation, debugging |

---

## Enhancement 3: Team Composition Intelligence (FUTURE)

**NOT implemented in v0.2.0.**

Potential future feature:
- Suggest optimal agent combinations based on team focus
- Detect role/file conflicts
- Recommend complementary built-ins

---

## Open Questions (RESOLVED)

### Q1: Agentic Lead — Main session or dedicated?
**Resolution:** The main Claude session IS the team lead. TeamCreate spawns teammates, but the lead role stays with the user's main session. The "agentic lead instructions" are embedded in the natural language prompt for the session.

### Q2: Built-in Agents — Suggest based on focus or let user pick?
**Resolution:** Let user pick freely via AskUserQuestion. Future enhancement could add smart defaults.

### Q3: Quality Gates — How to encode per focus?
**Resolution:** Generic quality gates in lead instructions:
- Code changes must pass review
- Research must be comprehensive
- Tests must cover edge cases
- Deliverables must be actionable

### Q4: Team Size Limits?
**Resolution:** No hard limits. Docs recommend 3-5 members. User is responsible for sensible composition.

---

## Files Changed

| File | Status |
|------|--------|
| `skills/recommend/SKILL.md` | UPDATED — full inline flow with review, install, team |
| `skills/review/SKILL.md` | DELETED — integrated into recommend |
| `skills/team/SKILL.md` | DELETED — integrated into recommend |
| `skills/apply/SKILL.md` | KEPT — optional direct installation |

---

**Status:** Design complete, ready for testing.