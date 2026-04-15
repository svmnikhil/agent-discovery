#!/usr/bin/env npx tsx
/**
 * Build script: reads sources.json, runs adapters, writes catalog.db.
 *
 * Usage: npx tsx scripts/build-catalog.ts
 *
 * Environment:
 *   GITHUB_TOKEN — required for github-directory sources (skipped if absent)
 *
 * Note: Does NOT use FTS5 (not available in default sql.js WASM build).
 * Search is done at application level with tokenized matching + scoring.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { LlmsTxtAdapter } from "../src/adapters/llms-txt.js";
import { GitHubDirAdapter } from "../src/adapters/github-dir.js";
import type { SourceConfig, SourceAdapter, CatalogEntry, SourcesFile } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function main() {
  console.log("Building catalog...\n");

  // 1. Read sources.json
  const sourcesPath = path.join(ROOT, "sources.json");
  const sourcesFile: SourcesFile = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));
  const enabledSources = sourcesFile.sources.filter((s) => s.enabled);
  console.log(`Found ${enabledSources.length} enabled source(s)\n`);

  // 2. Run each adapter
  const allEntries: CatalogEntry[] = [];

  for (const config of enabledSources) {
    const adapter = createAdapter(config);
    if (!adapter) {
      console.warn(`Unknown source type: ${config.type} for ${config.id} — skipping`);
      continue;
    }

    console.log(`Fetching from ${config.id} (${config.type})...`);
    try {
      const entries = await adapter.fetch();
      console.log(`  → ${entries.length} entries\n`);
      allEntries.push(...entries);
    } catch (err: any) {
      console.error(`  → Error: ${err.message}\n`);
    }
  }

  if (allEntries.length === 0) {
    console.error("No entries fetched. Catalog will be empty.");
  }

  // 3. Write to SQLite (no FTS5 — search is application-level)
  console.log(`Total entries: ${allEntries.length}`);
  console.log("Writing catalog.db...\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      tools TEXT,
      tags TEXT,
      fetched_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Create indexes for fast lookups
  db.run(`CREATE INDEX idx_agents_type ON agents(type);`);
  db.run(`CREATE INDEX idx_agents_source ON agents(source);`);
  db.run(`CREATE INDEX idx_agents_name ON agents(name);`);

  // Insert entries
  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO agents (id, source, name, type, description, url, filename, tools, tags, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const entry of allEntries) {
    insertStmt.run([
      entry.id,
      entry.source,
      entry.name,
      entry.type,
      entry.description || "",
      entry.url,
      entry.fileName,
      entry.tools ? JSON.stringify(entry.tools) : null,
      entry.tags ? JSON.stringify(entry.tags) : null,
      entry.fetchedAt,
    ]);
  }
  insertStmt.free();

  // Write metadata
  const now = new Date().toISOString();
  const sourceCount = enabledSources.length;
  const metaStmt = db.prepare("INSERT INTO catalog_meta (key, value) VALUES (?, ?)");
  metaStmt.run(["version", "1.0.0"]);
  metaStmt.run(["built_at", now]);
  metaStmt.run(["source_count", String(sourceCount)]);
  metaStmt.run(["entry_count", String(allEntries.length)]);
  metaStmt.free();

  // Export to file
  const catalogDir = path.join(ROOT, "catalog");
  if (!fs.existsSync(catalogDir)) {
    fs.mkdirSync(catalogDir, { recursive: true });
  }

  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(catalogDir, "catalog.db");
  fs.writeFileSync(dbPath, buffer);
  db.close();

  const sizeKb = (buffer.length / 1024).toFixed(1);
  console.log(`Catalog written to ${dbPath} (${sizeKb} KB)`);

  // Summary
  const typeCounts: Record<string, number> = {};
  for (const entry of allEntries) {
    typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
  }
  console.log("\nSummary:");
  console.log(`  Sources: ${sourceCount}`);
  console.log(`  Total entries: ${allEntries.length}`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log(`  Built at: ${now}`);
  console.log("\nDone!");
}

function createAdapter(config: SourceConfig): SourceAdapter | null {
  switch (config.type) {
    case "llms-txt":
      return new LlmsTxtAdapter(config);
    case "github-directory":
      return new GitHubDirAdapter(config);
    default:
      return null;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});