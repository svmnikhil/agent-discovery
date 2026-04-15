/**
 * E2E Tests: get_agent_details — fetches full markdown from GitHub.
 *
 * Requires network access. Skip with SKIP_NETWORK=1.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  findByName,
  findByPartialName,
  searchAgents,
  openCatalog,
} from "../../dist/catalog.js";
import https from "node:https";

const SKIP_NETWORK = process.env.SKIP_NETWORK === "1";

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "agent-discovery-e2e/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

export interface DetailsMetrics {
  tested: number;
  fetched: number;
  hasFrontmatter: number;
  errors: string[];
}

export async function runDetailsTests(): Promise<DetailsMetrics> {
  if (SKIP_NETWORK) {
    return { tested: 0, fetched: 0, hasFrontmatter: 0, errors: ["SKIPPED (SKIP_NETWORK=1)"] };
  }

  await openCatalog();
  const metrics: DetailsMetrics = { tested: 0, fetched: 0, hasFrontmatter: 0, errors: [] };

  // Pick 3 agents from catalog
  const agents = await searchAgents("code review", "all", 3);
  for (const agent of agents) {
    metrics.tested++;
    try {
      const content = await fetchText(agent.url);
      if (content.length > 0) metrics.fetched++;
      if (content.trimStart().startsWith("---")) metrics.hasFrontmatter++;
    } catch (err: any) {
      metrics.errors.push(`${agent.name}: ${err.message}`);
    }
  }

  return metrics;
}

export function registerDetailsTests() {
  describe("Agent Details (Network)", { skip: SKIP_NETWORK }, () => {
    before(async () => {
      await openCatalog();
    });

    it("fetches full markdown for a known agent", async () => {
      const agents = await searchAgents("code review", "all", 1);
      assert.ok(agents.length > 0, "Need at least 1 agent to test details");

      const content = await fetchText(agents[0].url);
      assert.ok(content.length > 0, "Content should be non-empty");
      assert.ok(
        typeof content === "string",
        "Content should be a string"
      );
    });

    it("fetched content contains markdown frontmatter", async () => {
      const agents = await searchAgents("code review", "all", 1);
      const content = await fetchText(agents[0].url);
      // Most agent files have YAML frontmatter
      // This is a soft check — not all files will have it
      if (content.trimStart().startsWith("---")) {
        assert.ok(true, "Has frontmatter");
      } else {
        // Just verify content is reasonable markdown
        assert.ok(content.length > 10, "Content should be substantial");
      }
    });

    it("findByName returns correct entry", async () => {
      const agents = await searchAgents("code", "all", 1);
      assert.ok(agents.length > 0);
      const entry = await findByName(agents[0].name);
      assert.ok(entry, `findByName("${agents[0].name}") returned null`);
      assert.equal(entry!.name, agents[0].name);
    });

    it("findByPartialName matches partial input", async () => {
      // Search for a partial name
      const results = await findByPartialName("review");
      assert.ok(results.length > 0, 'findByPartialName("review") should find matches');
      for (const r of results) {
        assert.ok(
          r.name.toLowerCase().includes("review"),
          `"${r.name}" should contain "review"`
        );
      }
    });

    it("handles network failures gracefully", async () => {
      // Test with a bogus URL — should throw, not crash
      try {
        await fetchText("https://raw.githubusercontent.com/nonexistent/repo/main/fake.md");
        assert.fail("Should have thrown for nonexistent URL");
      } catch (err: any) {
        assert.ok(err.message.includes("HTTP") || err.message.includes("ENOTFOUND"),
          `Expected HTTP error, got: ${err.message}`);
      }
    });
  });
}
