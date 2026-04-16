/**
 * Type definitions for the agent-discovery plugin
 */
export interface CatalogEntry {
    /** Unique ID: "{source}:{filename}" */
    id: string;
    /** Source identifier (e.g. "awesome-copilot", "gh-aw") */
    source: string;
    name: string;
    type: "agent" | "instruction" | "skill";
    description: string;
    /** raw.githubusercontent.com URL (always latest) */
    url: string;
    /** File name derived from the URL */
    fileName: string;
    /** Tool names from frontmatter */
    tools?: string[];
    /** Tags from frontmatter */
    tags?: string[];
    fetchedAt: string;
    /** Populated by dedup — similar agents from other sources */
    _alternatives?: Array<{
        source: string;
        name: string;
    }>;
}
export interface AgentDetails {
    name: string;
    type: "agent" | "instruction" | "skill";
    url: string;
    fileName: string;
    description: string;
    content: string;
}
export interface SourceConfig {
    id: string;
    type: "llms-txt" | "github-directory";
    url?: string;
    repo?: string;
    path?: string;
    branch?: string;
    enabled: boolean;
}
export interface SourcesFile {
    sources: SourceConfig[];
}
export interface SourceAdapter {
    id: string;
    fetch(): Promise<CatalogEntry[]>;
}
export interface CatalogMeta {
    version: string;
    built_at: string;
    source_count: number;
    entry_count: number;
}
export interface SearchResult {
    entry: CatalogEntry;
    score: number;
    cluster?: string;
    alternatives?: Array<{
        source: string;
        name: string;
    }>;
}
