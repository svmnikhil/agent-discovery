/**
 * Parser for the awesome-copilot llms.txt format
 *
 * The llms.txt is a markdown file with sections like:
 *   ## Agents
 *   - [Name](url): description
 *   - [Name](url): description
 *
 *   ## Instructions
 *   - [Name](url): description
 *
 *   ## Skills
 *   - [Name](url): description
 */

import type { CatalogEntry } from "./types.js";

const SECTION_TYPE_MAP: Record<string, CatalogEntry["type"]> = {
  agents: "agent",
  instructions: "instruction",
  skills: "skill",
};

/**
 * Parse the llms.txt content into structured catalog entries.
 */
export function parseLlmsTxt(content: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  let currentType: CatalogEntry["type"] | null = null;

  const lines = content.split("\n");

  for (const line of lines) {
    // Check for section headers like ## Agents, ## Instructions, ## Skills
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      const sectionName = headerMatch[1].trim().toLowerCase();
      // Find matching type
      for (const [key, type] of Object.entries(SECTION_TYPE_MAP)) {
        if (sectionName.includes(key)) {
          currentType = type;
          break;
        }
      }
      // Skip sections we don't care about (Learning Hub, etc.)
      if (!currentType && !sectionName.includes("agent") && !sectionName.includes("instruction") && !sectionName.includes("skill")) {
        currentType = null;
      }
      continue;
    }

    // Parse list items: - [Name](url): description
    if (currentType) {
      const itemMatch = line.match(/^\s*-\s+\[([^\]]+)\]\(([^)]+)\):\s*(.+)/);
      if (itemMatch) {
        const name = itemMatch[1].trim();
        const url = itemMatch[2].trim();
        const description = itemMatch[3].trim();
        const fileName = extractFileName(url);

        entries.push({
          name,
          type: currentType,
          url,
          description,
          fileName,
        });
      }
    }
  }

  return entries;
}

/**
 * Extract a file name from a raw GitHub URL.
 * e.g. "https://raw.githubusercontent.com/github/awesome-copilot/main/agents/dotnet-upgrade.agent.md"
 *   → "dotnet-upgrade.agent.md"
 */
function extractFileName(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1] || "unknown";
}