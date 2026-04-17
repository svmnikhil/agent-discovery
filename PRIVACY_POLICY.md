# Privacy Policy

**Last updated:** April 17, 2026  
**Plugin:** agent-discovery  
**Author:** Nikhil Sivapuram  
**Repository:** https://github.com/svmnikhil/agent-discovery

---

## 1. Overview

Agent Discovery ("the Plugin") is a Claude Code plugin that helps developers discover, review, and install AI agent configurations from a pre-built catalog. This policy describes what data the Plugin collects, how it's processed, where it's stored, and what it doesn't do.

**The short version:** The Plugin runs entirely on your machine. It does not collect, transmit, or store personal data. The only network requests it makes are to fetch public agent content from GitHub when you explicitly request it.

---

## 2. Data Collection

### 2.1 What We Do NOT Collect

The Plugin does **not**:

- Collect personal information, identifiers, or user profiles
- Transmit usage statistics, analytics, or telemetry
- Track searches, installations, or any user behavior
- Use cookies, local storage tokens, or tracking mechanisms
- Share any data with third parties
- Require user accounts, registration, or authentication

### 2.2 What Data the Plugin Processes

| Data | Where | Purpose | Retention |
|------|-------|---------|-----------|
| Catalog database (`catalog.db`) | Bundled with Plugin, read from local disk | Search and browse 687+ agent entries | Deleted when Plugin is uninstalled |
| Agent markdown content | Fetched on-demand from `raw.githubusercontent.com` | Display agent details when user requests them | Not stored; discarded after display |
| Installed agent files | Written to user's project directory (`.claude/`, `.github/`) | Provide the installed agent to Claude Code | User-controlled; persists until deleted |
| Project context (file names, configs) | Read from local filesystem during `/recommend` | Detect tech stack for relevant recommendations | Not stored or transmitted; processed in-session only |

---

## 3. Network Activity

### 3.1 Network Requests

The Plugin makes network requests **only** in the following circumstances:

| When | Where | What | Authentication |
|------|-------|------|---------------|
| User runs `get_agent_details` or `download_agent` | `raw.githubusercontent.com` | Fetches public markdown content for a specific agent | None required |
| Catalog build (developer/publisher action only) | `awesome-copilot.github.com`, GitHub API | Fetches source data to build `catalog.db` | `GITHUB_TOKEN` (build-time only, not used at runtime) |

**No network requests are made for:** searching the catalog, browsing entries, listing installed agents, or any other Plugin operation. The catalog is bundled locally and all search runs in-memory.

### 3.2 Data in Transit

- Network requests use HTTPS encryption
- Requests include a `User-Agent: agent-discovery-mcp/1.0` header for server compatibility — this is a standard practice header, not a tracking identifier
- No authentication tokens, API keys, or user identifiers are included in requests at runtime
- The Plugin does not send your code, file contents, project structure, or search queries to any server

### 3.3 Third-Party Services

The Plugin interacts with:

- **GitHub** (`raw.githubusercontent.com`) — to fetch publicly available agent configuration files. GitHub's [Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) applies to their service. We do not share any data with GitHub beyond the standard HTTP request to retrieve a public file.

No other third-party services are contacted.

---

## 4. Data Storage

### 4.1 Local Storage

All data remains on the user's local machine:

- **`catalog.db`** — Bundled with the Plugin, read-only at runtime
- **`.cache/`** — Optional local cache directory for fetched agent content (configurable via `CACHE_DIR` environment variable). Contains only markdown files fetched from public GitHub URLs
- **Installed files** — Agents, skills, and instructions written to the user's project directory at their explicit request

### 4.2 No Cloud Storage

The Plugin does not upload, sync, or back up any data to cloud services, remote servers, or any infrastructure controlled by the author.

---

## 5. User Control

Users have full control over their data:

- **Search queries** are processed in-memory and not persisted
- **Agent installations** write files to directories the user can see, edit, and delete
- **Cached content** can be cleared by deleting the `.cache/` directory
- **Complete removal** — uninstalling the Plugin removes all Plugin code; user-installed agent files remain in their project directories under the user's control

---

## 6. Children's Privacy

The Plugin is a developer tool intended for use by software professionals. It does not knowingly collect data from children under 13, and because it collects no personal data whatsoever, COPPA compliance is inherently satisfied.

---

## 7. International Users

The Plugin does not collect or process personal data from users in any jurisdiction. Since no personal data crosses borders (or leaves the user's machine), GDPR, CCPA, PIPEDA, and similar regulations regarding data transfer, processing, and storage are not applicable. That said, we respect all privacy frameworks as a matter of principle.

### GDPR (EU)

- **Data controller:** Not applicable — no personal data is processed
- **Legal basis:** Not applicable — no processing occurs
- **Data subject rights:** No personal data exists to exercise rights over
- **DPO:** Not required — no personal data processing

### CCPA (California)

- **Personal information sold:** None
- **Personal information shared:** None
- **Right to know:** This policy fully discloses all data practices
- **Right to delete:** No personal data held; user-controlled files can be deleted by the user at any time

### PIPEDA (Canada)

- **Consent:** Not required — no personal information collected
- **Purpose limitation:** No purposes exist beyond local Plugin operation
- **Access/correction:** No personal information held

---

## 8. Security

The Plugin:

- Runs as a local MCP server over stdio (no network listener, no open ports)
- Does not store credentials, tokens, or secrets at runtime
- Uses HTTPS for all network requests
- Reads catalog data from a read-only bundled database
- Writes files only to user-specified directories with explicit user initiation

**Limitations:** Agent content is fetched from public GitHub URLs. While GitHub enforces HTTPS, the content itself is sourced from public repositories and may be modified by repository owners. The Plugin does not verify the integrity or authenticity of fetched content beyond confirming a successful HTTPS response.

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last updated" date at the top of this document. Continued use of the Plugin after changes constitutes acceptance of the revised policy.

Significant changes will be noted in the Plugin's release notes on the [GitHub repository](https://github.com/svmnikhil/agent-discovery).

---

## 10. Contact

For questions about this Privacy Policy or the Plugin's data practices:

- **GitHub Issues:** https://github.com/svmnikhil/agent-discovery/issues
- **Author:** Nikhil Sivapuram — https://github.com/svmnikhil

---

*This privacy policy applies to the agent-discovery Claude Code plugin only. It does not cover Claude Code itself, Anthropic's services, GitHub's services, or any other third-party tools.*