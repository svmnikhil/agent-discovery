/**
 * E2E Tests: download_agent — installs agents to target directory.
 *
 * Requires network access. Skip with SKIP_NETWORK=1.
 * Uses os.tmpdir() for test directories, cleaned up after.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import {
  searchAgents,
  findByName,
  openCatalog,
} from "../../dist/catalog.js";

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

/** Simulate the download_agent logic (we test the catalog layer, not the MCP transport) */
async function downloadAgent(
  name: string,
  targetDir: string,
  overwrite: boolean = false
): Promise<{ destPath: string; content: string }> {
  const entry = await findByName(name);
  if (!entry) throw new Error(`No entry found: "${name}"`);

  let targetSubdir: string;
  let destFileName: string;
  if (entry.type === "skill") {
    targetSubdir = ".claude/skills";
    destFileName = entry.fileName;
  } else if (entry.type === "instruction") {
    targetSubdir = ".github/instructions";
    destFileName = entry.fileName;
  } else {
    targetSubdir = ".claude/agents";
    destFileName = entry.fileName.replace(/\.agent\.md$/, ".md");
  }

  const targetPath = path.join(targetDir, targetSubdir);
  const destPath = path.join(targetPath, destFileName);

  if (fs.existsSync(destPath) && !overwrite) {
    throw new Error(`File already exists at ${destPath}. Use overwrite: true to replace.`);
  }

  const content = await fetchText(entry.url);
  fs.mkdirSync(targetPath, { recursive: true });
  fs.writeFileSync(destPath, content, "utf-8");

  return { destPath, content };
}

export interface DownloadMetrics {
  tested: number;
  downloaded: number;
  overwriteProtected: boolean;
  overwriteSuccess: boolean;
  errors: string[];
}

export async function runDownloadTests(): Promise<DownloadMetrics> {
  if (SKIP_NETWORK) {
    return {
      tested: 0,
      downloaded: 0,
      overwriteProtected: false,
      overwriteSuccess: false,
      errors: ["SKIPPED (SKIP_NETWORK=1)"],
    };
  }

  await openCatalog();
  const metrics: DownloadMetrics = {
    tested: 0,
    downloaded: 0,
    overwriteProtected: false,
    overwriteSuccess: false,
    errors: [],
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-discovery-test-"));

  try {
    // Download one agent
    const agents = await searchAgents("code review", "agent", 1);
    if (agents.length > 0) {
      metrics.tested++;
      try {
        const { destPath, content } = await downloadAgent(agents[0].name, tmpDir);
        if (fs.existsSync(destPath) && content.length > 0) {
          metrics.downloaded++;
        }

        // Overwrite protection
        try {
          await downloadAgent(agents[0].name, tmpDir, false);
          // Should have thrown
        } catch {
          metrics.overwriteProtected = true;
        }

        // Overwrite success
        try {
          await downloadAgent(agents[0].name, tmpDir, true);
          metrics.overwriteSuccess = true;
        } catch (err: any) {
          metrics.errors.push(`Overwrite failed: ${err.message}`);
        }
      } catch (err: any) {
        metrics.errors.push(`Download failed: ${err.message}`);
      }
    }
  } finally {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return metrics;
}

export function registerDownloadTests() {
  describe("Download Agent (Network)", { skip: SKIP_NETWORK }, () => {
    let tmpDir: string;

    before(async () => {
      await openCatalog();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-discovery-test-"));
    });

    after(() => {
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("downloads an agent to .claude/agents/", async () => {
      const agents = await searchAgents("code review", "agent", 1);
      assert.ok(agents.length > 0, "Need an agent to test download");

      const { destPath, content } = await downloadAgent(agents[0].name, tmpDir);
      assert.ok(fs.existsSync(destPath), `File should exist at ${destPath}`);
      assert.ok(content.length > 0, "Downloaded content should be non-empty");
      assert.ok(destPath.includes(".claude/agents"), "Should install to .claude/agents/");
    });

    it("blocks overwrite when overwrite=false", async () => {
      const agents = await searchAgents("code review", "agent", 1);
      // First download already happened in previous test — download again
      try {
        await downloadAgent(agents[0].name, tmpDir);
      } catch {
        // May already exist from first download, that's fine for setup
      }
      await assert.rejects(
        () => downloadAgent(agents[0].name, tmpDir, false),
        /already exists/,
        "Should reject when file exists and overwrite=false"
      );
    });

    it("allows overwrite when overwrite=true", async () => {
      const agents = await searchAgents("code review", "agent", 1);
      const { destPath } = await downloadAgent(agents[0].name, tmpDir, true);
      assert.ok(fs.existsSync(destPath), "File should exist after overwrite");
    });

    it("downloads an instruction to .github/instructions/", async () => {
      const instructions = await searchAgents("code", "instruction", 1);
      if (instructions.length === 0) {
        // Skip if no instructions in catalog
        return;
      }
      const { destPath } = await downloadAgent(instructions[0].name, tmpDir);
      assert.ok(
        destPath.includes(".github/instructions"),
        `Instruction should install to .github/instructions/, got ${destPath}`
      );
    });
  });
}
