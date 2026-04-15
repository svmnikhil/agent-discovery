/**
 * E2E Tests: Search quality across diverse software project scenarios.
 *
 * Tests search_agents / searchWithMeta for relevance, type filtering,
 * limit enforcement, and precision metrics.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  searchAgents,
  searchWithMeta,
  openCatalog,
  closeCatalog,
} from "../../dist/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProjectProfile {
  id: string;
  name: string;
  techStack: string[];
  description: string;
  queries: string[];
  expectedAgentTypes: string[];
  expectedKeywords: string[];
}

export interface SearchMetrics {
  totalQueries: number;
  nonEmptyResults: number;
  precisionAt1: number;
  precisionAt3: number;
  precisionAt5: number;
  sourceDistribution: Record<string, number>;
  perProject: Array<{
    id: string;
    name: string;
    queries: Array<{
      query: string;
      resultCount: number;
      topResultName: string;
      hitAtK: { 1: boolean; 3: boolean; 5: boolean };
      sources: string[];
    }>;
  }>;
}

function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export async function runSearchTests(): Promise<SearchMetrics> {
  const projects: ProjectProfile[] = JSON.parse(
    readFileSync(path.join(__dirname, "scenarios", "software-projects.json"), "utf-8")
  );

  await openCatalog();

  const metrics: SearchMetrics = {
    totalQueries: 0,
    nonEmptyResults: 0,
    precisionAt1: 0,
    precisionAt3: 0,
    precisionAt5: 0,
    sourceDistribution: {},
    perProject: [],
  };

  let p1Hits = 0, p3Hits = 0, p5Hits = 0;

  for (const project of projects) {
    const projectResult: SearchMetrics["perProject"][0] = {
      id: project.id,
      name: project.name,
      queries: [],
    };

    for (const query of project.queries) {
      metrics.totalQueries++;
      const results = await searchWithMeta(query, "all", 10);

      const topNames = results.slice(0, 10).map((r) => r.entry.name);
      const topDescs = results.slice(0, 10).map((r) => r.entry.description);
      const combined = topNames.concat(topDescs);

      const hitAt1 =
        results.length >= 1 &&
        containsKeyword(
          results[0].entry.name + " " + results[0].entry.description,
          project.expectedKeywords
        );
      const hitAt3 =
        combined.slice(0, 6).some((t) => containsKeyword(t, project.expectedKeywords));
      const hitAt5 =
        combined.some((t) => containsKeyword(t, project.expectedKeywords));

      if (hitAt1) p1Hits++;
      if (hitAt3) p3Hits++;
      if (hitAt5) p5Hits++;

      if (results.length > 0) metrics.nonEmptyResults++;

      // Track source distribution
      for (const r of results) {
        const src = r.entry.source;
        metrics.sourceDistribution[src] = (metrics.sourceDistribution[src] || 0) + 1;
      }

      projectResult.queries.push({
        query,
        resultCount: results.length,
        topResultName: results[0]?.entry.name ?? "(none)",
        hitAtK: { 1: hitAt1, 3: hitAt3, 5: hitAt5 },
        sources: [...new Set(results.map((r) => r.entry.source))],
      });
    }

    metrics.perProject.push(projectResult);
  }

  metrics.precisionAt1 = metrics.totalQueries > 0 ? p1Hits / metrics.totalQueries : 0;
  metrics.precisionAt3 = metrics.totalQueries > 0 ? p3Hits / metrics.totalQueries : 0;
  metrics.precisionAt5 = metrics.totalQueries > 0 ? p5Hits / metrics.totalQueries : 0;

  return metrics;
}

export function registerSearchTests() {
  describe("Search Quality", () => {
    before(async () => {
      await openCatalog();
    });

    const projects: ProjectProfile[] = JSON.parse(
      readFileSync(path.join(__dirname, "scenarios", "software-projects.json"), "utf-8")
    );

    it("returns non-empty results for all project queries", async () => {
      for (const project of projects) {
        for (const query of project.queries) {
          const results = await searchAgents(query, "all", 10);
          assert.ok(
            results.length > 0,
            `Query "${query}" (${project.id}) returned no results`
          );
        }
      }
    });

    it("respects type filtering", async () => {
      const agentResults = await searchAgents("code review", "agent", 10);
      for (const r of agentResults) {
        assert.equal(r.type, "agent", `Expected type=agent, got ${r.type} for ${r.name}`);
      }

      const instructionResults = await searchAgents("code review", "instruction", 10);
      for (const r of instructionResults) {
        assert.equal(
          r.type,
          "instruction",
          `Expected type=instruction, got ${r.type} for ${r.name}`
        );
      }
    });

    it("respects limit parameter", async () => {
      const results3 = await searchAgents("code", "all", 3);
      assert.ok(results3.length <= 3, `Limit=3 returned ${results3.length} results`);

      const results1 = await searchAgents("code", "all", 1);
      assert.ok(results1.length <= 1, `Limit=1 returned ${results1.length} results`);
    });

    it("returns scored results via searchWithMeta", async () => {
      const results = await searchWithMeta("react typescript", "all", 5);
      assert.ok(results.length > 0, "searchWithMeta returned no results");
      for (const r of results) {
        assert.ok(r.score > 0, `Score should be >0, got ${r.score} for ${r.entry.name}`);
      }
      // Verify descending score order
      for (let i = 1; i < results.length; i++) {
        assert.ok(
          results[i].score <= results[i - 1].score,
          `Results not sorted by score: ${results[i - 1].score} < ${results[i].score}`
        );
      }
    });

    it("empty query returns no results", async () => {
      const results = await searchAgents("", "all", 10);
      assert.equal(results.length, 0, "Empty query should return 0 results");
    });

    it("gibberish query returns empty or low results", async () => {
      const results = await searchAgents("xyzzy qqqqq zzzfoo", "all", 10);
      assert.ok(results.length <= 2, `Gibberish query returned ${results.length} results`);
    });
  });
}
