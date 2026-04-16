/**
 * SQLite catalog reader using sql.js (WASM).
 *
 * Opens the bundled catalog.db and provides search/query methods.
 * The DB is read-only at runtime — built at publish time by scripts/build-catalog.ts.
 *
 * Search uses application-level token matching + BM25-style scoring
 * instead of FTS5 (not available in default sql.js WASM build).
 * For ~700 entries this is instantaneous.
 */
import { type Database } from "sql.js";
import type { CatalogEntry, CatalogMeta, SearchResult } from "./types.js";
/**
 * Open the bundled catalog database. Reuses the connection across calls.
 */
export declare function openCatalog(): Promise<Database>;
/**
 * Close the catalog database connection.
 */
export declare function closeCatalog(): void;
/**
 * Search the catalog using tokenized keyword matching with BM25-style scoring.
 * No FTS5 needed — application-level search on ~700 entries is instantaneous.
 */
export declare function searchAgents(query: string, type?: string, limit?: number): Promise<CatalogEntry[]>;
/**
 * Search with full result metadata (score, alternatives, cluster).
 */
export declare function searchWithMeta(query: string, type?: string, limit?: number): Promise<SearchResult[]>;
/**
 * Broad search for the recommend tool — returns more candidates for LLM re-ranking.
 */
export declare function broadSearch(query: string, limit?: number): Promise<CatalogEntry[]>;
/**
 * Look up a single agent by exact name (case-insensitive).
 */
export declare function findByName(name: string): Promise<CatalogEntry | null>;
/**
 * Find agents by partial name match (case-insensitive).
 */
export declare function findByPartialName(name: string): Promise<CatalogEntry[]>;
/**
 * Get catalog metadata (version, build date, counts).
 */
export declare function getCatalogInfo(): Promise<CatalogMeta & {
    types: Record<string, number>;
    sources: string[];
}>;
/**
 * Get duplicate clusters across sources — entries from different sources
 * that are semantically similar (same concept, different wording).
 */
export declare function getDuplicateClusters(): Promise<Array<{
    label: string;
    entries: Array<{
        name: string;
        source: string;
    }>;
}>>;
