/**
 * Parse the `acquire-codebase-knowledge` skill's STACK.md output into a
 * structured summary the query-mapping layer can use.
 *
 * The real template uses H2 `## Core Sections (Required)` with H3 subsections
 * `### 1) Runtime Summary`, `### 2) Production Frameworks and Dependencies`, etc.
 * The parser is intentionally forgiving — missing or malformed sections produce
 * empty arrays, never throws.
 */

export interface StackSummary {
  languages: string[];          // up to 3
  frameworks: string[];
  testFrameworks: string[];
  infra: string[];              // docker, kubernetes, terraform, ...
  ci: string[];                 // github-actions, gitlab-ci, ...
}

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript', typescript: 'typescript',
  js: 'javascript', javascript: 'javascript',
  py: 'python', python: 'python',
  go: 'go', golang: 'go',
  rs: 'rust', rust: 'rust',
  java: 'java',
  csharp: 'csharp', 'c#': 'csharp', dotnet: 'csharp',
  ruby: 'ruby', rb: 'ruby',
  php: 'php',
  kotlin: 'kotlin', kt: 'kotlin',
  swift: 'swift',
};

const INFRA_PATTERNS: Array<[string, RegExp]> = [
  ['docker',     /\bdocker\b/i],
  ['kubernetes', /\bkubernetes\b|\bk8s\b/i],
  ['terraform',  /\bterraform\b/i],
  ['helm',       /\bhelm\b/i],
  ['ansible',    /\bansible\b/i],
  ['pulumi',     /\bpulumi\b/i],
];

const CI_PATTERNS: Array<[string, RegExp]> = [
  ['github-actions', /github[\s-]?actions/i],
  ['gitlab-ci',      /gitlab[\s-]?ci/i],
  ['circleci',       /\bcircleci\b/i],
  ['jenkins',        /\bjenkins\b/i],
  ['travis',         /\btravis\b/i],
];

const TEST_PATTERNS: Array<[string, RegExp]> = [
  ['jest',     /\bjest\b/i],
  ['vitest',   /\bvitest\b/i],
  ['mocha',    /\bmocha\b/i],
  ['pytest',   /\bpytest\b/i],
  ['unittest', /\bunittest\b/i],
  ['rspec',    /\brspec\b/i],
  ['junit',    /\bjunit\b/i],
  ['go test',  /\bgo\s+test\b/i],
];

const SECTION_TITLES = {
  runtime:    /^(?:\d+\)\s*)?runtime\s+summary\b/i,
  frameworks: /^(?:\d+\)\s*)?(?:production\s+)?frameworks(?:\s+and\s+dependencies)?\b/i,
  toolchain:  /^(?:\d+\)\s*)?(?:development\s+)?toolchain\b/i,
  envConfig:  /^(?:\d+\)\s*)?environment(?:\s+and\s+config)?\b/i,
};

function stripVersion(tok: string): string {
  return tok
    .replace(/[@:][\w.^~>=<-]+$/, '')   // `react@18.2`, `pytest:7.4`
    .replace(/\s+v?\d[\d.]*$/, '')       // `react 18.2`, `node v20`
    .replace(/[()[\]{}]/g, '')           // stray brackets
    .trim();
}

function normalize(tok: string): string {
  return tok.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Split content by `### …` headings. Returns [ {title, body}, ... ]. */
function sliceH3Sections(content: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  const lines = content.split('\n');
  let curTitle: string | null = null;
  let curBody: string[] = [];

  for (const line of lines) {
    const m = /^###\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (curTitle !== null) sections.push({ title: curTitle, body: curBody.join('\n') });
      curTitle = m[1].trim();
      curBody = [];
    } else if (curTitle !== null) {
      curBody.push(line);
    }
  }
  if (curTitle !== null) sections.push({ title: curTitle, body: curBody.join('\n') });
  return sections;
}

/**
 * Pull tokens from a section body. Handles:
 *  - markdown tables (first column after the leading `|`)
 *  - bullet lists (`-`, `*`, `+`)
 *  - plain inline mentions (skipped here — handled by whole-doc keyword sweep)
 */
function extractTokens(body: string): string[] {
  const out: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Table row: `| react | 18.2 | …`
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length === 0) continue;
      const first = cells[0];
      // Skip table headers / separators (e.g. `---`, `Component`, `Package`).
      if (/^[-:\s|]+$/.test(first)) continue;
      if (/^(component|package|tool|category|name|item)$/i.test(first)) continue;
      out.push(first);
      continue;
    }

    // Bullet line: `- React 18.2 — UI framework`
    const bm = /^[-*+]\s+(.+?)(?:\s+[—:–-]\s+.*)?$/.exec(line);
    if (bm) {
      const text = bm[1].split(/[,;(]/)[0]; // up to first comma/semicolon/paren
      out.push(text);
    }
  }
  return out;
}

function dedupeKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function sweepKeywords(content: string, patterns: Array<[string, RegExp]>): string[] {
  const out: string[] = [];
  for (const [name, re] of patterns) {
    if (re.test(content)) out.push(name);
  }
  return out;
}

export function parseStackMd(content: string): StackSummary {
  const summary: StackSummary = {
    languages: [], frameworks: [], testFrameworks: [], infra: [], ci: [],
  };
  if (!content || typeof content !== 'string') return summary;

  const sections = sliceH3Sections(content);

  const runtimeBodies: string[] = [];
  const fwRaw: string[] = [];
  const toolchainRaw: string[] = [];

  for (const { title, body } of sections) {
    if (SECTION_TITLES.runtime.test(title)) {
      runtimeBodies.push(body);
    } else if (SECTION_TITLES.frameworks.test(title)) {
      fwRaw.push(...extractTokens(body));
    } else if (SECTION_TITLES.toolchain.test(title)) {
      toolchainRaw.push(...extractTokens(body));
    }
  }

  // Languages: scan ALL text in Runtime Summary against the alias map.
  // The template's table puts the *label* in column 1 ("Language") and the
  // *value* in column 2 ("TypeScript"), so we can't just take first columns.
  for (const body of runtimeBodies) {
    const lowered = body.toLowerCase();
    for (const [alias, canon] of Object.entries(LANGUAGE_ALIASES)) {
      const re = new RegExp(`(?:^|[^a-z0-9])${alias.replace(/[+#]/g, c => '\\' + c)}(?:[^a-z0-9]|$)`, 'i');
      if (re.test(lowered)) summary.languages.push(canon);
    }
  }
  summary.languages = dedupeKeepOrder(summary.languages).slice(0, 3);

  // Frameworks: just normalized tokens, drop versions
  summary.frameworks = dedupeKeepOrder(
    fwRaw.map(t => normalize(stripVersion(t))).filter(t => t && t.length > 1)
  );

  // Test frameworks: whole-doc sweep, supplemented by toolchain
  const tcLowered = toolchainRaw.map(t => normalize(stripVersion(t)));
  summary.testFrameworks = dedupeKeepOrder([
    ...sweepKeywords(content, TEST_PATTERNS),
    ...tcLowered.filter(t => TEST_PATTERNS.some(([name]) => name === t)),
  ]);

  // Infra & CI: whole-doc sweep
  summary.infra = sweepKeywords(content, INFRA_PATTERNS);
  summary.ci    = sweepKeywords(content, CI_PATTERNS);

  return summary;
}
