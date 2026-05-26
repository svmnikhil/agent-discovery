#!/usr/bin/env node

/**
 * Agent Discovery — HTTP MCP server for Confluent Cloud Streaming Agents.
 *
 * This is the HTTP counterpart of src/mcp-server.ts (which uses stdio for
 * Claude Code). Confluent Cloud Flink agents call into this server via the
 * `CREATE TOOL ... USING CONNECTION ... 'type' = 'mcp'` primitive.
 *
 * Tools exposed (deliberately small surface for the streaming agent):
 *   • get_current_team             — read the project's current apm.yml
 *   • search_catalog_for_category  — top-N catalog agents for a pain-point category
 *   • propose_team_change          — write proposed apm.yml + AGENTS.md to disk
 *
 * Transport: Streamable HTTP (replaces the deprecated SSE transport).
 * Auth: Bearer token in the Authorization header, matched against
 *       process.env.MCP_BEARER_TOKEN.
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

import {
  searchAgents,
  findByName,
  findByPartialName,
} from "./catalog.js";
import { CATEGORY_QUERIES, isKnownCategory } from "./categories.js";
import { agentNameFromDepPath, readApmFile } from "./apm-parser.js";
import {
  writeProposal,
  type ProposedChange,
  type ProposalInput,
} from "./proposals.js";

// ─── .env loader (avoid dotenv dep) ─────────────────────────────────────
// Loads `.env` from the current working directory before reading any env
// vars. Mirrors scripts/seed-events.ts so both entry points behave the
// same way when invoked with `npm run …` or directly.

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnvFile();

// ─── Env config ─────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN;
const SERVER_REPO_ROOT = path.resolve(
  process.env.SERVER_REPO_ROOT ?? process.cwd()
);
const PROPOSALS_DIR = path.resolve(
  process.env.PROPOSALS_DIR ?? path.join(SERVER_REPO_ROOT, "proposals")
);

if (!BEARER_TOKEN) {
  console.error(
    "FATAL: MCP_BEARER_TOKEN env var is required. Generate one with `openssl rand -hex 32`."
  );
  process.exit(1);
}

// ─── MCP server factory ─────────────────────────────────────────────────

function createServer(): McpServer {
  const server = new McpServer(
    { name: "agent-discovery-http", version: "2.0.0" },
    { capabilities: { logging: {} } }
  );

  // Tool 1: get_current_team
  server.registerTool(
    "get_current_team",
    {
      description:
        "Read the project's current AI agent team from its apm.yml. Returns the list of agent names currently configured. The repo_path argument is treated as a label only — the MCP server reads its own apm.yml.",
      inputSchema: {
        repo_path: z
          .string()
          .describe("Logical repo label (e.g. 'my-org/my-repo'). Not a filesystem path."),
      },
    },
    async ({ repo_path }) => {
      const doc = readApmFile(SERVER_REPO_ROOT);
      if (!doc) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  repo: repo_path,
                  found: false,
                  team: [],
                  message: "No apm.yml found at the server's repo root.",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const team = doc.apmDeps.map(agentNameFromDepPath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                repo: repo_path,
                found: true,
                project_name: doc.name,
                project_version: doc.version,
                team,
                team_deps: doc.apmDeps,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 2: search_catalog_for_category
  server.registerTool(
    "search_catalog_for_category",
    {
      description:
        "Find the top-N catalog agents that match a project pain-point category. Categories: auth, testing, security, performance, database. Returns ranked candidate agents with their dep_paths suitable for inclusion in apm.yml.",
      inputSchema: {
        category: z
          .string()
          .describe("One of: auth, testing, security, performance, database."),
        limit: z
          .number()
          .int()
          .optional()
          .default(5)
          .describe("Maximum number of candidates to return (default 5)."),
      },
    },
    async ({ category, limit }) => {
      const normalized = category.toLowerCase().trim();
      if (!isKnownCategory(normalized)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  category,
                  error: `Unknown category '${category}'. Known: ${Object.keys(
                    CATEGORY_QUERIES
                  ).join(", ")}.`,
                  candidates: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const queries = CATEGORY_QUERIES[normalized];
      const merged = new Map<
        string,
        {
          name: string;
          type: string;
          source: string;
          description: string;
          fileName: string;
          dep_path: string;
          best_query: string;
          score: number;
        }
      >();

      for (const q of queries) {
        const results = await searchAgents(q, "all", limit ?? 5);
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const dep_path = depPathFor(r);
          const rank = (results.length - i) / results.length;
          const existing = merged.get(r.name);
          if (!existing || rank > existing.score) {
            merged.set(r.name, {
              name: r.name,
              type: r.type,
              source: r.source,
              description: r.description,
              fileName: r.fileName,
              dep_path,
              best_query: q,
              score: rank,
            });
          }
        }
      }

      const candidates = Array.from(merged.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit ?? 5);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ category: normalized, queries, candidates }, null, 2),
          },
        ],
      };
    }
  );

  // Tool 3: propose_team_change
  server.registerTool(
    "propose_team_change",
    {
      description:
        "Write a proposed team change to disk: apm.yml.proposed, apm.yml.diff, AGENTS.md.proposed, and summary.json. Returns paths to the artifacts. Pass an empty `changes` array to record a 'no change' outcome (still writes summary.json for audit).",
      inputSchema: {
        repo_path: z.string().describe("Logical repo label."),
        eval_id: z
          .string()
          .optional()
          .describe("Evaluation ID. If omitted, a UUID-like id is generated."),
        trigger_category: z.string().describe("The category that triggered this evaluation."),
        trigger_event_count: z.number().int().optional(),
        trigger_window_start: z.string().optional(),
        trigger_window_end: z.string().optional(),
        sample_events: z
          .array(
            z.object({
              title: z.string(),
              source: z.string().optional(),
            })
          )
          .optional(),
        changes: z
          .array(
            z.object({
              op: z.enum(["add", "remove"]),
              agent: z.string(),
              dep_path: z.string().optional(),
              reason: z.string(),
            })
          )
          .describe("List of proposed changes. Empty array for 'no change' outcomes."),
        reason: z
          .string()
          .describe("1–2 sentence natural language summary of why this evaluation fired."),
      },
    },
    async (args) => {
      const eval_id =
        args.eval_id ?? `eval-${new Date().toISOString().replace(/[:.]/g, "-")}-${shortId()}`;

      const currentDoc = readApmFile(SERVER_REPO_ROOT);
      const currentTeam = currentDoc
        ? currentDoc.apmDeps.map(agentNameFromDepPath)
        : [];

      const input: ProposalInput = {
        repo_path: args.repo_path,
        eval_id,
        trigger_category: args.trigger_category,
        trigger_event_count: args.trigger_event_count,
        trigger_window_start: args.trigger_window_start,
        trigger_window_end: args.trigger_window_end,
        sample_events: args.sample_events,
        current_team: currentTeam,
        changes: args.changes as ProposedChange[],
        reason: args.reason,
      };

      const artifacts = writeProposal(PROPOSALS_DIR, SERVER_REPO_ROOT, input);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                eval_id,
                status: artifacts.status,
                proposal_dir: artifacts.proposalDir,
                files: {
                  apm_yml_proposed: artifacts.apmProposedPath,
                  apm_yml_diff: artifacts.apmDiffPath,
                  agents_md_proposed: artifacts.agentsMdProposedPath,
                  summary: artifacts.summaryPath,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

// Build the APM dep path for a catalog entry. Mirrors extension.ts:depLine.
function depPathFor(entry: {
  source: string;
  type: string;
  fileName: string;
  name: string;
  url: string;
}): string {
  if (entry.source === "awesome-copilot") {
    const folder =
      entry.type === "agent"
        ? "agents"
        : entry.type === "skill"
        ? "skills"
        : "instructions";
    return `github/awesome-copilot/${folder}/${entry.fileName}`;
  }
  if (entry.source === "gh-aw") {
    return `github/gh-aw/.github/agents/${entry.fileName}`;
  }
  return entry.url;
}

function shortId(): string {
  return crypto.randomBytes(4).toString("hex");
}

// ─── Express app + HTTP wiring ──────────────────────────────────────────

function requireBearer(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.header("authorization") ?? req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match || match[1] !== BEARER_TOKEN) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: invalid or missing bearer token" },
      id: null,
    });
    return;
  }
  next();
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, version: "2.0.0", proposals_dir: PROPOSALS_DIR });
});

app.post("/mcp", requireBearer, async (req, res) => {
  // Stateless per-request server — same shape as MCP SDK's
  // simpleStatelessStreamableHttp example.
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Method-not-allowed for GET/DELETE on /mcp (we run stateless, no SSE).
app.all("/mcp", (req, res) => {
  if (req.method === "POST") return;
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed; POST only on /mcp." },
    id: null,
  });
});

app.listen(PORT, HOST, () => {
  console.log(`agent-discovery HTTP MCP server listening on http://${HOST}:${PORT}`);
  console.log(`  /healthz       — health probe (no auth)`);
  console.log(`  POST /mcp      — MCP endpoint (bearer auth required)`);
  console.log(`  server repo    = ${SERVER_REPO_ROOT}`);
  console.log(`  proposals dir  = ${PROPOSALS_DIR}`);
});
