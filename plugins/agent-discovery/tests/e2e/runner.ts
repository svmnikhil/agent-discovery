#!/usr/bin/env npx tsx
/**
 * E2E Test Runner for agent-discovery MCP server.
 *
 * Discovers and runs all test suites, collects metrics,
 * and generates a human-readable report.
 *
 * Usage:
 *   npx tsx tests/e2e/runner.ts
 *   SKIP_NETWORK=1 npx tsx tests/e2e/runner.ts   # skip network tests
 */

import { run } from "node:test";
import { spec } from "node:test/reporters";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { closeCatalog, openCatalog } from "../../dist/catalog.js";

// Import metric runners
import { runSearchTests, type SearchMetrics } from "./test-search.js";
import { runRecommendTests, type RecommendMetrics } from "./test-recommend.js";
import { runDetailsTests, type DetailsMetrics } from "./test-details.js";
import { runDownloadTests, type DownloadMetrics } from "./test-download.js";
import { runCatalogTests, type CatalogMetrics } from "./test-catalog.js";
import { runDedupTests, type DedupMetrics } from "./test-dedup.js";
import { runVarianceTests, type VarianceMetrics } from "./test-variance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Collect metrics from all suites ────────────────────────────────

interface AllMetrics {
  search: SearchMetrics;
  recommend: RecommendMetrics;
  details: DetailsMetrics;
  download: DownloadMetrics;
  catalog: CatalogMetrics;
  dedup: DedupMetrics;
  variance: VarianceMetrics;
}

async function collectMetrics(): Promise<AllMetrics> {
  await openCatalog();

  console.log("\n=== Collecting metrics ===\n");

  console.log("  [1/7] Search quality...");
  const search = await runSearchTests();

  console.log("  [2/7] Recommend quality...");
  const recommend = await runRecommendTests();

  console.log("  [3/7] Agent details...");
  const details = await runDetailsTests();

  console.log("  [4/7] Download agent...");
  const download = await runDownloadTests();

  console.log("  [5/7] Catalog info...");
  const catalog = await runCatalogTests();

  console.log("  [6/7] Deduplication...");
  const dedup = await runDedupTests();

  console.log("  [7/7] Variance (KEY TEST)...");
  const variance = await runVarianceTests();

  return { search, recommend, details, download, catalog, dedup, variance };
}

// ── Generate report ────────────────────────────────────────────────

