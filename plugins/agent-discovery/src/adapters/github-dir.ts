/**
 * GitHubDirAdapter — lists files from a GitHub directory via Contents API,
 * then fetches each .agent.md to extract frontmatter for name/description/tools.
 *
 * Requires GITHUB_TOKEN for authenticated API access.
 */

import https from "node:https";
import type { CatalogEntry, SourceAdapter, SourceConfig } from "../types.js";

interface GitHubFile {
  name: string;
  download_url: string;
  type: string;
}

export class GitHubDirAdapter implements SourceAdapter {
  id: string;
  private repo: string;
  private dirPath: string;
  private branch: string;
  private token: string | undefined;

  constructor(config: SourceConfig) {
    this.id = config.id;
    this.repo = config.repo!;
    this.dirPath = config.path!;
    this.branch = config.branch || "main";
    this.token = process.env.GITHUB_TOKEN;
  }

  async fetch(): Promise<CatalogEntry[]> {
    if (!this.token) {
      console.error(`[${this.id}] GITHUB_TOKEN not set — skipping this source`);
      return [];
    }

    const files = await this.listFiles();
    const mdFiles = files.filter(
      (f) => f.type === "file" && (f.name.endsWith(".agent.md") || f.name.endsWith(".md"))
    );

    const entries: CatalogEntry[] = [];
    const now = new Date().toISOString();

    for (const file of mdFiles) {
      try {
        const content = await this.fetchFileContent(file.download_url);
        const parsed = this.parseAgentFile(file.name, content);

        // Build raw.githubusercontent.com URL (no auth needed)
        const rawUrl = `https://raw.githubusercontent.com/${this.repo}/${this.branch}/${this.dirPath}/${file.name}`;

        entries.push({
          id: `${this.id}:${file.name}`,
          source: this.id,
          name: parsed.name,
          type: this.inferType(file.name),
          description: parsed.description,
          url: rawUrl,
          fileName: file.name,
          tools: parsed.tools,
          tags: parsed.tags,
          fetchedAt: now,
        });
      } catch (err: any) {
        console.error(`[${this.id}] Failed to process ${file.name}: ${err.message}`);
      }
    }

    return entries;
  }

  private async listFiles(): Promise<GitHubFile[]> {
    const url = `https://api.github.com/repos/${this.repo}/contents/${this.dirPath}?ref=${this.branch}`;
    const raw = await this.fetchJson(url);
    return JSON.parse(raw) as GitHubFile[];
  }

  private async fetchFileContent(downloadUrl: string): Promise<string> {
    return this.fetchWithAuth(downloadUrl);
  }

  private parseAgentFile(
    fileName: string,
    content: string
  ): { name: string; description: string; tools?: string[]; tags?: string[] } {
    let name = fileName.replace(/\.agent\.md$/, "").replace(/\.md$/, "");
    let description = "";
    let tools: string[] | undefined;
    let tags: string[] | undefined;

    // Parse YAML frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const fm = fmMatch[1];

      const nameMatch = fm.match(/^name:\s*["']?(.+?)["']?\s*$/m);
      if (nameMatch) name = nameMatch[1];

      const descMatch = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m);
      if (descMatch) description = descMatch[1];

      const toolsMatch = fm.match(/^tools:\s*(.+)$/m);
      if (toolsMatch) {
        const toolsStr = toolsMatch[1].trim();
        // Handle YAML list or comma-separated
        if (toolsStr.startsWith("[")) {
          try { tools = JSON.parse(toolsStr); } catch { /* ignore */ }
        } else {
          tools = toolsStr.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }

      const tagsMatch = fm.match(/^tags:\s*(.+)$/m);
      if (tagsMatch) {
        const tagsStr = tagsMatch[1].trim();
        if (tagsStr.startsWith("[")) {
          try { tags = JSON.parse(tagsStr); } catch { /* ignore */ }
        } else {
          tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }
    }

    // Fallback: use first heading or first paragraph as description
    if (!description) {
      const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content;
      const headingMatch = body.match(/^#\s+(.+)/m);
      if (headingMatch && !name.includes("-")) {
        name = headingMatch[1].trim();
      }
      // First non-heading, non-empty line as description
      const lines = body.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          description = trimmed.slice(0, 200);
          break;
        }
      }
    }

    // Prettify name from filename if still kebab-case
    if (name.includes("-") && !name.includes(" ")) {
      name = name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }

    return { name, description, tools, tags };
  }

  private inferType(fileName: string): CatalogEntry["type"] {
    if (fileName.endsWith(".agent.md")) return "agent";
    if (fileName.includes("instruction")) return "instruction";
    if (fileName.includes("skill")) return "skill";
    return "agent";
  }

  private fetchJson(url: string): Promise<string> {
    return this.fetchWithAuth(url);
  }

  private fetchWithAuth(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        "User-Agent": "agent-discovery-mcp/1.0",
        Accept: "application/vnd.github.v3+json",
      };
      if (this.token) {
        headers["Authorization"] = `token ${this.token}`;
      }

      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers,
      };

      https
        .get(options, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            this.fetchWithAuth(res.headers.location).then(resolve).catch(reject);
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
}
