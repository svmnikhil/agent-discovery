# Product Improvements Analysis

## v2.0 Architecture — Resolved Items

The following gaps from v1.0 have been addressed by the v2.0 pre-built SQLite catalog refactor:

### ✅ Resolved: No Auth Required
**Was:** Users needed GitHub API access for some sources.
**Now:** Catalog is bundled at publish time. Zero auth, zero setup. Content fetched from raw.githubusercontent.com (no auth needed).

### ✅ Resolved: Skills Download Supported
**Was:** `download_agent` only worked for agents, not skills or instructions (277 skills inaccessible).
**Now:** `download_agent` routes by type: agents → `.claude/agents/`, instructions → `.github/instructions/`, skills → `.claude/skills/`.

### ✅ Resolved: Multi-Source Catalog
**Was:** Single source (awesome-copilot llms.txt) hardcoded.
**Now:** Source adapters with `sources.json` config. Currently: awesome-copilot (676 entries) + gh-aw (11 entries). Adding new sources = config change, not code change.

### ✅ Resolved: Cross-Source Dedup
**Was:** No dedup — identical agents from different sources would appear as separate results.
**Now:** Jaccard similarity + name overlap clustering. Similar entries across sources show "⚡ Also available from:" with alternatives.

### ✅ Resolved: Search Quality
**Was:** Naive keyword scan over JSON.
**Now:** BM25-style scoring with weighted name/tag/description/tool matching + prefix matching.

### ✅ Resolved: Activation Guidance
**Was:** After download, users didn't know how to activate agents.
**Now:** `download_agent` returns activation instructions per type (agent/skill/instruction).

---

## Remaining Gaps & Product Improvements

#### 🔴 Critical: No End-to-End Test in Claude Code
**Problem:** The MCP server hasn't been tested as an actual plugin in Claude Code. We know the tools compile and work via direct Node calls, but haven't verified they appear and work through the MCP protocol.

**Improvement:**
1. Install the plugin in a test Claude Code project
2. Verify all 5 tools appear in `/agent-discovery:` namespace
3. Test search_agents, recommend, download_agent flows
4. Test with both awesome-copilot and gh-aw agents

---

#### 🟡 Medium: No List Installed Items
**Problem:** No way to see what agents/skills are already installed in a project.

**Improvement:** Add `list_installed` tool:
```
list_installed(targetDir: string, type?: "agent" | "skill" | "instruction")
```

Returns:
```
Installed in .claude/agents/:
  • Grumpy Reviewer (from: gh-aw)
  • Expert React Frontend Engineer (from: awesome-copilot)
```

---

#### 🟡 Medium: No Remove/Uninstall
**Problem:** No way to remove an installed agent through the plugin.

**Improvement:** Add `uninstall_agent` tool:
```
uninstall_agent(name: string, targetDir: string)
```

---

#### 🟡 Medium: catalog_info --stats Shows Duplicate Clusters
**Problem:** Users can't see which agents overlap across sources without searching.

**Improvement:** Add `--stats` flag to catalog_info that pre-computes duplicate clusters:
```
Catalog: 687 entries from 2 sources
  awesome-copilot: 676 (203 agents, 177 instructions, 296 skills)
  gh-aw: 11 (9 agents, 2 instructions)

Potential duplicates: 3 clusters
  - "ADR" (2 variants: awesome-copilot, gh-aw)
  - "technical writing" (3 variants)
  - "reviewer" (2 variants)
```

---

#### 🟢 Low: Overwrite Prompt in apply Skill
**Problem:** If a file already exists, download fails. The skill should ask the user first.

**Current:** Error message mentions `overwrite: true`.
**Improvement:** The `/agent-discovery:apply` skill should ask: "Agent already installed. Overwrite?"

---

#### 🟢 Low: Preview Before Download
**Problem:** Users download agents without seeing the full content first.

**Improvement:** `/agent-discovery:apply` should show a preview option using `get_agent_details` before calling `download_agent`.

---

## Priority: What Devs Need Most

1. **"Does this actually work in Claude Code?"** — E2E test is the #1 blocker
2. **"What do I have installed?"** — list_installed tool
3. **"How do I remove an agent?"** — uninstall_agent tool

## Priority: What Devs DON'T Need Yet

- Overwrite prompt (low friction, can manually delete)
- Preview before download (can use get_agent_details first)
- Semantic embeddings (overkill at this scale)

---

## Test Evidence (v2.0)

### Build
```
$ npm run build-catalog
Building catalog...
Found 2 enabled source(s)
Fetching from awesome-copilot (llms-txt)...
  → 676 entries
Fetching from gh-aw (github-directory)...
  → 11 entries
Total entries: 687
Catalog written to catalog/catalog.db (248.0 KB)
```

### Search
```
$ search_agents("ADR", "all", 10)
1. Adr Writer (gh-aw)
   ⚡ Also available from: ADR Generator (awesome-copilot)

$ search_agents("code review", "all", 5)
1. Gilfoyle Code Review Mode (awesome-copilot)
2. Electron Code Review Mode Instructions (awesome-copilot)
3. Code Review Generic (awesome-copilot)
4. Gilfoyle Code Review (awesome-copilot)
5. WG Code Alchemist (awesome-copilot)

$ search_agents("azure deploy", "all", 5)
1. Azure Iac Exporter (awesome-copilot)
2. Azure AVM Bicep mode (awesome-copilot)
3. Azure AVM Terraform mode (awesome-copilot)
4. Azure Principal Architect mode (awesome-copilot)
5. Azure SaaS Architect mode (awesome-copilot)
```

---

*Updated: 2026-04-14 | Version: 2.0.0 | Plugin: agent-discovery*