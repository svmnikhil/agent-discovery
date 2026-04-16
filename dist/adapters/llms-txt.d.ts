/**
 * LlmsTxtAdapter — fetches and parses llms.txt format.
 *
 * Ported from the original parser.ts logic.
 */
import type { CatalogEntry, SourceAdapter, SourceConfig } from "../types.js";
export declare class LlmsTxtAdapter implements SourceAdapter {
    id: string;
    private url;
    constructor(config: SourceConfig);
    fetch(): Promise<CatalogEntry[]>;
    private parseLlmsTxt;
}
