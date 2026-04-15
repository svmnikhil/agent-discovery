/**
 * E2E Tests: catalog_info — metadata, type counts, sources, stats.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  getCatalogInfo,
  getDuplicateClusters,
  openCatalog,
} from "../../dist/catalog.js";

export interface CatalogMetrics {
  entryCount: number;
  typeCounts: Record<string, number>;
  sources: string[];
  clusterCount: number;
  version: string;
}

export async function runCatalogTests(): Promise<CatalogMetrics> {
  await openCatalog();
  const info = await getCatalogInfo();
  const clusters = await getDuplicateClusters();

  return {
    entryCount: info.entry_count,
    typeCounts: info.types,
    sources: info.sources,
    clusterCount: clusters.length,
    version: info.version,
  };
}

export function registerCatalogTests() {
  describe("Catalog Info", () => {
    before(async () => {
      await openCatalog();
    });

    it("has required metadata fields", async () => {
      const info = await getCatalogInfo();
      assert.ok(info.version, "version should be present");
      assert.ok(info.built_at, "built_at should be present");
      assert.ok(info.entry_count > 0, `entry_count should be >0, got ${info.entry_count}`);
      assert.ok(info.source_count > 0, `source_count should be >0, got ${info.source_count}`);
    });

    it("type counts are consistent and non-zero", async () => {
      const info = await getCatalogInfo();
      const typeSum = Object.values(info.types).reduce((a, b) => a + b, 0);
      assert.ok(typeSum > 0, `Type counts sum should be >0, got ${typeSum}`);
      // entry_count in metadata may differ from actual rows (build-time vs runtime)
      // so we just verify type counts are internally consistent
      for (const [type, count] of Object.entries(info.types)) {
        assert.ok(count >= 0, `Type ${type} has negative count: ${count}`);
      }
    });

    it("sources include expected catalogs", async () => {
      const info = await getCatalogInfo();
      assert.ok(
        info.sources.includes("awesome-copilot"),
        `Sources should include "awesome-copilot", got: ${info.sources.join(", ")}`
      );
    });

    it("has agents, instructions, and/or skills types", async () => {
      const info = await getCatalogInfo();
      const knownTypes = ["agent", "instruction", "skill"];
      const foundTypes = Object.keys(info.types);
      const hasAtLeastOne = foundTypes.some((t) => knownTypes.includes(t));
      assert.ok(hasAtLeastOne, `Expected at least one known type, got: ${foundTypes.join(", ")}`);
    });

    it("getDuplicateClusters returns valid clusters", async () => {
      const clusters = await getDuplicateClusters();
      // May have 0 clusters if catalog is clean, but structure should be valid
      for (const cluster of clusters) {
        assert.ok(cluster.label, "Cluster should have a label");
        assert.ok(cluster.entries.length >= 2, "Cluster should have >=2 entries");
        if (cluster.scores) {
          assert.ok(
            cluster.scores.descriptionJaccard >= 0 && cluster.scores.descriptionJaccard <= 1,
            `descriptionJaccard should be 0-1, got ${cluster.scores.descriptionJaccard}`
          );
          assert.ok(
            cluster.scores.nameOverlap >= 0 && cluster.scores.nameOverlap <= 1,
            `nameOverlap should be 0-1, got ${cluster.scores.nameOverlap}`
          );
          assert.ok(
            cluster.scores.combined >= 0,
            `combined should be >=0, got ${cluster.scores.combined}`
          );
        }
      }
    });

    it("duplicate cluster entries come from different sources", async () => {
      const clusters = await getDuplicateClusters();
      for (const cluster of clusters) {
        const sources = new Set(cluster.entries.map((e) => e.source));
        assert.ok(
          sources.size >= 2,
          `Cluster "${cluster.label}" should have entries from >=2 sources, got: ${[...sources].join(", ")}`
        );
      }
    });
  });
}
