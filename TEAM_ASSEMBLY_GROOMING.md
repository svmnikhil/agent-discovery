# TEAM_ASSEMBLY_GROOMING.md

**Date:** 2026-04-16  
**Feature:** Team Assembly Enhancements  
**Status:** Grooming (not implemented)

---

## Current State

The `/team` skill currently:
- Installs agents to `.claude/agents/`
- Uses `TeamCreate` (if available) or provides natural language prompt
- Has a basic team focus picker
- No explicit agentic lead configuration
- No integration with Claude Code built-in agents

---

## Proposed Enhancements

### Enhancement 1: Agentic Team Lead (Self-Validating Loops)

**Problem:** Current teams have a passive coordinator — the lead just assigns tasks and waits. No quality gates, no autonomous validation.

**Proposed Solution:** Every team MUST have an **agentic lead** with:
- Autonomous task assignment based on capabilities
- Progress monitoring and reassignment when stuck
- **Output validation** against quality criteria before completion
- **Revision requests** when work falls short
- Result synthesis into cohesive deliverables
- Autonomous judgment calls to minimize human-in-the-loop

**Questions:**
1. Should the agentic lead be a separate agent from the main Claude session, or should we assume the main session IS the agentic lead?
2. How do we encode "quality criteria" for different team focuses? (Code review = different gates than feature development)
3. Should the lead have a specific model (Sonnet for quality reasoning) or inherit from session?

**Implementation Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A: Main session is agentic lead** | No extra spawning, simpler UX | Main session must manage team + conversation |
| **B: Spawn separate agentic lead** | Dedicated focus on coordination, cleaner separation | Extra Claude instance, more tokens |
| **C: User chooses** | Flexibility | More decisions in the flow |

**Recommended:** Option A for v0.2.0 (main session is lead), Option B/C for future.

---

### Enhancement 2: Claude Code Built-in Agents Integration

**Problem:** Teams are limited to catalog agents. Claude Code has powerful built-in agents (Explore, Plan, General-purpose) that could supplement teams.

**Claude Code Built-in Agents:**

| Agent | Model | Purpose | When to Include |
|-------|-------|---------|-----------------|
| **Explore** | Haiku | Fast read-only codebase search and file discovery | Research tasks, file finding, code search |
| **Plan** | Inherits | Research agent for gathering context before implementation | Planning phase, architecture decisions |
| **General-purpose** | Inherits | Complex multi-step tasks requiring exploration + action | Implementation tasks, debugging |

**Proposed Solution:** Add an AskUserQuestion step after team focus selection:
- "Should Claude Code's built-in agents be included?"
- multiSelect: true (can pick multiple)
- Options: Explore, Plan, General-purpose, None

**Questions:**
1. How do built-in agents interact with catalog agents? Do they overlap?
2. Should we suggest specific built-ins based on team focus? (e.g., Explore for research teams)
3. Are built-in agents available as subagent definitions for teammates, or do we reference them differently?

**From the docs:** Built-in agents are available as subagent types and can be referenced by name in the teammate list. They inherit session tools but have built-in restrictions (Explore is read-only).

**Implementation:**
- AskUserQuestion for built-in selection
- If selected, add to teammates list by name: `"explore"`, `"plan"`, `"general-purpose"`
- No installation needed — they're already available

---

### Enhancement 3: Team Composition Intelligence

**Problem:** Users pick agents manually. No guidance on whether the team composition makes sense.

**Proposed Solution:** Optional "suggest team composition" feature:
1. After team focus is selected, ask: "Want me to suggest optimal agent combinations?"
2. If yes, analyze selected agents + catalog + built-ins and suggest:
   - Best combination for the focus
   - Why this combination works
   - Potential conflicts (file ownership overlap, role conflicts)
3. User can accept, modify, or reject suggestion

**Questions:**
1. Is this LLM-powered (expensive) or rule-based (cheaper)?
2. Should suggestions include agents NOT in the original selection?
3. How do we detect role conflicts?

**Recommended:** Skip for v0.2.0. Add in v0.3.0 as "Smart Team Suggestions."

---

## Open Questions for Nikhil

1. **Agentic Lead:** Should the main session be the agentic lead (simpler) or should we spawn a dedicated lead agent (more capable but expensive)?

2. **Built-in Agents:** Should we suggest specific built-ins based on team focus, or let the user pick freely?
   - Example: "Code quality review" → suggest Explore for codebase search
   - Example: "Feature development" → suggest Plan for architecture decisions

3. **Quality Gates:** What quality criteria should the agentic lead enforce for different focuses?
   - Code review: tests pass, no security issues, code style
   - Feature development: tests included, documentation updated
   - Research: comprehensive coverage, actionable findings

4. **Team Size:** Should we enforce or suggest team size limits? (Docs say 3-5 is optimal, 5-6 tasks per teammate)

---

## Not Implemented Yet

The following are groomed but NOT implemented in the current `/team` skill:

- [ ] Agentic lead configuration in TeamCreate call
- [ ] AskUserQuestion for built-in agent selection
- [ ] Quality gate definitions per team focus
- [ ] Team composition suggestions
- [ ] Conflict detection (file overlap, role overlap)

**Current `/team` skill:** Still uses basic TeamCreate without agentic lead or built-in integration.

---

*Groomed by Jerry | Awaiting approval to implement*