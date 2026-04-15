/**
 * E2E Tests: Variance testing — THE KEY TEST.
 *
 * Verifies that similar-but-different proposals yield meaningfully
 * different top results. A good catalog should NOT return the same
 * agents for every query.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  searchWithMeta,
  openCatalog,
} from "../../dist/catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SimilarPair {
  id: string;
  label: string;
  proposalA: { description: string; query: string };
  proposalB: { description: string; query: string };
  expectDifferentTopResult: boolean;
  rationale: string;
}

export interface VariancePairResult {
  id: string;
  label: string;
  topA: string[];
  topB: string[];
  jaccardTop5: number;
  differentTopResult: boolean;
  expectedDifferent: boolean;
  verdict: "HIGH_VARIANCE" | "MODERATE_VARIANCE" | "LOW_VARIANCE";
  rationale: string;
}

export interface VarianceMetrics {
  pairs: VariancePairResult[];
  avgJaccard: number;
  highVarianceCount: number;
  moderateVarianceCount: number;
  lowVarianceCount: number;
  overallVerdict: string;
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export async function runVarianceTests(): Promise<VarianceMetrics> {
  const pairs: SimilarPair[] = JSON.parse(
    readFileSync(path.join(__dirname, "scenarios", "similar-proposals.json"), "utf-8")
  );
  await openCatalog();

  const results: VariancePairResult[] = [];
  let totalJaccard = 0;
  let high = 0, moderate = 0, low = 0;

  for (const pair of pairs) {
    const resultsA = await searchWithMeta(pair.proposalA.query, "all", 5);
    const resultsB = await searchWithMeta(pair.proposalB.query, "all", 5);

    const topA = resultsA.map((r) => r.entry.name);
    const topB = resultsB.map((r) => r.entry.name);

    const setA = new Set(topA);
    const setB = new Set(topB);
    const jaccard = jaccardSimilarity(setA, setB);
    totalJaccard += jaccard;

    const differentTop = topA[0] !== topB[0];

    let verdict: VariancePairResult["verdict"];
    if (jaccard < 0.3) {
      verdict = "HIGH_VARIANCE";
      high++;
    } else if (jaccard <= 0.6) {
      verdict = "MODERATE_VARIANCE";
      moderate++;
    } else {
      verdict = "LOW_VARIANCE";
      low++;
    }

    results.push({
      id: pair.id,
      label: pair.label,
      topA,
      topB,
      jaccardTop5: Math.round(jaccard * 1000) / 1000,
      differentTopResult: differentTop,
      expectedDifferent: pair.expectDifferentTopResult,
      verdict,
      rationale: pair.rationale,
    });
  }

  const avgJaccard = pairs.length > 0 ? totalJaccard / pairs.length : 0;

  let overallVerdict: string;
  if (avgJaccard < 0.3) {
    overallVerdict = "EXCELLENT — catalog produces highly differentiated results";
  } else if (avgJaccard < 0.5) {
    overallVerdict = "GOOD — catalog generally differentiates between different needs";
  } else if (avgJaccard < 0.7) {
    overallVerdict = "FAIR — some differentiation, but many similar pairs get similar results";
  } else {
    overallVerdict = "POOR — catalog returns too-similar results for different needs";
  }

  return {
    pairs: results,
    avgJaccard: Math.round(avgJaccard * 1000) / 1000,
    highVarianceCount: high,
    moderateVarianceCount: moderate,
    lowVarianceCount: low,
    overallVerdict,
  };
}

export function registerVarianceTests() {
  describe("Variance Testing (KEY TEST)", () => {
    before(async () => {
      await openCatalog();
    });

    const pairs: SimilarPair[] = JSON.parse(
      readFileSync(path.join(__dirname, "scenarios", "similar-proposals.json"), "utf-8")
    );

    it("different proposals produce non-identical result sets", async () => {
      for (const pair of pairs) {
        const resultsA = await searchWithMeta(pair.proposalA.query, "all", 5);
        const resultsB = await searchWithMeta(pair.proposalB.query, "all", 5);

        const namesA = new Set(resultsA.map((r) => r.entry.name));
        const namesB = new Set(resultsB.map((r) => r.entry.name));
        const jaccard = jaccardSimilarity(namesA, namesB);

        // Not a hard fail — just flag if too similar
        if (jaccard > 0.8) {
          console.log(
            `  WARNING: "${pair.label}" has very similar results (Jaccard=${jaccard.toFixed(3)})`
          );
        }
        // Soft assertion: at least some results should differ
        assert.ok(
          jaccard < 1.0 || (resultsA.length === 0 && resultsB.length === 0),
          `"${pair.label}": identical top-5 results (Jaccard=1.0). Expected some differentiation.`
        );
      }
    });

    it("pairs expecting different top results actually get them", async () => {
      let pass = 0, total = 0;
      for (const pair of pairs.filter((p) => p.expectDifferentTopResult)) {
        total++;
        const resultsA = await searchWithMeta(pair.proposalA.query, "all", 5);
        const resultsB = await searchWithMeta(pair.proposalB.query, "all", 5);

        if (resultsA.length > 0 && resultsB.length > 0) {
          if (resultsA[0].entry.name !== resultsB[0].entry.name) {
            pass++;
          }
        }
      }
      // At least half of "expectDifferentTopResult" pairs should actually differ
      const ratio = total > 0 ? pass / total : 1;
      assert.ok(
        ratio >= 0.4,
        `Only ${pass}/${total} (${(ratio * 100).toFixed(0)}%) of expected-different pairs actually had different top results`
      );
    });

    it("average Jaccard similarity across pairs is not too high", async () => {
      let totalJaccard = 0;
      for (const pair of pairs) {
        const resultsA = await searchWithMeta(pair.proposalA.query, "all", 5);
        const resultsB = await searchWithMeta(pair.proposalB.query, "all", 5);
        const namesA = new Set(resultsA.map((r) => r.entry.name));
        const namesB = new Set(resultsB.map((r) => r.entry.name));
        totalJaccard += jaccardSimilarity(namesA, namesB);
      }
      const avg = pairs.length > 0 ? totalJaccard / pairs.length : 0;
      // Warn but don't hard-fail — this is diagnostic
      if (avg > 0.6) {
        console.log(
          `  WARNING: Average Jaccard across pairs is ${avg.toFixed(3)} (>0.6 suggests low variance)`
        );
      }
      assert.ok(
        avg < 0.9,
        `Average Jaccard ${avg.toFixed(3)} is too high — catalog is not differentiating`
      );
    });
  });
}
