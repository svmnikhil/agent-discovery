# Product Improvements Analysis

## Phase 2 & 3 Test Results Summary

### Current Functionality Working ✅

1. **MCP Tools (5 total)**
   - `fetch_catalog` - Fetches 640 entries from awesome-copilot ✅
   - `search_agents` - Searches with type filter (agent/skill/instruction) ✅
   - `get_agent_details` - Returns full agent content ✅
   - `download_agent` - Downloads to `.github/agents/` ✅
   - `validate_agent` - Validates agent file structure ✅

2. **Catalog Types Discovered**
   - **Agents** (188): Full agent definitions with tools, expertise, guidelines
   - **Instructions** (175): Project-level instructions (like coding standards)
   - **Skills** (277): Reusable skill definitions (like autoresearch)

### Key Gaps & Product Improvements Needed

#### 🔴 Critical Gap: No Instructions for Using Installed Agents

**Problem:** After downloading an agent, developers don't know how to activate it.

**Current behavior:**
```
$ /agent-discovery:apply "Expert React Frontend Engineer"
✅ Agent downloaded to .github/agents/expert-react-frontend-engineer.agent.md
```

**What's missing:** The user has no idea what to do next. The agent file is downloaded but there's no:
1. Activation instructions
2. Usage examples
3. Information about what the agent will do when invoked

**Improvement:**
```
$ /agent-discovery:apply "Expert React Frontend Engineer"
✅ Agent installed to .github/agents/expert-react-frontend-engineer.agent.md

📖 What happens next:
   When you work in this repo, Claude Code will automatically use this agent
   when you ask about React, hooks, components, or frontend development.

   Try it:
   • "Help me build a form with React 19 Actions"
   • "Review my React component for performance"

   Agent includes: TypeScript, testing, accessibility, modern hooks expertise
```

---

#### 🔴 Critical Gap: Skills Download Not Supported

**Problem:** `download_agent` only works for agents, not skills or instructions.

**Current behavior:**
```
$ download_agent("Autoresearch")
❌ "Autoresearch" is a skill, not an agent. download_agent is for agents only.
```

**Impact:** 277 skills in catalog are inaccessible!

**Improvement:** Rename tool to `download_item` or `install_item` with type parameter:
```
download_item(name: string, type: "agent" | "skill" | "instruction", targetDir: string)
```

For skills, they should go to `.github/skills/` (not `.github/agents/`).

---

#### 🟡 Medium Gap: No List Installed Items

**Problem:** No way to see what agents/skills are already installed.

**Improvement:** Add `list_installed` tool:
```
list_installed(targetDir: string, type?: "agent" | "skill" | "instruction")
```

Returns:
```
Installed in .github/agents/:
  • Expert React Frontend Engineer (24.9 KB)
  • TypeScript Expert (15.2 KB)

Installed in .github/skills/:
  • Autoresearch (8.1 KB)
```

---

#### 🟡 Medium Gap: Search Results Don't Show Type Clearly

**Problem:** Search results show `[agent]` or `[skill]` but don't explain what each type means.

**Improvement:** Add type descriptions in search output:
```
Found 3 result(s) for "react":

1. **Expert React Frontend Engineer** [agent]
   ⚡ Agent - Full AI assistant persona with tools and expertise
   Expert React 19.2 frontend engineer...

2. **Msstore Cli** [skill]
   🔧 Skill - Reusable capability for specific tasks
   Microsoft Store Developer CLI...

3. **Agent Skills** [instruction]
   📋 Instruction - Project-level coding guidelines
   Guidelines for creating high-quality Agent Skills...
```

---

#### 🟢 Low Gap: No Overwrite Option in download_agent

**Problem:** If file exists, download fails with error.

**Current behavior:**
```
❌ Agent file already exists. Use overwrite: true to replace it.
```

**Issue:** The tool mentions `overwrite: true` but this isn't exposed via the skill interface.

**Improvement:** The `/agent-discovery:apply` skill should ask user if they want to overwrite:
```
Agent "Expert React Frontend Engineer" is already installed.
Overwrite? (yes/no)
```

---

#### 🟢 Low Gap: No Preview Before Download

**Problem:** Users download agents blind without knowing the full scope.

**Improvement:** `/agent-discovery:recommend` should show a preview option:
```
Recommended agents for your React Native project:

1. **Expert React Frontend Engineer**
   Tools: 22 available
   Expertise: React 19.2, TypeScript, testing, accessibility
   Size: 24.9 KB

   [Preview details?] [Install now?]
```

---

## Recommended Product Roadmap

### Phase 1: Activation Guidance (Critical) ✨
1. Update `download_agent` tool output to include activation instructions
2. Update `/agent-discovery:apply` skill to show "What happens next" section
3. Add example prompts that would trigger the agent

### Phase 2: Support All Catalog Types
1. Add `download_skill` and `download_instruction` tools
2. Or: Create unified `install_item` tool with type parameter
3. Update `/agent-discovery:apply` to handle all three types

### Phase 3: Management Features
1. Add `list_installed` tool
2. Add `remove_item` tool
3. Add `update_item` tool (re-download from source)

### Phase 4: Enhanced Discovery
1. Add "Preview" option before install
2. Add "Similar agents" suggestions
3. Add "Popular in your tech stack" recommendations

---

## Test Evidence

### Phase 2 Results
```json
// search_agents for "typescript"
{
  "result": {
    "content": [{
      "type": "text",
      "text": "Found 5 result(s)...\n\n1. **Apify Integration Expert** [agent]\n2. **Expert Nuxt Developer** [agent]\n3. **Expert React Frontend Engineer** [agent]\n4. **Expert Vue.js Frontend Engineer** [agent]\n5. **GitHub Actions Node Runtime Upgrade** [agent]"
    }]
  }
}
```

### Phase 3 Results
```json
// download_agent - already exists error
{
  "result": {
    "content": [{
      "type": "text",
      "text": "Agent file already exists... Use overwrite: true to replace it."
    }],
    "isError": true
  }
}

// download_agent for skill - type error
{
  "result": {
    "content": [{
      "type": "text",
      "text": "\"Autoresearch\" is a skill, not an agent. download_agent is for agents only."
    }],
    "isError": true
  }
}
```

### Agent Content Structure
```yaml
---
description: "Expert React 19.2 frontend engineer..."
name: "Expert React Frontend Engineer"
tools: ["changes", "codebase", "edit/editFiles", ...]
---

# Expert React Frontend Engineer

You are a world-class expert in React 19.2...

## Your Expertise
- React 19.2 Features
- React 19 Core Features
- Server Components
...
```

---

## Priority: What devs need MOST

**Top 3:**

1. **"How do I use this agent?"** - Activation guidance after install
2. **"What skills are available?"** - Support downloading skills, not just agents
3. **"What do I have installed?"** - List installed items

**What devs DON'T need yet:**
- Overwrite prompt (low friction)
- Preview before download (can preview in discovery phase)
- Update/remove tools (can manually manage files for now)