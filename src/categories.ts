/**
 * Category → catalog-query bundle map.
 *
 * Maps a project pain-point category (auth, testing, security, performance,
 * database) to a small set of catalog search queries. The Flink streaming
 * agent calls search_catalog_for_category(<category>) and we run each query
 * through the existing BM25 catalog scorer, aggregating top hits.
 *
 * Keep queries short (2–3 tokens) — the catalog scorer is tuned for that.
 */

export const CATEGORY_QUERIES: Record<string, string[]> = {
  auth: ["auth security", "oauth token", "session security", "authentication", "identity"],
  testing: ["testing strategy", "test coverage", "flaky tests", "test automation"],
  security: ["security review", "vulnerability scanning", "security audit", "secrets"],
  performance: ["performance review", "performance optimization", "profiling", "latency"],
  database: ["database migration", "query performance", "schema design", "sql"],
};

export type Category = keyof typeof CATEGORY_QUERIES;

export function isKnownCategory(c: string): c is Category {
  return Object.prototype.hasOwnProperty.call(CATEGORY_QUERIES, c);
}
