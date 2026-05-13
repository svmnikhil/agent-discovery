/**
 * Execute the bundled `acquire-codebase-knowledge` skill:
 *   1. Verify python3 is available
 *   2. Spawn scan.py against the workspace
 *   3. Feed scan output + skill instructions to the chat LM
 *   4. Parse the LM response: STACK.md content + (optional) JSON queries block
 *   5. Persist STACK.md under <workspaceRoot>/docs/codebase/
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import type { ProposedQuery } from './query-mapping';

export interface SkillResult {
  stackMdPath: string;
  stackMdContent: string;
  lmSuggestedQueries: ProposedQuery[];
}

export class MissingPythonError extends Error { constructor() { super('python3 not found on PATH'); } }
export class ScanTimeoutError    extends Error { constructor() { super('scan.py exceeded 60s timeout'); } }
export class ScanFailedError     extends Error {}
export class LmOutputInvalidError extends Error {}

const SCAN_TIMEOUT_MS = 60_000;
const QUERIES_MARKER = '<!-- AGENT-DISCOVERY-QUERIES -->';

function checkPython(): boolean {
  try {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf-8' });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

async function runScan(
  scanScriptPath: string,
  workspaceRoot: string,
  outputPath: string,
  token: vscode.CancellationToken,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scanScriptPath, '--output', outputPath], {
      cwd: workspaceRoot,
    });
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch { /* noop */ }
      reject(new ScanTimeoutError());
    }, SCAN_TIMEOUT_MS);

    const cancelSub = token.onCancellationRequested(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch { /* noop */ }
    });

    child.stderr?.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      clearTimeout(timer);
      cancelSub.dispose();
      if (!killed) reject(new ScanFailedError(`spawn failed: ${err.message}`));
    });
    child.on('close', code => {
      clearTimeout(timer);
      cancelSub.dispose();
      if (killed) return;
      if (code !== 0) {
        const tail = stderr.slice(0, 500);
        reject(new ScanFailedError(`scan.py exited with code ${code}${tail ? `: ${tail}` : ''}`));
      } else {
        resolve();
      }
    });
  });
}

function buildSystemPrompt(): string {
  return [
    'You are populating a STACK.md file as part of the awesome-copilot',
    '`acquire-codebase-knowledge` skill, then emitting follow-up search queries',
    'for an agent recommendation system.',
    '',
    'Focus on the Runtime Summary (primary language, runtime version, package',
    'manager, build system) and the Production Frameworks and Dependencies sections.',
    'Every claim must be traceable to actual files in the scan output. Use [TODO]',
    'for unknowns; never fabricate.',
    '',
    'The downstream BM25-style ranker prefers 2–3 token tech+task queries.',
    '  Good: `opentelemetry instrumentation`, `react accessibility`, `terraform security`.',
    '  Bad:  `set up observability for my service`, `how do I make my React app accessible`.',
    '',
    'OUTPUT FORMAT (strict):',
    '  1. The populated STACK.md content (markdown). It MUST start with a "# Stack" heading.',
    `  2. A single marker line: ${QUERIES_MARKER}`,
    '  3. A single ```json fenced block containing:',
    '       { "queries": [ { "label": "...", "query": "...", "why": "..." }, ... ] }',
    '     Up to 10 entries. Each `query` must be ≤ 5 whitespace tokens and ≤ 50 characters.',
    '     Cover tools / frameworks / concerns the static stack mapping is likely to miss:',
    '     novel frameworks, observability tools, security configs, monorepo tooling,',
    '     IaC platforms detected in the scan output.',
    '  4. No preamble. No commentary. No text after the closing ```.',
  ].join('\n');
}

function buildUserPrompt(scanOutput: string, stackTemplate: string, workspaceRoot: string): string {
  return [
    `Workspace root: ${workspaceRoot}`,
    '',
    '--- BEGIN scan.py output ---',
    scanOutput,
    '--- END scan.py output ---',
    '',
    '--- BEGIN STACK.md template (populate this) ---',
    stackTemplate,
    '--- END STACK.md template ---',
  ].join('\n');
}

