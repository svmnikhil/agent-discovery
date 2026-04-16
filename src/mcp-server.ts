#!/usr/bin/env node

/**
 * Agent Discovery MCP Server
 *
 * Provides tools to discover, search, and install AI agents from a pre-built
 * SQLite catalog. No runtime fetching needed — catalog is bundled at publish time.
 *
 * Tools:
 *   search_agents   - FTS5 search on local SQLite catalog
 *   recommend       - Broad FTS5 retrieval for LLM re-ranking
 *   get_agent_details - Fetch full content from raw.githubusercontent.com
 *   download_agent  - Download and install to target directory
 *   catalog_info    - Show DB version, source count, build date
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import {
  searchAgents,
  broadSearch,
  findByName,
  findByPartialName,
  getCatalogInfo,
  getDuplicateClusters,
} from "./catalog.js";
import { convertToClaudeSubagent } from "./converter.js";
import type { CatalogEntry } from "./types.js";

// ─── HTTP fetch helper ──────────────────────────────────────────────

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "agent-discovery-mcp/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ─── Create MCP server ──────────────────────────────────────────────

const server = new McpServer({
  name: "agent-discovery",
  version: "2.0.0",
});

// ─── Tool: search_agents ────────────────────────────────────────────

server.tool(
  "search_agents",
  "Search the local catalog for agents, instructions, or skills using full-text search. No network required.",
  {
    query: z.string().describe("Search query (supports terms, AND/OR, phrases, prefix matching)"),
    type: z
      .enum(["agent", "instruction", "skill", "all"])
      .optional()
      .default("all")
      .describe("Filter by entry type"),
    limit: z.number().optional().default(20).describe("Maximum results to return"),
  },
  async ({ query, type, limit }) => {
    try {
      const results = await searchAgents(query, type, limit ?? 20);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for "${query}" (type: ${type}). Try broader terms or different keywords.`,
            },
          ],
        };
      }

      const text = results
        .map((r, i) => {
          let line = `${i + 1}. **${r.name}** [${r.type}] (${r.source})\n   ${r.description}\n   URL: ${r.url}\n   File: ${r.fileName}`;
          if ((r as any)._alternatives?.length) {
            const alts = (r as any)._alternatives
              .map((a: any) => `${a.name} (${a.source})`)
              .join(", ");
            line += `\n   ⚡ Also available from: ${alts}`;
          }
          return line;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} result(s) for "${query}":\n\n${text}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Search error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: recommend ────────────────────────────────────────────────

server.tool(
  "recommend",
  "Broad catalog search returning up to 30 candidates with descriptions for LLM re-ranking. Use this when making recommendations based on project context.",
  {
    query: z.string().describe("Search query describing what the user needs"),
    context: z
      .string()
      .optional()
      .describe("Additional context about the project or use case"),
  },
  async ({ query, context }) => {
    try {
      const searchQuery = context ? `${query} ${context}` : query;
      const candidates = await broadSearch(searchQuery, 30);

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No candidates found for "${query}". Try different keywords.`,
            },
          ],
        };
      }

      const text = candidates
        .map(
          (r, i) =>
            `${i + 1}. **${r.name}** [${r.type}] (${r.source})\n   ${r.description}${r.tools ? `\n   Tools: ${r.tools.join(", ")}` : ""}${r.tags ? `\n   Tags: ${r.tags.join(", ")}` : ""}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${candidates.length} candidate(s) for "${query}":\n\n${text}\n\nReview these candidates and recommend the most relevant ones based on the user's context.`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Recommend error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: get_agent_details ────────────────────────────────────────

server.tool(
  "get_agent_details",
  "Get full details for a specific catalog entry, including its content fetched from raw.githubusercontent.com.",
  {
    name: z.string().describe("Name of the catalog entry"),
  },
  async ({ name }) => {
    try {
      let entry = await findByName(name);

      if (!entry) {
        const partials = await findByPartialName(name);
        if (partials.length === 1) {
          entry = partials[0];
        } else if (partials.length > 1) {
          const names = partials.map((e) => `  - ${e.name}`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `No exact match for "${name}", but found ${partials.length} partial matches:\n${names}\n\nPlease use the exact name.`,
              },
            ],
          };
        } else {
          return {
            content: [{ type: "text", text: `No entry found with name "${name}".` }],
            isError: true,
          };
        }
      }

      return getDetailsForEntry(entry);
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

async function getDetailsForEntry(entry: CatalogEntry): Promise<any> {
  try {
    const content = await fetchText(entry.url);
    return {
      content: [
        {
          type: "text",
          text: `**${entry.name}** [${entry.type}] (${entry.source})\n${entry.description}\n\nSource: ${entry.url}\nFile: ${entry.fileName}\n\n---\n\n${content}`,
        },
      ],
    };
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: `Found entry "${entry.name}" but failed to fetch content: ${err.message}\n\nMetadata: ${entry.description}\nURL: ${entry.url}`,
        },
      ],
      isError: true,
    };
  }
}

// ─── Tool: download_agent ───────────────────────────────────────────

server.tool(
  "download_agent",
  "Download and install a catalog entry to the project. Routes by type: agents → .claude/agents/, instructions → .github/instructions/, skills → .claude/skills/. Auto-converts awesome-copilot agents to Claude Code subagent format.",
  {
    name: z.string().describe("Name of the catalog entry to download"),
    targetDir: z
      .string()
      .optional()
      .default(".")
      .describe("Target project directory (default: current directory)"),
    overwrite: z
      .boolean()
      .optional()
      .default(false)
      .describe("Overwrite if the file already exists"),
  },
  async ({ name, targetDir, overwrite }) => {
    try {
      let entry = await findByName(name);

      if (!entry) {
        const partials = await findByPartialName(name);
        if (partials.length > 0) {
          const names = partials.map((e) => `  - ${e.name}`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: `No exact match for "${name}". Did you mean one of these?\n${names}`,
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: `No entry found with name "${name}".` }],
          isError: true,
        };
      }

      const projectDir = path.resolve(targetDir);

      let targetSubdir: string;
      let destFileName: string;
      if (entry.type === "skill") {
        targetSubdir = ".claude/skills";
        destFileName = entry.fileName;
      } else if (entry.type === "instruction") {
        targetSubdir = ".github/instructions";
        destFileName = entry.fileName;
      } else {
        targetSubdir = ".claude/agents";
        destFileName = entry.fileName.replace(/\.agent\.md$/, ".md");
      }

      const targetPath = path.join(projectDir, targetSubdir);
      const destPath = path.join(targetPath, destFileName);

      if (fs.existsSync(destPath) && !overwrite) {
        return {
          content: [
            {
              type: "text",
              text: `File already exists at ${destPath}. Use overwrite: true to replace it.`,
            },
          ],
          isError: true,
        };
      }

      const rawContent = await fetchText(entry.url);

      // Convert awesome-copilot agents to Claude Code subagent format
      let content = rawContent;
      if (entry.type === "agent" && entry.source === "awesome-copilot") {
        content = convertToClaudeSubagent(entry.name, entry.description, rawContent);
      }

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      fs.writeFileSync(destPath, content, "utf-8");

      let activationMsg = "";
      if (entry.type === "agent") {
        activationMsg = `\n\nActivation: This agent now appears in /agents automatically.`;
      } else if (entry.type === "skill") {
        activationMsg = `\n\nActivation: This skill is auto-discovered by Claude Code when relevant.`;
      } else if (entry.type === "instruction") {
        activationMsg = `\n\nActivation: This instruction is loaded automatically for matching file patterns.`;
      }

      const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
      return {
        content: [
          {
            type: "text",
            text: `${typeLabel} "${entry.name}" installed successfully.\n\nFile: ${destPath}\nType: ${entry.type}\nSource: ${entry.source}\nDescription: ${entry.description}${activationMsg}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to download "${name}": ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: catalog_info ─────────────────────────────────────────────

server.tool(
  "catalog_info",
  "Show catalog metadata: version, entry count by type, source list, and build date. Use stats=true to show duplicate clusters across sources.",
  {
    stats: z
      .boolean()
      .optional()
      .default(false)
      .describe("Show duplicate cluster statistics across sources"),
  },
  async ({ stats }) => {
    try {
      const info = await getCatalogInfo();

      const typeLines = Object.entries(info.types)
        .map(([type, count]) => `  - ${type}: ${count}`)
        .join("\n");

      // Per-source breakdown
      const sourceLines = info.sources
        .map((source) => {
          // Count by type per source from the DB
          return `  - ${source}`;
        })
        .join("\n");

      let text = `Catalog Info:\n\nVersion: ${info.version}\nBuild date: ${info.built_at}\nSources: ${info.source_count}\n${sourceLines}\nTotal entries: ${info.entry_count}\n\nBy type:\n${typeLines}`;

      // Add duplicate cluster stats if requested
      if (stats) {
        const clusters = await getDuplicateClusters();
        if (clusters.length > 0) {
          text += `\n\nPotential duplicates: ${clusters.length} cluster(s)`;
          for (const cluster of clusters) {
            const entries = cluster.entries
              .map((e) => `${e.name} (${e.source})`)
              .join(", ");
            text += `\n  - "${cluster.label}": ${entries}`;
          }
        } else {
          text += `\n\nNo duplicate clusters found across sources.`;
        }
      }

      return {
        content: [{ type: "text", text }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error reading catalog: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Start server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Discovery MCP server running on stdio (v2.0 — SQLite catalog)");
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
