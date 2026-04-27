# Changelog

## [0.1.0] — 2025-04-27

### Added

- `@agent-discovery` GitHub Copilot Chat participant
- **Search** (`@agent-discovery <query>`): BM25-ranked search over 392 catalog entries (213 agents, 178 instructions, 1 skill) from awesome-copilot and GitHub's Agent Factory — instant, runs entirely offline against a bundled catalog, no API keys required
- **Install** (`@agent-discovery /install <name>`): downloads and writes agent files to the correct workspace directory (`.claude/agents/` for agents, `.github/instructions/` for instructions, `.claude/skills/` for skills); detects already-installed files and won't overwrite
- **APM manifest** (`@agent-discovery /apm`): scans workspace for installed catalog entries and generates an `apm.yml` manifest; includes "Save to workspace" and "Install agents now" buttons
- **APM auto-install**: the APM CLI binary is downloaded automatically on first use from GitHub Releases and cached in VS Code's global storage — no manual install step required
- "Show more results" quick-pick for browsing beyond the top 8 results
- Follow-up suggestions after each response
- Cross-platform APM support: macOS (arm64/x64), Linux (arm64/x64), Windows (x64)