/** Parse LM response → { stackMd, queries }. Throws LmOutputInvalidError on bad STACK.md. */
function parseLmResponse(buf: string): { stackMd: string; queries: ProposedQuery[] } {
  const markerIdx = buf.indexOf(QUERIES_MARKER);
  const stackMdRaw = markerIdx >= 0 ? buf.slice(0, markerIdx) : buf;
  const tail = markerIdx >= 0 ? buf.slice(markerIdx + QUERIES_MARKER.length) : '';

  const stackMd = stackMdRaw.replace(/^\s*```(?:markdown)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  if (!stackMd) throw new LmOutputInvalidError('LM returned empty STACK.md content');
  const firstLine = stackMd.split(/\r?\n/).find(l => l.trim().length > 0) ?? '';
  if (!/^#\s*stack\b/i.test(firstLine)) {
    throw new LmOutputInvalidError(`LM STACK.md missing '# Stack' heading (got: ${firstLine.slice(0, 80)})`);
  }

  let queries: ProposedQuery[] = [];
  if (tail.trim()) {
    const m = /```json\s*\n([\s\S]*?)\n?```/.exec(tail);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        const raw = Array.isArray(parsed?.queries) ? parsed.queries : [];
        for (const e of raw) {
          if (!e || typeof e !== 'object') continue;
          const query = typeof e.query === 'string' ? e.query.trim() : '';
          const label = typeof e.label === 'string' ? e.label.trim() : '';
          const why   = typeof e.why   === 'string' ? e.why.trim()   : '';
          if (!query || !label || !why) continue;
          if (query.length > 50) continue;
          if (query.split(/\s+/).length > 5) continue;
          queries.push({ group: 'stack-adapted', label, query, why });
        }
        if (queries.length > 10) queries = queries.slice(0, 10);
      } catch {
        queries = [];
      }
    }
  }

  return { stackMd, queries };
}

export async function runAcquireCodebaseKnowledge(
  workspaceRoot: string,
  bundledSkillRoot: string,
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  progress: (msg: string) => void,
): Promise<SkillResult> {
  progress('Checking prerequisites…');
  if (!checkPython()) throw new MissingPythonError();

  const docsDir = path.join(workspaceRoot, 'docs', 'codebase');
  fs.mkdirSync(docsDir, { recursive: true });
  const scanOutputPath = path.join(docsDir, '.codebase-scan.txt');
  const scanScriptPath = path.join(bundledSkillRoot, 'scripts', 'scan.py');
  const templatePath   = path.join(bundledSkillRoot, 'assets', 'templates', 'STACK.md');

  progress('Scanning workspace (scan.py)…');
  await runScan(scanScriptPath, workspaceRoot, scanOutputPath, token);
  if (token.isCancellationRequested) throw new ScanFailedError('cancelled');

  const scanOutput  = fs.readFileSync(scanOutputPath, 'utf-8');
  const stackTpl    = fs.readFileSync(templatePath,   'utf-8');

  progress('Generating STACK.md (Copilot)…');
  const messages = [
    vscode.LanguageModelChatMessage.User(buildSystemPrompt()),
    vscode.LanguageModelChatMessage.User(buildUserPrompt(scanOutput, stackTpl, workspaceRoot)),
  ];
  const response = await model.sendRequest(messages, {}, token);

  let buf = '';
  for await (const chunk of response.text) buf += chunk;

  const { stackMd, queries } = parseLmResponse(buf);

  const header = [
    `<!-- Generated by @agent-discovery /review on ${new Date().toISOString()} -->`,
    `<!-- Source skill: acquire-codebase-knowledge (awesome-copilot, MIT) -->`,
    '',
    '',
  ].join('\n');

  const stackMdPath = path.join(docsDir, 'STACK.md');
  fs.writeFileSync(stackMdPath, header + stackMd + '\n', 'utf-8');

  return { stackMdPath, stackMdContent: stackMd, lmSuggestedQueries: queries };
}
