/**
 * LlmsTxtAdapter — fetches and parses llms.txt format.
 *
 * Ported from the original parser.ts logic.
 */
import https from "node:https";
const SECTION_TYPE_MAP = {
    agents: "agent",
    instructions: "instruction",
    skills: "skill",
};
export class LlmsTxtAdapter {
    id;
    url;
    constructor(config) {
        this.id = config.id;
        this.url = config.url;
    }
    async fetch() {
        const raw = await fetchText(this.url);
        return this.parseLlmsTxt(raw);
    }
    parseLlmsTxt(content) {
        const entries = [];
        let currentType = null;
        const now = new Date().toISOString();
        const lines = content.split("\n");
        for (const line of lines) {
            // Check for section headers like ## Agents, ## Instructions, ## Skills
            const headerMatch = line.match(/^##\s+(.+)/);
            if (headerMatch) {
                const sectionName = headerMatch[1].trim().toLowerCase();
                currentType = null;
                for (const [key, type] of Object.entries(SECTION_TYPE_MAP)) {
                    if (sectionName.includes(key)) {
                        currentType = type;
                        break;
                    }
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
                        id: `${this.id}:${fileName}`,
                        source: this.id,
                        name,
                        type: currentType,
                        url,
                        description,
                        fileName,
                        fetchedAt: now,
                    });
                }
            }
        }
        return entries;
    }
}
function extractFileName(url) {
    const parts = url.split("/");
    return parts[parts.length - 1] || "unknown";
}
function fetchText(url) {
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
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
            res.on("error", reject);
        })
            .on("error", reject);
    });
}
//# sourceMappingURL=llms-txt.js.map