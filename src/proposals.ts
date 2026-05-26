/**
 * Proposal writers — produce the artifacts a Confluent Streaming Agent emits
 * via the propose_team_change MCP tool.
 *
 * Per evaluation cycle we write a directory:
 *
 *   proposals/<eval_id>/
 *     apm.yml.proposed       — full proposed apm.yml after applying changes
 *     apm.yml.diff           — unified diff vs. the current apm.yml
 *     AGENTS.md.proposed     — regenerated team-summary fragment for AGENTS.md
 *     summary.json           — machine-readable summary that mirrors the
 *                              team.eval.outcome event payload
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ApmDocument } from "./apm-parser.js";
import {
  agentNameFromDepPath,
  readApmFile,
  serializeApmYml,
} from "./apm-parser.js";

export interface ProposedChange {
  op: "add" | "remove";
  agent: string;            // bare agent name, e.g. "grumpy-reviewer"
  dep_path?: string;        // catalog dep path; required for "add"
  reason: string;
}

export interface ProposalInput {
  repo_path: string;        // logical label (NOT a filesystem path)
  eval_id: string;
  trigger_category: string;
  trigger_event_count?: number;
  trigger_window_start?: string;
  trigger_window_end?: string;
  sample_events?: Array<{ title?: string; source?: string }>;
  current_team: string[];   // bare agent names currently in the team
  changes: ProposedChange[];
  reason: string;
}

export interface ProposalArtifacts {
  proposalDir: string;
  apmProposedPath: string;
  apmDiffPath: string;
  agentsMdProposedPath: string;
  summaryPath: string;
  status: "no_change" | "proposed";
}

/**
 * Apply a list of changes to an apm.yml document.
 * - "add" appends the dep_path if not already in apmDeps.
 * - "remove" removes any dep whose agentNameFromDepPath() matches the agent.
 */
function applyChanges(doc: ApmDocument, changes: ProposedChange[]): ApmDocument {
  const next = {
    ...doc,
    apmDeps: [...doc.apmDeps],
    mcpLines: [...doc.mcpLines],
    preamble: [...doc.preamble],
  };

  for (const change of changes) {
    if (change.op === "add") {
      if (!change.dep_path) continue;
      const already = next.apmDeps.some(
        (d) => agentNameFromDepPath(d) === change.agent
      );
      if (!already) next.apmDeps.push(change.dep_path);
    } else if (change.op === "remove") {
      next.apmDeps = next.apmDeps.filter(
        (d) => agentNameFromDepPath(d) !== change.agent
      );
    }
  }

  return next;
}

/** Tiny unified-diff generator — no external dep. Good enough for human review. */
function unifiedDiff(
  oldText: string,
  newText: string,
  oldLabel = "current",
  newLabel = "proposed"
): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const out: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      out.push(` ${oldLines[i]}`);
      i++;
      j++;
      continue;
    }
    // Find next matching line within a small window
    let advanced = false;
    for (let k = 1; k <= 5 && i + k < oldLines.length; k++) {
      if (oldLines[i + k] === newLines[j]) {
        for (let r = 0; r < k; r++) out.push(`-${oldLines[i + r]}`);
        i += k;
        advanced = true;
        break;
      }
    }
    if (advanced) continue;
    for (let k = 1; k <= 5 && j + k < newLines.length; k++) {
      if (newLines[j + k] === oldLines[i]) {
        for (let r = 0; r < k; r++) out.push(`+${newLines[j + r]}`);
        j += k;
        advanced = true;
        break;
      }
    }
    if (advanced) continue;
    // Fallback: emit one removal and one addition
    if (i < oldLines.length) {
      out.push(`-${oldLines[i]}`);
      i++;
    }
    if (j < newLines.length) {
      out.push(`+${newLines[j]}`);
      j++;
    }
  }
  return out.join("\n");
}

