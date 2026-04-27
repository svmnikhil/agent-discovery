# Agent Discovery for GitHub Copilot

**Search and install 390+ AI agent configurations from the awesome-copilot catalog — without leaving Copilot Chat.**

![demo](images/demo.gif)
<!-- TODO: replace with real animated demo GIF before Marketplace publish -->

---

## The problem

The [awesome-copilot](https://github.com/github/awesome-copilot) catalog has hundreds of community-built AI agents, skills, and instructions. Finding the right one means browsing GitHub manually. Installing it means copying files by hand. Sharing it with your team means... hoping everyone does the same thing.

Agent Discovery solves all three in Copilot Chat.

---

## Quick start

1. Install from the VS Code Marketplace *(coming soon — use dev mode for now, see below)*
2. Open GitHub Copilot Chat (`Ctrl+Shift+I` / `Cmd+Shift+I`)
3. Type `@agent-discovery` and start searching

**Dev mode install:**
```bash
git clone https://github.com/svmnikhil/agent-discovery.git
cd agent-discovery/extensions/vscode-copilot
npm run prepare
code --extensionDevelopmentPath=$(pwd) /your/project
```

---

## Commands

| Command | What it does |
|---|---|
| `@agent-discovery <query>` | BM25-ranked search over 390+ agents, skills, and instructions — instant, no API keys |
| `@agent-discovery /install <name>` | Download and install an agent to your workspace (`.claude/agents/`, `.github/instructions/`, or `.claude/skills/`) |
| `@agent-discovery /apm` | Scan installed agents → generate `apm.yml` → optionally run `apm install` to reproduce the setup on any machine |

**Examples:**
```
@agent-discovery code review
@agent-discovery react frontend testing
@agent-discovery azure deployment security
@agent-discovery /install Grumpy Reviewer
@agent-discovery /apm
```

---

## Team portability with APM

`/apm` generates an [Agent Package Manager](https://github.com/microsoft/apm) manifest:

```yaml
name: my-project
version: 1.0.0
dependencies:
  apm:
    - github/awesome-copilot/agents/grumpy-reviewer.agent.md
    - github/awesome-copilot/agents/expert-react-frontend-engineer.agent.md
```

Commit `apm.yml` to your repo. Every developer who clones it gets the same agent setup via `apm install` — no manual file copying, no drift.

**APM is zero-install.** Clicking "Install agents now" in the `/apm` response downloads the APM binary automatically on first use and caches it — same pattern as the C# or Python language server extensions.

---

## Requirements

- VS Code 1.100 or later
- GitHub Copilot subscription (Chat panel must be active)

---

## Privacy

This extension **does not collect any usage data, telemetry, or analytics.** All catalog search runs locally against a bundled JSON file (no network calls for search). Network is used only when installing an agent (fetching the agent file from `raw.githubusercontent.com`) or downloading the APM binary on first use.

---

## Built on

- [github/awesome-copilot](https://github.com/github/awesome-copilot) — the community agent catalog
- [microsoft/apm](https://github.com/microsoft/apm) — Agent Package Manager
- Also accepted into [Anthropic's Claude Code plugin marketplace](https://github.com/svmnikhil/agent-discovery) — dual-platform, same catalog

---

## License

MIT
