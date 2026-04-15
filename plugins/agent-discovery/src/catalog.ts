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

import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import type { CatalogEntry, CatalogMeta, SearchResult, DuplicateCluster } from "./types.js";

let db: Database | null = null;

/**
 * Get the path to the bundled catalog DB.
 */
function getDbPath(): string {
  return path.resolve(import.meta.dirname, "..", "catalog", "catalog.db");
}

/**
 * Open the bundled catalog database. Reuses the connection across calls.
 */
export async function openCatalog(): Promise<Database> {
  if (db) return db;

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Catalog database not found at ${dbPath}. Run the build-catalog script first.`
    );
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  db = new SQL.Database(buffer);
  return db;
}

/**
 * Close the catalog database connection.
 */
export function closeCatalog(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get all entries from the catalog (for in-memory search).
 */
async function getAllEntries(): Promise<CatalogEntry[]> {
  const catalog = await openCatalog();
  const results = catalog.exec(
    `SELECT id, source, name, type, description, url, filename, tools, tags, fetched_at FROM agents`
  );
  if (!results.length || !results[0].values.length) return [];
  return results[0].values.map(rowToEntry);
}

/**
 * Tokenize a string into lowercase words for matching.
 */
function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Compute BM25-style relevance score between query tokens and a document.
 * Simple implementation: term frequency * inverse document frequency approximation.
 */
function relevanceScore(
  queryTokens: string[],
  nameTokens: string[],
  descTokens: string[],
  tagTokens: string[],
  toolTokens: string[]
): number {
  let score = 0;
  const nameSet = new Set(nameTokens);
  const descSet = new Set(descTokens);
  const tagSet = new Set(tagTokens);
  const toolSet = new Set(toolTokens);

  for (const qt of queryTokens) {
    // Name match (highest weight)
    if (nameSet.has(qt)) score += 10;
    // Prefix match on name
    for (const nt of nameTokens) {
      if (nt.startsWith(qt) && nt !== qt) score += 5;
    }

    // Tag match (high weight)
    if (tagSet.has(qt)) score += 8;
    for (const tt of tagTokens) {
      if (tt.startsWith(qt) && tt !== qt) score += 4;
    }

    // Tool match (medium weight)
    if (toolSet.has(qt)) score += 3;
    for (const tt of toolTokens) {
      if (tt.startsWith(qt) && tt !== qt) score += 1.5;
    }

    // Description match (lower weight, but counts frequency)
    let descHits = 0;
    for (const dt of descTokens) {
      if (dt === qt) descHits++;
      else if (dt.startsWith(qt)) descHits += 0.5;
    }
    score += descHits * 1.5;
  }

  return score;
}

/**
 * Compute Jaccard similarity between two descriptions for dedup clustering.
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Deduplicate search results by clustering semantically similar entries.
 * Uses both description Jaccard similarity AND name overlap.
 * Groups entries and shows the higher-ranked one as primary with alternatives noted.
 */
function dedupResults(results: SearchResult[]): SearchResult[] {
  const JACCARD_THRESHOLD = 0.25;
  const NAME_OVERLAP_BONUS = 0.15; // Boost similarity when names share tokens

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      // Only cluster entries from different sources (same source won't have true dupes)
      if (results[i].entry.source === results[j].entry.source) continue;

      let sim = jaccardSimilarity(
        results[i].entry.description,
        results[j].entry.description
      );

      // Boost similarity if names share tokens
      const nameTokensA = new Set(tokenize(results[i].entry.name));
      const nameTokensB = new Set(tokenize(results[j].entry.name));
      const nameOverlap = [...nameTokensA].filter(t => nameTokensB.has(t)).length;
      if (nameOverlap > 0) {
        const maxNameTokens = Math.max(nameTokensA.size, nameTokensB.size);
        sim += NAME_OVERLAP_BONUS * (nameOverlap / maxNameTokens);
      }

      // Also flag high-scoring same-query entries with shared key name tokens
      // This catches cases like "ADR Writer" and "ADR Generator" where descriptions differ
      if (sim <= JACCARD_THRESHOLD) {
        // Extract significant name tokens: length>3 OR uppercase acronyms (pre-tokenization)
        const extractSignificantTokens = (name: string) => {
          const rawTokens = name.split(/\s+/);
          const significant: string[] = [];
          for (const token of rawTokens) {
            const lower = token.toLowerCase().replace(/[^a-z0-9]/g, "");
            // Keep tokens that are long (likely meaningful) or look like acronyms
            if (lower.length >= 3 || (lower.length >= 2 && token === token.toUpperCase())) {
              significant.push(lower);
            }
          }
          return new Set(significant);
        };
        const sigA = extractSignificantTokens(results[i].entry.name);
        const sigB = extractSignificantTokens(results[j].entry.name);
        const sharedSigTokens = [...sigA].filter(t => sigB.has(t));
        // If they share a meaningful name token AND both scored high
        // AND descriptions share at least some terms (avoid false positives on generic words)
        if (sharedSigTokens.length > 0 && results[i].score > 8 && results[j].score > 8) {
          const descSim = jaccardSimilarity(results[i].entry.description, results[j].entry.description);
          if (descSim > 0.05) {
            sim = JACCARD_THRESHOLD + 0.01; // Just above threshold
          }
        }
      }

      if (sim > JACCARD_THRESHOLD) {
        // Keep higher-scoring as primary
        if (results[i].score >= results[j].score) {
          results[i].alternatives ??= [];
          results[i].alternatives!.push({
            source: results[j].entry.source,
            name: results[j].entry.name,
          });
          results[j].cluster = results[i].entry.id;
        } else {
          results[j].alternatives ??= [];
          results[j].alternatives!.push({
            source: results[i].entry.source,
            name: results[i].entry.name,
          });
          results[i].cluster = results[j].entry.id;
        }
      }
    }
  }

  return results.filter((r) => !r.cluster);
}

/**
 * Search the catalog using tokenized keyword matching with BM25-style scoring.
 * No FTS5 needed — application-level search on ~700 entries is instantaneous.
 */
export async function searchAgents(
  query: string,
  type?: string,
  limit: number = 20
): Promise<CatalogEntry[]> {
  const results = await searchWithMeta(query, type, limit);
  return results.map((r) => ({
    ...r.entry,
    // Embed alternatives info in description for downstream consumers
    _alternatives: r.alternatives,
  }));
}

/**
 * Search with full result metadata (score, alternatives, cluster).
 */
export async function searchWithMeta(
  query: string,
  type?: string,
  limit: number = 20
): Promise<SearchResult[]> {
  let entries = await getAllEntries();

  // Filter by type
  if (type && type !== "all") {
    entries = entries.filter((e) => e.type === type);
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Score each entry
  const scored: SearchResult[] = entries.map((entry) => {
    const nameTokens = tokenize(entry.name);
    const descTokens = tokenize(entry.description);
    const tagTokens = entry.tags ? entry.tags.flatMap(tokenize) : [];
    const toolTokens = entry.tools ? entry.tools.flatMap(tokenize) : [];

    const score = relevanceScore(
      queryTokens,
      nameTokens,
      descTokens,
      tagTokens,
      toolTokens
    );

    return { entry, score };
  });

  // Sort by score descending, take top results with non-zero scores
  scored.sort((a, b) => b.score - a.score);
  const hits = scored.filter((r) => r.score > 0).slice(0, limit);

  // Dedup similar results across sources
  return dedupResults(hits);
}

/**
 * Broad search for the recommend tool — returns more candidates for LLM re-ranking.
 */
export async function broadSearch(
  query: string,
  limit: number = 30
): Promise<CatalogEntry[]> {
  const results = await searchWithMeta(query, "all", limit);
  return results.map((r) => ({
    ...r.entry,
    _alternatives: r.alternatives,
  }));
}

/**
 * Look up a single agent by exact name (case-insensitive).
 */
export async function findByName(name: string): Promise<CatalogEntry | null> {
  const catalog = await openCatalog();
  const results = catalog.exec(
    `SELECT id, source, name, type, description, url, filename, tools, tags, fetched_at
     FROM agents WHERE lower(name) = lower(?) LIMIT 1`,
    [name]
  );

  if (!results.length || !results[0].values.length) return null;
  return rowToEntry(results[0].values[0]);
}

/**
 * Find agents by partial name match (case-insensitive).
 */
export async function findByPartialName(name: string): Promise<CatalogEntry[]> {
  const catalog = await openCatalog();
  const results = catalog.exec(
    `SELECT id, source, name, type, description, url, filename, tools, tags, fetched_at
     FROM agents WHERE lower(name) LIKE ? LIMIT 10`,
    [`%${name.toLowerCase()}%`]
  );

  if (!results.length || !results[0].values.length) return [];
  return results[0].values.map(rowToEntry);
}

/**
 * Get catalog metadata (version, build date, counts).
 */
export async function getCatalogInfo(): Promise<
  CatalogMeta & { types: Record<string, number>; sources: string[] }
> {
  const catalog = await openCatalog();

  // Get metadata
  const metaRows = catalog.exec("SELECT key, value FROM catalog_meta");
  const meta: Record<string, string> = {};
  if (metaRows.length && metaRows[0].values.length) {
    for (const row of metaRows[0].values) {
      meta[row[0] as string] = row[1] as string;
    }
  }

  // Get type counts
  const typeRows = catalog.exec(
    "SELECT type, COUNT(*) as cnt FROM agents GROUP BY type"
  );
  const types: Record<string, number> = {};
  if (typeRows.length && typeRows[0].values.length) {
    for (const row of typeRows[0].values) {
      types[row[0] as string] = row[1] as number;
    }
  }

  // Get distinct sources
  const sourceRows = catalog.exec(
    "SELECT DISTINCT source FROM agents ORDER BY source"
  );
  const sources: string[] = [];
  if (sourceRows.length && sourceRows[0].values.length) {
    for (const row of sourceRows[0].values) {
      sources.push(row[0] as string);
    }
  }

  return {
    version: meta["version"] || "unknown",
    built_at: meta["built_at"] || "unknown",
    source_count: parseInt(meta["source_count"] || "0", 10),
    entry_count: parseInt(meta["entry_count"] || "0", 10),
    types,
    sources,
  };
}

/**
 * Get duplicate clusters across sources — entries from different sources
 * that are semantically similar (same concept, different wording).
 */
export async function getDuplicateClusters(): Promise<DuplicateCluster[]> {
  const entries = await getAllEntries();

  // Group by source
  const bySource: Record<string, CatalogEntry[]> = {};
  for (const e of entries) {
    if (!bySource[e.source]) bySource[e.source] = [];
    bySource[e.source].push(e);
  }

  const sources = Object.keys(bySource);
  // Track which entries are already in a cluster (one cluster per entry, no transitive merging)
  const used = new Set<string>();
  const clusters: DuplicateCluster[] = [];

  // Compare across all source pairs
  for (let si = 0; si < sources.length; si++) {
    for (let sj = si + 1; sj < sources.length; sj++) {
      const entriesA = bySource[sources[si]];
      const entriesB = bySource[sources[sj]];

      for (const a of entriesA) {
        if (used.has(a.id)) continue;
        for (const b of entriesB) {
          if (used.has(b.id)) continue;

          // Skip different types
          if (a.type !== b.type) continue;

          // Require meaningful name overlap (at least 1 significant shared token)
          const extractSignificant = (name: string) => {
            const rawTokens = name.split(/\s+/);
            const significant: string[] = [];
            const STOP = new Set(["the", "and", "for", "with", "from", "mode", "chat", "expert", "agent", "specialist"]);
            for (const token of rawTokens) {
              const lower = token.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (lower.length >= 2 && !STOP.has(lower)) {
                significant.push(lower);
              }
            }
            return new Set(significant);
          };
          const sigA = extractSignificant(a.name);
          const sigB = extractSignificant(b.name);
          const sharedSig = [...sigA].filter((t) => sigB.has(t));
          if (sharedSig.length === 0) continue;

          // Check description similarity (must be above noise floor)
          const descSim = jaccardSimilarity(a.description, b.description);
          if (descSim < 0.05) continue;

          // Combined check: name overlap + description similarity = likely same concept
          const nameOverlap = sharedSig.length / Math.max(sigA.size, sigB.size);
          const combined = descSim + 0.15 * nameOverlap;
          if (combined < 0.15) continue;

          // It's a cluster
          used.add(a.id);
          used.add(b.id);
          const label =
            [...sharedSig]
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(" ");
          clusters.push({
            label,
            entries: [
              { name: a.name, source: a.source },
              { name: b.name, source: b.source },
            ],
            scores: {
              descriptionJaccard: Math.round(descSim * 1000) / 1000,
              nameOverlap: Math.round(nameOverlap * 1000) / 1000,
              combined: Math.round(combined * 1000) / 1000,
            },
          });
          break; // Move to next `a` since this one is used
        }
      }
    }
  }

  return clusters;
}

/**
 * Convert a SQL result row to a CatalogEntry.
 */
function rowToEntry(row: any[]): CatalogEntry {
  return {
    id: row[0] as string,
    source: row[1] as string,
    name: row[2] as string,
    type: row[3] as CatalogEntry["type"],
    description: (row[4] as string) || "",
    url: row[5] as string,
    fileName: row[6] as string,
    tools: row[7] ? JSON.parse(row[7] as string) : undefined,
    tags: row[8] ? JSON.parse(row[8] as string) : undefined,
    fetchedAt: row[9] as string,
  };
}