function generateReport(metrics: AllMetrics): string {
  const lines: string[] = [];
  const hr = "---";

  lines.push("# Agent Discovery E2E Test Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Network tests: ${process.env.SKIP_NETWORK === "1" ? "SKIPPED" : "ENABLED"}`);
  lines.push("");

  // ── Catalog Overview
  lines.push("## Catalog Overview");
  lines.push("");
  lines.push(`- Version: ${metrics.catalog.version}`);
  lines.push(`- Total entries: ${metrics.catalog.entryCount}`);
  lines.push(`- Sources: ${metrics.catalog.sources.join(", ")}`);
  lines.push(`- Types: ${Object.entries(metrics.catalog.typeCounts).map(([t, c]) => `${t}=${c}`).join(", ")}`);
  lines.push(`- Duplicate clusters: ${metrics.catalog.clusterCount}`);
  lines.push("");

  // ── Search Quality
  lines.push("## Search Quality");
  lines.push("");
  lines.push(`- Total queries tested: ${metrics.search.totalQueries}`);
  lines.push(`- Non-empty results: ${metrics.search.nonEmptyResults}/${metrics.search.totalQueries} (${((metrics.search.nonEmptyResults / metrics.search.totalQueries) * 100).toFixed(0)}%)`);
  lines.push(`- **Precision@1**: ${(metrics.search.precisionAt1 * 100).toFixed(1)}%`);
  lines.push(`- **Precision@3**: ${(metrics.search.precisionAt3 * 100).toFixed(1)}%`);
  lines.push(`- **Precision@5**: ${(metrics.search.precisionAt5 * 100).toFixed(1)}%`);
  lines.push("");
  lines.push("Source distribution:");
  for (const [src, count] of Object.entries(metrics.search.sourceDistribution)) {
    lines.push(`  - ${src}: ${count} results`);
  }
  lines.push("");

  // Per-project breakdown
  lines.push("### Per-Project Results");
  lines.push("");
  lines.push("| Project | Query | Results | Top Result | P@1 | P@3 | P@5 |");
  lines.push("|---------|-------|---------|------------|-----|-----|-----|");
  for (const proj of metrics.search.perProject) {
    for (const q of proj.queries) {
      const p1 = q.hitAtK[1] ? "Y" : "N";
      const p3 = q.hitAtK[3] ? "Y" : "N";
      const p5 = q.hitAtK[5] ? "Y" : "N";
      const topName = q.topResultName.length > 25
        ? q.topResultName.slice(0, 25) + "..."
        : q.topResultName;
      lines.push(`| ${proj.id} | ${q.query} | ${q.resultCount} | ${topName} | ${p1} | ${p3} | ${p5} |`);
    }
  }
  lines.push("");

  // ── Recommend Quality
  lines.push("## Recommend Quality");
  lines.push("");
  lines.push(`- Total queries: ${metrics.recommend.totalQueries}`);
  lines.push(`- Avg candidate count: ${metrics.recommend.avgCandidateCount.toFixed(1)}`);
  lines.push(`- Avg delta (recommend vs search): +${metrics.recommend.recommendVsSearchDelta.toFixed(1)} more results`);
  lines.push(`- Type diversity: ${Object.entries(metrics.recommend.typeDiversity).map(([t, c]) => `${t}=${c}`).join(", ")}`);
  lines.push("");

  // ── Details Tests
  lines.push("## Agent Details (Network)");
  lines.push("");
  if (metrics.details.errors.length === 1 && metrics.details.errors[0].startsWith("SKIPPED")) {
    lines.push("SKIPPED (SKIP_NETWORK=1)");
  } else {
    lines.push(`- Tested: ${metrics.details.tested}`);
    lines.push(`- Successfully fetched: ${metrics.details.fetched}`);
    lines.push(`- With frontmatter: ${metrics.details.hasFrontmatter}`);
    if (metrics.details.errors.length > 0) {
      lines.push(`- Errors: ${metrics.details.errors.join("; ")}`);
    }
  }
  lines.push("");

  // ── Download Tests
  lines.push("## Download Agent (Network)");
  lines.push("");
  if (metrics.download.errors.length === 1 && metrics.download.errors[0].startsWith("SKIPPED")) {
    lines.push("SKIPPED (SKIP_NETWORK=1)");
  } else {
    lines.push(`- Tested: ${metrics.download.tested}`);
    lines.push(`- Downloaded: ${metrics.download.downloaded}`);
    lines.push(`- Overwrite protection: ${metrics.download.overwriteProtected ? "PASS" : "FAIL"}`);
    lines.push(`- Overwrite allowed: ${metrics.download.overwriteSuccess ? "PASS" : "FAIL"}`);
    if (metrics.download.errors.length > 0) {
      lines.push(`- Errors: ${metrics.download.errors.join("; ")}`);
    }
  }
  lines.push("");

  // ── Dedup Report
  lines.push("## Deduplication Report");
  lines.push("");
  lines.push(`- Clusters found: ${metrics.dedup.clusterCount}`);
  lines.push(`- Avg description Jaccard: ${metrics.dedup.avgDescJaccard.toFixed(3)}`);
  lines.push(`- Avg name overlap: ${metrics.dedup.avgNameOverlap.toFixed(3)}`);
  lines.push(`- Avg combined score: ${metrics.dedup.avgCombined.toFixed(3)}`);
  lines.push(`- Search results with alternatives shown: ${metrics.dedup.alternativesShown}`);
  lines.push("");
  if (metrics.dedup.clusters.length > 0) {
    lines.push("### Clusters");
    lines.push("");
    for (const c of metrics.dedup.clusters) {
      const scoreStr = c.scores
        ? ` [desc=${c.scores.descriptionJaccard} name=${c.scores.nameOverlap} combined=${c.scores.combined}]`
        : "";
      lines.push(`- **${c.label}**: ${c.entries.join(", ")}${scoreStr}`);
    }
    lines.push("");
  }

  // ── VARIANCE REPORT (KEY DELIVERABLE)
  lines.push("## Variance Report (KEY TEST)");
  lines.push("");
  lines.push(`**Overall Verdict: ${metrics.variance.overallVerdict}**`);
  lines.push("");
  lines.push(`- Average Jaccard similarity: ${metrics.variance.avgJaccard}`);
  lines.push(`- High variance pairs (Jaccard < 0.3): ${metrics.variance.highVarianceCount}`);
  lines.push(`- Moderate variance pairs (0.3-0.6): ${metrics.variance.moderateVarianceCount}`);
  lines.push(`- Low variance pairs (Jaccard > 0.6): ${metrics.variance.lowVarianceCount}`);
  lines.push("");

  lines.push("### Pair-by-Pair Results");
  lines.push("");
  lines.push("| Pair | Jaccard | Top-1 Different? | Expected? | Verdict |");
  lines.push("|------|---------|-----------------|-----------|---------|");
  for (const p of metrics.variance.pairs) {
    const diff = p.differentTopResult ? "YES" : "NO";
    const expected = p.expectedDifferent ? "YES" : "NO";
    const match = (p.differentTopResult === p.expectedDifferent) ? "" : " (!)";
    lines.push(`| ${p.label} | ${p.jaccardTop5} | ${diff} | ${expected} | ${p.verdict}${match} |`);
  }
  lines.push("");

  lines.push("### Detailed Pair Analysis");
  lines.push("");
  for (const p of metrics.variance.pairs) {
    lines.push(`#### ${p.label}`);
    lines.push(`- Rationale: ${p.rationale}`);
    lines.push(`- Jaccard: ${p.jaccardTop5} → **${p.verdict}**`);
    lines.push(`- Proposal A top-5: ${p.topA.join(", ") || "(no results)"}`);
    lines.push(`- Proposal B top-5: ${p.topB.join(", ") || "(no results)"}`);
    lines.push("");
  }

  // ── Recommendations
  lines.push(hr);
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");

  const recs: string[] = [];
  if (metrics.search.precisionAt1 < 0.5) {
    recs.push("- Search precision@1 is below 50%. Consider boosting name/tag weights or adding synonyms.");
  }
  if (metrics.search.precisionAt5 < 0.7) {
    recs.push("- Search precision@5 is below 70%. Consider expanding tag coverage in the catalog.");
  }
  if (metrics.variance.lowVarianceCount > metrics.variance.pairs.length / 2) {
    recs.push("- More than half of similar pairs have LOW variance. The catalog needs better keyword/tag differentiation.");
  }
  if (metrics.dedup.clusterCount === 0) {
    recs.push("- No duplicate clusters detected. Verify dedup thresholds if cross-source overlap is expected.");
  }
  if (metrics.recommend.recommendVsSearchDelta < 1) {
    recs.push("- Recommend returns barely more results than search. Consider broadening the recommend scoring threshold.");
  }
  if (recs.length === 0) {
    recs.push("- All metrics look healthy. No immediate action needed.");
  }
  lines.push(recs.join("\n"));
  lines.push("");

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log("Agent Discovery E2E Test Suite");
  console.log("==============================\n");

  // Phase 1: Run node:test assertions
  console.log("Phase 1: Running assertion tests...\n");

  const testFiles = [
    path.join(__dirname, "test-search.ts"),
    path.join(__dirname, "test-recommend.ts"),
    path.join(__dirname, "test-details.ts"),
    path.join(__dirname, "test-download.ts"),
    path.join(__dirname, "test-catalog.ts"),
    path.join(__dirname, "test-dedup.ts"),
    path.join(__dirname, "test-variance.ts"),
  ];

  // Dynamically register all test suites
  const { registerSearchTests } = await import("./test-search.js");
  const { registerRecommendTests } = await import("./test-recommend.js");
  const { registerDetailsTests } = await import("./test-details.js");
  const { registerDownloadTests } = await import("./test-download.js");
  const { registerCatalogTests } = await import("./test-catalog.js");
  const { registerDedupTests } = await import("./test-dedup.js");
  const { registerVarianceTests } = await import("./test-variance.js");

  registerSearchTests();
  registerRecommendTests();
  registerDetailsTests();
  registerDownloadTests();
  registerCatalogTests();
  registerDedupTests();
  registerVarianceTests();

  // Phase 2: Collect detailed metrics
  let metrics: AllMetrics;
  try {
    metrics = await collectMetrics();
  } catch (err) {
    console.error("Failed to collect metrics:", err);
    closeCatalog();
    process.exit(1);
  }

  // Phase 3: Generate report
  const report = generateReport(metrics);
  const duration = ((Date.now() - start) / 1000).toFixed(1);

  // Write report
  const reportPath = path.join(__dirname, "report.md");
  fs.writeFileSync(reportPath, report, "utf-8");

  // Print report to stdout
  console.log("\n" + report);
  console.log(`\nCompleted in ${duration}s`);
  console.log(`Report written to: ${reportPath}`);

  closeCatalog();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  closeCatalog();
  process.exit(1);
});
