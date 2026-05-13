/**
 * Build-time fetch of the awesome-copilot `acquire-codebase-knowledge` skill.
 *
 * Vendors three files into ./bundled-skill/ for runtime use by the /review command:
 *   - SKILL.md
 *   - scripts/scan.py
 *   - assets/templates/STACK.md
 *
 * License: the skill declares `license: MIT` in its frontmatter, so vendoring is permitted.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'bundled-skill');

const BASE = 'https://raw.githubusercontent.com/github/awesome-copilot/main/skills/acquire-codebase-knowledge';
const FILES = [
  { url: `${BASE}/SKILL.md`,                          rel: 'SKILL.md' },
  { url: `${BASE}/scripts/scan.py`,                   rel: 'scripts/scan.py' },
  { url: `${BASE}/assets/templates/STACK.md`,         rel: 'assets/templates/STACK.md' },
];

function fetchText(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'agent-discovery-vscode-build/0.1' } }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects <= 0) { reject(new Error(`Too many redirects for ${url}`)); return; }
        fetchText(res.headers.location, redirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  for (const { url, rel } of FILES) {
    process.stdout.write(`Fetching ${url} … `);
    const content = await fetchText(url);
    const dest = resolve(ROOT, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content, 'utf-8');
    process.stdout.write(`${content.length} bytes → ${rel}\n`);
  }
  console.log('Bundled skill written to bundled-skill/');
}

main().catch(err => {
  console.error('fetch-skill failed:', err.message);
  process.exit(1);
});
