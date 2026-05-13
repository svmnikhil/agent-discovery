/**
 * Integration tests for the @agent-discovery VS Code chat participant handler.
 *
 * Strategy:
 *  - vscode module: mocked (not a real npm package in Node.js)
 *  - https module:  mocked (avoid network calls)
 *  - fs module:     REAL — writes to a temp directory so we verify actual file I/O
 *  - catalog:       REAL — loads real catalog-data.json (392 entries)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── vscode mock ────────────────────────────────────────────────────────────
// Must be declared before vi.mock() factory is evaluated.
// We expose `_workspaceFolders` so individual tests can mutate it.
export let _workspaceFolders: Array<{ uri: { fsPath: string } }> | null = null;

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() { return _workspaceFolders; },
  },
  Uri: {
    file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }),
  },
  commands: {
    registerCommand: vi.fn(),
  },
  chat: {
    createChatParticipant: vi.fn().mockReturnValue({ followupProvider: null }),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showQuickPick: vi.fn(),
  },
  LanguageModelChatMessage: {
    User: (content: string) => ({ role: 'user', content }),
  },
}));

// ─── skill-runner mock ──────────────────────────────────────────────────────
// Tests reconfigure `_runSkillImpl` per-case to stub success/failure.
export let _runSkillImpl: ((workspaceRoot: string) => Promise<any>) | null = null;
vi.mock('../src/skill-runner', async () => {
  // Re-export the real error classes so `instanceof` checks in the handler match.
  const actual = await vi.importActual<typeof import('../src/skill-runner')>('../src/skill-runner');
  return {
    ...actual,
    runAcquireCodebaseKnowledge: vi.fn(async (workspaceRoot: string) => {
      if (!_runSkillImpl) throw new Error('Test did not configure _runSkillImpl');
      return _runSkillImpl(workspaceRoot);
    }),
  };
});

// ─── https mock ─────────────────────────────────────────────────────────────
const MOCK_AGENT_CONTENT = `---
name: mock-agent
description: A mock agent for testing
tools: [Bash, Read]
---

# Mock Agent

You are a test agent. Help the user with testing tasks.
`;

vi.mock('https', () => ({
  get: vi.fn((
    _url: string,
    _opts: object,
    cb: (res: object) => void
  ) => {
    const chunks: Buffer[] = [Buffer.from(MOCK_AGENT_CONTENT)];
    const mockRes = {
      statusCode: 200,
      headers: {},
      on(event: string, fn: (arg?: Buffer | Error) => void) {
        if (event === 'data') chunks.forEach(c => fn(c));
        if (event === 'end') fn();
        return this;
      },
    };
    cb(mockRes);
    return { on: vi.fn() };
  }),
}));

// ─── import handler AFTER mocks are set up ──────────────────────────────────
import { handler, activate } from '../src/extension';
import { searchCatalog } from '../src/catalog';
import { MissingPythonError, LmOutputInvalidError, ScanTimeoutError } from '../src/skill-runner';

// Activate once so `extensionRoot` (module state in extension.ts) is set.
// The /review handler short-circuits with 'Extension not yet activated.' otherwise.
activate({
  extensionUri: { fsPath: '/fake/extension' } as any,
  subscriptions: { push: () => {} },
} as any);

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeRequest(command: string | undefined, prompt: string) {
  return {
    command,
    prompt,
  } as any;
}

function makeContext() {
  return { history: [] } as any;
}

function makeToken(cancelled = false) {
  return { isCancellationRequested: cancelled } as any;
}

interface StreamCapture {
  stream: {
    markdown: ReturnType<typeof vi.fn>;
    progress: ReturnType<typeof vi.fn>;
    button: ReturnType<typeof vi.fn>;
  };
  /** Call AFTER handler completes — reads getter value post-execution. */
  markdown(): string;
  progress(): string[];
  buttons(): Array<{ command: string; title: string }>;
}

