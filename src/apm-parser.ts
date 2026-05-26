/**
 * Minimal apm.yml parser/writer.
 *
 * apm.yml has a known shape — we only care about the dependencies.apm list,
 * which is what the streaming agent reasons about. We avoid pulling in a YAML
 * dependency by parsing this small surface by hand.
 *
 * Shape we support:
 *
 *   name: <string>
 *   version: <string>
 *   dependencies:
 *     apm:
 *       - <path>            # e.g. "github/awesome-copilot/agents/grumpy-reviewer.agent.md"
 *       - <path>
 *     mcp:                  # optional; preserved on write but not reasoned about
 *       - name: <string>
 *         command: <string>
 *         args: [...]
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ApmDocument {
  name: string;
  version: string;
  apmDeps: string[];        // dependency lines from `dependencies.apm`
  mcpLines: string[];       // raw lines from `dependencies.mcp` (preserved)
  preamble: string[];       // header comments before `name:`
}

/**
 * Extract the bare agent name from an APM dependency path.
 * "github/awesome-copilot/agents/grumpy-reviewer.agent.md" → "grumpy-reviewer"
 * "svmnikhil/agent-discovery" → "agent-discovery"
 */
export function agentNameFromDepPath(dep: string): string {
  const last = dep.split("/").pop() ?? dep;
  return last.replace(/\.agent\.md$/, "").replace(/\.md$/, "");
}

export function parseApmYml(content: string): ApmDocument {
  const lines = content.split(/\r?\n/);
  const doc: ApmDocument = {
    name: "",
    version: "",
    apmDeps: [],
    mcpLines: [],
    preamble: [],
  };

  let mode: "preamble" | "top" | "apm" | "mcp" = "preamble";
  let mcpIndent = -1;

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    if (mode === "preamble") {
      if (/^name\s*:/.test(trimmed)) {
        mode = "top";
      } else {
        doc.preamble.push(line);
        continue;
      }
    }

    const nameMatch = /^name\s*:\s*(.+)\s*$/.exec(trimmed);
    if (nameMatch) {
      doc.name = nameMatch[1];
      continue;
    }
    const versionMatch = /^version\s*:\s*(.+)\s*$/.exec(trimmed);
    if (versionMatch) {
      doc.version = versionMatch[1];
      continue;
    }

    if (/^dependencies\s*:\s*$/.test(trimmed)) {
      mode = "top";
      continue;
    }
    if (/^apm\s*:\s*$/.test(trimmed)) {
      mode = "apm";
      continue;
    }
    if (/^mcp\s*:\s*$/.test(trimmed)) {
      mode = "mcp";
      mcpIndent = -1;
      continue;
    }

    if (mode === "apm") {
      const depMatch = /^-\s+(.+?)\s*(?:#.*)?$/.exec(trimmed);
      if (depMatch) {
        doc.apmDeps.push(depMatch[1]);
        continue;
      }
      // Comment or blank inside apm: list — keep going; we don't preserve apm comments
      if (trimmed.startsWith("#") || trimmed === "") continue;
      // Anything else means we've exited the apm: block
      mode = "top";
    }

    if (mode === "mcp") {
      // Preserve mcp: block verbatim so a round-trip rewrite doesn't lose it.
      if (mcpIndent === -1 && trimmed !== "" && !trimmed.startsWith("#")) {
        mcpIndent = line.length - line.trimStart().length;
      }
      doc.mcpLines.push(line);
      continue;
    }
  }

  return doc;
}

export function serializeApmYml(doc: ApmDocument): string {
  const parts: string[] = [];

  if (doc.preamble.length > 0) {
    parts.push(doc.preamble.join("\n"));
    if (!parts[parts.length - 1].endsWith("\n")) parts.push("");
  }

  parts.push(`name: ${doc.name}`);
  parts.push(`version: ${doc.version}`);
  parts.push("");
  parts.push("dependencies:");
  parts.push("  apm:");
  for (const dep of doc.apmDeps) {
    parts.push(`    - ${dep}`);
  }

  if (doc.mcpLines.length > 0) {
    parts.push("");
    parts.push("  mcp:");
    for (const line of doc.mcpLines) {
      parts.push(line);
    }
  }

  return parts.join("\n") + "\n";
}

/** Load apm.yml from disk; returns null if missing. */
export function readApmFile(repoRoot: string): ApmDocument | null {
  const apmPath = path.join(repoRoot, "apm.yml");
  if (!fs.existsSync(apmPath)) return null;
  return parseApmYml(fs.readFileSync(apmPath, "utf-8"));
}
