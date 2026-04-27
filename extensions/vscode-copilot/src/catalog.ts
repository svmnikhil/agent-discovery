/**
 * Pure-JS BM25 catalog search over the pre-exported catalog-data.json.
 * No sql.js / WASM — runs at full speed in the VS Code extension host.
 */

import catalogData from './catalog-data.json';

export interface CatalogEntry {
  id: string;
  source: string;
  name: string;
  type: 'agent' | 'instruction' | 'skill';
  description: string;
  url: string;
  fileName: string;
  tools?: string[];
  tags?: string[];
}

export interface SearchResult {
  entry: CatalogEntry;
  score: number;
  alternatives?: Array<{ source: string; name: string }>;
}

const ALL_ENTRIES: CatalogEntry[] = catalogData as CatalogEntry[];

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function relevanceScore(
  queryTokens: string[],
  nameTokens: string[],
  descTokens: string[],
  tagTokens: string[],
  toolTokens: string[]
): number {
  let score = 0;
  const nameSet = new Set(nameTokens);
  const tagSet = new Set(tagTokens);
  const toolSet = new Set(toolTokens);

  for (const qt of queryTokens) {
    if (nameSet.has(qt)) score += 10;
    for (const nt of nameTokens) {
      if (nt.startsWith(qt) && nt !== qt) score += 5;
    }
    if (tagSet.has(qt)) score += 8;
    for (const tt of tagTokens) {
      if (tt.startsWith(qt) && tt !== qt) score += 4;
    }
    if (toolSet.has(qt)) score += 3;
    let descHits = 0;
    for (const dt of descTokens) {
      if (dt === qt) descHits++;
      else if (dt.startsWith(qt)) descHits += 0.5;
    }
    score += descHits * 1.5;
  }
  return score;
}

function jaccardSimilarity(a: string, b: string): number {
  const tokA = new Set(tokenize(a));
  const tokB = new Set(tokenize(b));
  const intersection = [...tokA].filter(x => tokB.has(x)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return union === 0 ? 0 : intersection / union;
}

function dedupResults(results: SearchResult[]): SearchResult[] {
  const THRESHOLD = 0.25;
  const clustered = new Set<number>();

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      if (clustered.has(j)) continue;
      if (results[i].entry.source === results[j].entry.source) continue;

      let sim = jaccardSimilarity(results[i].entry.description, results[j].entry.description);
      const nameA = new Set(tokenize(results[i].entry.name));
      const nameB = new Set(tokenize(results[j].entry.name));
      const nameOverlap = [...nameA].filter(t => nameB.has(t)).length;
      if (nameOverlap > 0) {
        sim += 0.15 * (nameOverlap / Math.max(nameA.size, nameB.size));
      }

      if (sim > THRESHOLD) {
        if (results[i].score >= results[j].score) {
          results[i].alternatives ??= [];
          results[i].alternatives!.push({ source: results[j].entry.source, name: results[j].entry.name });
          clustered.add(j);
        } else {
          results[j].alternatives ??= [];
          results[j].alternatives!.push({ source: results[i].entry.source, name: results[i].entry.name });
          clustered.add(i);
        }
      }
    }
  }
  return results.filter((_, idx) => !clustered.has(idx));
}

export function searchCatalog(query: string, type?: string, limit = 10): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  let entries = ALL_ENTRIES;
  if (type && type !== 'all') {
    entries = entries.filter(e => e.type === type);
  }

  const scored: SearchResult[] = entries.map(entry => ({
    entry,
    score: relevanceScore(
      queryTokens,
      tokenize(entry.name),
      tokenize(entry.description),
      entry.tags?.flatMap(tokenize) ?? [],
      entry.tools?.flatMap(tokenize) ?? []
    ),
  }));

  scored.sort((a, b) => b.score - a.score);
  const hits = scored.filter(r => r.score > 0).slice(0, limit);
  return dedupResults(hits);
}

export function findByName(name: string): CatalogEntry | undefined {
  const lower = name.toLowerCase();
  return ALL_ENTRIES.find(e => e.name.toLowerCase() === lower)
    ?? ALL_ENTRIES.find(e => e.name.toLowerCase().includes(lower));
}

export function catalogStats() {
  const byType: Record<string, number> = {};
  for (const e of ALL_ENTRIES) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }
  const sources = [...new Set(ALL_ENTRIES.map(e => e.source))];
  return { total: ALL_ENTRIES.length, byType, sources };
}