function renderAgentsMdFragment(
  input: ProposalInput,
  proposedTeam: string[],
  status: "no_change" | "proposed"
): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push("# Team Evaluation Proposal");
  lines.push("");
  lines.push(`- **Evaluation ID:** \`${input.eval_id}\``);
  lines.push(`- **Repo:** \`${input.repo_path}\``);
  lines.push(`- **Status:** \`${status}\``);
  lines.push(`- **Trigger category:** \`${input.trigger_category}\``);
  if (input.trigger_event_count !== undefined) {
    lines.push(`- **Event count in window:** ${input.trigger_event_count}`);
  }
  if (input.trigger_window_start && input.trigger_window_end) {
    lines.push(
      `- **Window:** ${input.trigger_window_start} → ${input.trigger_window_end}`
    );
  }
  lines.push(`- **Generated:** ${now}`);
  lines.push("");

  lines.push("## Why this evaluation fired");
  lines.push("");
  lines.push(input.reason || "(no reason provided)");
  lines.push("");

  if (input.sample_events && input.sample_events.length > 0) {
    lines.push("### Sample events that triggered this");
    lines.push("");
    for (const ev of input.sample_events.slice(0, 5)) {
      const src = ev.source ? ` _(${ev.source})_` : "";
      const title = ev.title ?? "(untitled event)";
      lines.push(`- ${title}${src}`);
    }
    lines.push("");
  }

  lines.push("## Current team");
  lines.push("");
  if (input.current_team.length === 0) {
    lines.push("_(empty)_");
  } else {
    for (const a of input.current_team) lines.push(`- ${a}`);
  }
  lines.push("");

  if (status === "no_change") {
    lines.push("## Recommendation");
    lines.push("");
    lines.push(
      "**No team changes recommended.** The current team already covers the surge category."
    );
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Proposed changes");
  lines.push("");
  for (const c of input.changes) {
    const verb = c.op === "add" ? "Add" : "Remove";
    lines.push(`- **${verb}** \`${c.agent}\` — ${c.reason}`);
  }
  lines.push("");

  lines.push("## Proposed team (after applying changes)");
  lines.push("");
  if (proposedTeam.length === 0) {
    lines.push("_(empty)_");
  } else {
    for (const a of proposedTeam) lines.push(`- ${a}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Review `apm.yml.proposed` and `apm.yml.diff` in this directory. If you approve the change, copy `apm.yml.proposed` over the project's `apm.yml` and run `apm install`."
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Write all proposal artifacts to disk. Idempotent on the eval_id directory.
 */
export function writeProposal(
  proposalsRoot: string,
  serverRepoRoot: string,
  input: ProposalInput
): ProposalArtifacts {
  if (!fs.existsSync(proposalsRoot)) {
    fs.mkdirSync(proposalsRoot, { recursive: true });
  }
  const proposalDir = path.join(proposalsRoot, input.eval_id);
  if (!fs.existsSync(proposalDir)) {
    fs.mkdirSync(proposalDir, { recursive: true });
  }

  // Read the current apm.yml from the server's own repo root.
  // The repo_path argument is a logical label, not a filesystem path —
  // the MCP server never trusts arbitrary client-supplied paths.
  const currentDoc = readApmFile(serverRepoRoot);

  let proposedDoc: ApmDocument;
  let proposedYaml: string;
  let currentYaml: string;

  if (currentDoc) {
    proposedDoc = applyChanges(currentDoc, input.changes);
    currentYaml = serializeApmYml(currentDoc);
  } else {
    // No existing apm.yml — synthesize a fresh one with just the proposed adds.
    proposedDoc = {
      name: input.repo_path || "unknown-project",
      version: "0.1.0",
      apmDeps: input.changes
        .filter((c) => c.op === "add" && !!c.dep_path)
        .map((c) => c.dep_path!),
      mcpLines: [],
      preamble: [
        `# apm.yml — generated by agent-discovery streaming agent (${input.eval_id})`,
      ],
    };
    currentYaml = "";
  }
  proposedYaml = serializeApmYml(proposedDoc);

  // Compute proposed team names for the AGENTS.md fragment
  const proposedTeam = proposedDoc.apmDeps.map(agentNameFromDepPath);

  // Decide status. If proposed deps equal current deps, it's a no_change.
  const status: "no_change" | "proposed" =
    input.changes.length === 0 ||
    proposedYaml === currentYaml
      ? "no_change"
      : "proposed";

  const apmProposedPath = path.join(proposalDir, "apm.yml.proposed");
  const apmDiffPath = path.join(proposalDir, "apm.yml.diff");
  const agentsMdProposedPath = path.join(proposalDir, "AGENTS.md.proposed");
  const summaryPath = path.join(proposalDir, "summary.json");

  fs.writeFileSync(apmProposedPath, proposedYaml, "utf-8");
  fs.writeFileSync(
    apmDiffPath,
    unifiedDiff(currentYaml, proposedYaml, "apm.yml (current)", "apm.yml (proposed)") + "\n",
    "utf-8"
  );
  fs.writeFileSync(
    agentsMdProposedPath,
    renderAgentsMdFragment(input, proposedTeam, status),
    "utf-8"
  );
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        eval_id: input.eval_id,
        repo: input.repo_path,
        status,
        trigger_category: input.trigger_category,
        trigger_event_count: input.trigger_event_count,
        trigger_window_start: input.trigger_window_start,
        trigger_window_end: input.trigger_window_end,
        sample_events: input.sample_events ?? [],
        current_team: input.current_team,
        proposed_team: proposedTeam,
        proposed_changes: input.changes,
        reason: input.reason,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );

  return {
    proposalDir,
    apmProposedPath,
    apmDiffPath,
    agentsMdProposedPath,
    summaryPath,
    status,
  };
}
