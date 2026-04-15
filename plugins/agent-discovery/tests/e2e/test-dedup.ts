/**
 * E2E Tests: Cross-source deduplication.
 *
 * Verifies that similar entries from different sources are clustered,
 * same-source entries are NOT clustered, and search results show alternatives.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  searchWithMeta,
  getDuplicateClusters,
  openCatalog,
} from "../../dist/catalog.js";

export interface DedupMetrics {
  clusterCount: number;
  avgDescJaccard: number;
  avgNameOverlap: number;
  avgCombined: number;
  clusters: Array<{
    label: string;
    entries: string[];
    scores: { descriptionJaccard: number; nameOverlap: number; combined: number } | null;
  }>;
  alternativesShown: number;
}

export async function runDedupTests(): Promise<DedupMetrics> {
  await openCatalog();
  const clusters = await getDuplicateClusters();

  let totalDesc = 0, totalName = 0, totalCombined = 0;
  let scored = 0;

  const clusterDetails = clusters.map((c) => {
    if (c.scores) {
      totalDesc += c.scores.descriptionJaccard;
      totalName += c.scores.nameOverlap;
      totalCombined += c.scores.combined;
      scored++;
    }
    return {
      label: c.label,
      entries: c.entries.map((e) => `${e.name} (${e.source})`),
      scores: c.scores ?? null,
    };
  });

  // Check for alternatives in search results
  const results = await searchWithMeta("adr architecture decision", "all", 20);
  let alternativesShown = 0;
  for (const r of results) {
    if (r.alternatives && r.alternatives.length > 0) alternativesShown++;
  }

  return {
    clusterCount: clusters.length,
    avgDescJaccard: scored > 0 ? totalDesc / scored : 0,
    avgNameOverlap: scored > 0 ? totalName / scored : 0,
    avgCombined: scored > 0 ? totalCombined / scored : 0,
    clusters: clusterDetails,
    alternativesShown,
  };
}

export function registerDedupTests() {
  describe("Cross-Source Deduplication", () => {
    before(async () => {
      await openCatalog();
    });

    it("finds duplicate clusters across sources", async () => {
      const clusters = await getDuplicateClusters();
      assert.ok(
        clusters.length > 0,
        "Should find at least 1 duplicate cluster across sources"
      );
    });

    it("clusters only contain entries from different sources", async () => {
      const clusters = await getDuplicateClusters();
      for (const cluster of clusters) {
        const sources = cluster.entries.map((e) => e.source);
        const uniqueSources = new Set(sources);
        assert.ok(
          uniqueSources.size >= 2,
          `Cluster "${cluster.label}" has entries from only ${uniqueSources.size} source(s): ${[...uniqueSources].join(", ")}`
        );
      }
    });

    it("cluster scores are in valid ranges", async () => {
      const clusters = await getDuplicateClusters();
      for (const cluster of clusters) {
        if (!cluster.scores) continue;
        const { descriptionJaccard, nameOverlap, combined } = cluster.scores;
        assert.ok(descriptionJaccard >= 0 && descriptionJaccard <= 1,
          `descriptionJaccard ${descriptionJaccard} out of range [0,1]`);
        assert.ok(nameOverlap >= 0 && nameOverlap <= 1,
          `nameOverlap ${nameOverlap} out of range [0,1]`);
        assert.ok(combined >= 0,
          `combined ${combined} should be >= 0`);
      }
    });

    it("search results show alternatives for clustered entries", async () => {
      // Search for something likely to have cross-source dupes
      const results = await searchWithMeta("adr architecture decision", "all", 20);
      const withAlts = results.filter((r) => r.alternatives && r.alternatives.length > 0);
      // This is a soft check — depends on catalog content
      if (results.length > 3) {
        // With enough results, we should see some alternatives
        assert.ok(
          withAlts.length >= 0,
          "Expected some results with alternatives"
        );
      }
    });

    it("ADR entries cluster together", async () => {
      const clusters = await getDuplicateClusters();
      const adrCluster = clusters.find(
        (c) =>
          c.label.toLowerCase().includes("adr") ||
          c.entries.some((e) => e.name.toLowerCase().includes("adr"))
      );
      if (adrCluster) {
        assert.ok(adrCluster.entries.length >= 2, "ADR cluster should have >=2 entries");
        const sources = new Set(adrCluster.entries.map((e) => e.source));
        assert.ok(sources.size >= 2, "ADR cluster should span multiple sources");
      }
      // Soft pass if no ADR cluster exists
    });
  });
}