/** Captures all stream calls. Access `.markdown()` AFTER awaiting the handler. */
function makeStream(): StreamCapture {
  const markdownChunks: string[] = [];
  const progressChunks: string[] = [];
  const buttonList: Array<{ command: string; title: string }> = [];
  return {
    stream: {
      markdown: vi.fn((text: string) => { markdownChunks.push(text); }),
      progress: vi.fn((text: string) => { progressChunks.push(text); }),
      button: vi.fn((b: { command: string; title: string }) => { buttonList.push(b); }),
    },
    markdown: () => markdownChunks.join('\n'),
    progress: () => progressChunks,
    buttons: () => buttonList,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('@agent-discovery chat handler', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-discovery-test-'));
    _workspaceFolders = [{ uri: { fsPath: tempDir } }];
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    _workspaceFolders = null;
  });

  // ── Search ────────────────────────────────────────────────────────────────

  describe('default (search) command', () => {
    it('returns ranked results for a real catalog query', async () => {
      const s = makeStream();
      await handler(makeRequest(undefined, 'code review'), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).toBeTruthy();
      expect(md).toMatch(/###\s+(🤖|⚡|📄)/);
      expect(md.toLowerCase()).toMatch(/review|code/);
    });

    it('results are ranked — top result has highest relevance for specific query', async () => {
      const directResults = searchCatalog('code review', 'all', 3);
      expect(directResults.length).toBeGreaterThan(0);

      const s = makeStream();
      await handler(makeRequest(undefined, 'code review'), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      const topName = directResults[0].entry.name;
      expect(md).toContain(topName);
    });

    it('returns help text for empty query', async () => {
      const s = makeStream();
      await handler(makeRequest(undefined, ''), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).toContain('Agent Discovery');
      expect(md).toContain('@agent-discovery');
      expect(md).toMatch(/\d+\s+entries/);
    });

    it('returns no-results message for unmatched query', async () => {
      // Use a single nonsense token (no underscores → BM25 won't split it into real words)
      const s = makeStream();
      await handler(
        makeRequest(undefined, 'blarfzorpnoggle'),
        makeContext(), s.stream as any, makeToken()
      );

      expect(s.markdown()).toMatch(/no results/i);
    });

    it('does not throw on special-character query', async () => {
      const s = makeStream();
      await expect(
        handler(makeRequest(undefined, 'c++ template<typename T> && operator||'), makeContext(), s.stream as any, makeToken())
      ).resolves.toBeDefined();
    });

    it('shows install instructions in search results', async () => {
      const s = makeStream();
      await handler(makeRequest(undefined, 'react frontend'), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      if (!md.includes('No results')) {
        expect(md).toContain('/install');
        expect(md).toContain('/apm');
      }
    });
  });

  // ── /install ─────────────────────────────────────────────────────────────

  describe('/install command', () => {
    it('installs a real catalog entry to .claude/agents/', async () => {
      const results = searchCatalog('code review', 'agent', 1);
      expect(results.length).toBeGreaterThan(0);
      const targetName = results[0].entry.name;

      const s = makeStream();
      await handler(makeRequest('install', targetName), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).toContain('installed successfully');

      const agentsDir = join(tempDir, '.claude', 'agents');
      expect(existsSync(agentsDir)).toBe(true);
      const files = require('fs').readdirSync(agentsDir);
      expect(files.length).toBeGreaterThan(0);

      const installedContent = readFileSync(join(agentsDir, files[0]), 'utf-8');
      expect(installedContent).toContain('mock-agent');

      expect(s.buttons().some(b => b.title.toLowerCase().includes('open'))).toBe(true);
    });

    it('returns error message for bogus agent name', async () => {
      const s = makeStream();
      await handler(
        makeRequest('install', 'this-agent-does-not-exist-xyz-000'),
        makeContext(), s.stream as any, makeToken()
      );

      expect(s.markdown()).toMatch(/no.*found|not found/i);
      expect(s.markdown()).toContain('@agent-discovery');
    });

    it('returns error when no workspace folder is open', async () => {
      _workspaceFolders = null;

      const s = makeStream();
      await handler(makeRequest('install', 'some-agent'), makeContext(), s.stream as any, makeToken());

      expect(s.markdown()).toMatch(/no workspace/i);
    });

    it('returns usage hint when install is called with no name', async () => {
      const s = makeStream();
      await handler(makeRequest('install', '   '), makeContext(), s.stream as any, makeToken());

      expect(s.markdown()).toContain('/install');
    });

    it('detects already-installed file and does not overwrite', async () => {
      const results = searchCatalog('code review', 'agent', 1);
      const targetName = results[0].entry.name;
      const targetEntry = results[0].entry;

      const agentsDir = join(tempDir, '.claude', 'agents');
      require('fs').mkdirSync(agentsDir, { recursive: true });
      const destFileName = targetEntry.fileName.replace(/\.agent\.md$/, '.md');
      require('fs').writeFileSync(join(agentsDir, destFileName), 'already here', 'utf-8');

      const s = makeStream();
      await handler(makeRequest('install', targetName), makeContext(), s.stream as any, makeToken());

      expect(s.markdown()).toMatch(/already installed/i);
      const content = readFileSync(join(agentsDir, destFileName), 'utf-8');
      expect(content).toBe('already here');
    });
  });

  // ── /apm ──────────────────────────────────────────────────────────────────

  describe('/apm command', () => {
    it('generates starter apm.yml when no agents are installed', async () => {
      const s = makeStream();
      await handler(makeRequest('apm', ''), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).toContain('```yaml');
      expect(md).toContain('name:');
      expect(md).toContain('dependencies:');
      expect(md).toContain('apm install');
    });

    it('generates apm.yml with installed catalog entries', async () => {
      const results = searchCatalog('code review', 'agent', 1);
      const targetEntry = results[0].entry;

      const agentsDir = join(tempDir, '.claude', 'agents');
      require('fs').mkdirSync(agentsDir, { recursive: true });
      const destFileName = targetEntry.fileName.replace(/\.agent\.md$/, '.md');
      require('fs').writeFileSync(join(agentsDir, destFileName), '# agent', 'utf-8');

      const s = makeStream();
      await handler(makeRequest('apm', ''), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).toContain('```yaml');
      expect(md).toContain('github/awesome-copilot');
      expect(md).toMatch(/\d+.*agent/i);
    });

    it('returns error when no workspace folder is open', async () => {
      _workspaceFolders = null;

      const s = makeStream();
      await handler(makeRequest('apm', ''), makeContext(), s.stream as any, makeToken());

      expect(s.markdown()).toMatch(/no workspace/i);
    });

    it('apm.yml contains valid YAML structure', async () => {
      const s = makeStream();
      await handler(makeRequest('apm', ''), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      const yamlMatch = md.match(/```yaml\n([\s\S]+?)```/);
      expect(yamlMatch).not.toBeNull();

      const yaml = yamlMatch![1];
      expect(yaml).toContain('name:');
      expect(yaml).toContain('version:');
      expect(yaml).toContain('dependencies:');
      expect(yaml).toContain('apm:');
    });
  });

  // ── Cancellation ──────────────────────────────────────────────────────────

  it('respects cancellation token for search', async () => {
    const s = makeStream();
    const result = await handler(
      makeRequest(undefined, 'code review'),
      makeContext(),
      s.stream as any,
      makeToken(true) // cancelled
    );
    expect(result).toBeDefined();
  });

  // ── /review ───────────────────────────────────────────────────────────────

  describe('/review command', () => {
    const fakeModel = { sendRequest: vi.fn() };

    function reviewRequest(model: any = fakeModel) {
      return { command: 'review', prompt: '', model } as any;
    }

    function configureSkill(impl: (workspaceRoot: string) => Promise<any>) {
      _runSkillImpl = impl;
    }

    function successfulSkill(stackMd: string, lmQueries: any[] = []) {
      return async (workspaceRoot: string) => {
        const stackPath = join(workspaceRoot, 'docs', 'codebase', 'STACK.md');
        require('fs').mkdirSync(join(workspaceRoot, 'docs', 'codebase'), { recursive: true });
        require('fs').writeFileSync(stackPath, stackMd, 'utf-8');
        return { stackMdPath: stackPath, stackMdContent: stackMd, lmSuggestedQueries: lmQueries };
      };
    }

    afterEach(() => { _runSkillImpl = null; });

    it('errors out with no workspace', async () => {
      _workspaceFolders = null;
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/no workspace/i);
    });

    it('short-circuits self-recursion (root package.json#name === agent-discovery)', async () => {
      require('fs').writeFileSync(join(tempDir, 'package.json'),
        JSON.stringify({ name: 'agent-discovery' }), 'utf-8');
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/agent-discovery.*repo itself/);
    });

    it('errors when no LanguageModelChat is available', async () => {
      const s = makeStream();
      // Pass null explicitly — `undefined` would re-trigger the default-param `fakeModel`.
      await handler(reviewRequest(null), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/Copilot Chat/);
    });

    it('happy path: renders Per-technology, Cross-cutting, and Adapted groups', async () => {
      const stackMd = `# Stack

### 1) Runtime Summary
- Language: TypeScript

### 2) Production Frameworks and Dependencies
- react
- vite

### 5) Environment and Config
- Dockerfile present
`;
      configureSkill(successfulSkill(stackMd, [
        // `bicep` matches Azure AVM Bicep mode in the real catalog and isn't
        // in any static-query set, so it surfaces under "Adapted to your stack".
        { group: 'stack-adapted', label: 'Bicep', query: 'bicep', why: 'Azure Bicep templates detected' },
      ]));

      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).toContain('## Per-technology recommendations');
      expect(md).toContain('## Cross-cutting concerns');
      expect(md).toContain('## Adapted to your stack');
      expect(md).toContain('### React');
      expect(md).toContain('### Bicep');
      expect(md).toContain('(LM-suggested)');
      expect(md).toMatch(/Detected stack/);

      // [Open STACK.md] button registered
      expect(s.buttons().some(b => b.title === 'Open STACK.md')).toBe(true);

      // STACK.md present on disk
      expect(existsSync(join(tempDir, 'docs', 'codebase', 'STACK.md'))).toBe(true);
    });

    it('omits "Adapted to your stack" when LM suggested no queries', async () => {
      const stackMd = `# Stack

### 1) Runtime Summary
- Language: TypeScript

### 2) Production Frameworks and Dependencies
- react
`;
      configureSkill(successfulSkill(stackMd, []));
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).not.toContain('## Adapted to your stack');
      expect(md).toContain('## Per-technology recommendations');
    });

    it('omits Per-technology when stack is empty (only cross-cutting renders)', async () => {
      configureSkill(successfulSkill('# Stack\n\nNothing detected.\n', []));
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      const md = s.markdown();

      expect(md).not.toContain('## Per-technology recommendations');
      expect(md).toContain('## Cross-cutting concerns');
    });

    it('renders MissingPythonError with install guidance', async () => {
      configureSkill(async () => { throw new MissingPythonError(); });
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/Python 3\.8\+/);
    });

    it('renders ScanTimeoutError friendly message', async () => {
      configureSkill(async () => { throw new ScanTimeoutError(); });
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/60s/);
    });

    it('renders LmOutputInvalidError friendly message', async () => {
      configureSkill(async () => { throw new LmOutputInvalidError('bad'); });
      const s = makeStream();
      await handler(reviewRequest(), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/unparseable STACK\.md/);
    });
  });

  // ── /review nudge in lexical path ─────────────────────────────────────────

  describe('low-result nudge', () => {
    it('appends /review tip when results ≤ 1 and workspace is open', async () => {
      const s = makeStream();
      await handler(makeRequest(undefined, 'blarfzorpnoggle'), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).toMatch(/Try `@agent-discovery \/review`/);
    });

    it('does not append nudge when results are plentiful', async () => {
      const s = makeStream();
      await handler(makeRequest(undefined, 'code review'), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).not.toMatch(/Try `@agent-discovery \/review`/);
    });

    it('does not append nudge when no workspace is open', async () => {
      _workspaceFolders = null;
      const s = makeStream();
      await handler(makeRequest(undefined, 'blarfzorpnoggle'), makeContext(), s.stream as any, makeToken());
      expect(s.markdown()).not.toMatch(/Try `@agent-discovery \/review`/);
    });
  });

  // ── Welcome lists /review ─────────────────────────────────────────────────

  it('empty-prompt welcome mentions /review', async () => {
    const s = makeStream();
    await handler(makeRequest(undefined, ''), makeContext(), s.stream as any, makeToken());
    expect(s.markdown()).toContain('/review');
  });
});
