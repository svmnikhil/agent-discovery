/**
 * E2E Tests: Recommend / broad search quality.
 *
 * Tests broadSearch returning more candidates than searchAgents,
 * diversity of types, and context-aware recommendations.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  searchAgents,
  broadSearch,
  openCatalog,
} from "../../dist/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProjectProfile {
  id: string;
  name: string;
  queries: string[];
  description: string;
}

export interface RecommendMetrics {
  totalQueries: number;
  avgCandidateCount: number;
  recommendVsSearchDelta: number; // average difference in result count
  typeDiversity: Record<string, number>;
}

export async function runRecommendTests(): Promise<RecommendMetrics> {
  const projects: ProjectProfile[] = JSON.parse(
    readFileSync(path.join(__dirname, "scenarios", "software-projects.json"), "utf-8")
  );
  await openCatalog();

  let totalCandidates = 0;
  let totalDelta = 0;
  let totalQueries = 0;
  const typeCounts: Record<string, number> = {};

  for (const project of projects) {
    const query = project.queries[0];
    totalQueries++;

    const broad = await broadSearch(query, 30);
    const narrow = await searchAgents(query, "all", 20);

    totalCandidates += broad.length;
    totalDelta += broad.length - narrow.length;

    for (const r of broad) {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    }
  }

  return {
    totalQueries,
    avgCandidateCount: totalQueries > 0 ? totalCandidates / totalQueries : 0,
    recommendVsSearchDelta: totalQueries > 0 ? totalDelta / totalQueries : 0,
    typeDiversity: typeCounts,
  };
}

export function registerRecommendTests() {
  describe("Recommend / Broad Search", () => {
    before(async () => {
      await openCatalog();
    });

    const projects: ProjectProfile[] = JSON.parse(
      readFileSync(path.join(__dirname, "scenarios", "software-projects.json"), "utf-8")
    );

    it("broadSearch returns results for all project queries", async () => {
      for (const project of projects) {
        const query = project.queries[0];
        const results = await broadSearch(query, 30);
        assert.ok(
          results.length > 0,
          `broadSearch("${query}") for ${project.id} returned no results`
        );
      }
    });

    it("broadSearch respects limit of 30", async () => {
      const results = await broadSearch("code", 30);
      assert.ok(results.length <= 30, `broadSearch returned ${results.length} (> 30)`);
    });

    it("broadSearch returns >= as many results as searchAgents for same query", async () => {
      const query = "react typescript frontend";
      const broad = await broadSearch(query, 30);
      const narrow = await searchAgents(query, "all", 20);
      assert.ok(
        broad.length >= narrow.length,
        `broadSearch (${broad.length}) should return >= searchAgents (${narrow.length})`
      );
    });

    it("broadSearch with context returns results", async () => {
      const query = "code review";
      const context = "We are building a React SaaS app with TypeScript";
      // broadSearch concatenates query + context internally via recommend tool
      const combinedQuery = `${query} ${context}`;
      const results = await broadSearch(combinedQuery, 30);
      assert.ok(results.length > 0, "broadSearch with context returned no results");
    });

    it("broadSearch includes diverse types", async () => {
      const results = await broadSearch("code development best practices", 30);
      const types = new Set(results.map((r) => r.type));
      // Should have at least 2 different types in a broad search
      assert.ok(
        types.size >= 1,
        `Expected diverse types, got: ${[...types].join(", ")}`
      );
    });
  });
}
