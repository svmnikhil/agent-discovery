# Testing & Demo Guide — Agent Discovery for GitHub Copilot

This document is both the manual verification path and the demo video script.

---

## Prerequisites

- VS Code **1.100 or later** (`code --version`)
- **GitHub Copilot** subscription active in VS Code (Chat panel must appear)
- Node.js 18+

---

## Step 1 — Build

From the `extensions/vscode-copilot/` directory:

```bash
npm run prepare
```

This runs two steps sequentially:
1. `node scripts/export-catalog.mjs` — exports `catalog.db` → `src/catalog-data.json` (~164KB, 392 entries)
2. `node esbuild.js` — compiles to `dist/extension.js` (~182KB)

**Verify artifacts exist and are non-empty:**

```bash
ls -lh dist/extension.js src/catalog-data.json
# Expected:
#   dist/extension.js      ~182KB
#   src/catalog-data.json  ~164KB
```

---

## Step 2 — Run automated tests

```bash
npm test
```

**Expected output:**
```
Tests  16 passed (16)
Duration  ~200ms
```

All 16 tests cover: search ranking, install to filesystem, bogus-name errors, apm.yml generation, empty query, special characters, cancellation.

---

## Step 3 — Launch in VS Code (dev mode)

```bash
# From extensions/vscode-copilot/
code --extensionDevelopmentPath=$(pwd) /path/to/any/project
```

**What you should see:** VS Code opens with the extension loaded. Open the GitHub Copilot Chat panel (`Ctrl+Shift+I` / `Cmd+Shift+I`) — you should see the `@agent-discovery` participant available.

---

## Step 4 — Manual verification sequence

Run these commands in the Copilot Chat panel in order. Each has a specific expected response.

### 4a — Default search: `@agent-discovery code review`

Type exactly: `@agent-discovery code review`

**What to look for:**
- Response opens with `Found N matches for "code review":`
- **Gilfoyle Code Review Mode** should appear in the top 3 results (it's the highest BM25 scorer for this query)
- Each result shows: name with emoji (🤖 agent / ⚡ skill / 📄 instruction), description, type, source
- Response footer includes: `` **To install:** `@agent-discovery /install <name>` ``
- A "Show more results" button appears

### 4b — Install: `@agent-discovery /install Grumpy Reviewer`

Type exactly: `@agent-discovery /install Grumpy Reviewer`

**What to look for:**
- Progress indicator: "Downloading Grumpy Reviewer…"
- Success message: `✅ **Grumpy Reviewer** installed successfully!`
- File path shown: `.claude/agents/grumpy-reviewer.md`
- Activation note: "The agent is now available as a subagent in Claude Code."
- "Open installed file" button → clicking it opens `.claude/agents/grumpy-reviewer.md` in VS Code editor
- **On disk:** verify `<project>/.claude/agents/grumpy-reviewer.md` exists and contains agent instructions

### 4c — APM manifest: `@agent-discovery /apm`

Type exactly: `@agent-discovery /apm`

**What to look for:**
- "Found **1** catalog-sourced agent(s) in your workspace." (reflecting the Grumpy Reviewer just installed)
- A fenced YAML block:
  ```yaml
  name: my-project
  version: 1.0.0
  dependencies:
    apm:
      - github/awesome-copilot/agents/grumpy-reviewer.agent.md
  ```
- "Save apm.yml to workspace root" button → clicking it writes `apm.yml` and opens it in the editor
- Footer: `apm install` command shown

### 4d — APM auto-install: click "Install agents now"

After step 4c, click the **"Install agents now (apm install)"** button in the chat response.

**What to look for:**
- First run only: a VS Code notification appears: "Agent Discovery: Downloading APM…" with a progress indicator (downloads ~20MB platform binary from GitHub Releases, cached permanently in VS Code's global storage — no internet required on subsequent runs)
- An "Agent Discovery — apm install" Output Channel opens and shows:
  ```
  Fetching APM binary (first-run download may take ~30s)…
  Using APM binary: /Users/<you>/Library/Application Support/Code/User/globalStorage/svmnikhil.agent-discovery-vscode/apm-bin/0.9.4/apm
  Running: apm install
  
  ✅ apm install completed.
  ```
- A VS Code info notification: "✅ apm install completed — all agents are set up."
- Subsequent clicks: binary is already cached, skips download entirely

### 4f — Error case: `@agent-discovery /install thisdoesnotexist`

Type exactly: `@agent-discovery /install thisdoesnotexist`

**What to look for:**
- Message: `No catalog entry found for "thisdoesnotexist".`
- Suggestion to search first

### 4g — Empty query: `@agent-discovery`

Type exactly: `@agent-discovery` (no query after it)

**What to look for:**
- Help text header: `## Agent Discovery`
- Catalog count: `**392 entries** from awesome-copilot, gh-aw`
- Example queries listed

---

## Demo video script (3 minutes)

| Time | Action | What to say |
|---|---|---|
| 0:00–0:20 | Show the problem: Copilot Chat blank, mention 390+ agents exist in awesome-copilot | "There are hundreds of community AI agents — but zero way to find them without GitHub-browsing" |
| 0:20–0:45 | Type `@agent-discovery code review` | "Agent Discovery indexes the entire catalog — BM25 search, instant, no API keys" |
| 0:45–1:15 | Type `@agent-discovery /install Grumpy Reviewer` | "One command installs it to .claude/agents/ — works in Claude Code and other editors" |
| 1:15–1:30 | Open the installed file | "It's a real agent file, on disk, customizable" |
| 1:30–2:00 | Type `@agent-discovery /apm` | "The bigger story: team portability. Generate apm.yml and every dev who clones the repo runs `apm install` — same agents, every machine" |
| 2:00–2:20 | Click "Save apm.yml" button, show the file | "Commit this file. Reproducible agent setup, like package.json but for AI" |
| 2:20–2:45 | Show the Claude Code plugin working side-by-side (if time) | "Also accepted into Anthropic's official plugin marketplace — dual-platform" |
| 2:45–3:00 | Show the repo README | "Open source, MIT licensed, built for the GitHub Copilot SDK ecosystem" |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `@agent-discovery` not appearing in chat | Ensure `code --extensionDevelopmentPath` is pointing to the `extensions/vscode-copilot/` directory, not the repo root |
| "Cannot find module 'vscode'" when running Node directly | Expected — the extension must run inside VS Code; use dev mode |
| `catalog-data.json` is empty | Run `npm run build:catalog` from `extensions/vscode-copilot/` (requires `catalog.db` at repo root) |
| Install fails with network error | Check internet connectivity; content is fetched from `raw.githubusercontent.com` |
| VS Code version too old | Update to 1.100+ — the `vscode.chat.createChatParticipant` API requires it |
