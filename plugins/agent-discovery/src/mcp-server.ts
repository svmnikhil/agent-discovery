#!/usr/bin/env node

/**
 * Agent Discovery MCP Server
 *
 * Provides tools to discover, search, and install custom GitHub Copilot agents
 * from the awesome-copilot catalog (llms.txt).
 *
 * Tools:
 *   fetch_catalog   - Fetch and cache the awesome-copilot llms.txt
 *   search_agents   - Search the cached catalog for agents
 *   get_agent_details - Get full details for a specific agent
 *   download_agent  - Download an agent to .claude/agents/ (Claude Code native format)
 *   validate_agent  - Validate an agent's structure
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { parseLlmsTxt } from "./parser.js";
import { readCache, writeCache, clearCache } from "./cache.js";
import type { Catalog, CatalogEntry, AgentDetails, ValidationResult } from "./types.js";

const CATALOG_URL = "https://awesome-copilot.github.com/llms.txt";
const AGENTS_DIR = ".claude/agents";

// Resolve the base directory (where the plugin lives)
const BASE_DIR = path.resolve(import.meta.dirname, "..");

// ─── HTTP fetch helper ──────────────────────────────────────────────

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "agent-discovery-mcp/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
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
  version: "1.0.0",
});

// ─── Tool: fetch_catalog ────────────────────────────────────────────

server.tool(
  "fetch_catalog",
  "Fetch the awesome-copilot llms.txt catalog, parse it, and cache it locally. Returns the number of entries found.",
  {},
  async () => {
    try {
      const raw = await fetchText(CATALOG_URL);
      const entries = parseLlmsTxt(raw);

      const catalog: Catalog = {
        fetchedAt: new Date().toISOString(),
        source: CATALOG_URL,
        entries,
      };

      writeCache(BASE_DIR, catalog);

      const typeCounts = {
        agent: entries.filter((e) => e.type === "agent").length,
        instruction: entries.filter((e) => e.type === "instruction").length,
        skill: entries.filter((e) => e.type === "skill").length,
      };

      return {
        content: [
          {
            type: "text",
            text: `Catalog fetched and cached successfully.\n\nTotal entries: ${entries.length}\n- Agents: ${typeCounts.agent}\n- Instructions: ${typeCounts.instruction}\n- Skills: ${typeCounts.skill}\n\nFetched at: ${catalog.fetchedAt}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error fetching catalog: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: search_agents ────────────────────────────────────────────

server.tool(
  "search_agents",
  "Search the cached catalog for agents, instructions, or skills matching a query.",
  {
    query: z.string().describe("Search query (keyword or phrase)"),
    type: z
      .enum(["agent", "instruction", "skill", "all"])
      .optional()
      .default("all")
      .describe("Filter by entry type"),
    limit: z.number().optional().default(20).describe("Maximum results to return"),
  },
  async ({ query, type, limit }) => {
    const catalog = readCache(BASE_DIR);
    if (!catalog) {
      return {
        content: [
          {
            type: "text",
            text: "Catalog not cached yet. Run fetch_catalog first.",
          },
        ],
        isError: true,
      };
    }

    const q = query.toLowerCase();
    let results = catalog.entries.filter((entry) => {
      // Type filter
      if (type !== "all" && entry.type !== type) return false;
      // Query match on name or description
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q)
      );
    });

    results = results.slice(0, limit ?? 20);

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No results found for "${query}" (type: ${type}). Try broader terms or fetch a fresh catalog.`,
          },
        ],
      };
    }

    const text = results
      .map(
        (r, i) =>
          `${i + 1}. **${r.name}** [${r.type}]\n   ${r.description}\n   URL: ${r.url}\n   File: ${r.fileName}`
      )
      .join("\n\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} result(s) for "${query}":\n\n${text}`,
        },
      ],
    };
  }
);

// ─── Tool: get_agent_details ────────────────────────────────────────

server.tool(
  "get_agent_details",
  "Get full details for a specific catalog entry, including its content fetched from the source URL.",
  {
    name: z.string().describe("Exact name of the catalog entry"),
  },
  async ({ name }) => {
    const catalog = readCache(BASE_DIR);
    if (!catalog) {
      return {
        content: [
          {
            type: "text",
            text: "Catalog not cached yet. Run fetch_catalog first.",
          },
        ],
        isError: true,
      };
    }

    const entry = catalog.entries.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );

    if (!entry) {
      // Try partial match
      const partial = catalog.entries.filter((e) =>
        e.name.toLowerCase().includes(name.toLowerCase())
      );
      if (partial.length === 1) {
        return getDetailsForEntry(partial[0]);
      }
      if (partial.length > 1) {
        const names = partial.map((e) => `  - ${e.name}`).join("\n");
        return {
          content: [
            {
              type: "text",
              text: `No exact match for "${name}", but found ${partial.length} partial matches:\n${names}\n\nPlease use the exact name.`,
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: `No entry found with name "${name}".` }],
        isError: true,
      };
    }

    return getDetailsForEntry(entry);
  }
);

async function getDetailsForEntry(entry: CatalogEntry): Promise<any> {
  try {
    const content = await fetchText(entry.url);
    const details: AgentDetails = {
      name: entry.name,
      type: entry.type,
      url: entry.url,
      fileName: entry.fileName,
      description: entry.description,
      content,
    };

    return {
      content: [
        {
          type: "text",
          text: `**${details.name}** [${details.type}]\n${details.description}\n\nSource: ${details.url}\nFile: ${details.fileName}\n\n---\n\n${details.content}`,
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
  "Download an agent from the catalog to .claude/agents/ in the target project directory. Converts the format to Claude Code's native subagent format so it appears in /agents automatically.",
  {
    name: z.string().describe("Exact name of the catalog entry to download"),
    targetDir: z
      .string()
      .optional()
      .default(".")
      .describe("Target project directory (default: current directory)"),
    overwrite: z
      .boolean()
      .optional()
      .default(false)
      .describe("Overwrite if the agent file already exists"),
  },
  async ({ name, targetDir, overwrite }) => {
    const catalog = readCache(BASE_DIR);
    if (!catalog) {
      return {
        content: [
          {
            type: "text",
            text: "Catalog not cached yet. Run fetch_catalog first.",
          },
        ],
        isError: true,
      };
    }

    const entry = catalog.entries.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (!entry) {
      const partial = catalog.entries.filter((e) =>
        e.name.toLowerCase().includes(name.toLowerCase())
      );
      if (partial.length > 0) {
        const names = partial.map((e) => `  - ${e.name}`).join("\n");
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

    // Support agents, skills, and instructions
    const supportedTypes = ["agent", "skill", "instruction"];
    if (!supportedTypes.includes(entry.type)) {
      return {
        content: [
          {
            type: "text",
            text: `"${name}" is a ${entry.type}, which is not supported for download. Supported types: ${supportedTypes.join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    const projectDir = path.resolve(targetDir);
    // Route different types to different directories
    let targetSubdir: string;
    let destFileName: string;
    if (entry.type === "skill") {
      targetSubdir = ".claude/skills";
      // Skills are directories — use the skill name as folder
      destFileName = entry.fileName;
    } else if (entry.type === "instruction") {
      targetSubdir = ".github/instructions";
      destFileName = entry.fileName;
    } else {
      // Agents go to .claude/agents/ in Claude Code subagent format
      targetSubdir = AGENTS_DIR;
      destFileName = entry.fileName.replace(/\.agent\.md$/, ".md");
    }

    const targetPath = path.join(projectDir, targetSubdir);
    const destPath = path.join(targetPath, destFileName);

    // Check if already exists
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

    try {
      // Fetch the content
      const rawContent = await fetchText(entry.url);

      // Convert awesome-copilot format to Claude Code subagent format for agents
      let content = rawContent;
      if (entry.type === "agent") {
        content = convertToClaudeSubagent(entry.name, entry.description, rawContent);
      }

      // Ensure target directory exists
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(destPath, content, "utf-8");

      // Build activation guidance based on type
      let activationMsg = "";
      if (entry.type === "agent") {
        activationMsg = `\n\n📖 Activation: This agent now appears in /agents automatically.\nType /agents to see it listed. Claude Code will invoke it based on the description field.`;
      } else if (entry.type === "skill") {
        activationMsg = `\n\n📖 Activation: This skill is auto-discovered by Claude Code.\nIt will be suggested when relevant to your task.`;
      } else if (entry.type === "instruction") {
        activationMsg = `\n\n📖 Activation: This instruction is loaded automatically for matching file patterns.`;
      }

      return {
        content: [
          {
            type: "text",
            text: `${entry.type === "agent" ? "Agent" : entry.type === "skill" ? "Skill" : "Instruction"} "${entry.name}" installed successfully.\n\nFile: ${destPath}\nType: ${entry.type}\nDescription: ${entry.description}\nSource: ${entry.url}${activationMsg}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to download agent "${entry.name}": ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool: validate_agent ───────────────────────────────────────────

server.tool(
  "validate_agent",
  "Validate an agent file's structure and content. Checks for required sections and formatting.",
  {
    filePath: z
      .string()
      .describe("Path to the agent file to validate (relative or absolute)"),
  },
  async ({ filePath }) => {
    const absPath = path.resolve(filePath);

    if (!fs.existsSync(absPath)) {
      return {
        content: [{ type: "text", text: `File not found: ${absPath}` }],
        isError: true,
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const content = fs.readFileSync(absPath, "utf-8");
      const fileName = path.basename(absPath);

      // Check file extension
      if (!fileName.endsWith(".agent.md") && !fileName.endsWith(".md")) {
        errors.push("File should have .agent.md or .md extension");
      }

      // Check for empty content
      if (content.trim().length === 0) {
        errors.push("File is empty");
      }

      // Check for frontmatter (optional but recommended)
      if (!content.startsWith("---")) {
        warnings.push("No YAML frontmatter found (recommended for agent metadata)");
      }

      // Check for common agent sections
      const hasName =
        /name[:\s]/i.test(content) || /^#\s+/.test(content);
      if (!hasName) {
        warnings.push("No agent name/title detected (expected a heading or name field)");
      }

      // Check for description/instructions content
      if (content.length < 100) {
        warnings.push("Agent content is very short (< 100 chars) — may lack sufficient instructions");
      }

      // Check for common useful patterns
      const hasInstructions = /instruction/i.test(content);
      const hasTools = /tool|command|mcp/i.test(content);
      if (!hasInstructions && !hasTools) {
        warnings.push("No instructions or tool references detected in agent content");
      }

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
      };

      const status = result.valid ? "✅ VALID" : "❌ INVALID";
      let text = `Validation result for ${fileName}: ${status}\n`;

      if (errors.length > 0) {
        text += `\nErrors:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
      }
      if (warnings.length > 0) {
        text += `\nWarnings:\n${warnings.map((w) => `  - ⚠️ ${w}`).join("\n")}`;
      }
      if (errors.length === 0 && warnings.length === 0) {
        text += "\nNo issues found. Agent looks good!";
      }

      return { content: [{ type: "text", text }] };
    } catch (err: any) {
      return {
        content: [
          { type: "text", text: `Error reading file: ${err.message}` },
        ],
        isError: true,
      };
    }
  }
);

// ─── Format Converter ──────────────────────────────────────────────

/**
 * Convert an awesome-copilot .agent.md file to Claude Code's native
 * subagent format (.claude/agents/*.md).
 *
 * awesome-copilot format:
 *   ---
 *   name: "Agent Name"
 *   description: "What this agent does..."
 *   ---
 *   # Agent instructions...
 *
 * Claude Code subagent format:
 *   ---
 *   name: agent-name
 *   description: When to invoke this agent
 *   tools: Read, Grep, Glob, Bash
 *   ---
 *   # Agent instructions...
 */
function convertToClaudeSubagent(
  name: string,
  description: string,
  rawContent: string
): string {
  // Extract frontmatter and body from the original
  let body = rawContent;
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    body = rawContent.slice(frontmatterMatch[0].length).trim();
  }

  // Generate a kebab-case name
  const kebabName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Build Claude Code subagent frontmatter
  const claudeFrontmatter = [
    `name: ${kebabName}`,
    `description: ${description}`,
    `tools: Read, Grep, Glob, Bash`,
  ].join("\n");

  return `---\n${claudeFrontmatter}\n---\n\n${body}`;
}

// ─── Start server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Discovery MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});