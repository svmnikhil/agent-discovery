/**
 * GitHubDirAdapter — lists files from a GitHub directory via Contents API,
 * then fetches each .agent.md to extract frontmatter for name/description/tools.
 *
 * Requires GITHUB_TOKEN for authenticated API access.
 */
import type { CatalogEntry, SourceAdapter, SourceConfig } from "../types.js";
export declare class GitHubDirAdapter implements SourceAdapter {
    id: string;
    private repo;
    private dirPath;
    private branch;
    private token;
    constructor(config: SourceConfig);
    fetch(): Promise<CatalogEntry[]>;
    private listFiles;
    private fetchFileContent;
    private parseAgentFile;
    private inferType;
    private fetchJson;
    private fetchWithAuth;
}
