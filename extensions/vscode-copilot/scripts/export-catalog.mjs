/**
 * Build-time script: exports catalog.db to catalog-data.json for bundling in the VS Code extension.
 * Run once before building: node scripts/export-catalog.mjs
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Find catalog.db — either in the repo root or two levels up (worktree)
const candidates = [
  resolve(__dirname, '../../../catalog/catalog.db'),
  resolve(__dirname, '../../../../catalog/catalog.db'),
];

const dbPath = candidates.find(p => existsSync(p));
if (!dbPath) {
  console.error('catalog.db not found. Tried:\n' + candidates.join('\n'));
  process.exit(1);
}

// sql.js might be in root node_modules (two levels up) or in extension node_modules
const sqlJsCandidates = [
  resolve(__dirname, '../node_modules/sql.js'),
  resolve(__dirname, '../../../node_modules/sql.js'),
  resolve(__dirname, '../../../../node_modules/sql.js'),
];
const sqlJsPath = sqlJsCandidates.find(p => existsSync(p));
if (!sqlJsPath) {
  console.error('sql.js not found. Run npm install in the repo root first.');
  process.exit(1);
}

const initSqlJs = require(sqlJsPath);

const SQL = await initSqlJs();
const buf = readFileSync(dbPath);
const db = new SQL.Database(buf);

const rows = db.exec(
  'SELECT id, source, name, type, description, url, filename, tools, tags FROM agents'
);

if (!rows.length) {
  console.error('No rows returned from catalog.db');
  process.exit(1);
}

const entries = rows[0].values.map(r => ({
  id: r[0],
  source: r[1],
  name: r[2],
  type: r[3],
  description: r[4] || '',
  url: r[5],
  fileName: r[6],
  tools: r[7] ? JSON.parse(r[7]) : undefined,
  tags: r[8] ? JSON.parse(r[8]) : undefined,
}));

db.close();

const outPath = resolve(__dirname, '../src/catalog-data.json');
writeFileSync(outPath, JSON.stringify(entries, null, 0), 'utf-8');

console.log(`Exported ${entries.length} entries → ${outPath}`);
console.log(`File size: ${(readFileSync(outPath).length / 1024).toFixed(1)} KB`);
