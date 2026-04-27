import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { searchCatalog, findByName, catalogStats, type CatalogEntry } from './catalog';

const PARTICIPANT_ID = 'agent-discovery.discover';

// ─── HTTP fetch ───────────────────────────────────────────────────────

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'agent-discovery-vscode/0.1' } }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Install helper ───────────────────────────────────────────────────

async function installEntry(
  entry: CatalogEntry,
  workspaceRoot: string,
  overwrite = false
): Promise<{ destPath: string; alreadyExists: boolean }> {
  let subdir: string;
  let fileName = entry.fileName;

  if (entry.type === 'skill') {
    subdir = '.claude/skills';
  } else if (entry.type === 'instruction') {
    subdir = '.github/instructions';
  } else {
    subdir = '.claude/agents';
    fileName = fileName.replace(/\.agent\.md$/, '.md');
  }

  const targetDir = path.join(workspaceRoot, subdir);
  const destPath = path.join(targetDir, fileName);

  if (fs.existsSync(destPath) && !overwrite) {
    return { destPath, alreadyExists: true };
  }

  const content = await fetchText(entry.url);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(destPath, content, 'utf-8');
  return { destPath, alreadyExists: false };
}

// ─── APM manifest generator ───────────────────────────────────────────

function generateApmYml(installed: Array<{ entry: CatalogEntry; path: string }>): string {
  if (installed.length === 0) {
    return [
      '# apm.yml — Agent Package Manager manifest',
      '# No catalog entries installed yet. Run @agent-discovery <query> to find and install agents.',
      'name: my-project',
      'version: 1.0.0',
      'dependencies:',
      '  apm: []',
    ].join('\n');
  }

  const deps = installed.map(({ entry }) => {
    if (entry.source === 'awesome-copilot') {
      // Map to github/awesome-copilot/<type>s/<filename>
      const folder = entry.type === 'agent' ? 'agents'
        : entry.type === 'skill' ? 'skills'
        : 'instructions';
      return `    - github/awesome-copilot/${folder}/${entry.fileName}`;
    } else if (entry.source === 'gh-aw') {
      return `    - github/gh-aw/.github/agents/${entry.fileName}`;
    }
    return `    # ${entry.name} (${entry.source}) — ${entry.url}`;
  });

  return [
    '# apm.yml — Agent Package Manager manifest',
    '# Run `apm install` to reproduce this agent setup on any machine.',
    '# See: https://github.com/microsoft/apm',
    '',
    'name: my-project',
    'version: 1.0.0',
    'dependencies:',
    '  apm:',
    ...deps,
  ].join('\n');
}

// ─── Scan installed entries ───────────────────────────────────────────

function scanInstalledEntries(workspaceRoot: string): Array<{ entry: CatalogEntry; path: string }> {
  const stats = catalogStats();
  const result: Array<{ entry: CatalogEntry; path: string }> = [];

  const checks: Array<{ dir: string; type: string }> = [
    { dir: '.claude/agents', type: 'agent' },
    { dir: '.claude/skills', type: 'skill' },
    { dir: '.github/instructions', type: 'instruction' },
  ];

  for (const { dir } of checks) {
    const absDir = path.join(workspaceRoot, dir);
    if (!fs.existsSync(absDir)) continue;
    const files = fs.readdirSync(absDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const baseName = file.replace(/\.md$/, '');
      // Try to match against catalog by filename
      const entry = findByName(baseName) ?? findByName(file);
      if (entry) {
        result.push({ entry, path: path.join(absDir, file) });
      }
    }
  }

  void stats; // used indirectly via findByName
  return result;
}

// ─── Format results as markdown ──────────────────────────────────────

function formatResults(results: ReturnType<typeof searchCatalog>, query: string): string {
  if (results.length === 0) {
    return `No results found for **"${query}"**.\n\nTry different terms, e.g. \`@agent-discovery code review\` or \`@agent-discovery python testing\`.`;
  }

  const lines = [
    `Found **${results.length}** match${results.length !== 1 ? 'es' : ''} for **"${query}"**:\n`,
  ];

  for (const { entry, alternatives } of results) {
    const typeIcon = entry.type === 'agent' ? '🤖' : entry.type === 'skill' ? '⚡' : '📄';
    lines.push(`### ${typeIcon} ${entry.name}`);
    lines.push(`> ${entry.description}`);
    lines.push(`**Type:** ${entry.type} · **Source:** ${entry.source}`);
    if (entry.tools?.length) lines.push(`**Tools:** ${entry.tools.join(', ')}`);
    if (entry.tags?.length) lines.push(`**Tags:** ${entry.tags.slice(0, 5).join(', ')}`);
    if (alternatives?.length) {
      const altStr = alternatives.map(a => `${a.name} (${a.source})`).join(', ');
      lines.push(`⚡ Also available as: ${altStr}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('**To install:** `@agent-discovery /install <name>`');
  lines.push('**To generate apm.yml:** `@agent-discovery /apm`');

  return lines.join('\n');
}

// ─── Chat participant handler ─────────────────────────────────────────

export async function handler(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {

  // /install <name>
  if (request.command === 'install') {
    const name = request.prompt.trim();
    if (!name) {
      stream.markdown('Please provide an agent name: `@agent-discovery /install <name>`\n\nSearch first: `@agent-discovery <query>`');
      return {};
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      stream.markdown('No workspace folder open. Open a project folder first.');
      return {};
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    stream.progress(`Looking up "${name}"…`);
    const entry = findByName(name);
    if (!entry) {
      stream.markdown(`No catalog entry found for **"${name}"**.\n\nSearch first: \`@agent-discovery ${name}\``);
      return {};
    }

    if (token.isCancellationRequested) return {};

    stream.progress(`Downloading ${entry.name}…`);
    try {
      const { destPath, alreadyExists } = await installEntry(entry, workspaceRoot);
      if (alreadyExists) {
        stream.markdown(`**${entry.name}** is already installed at \`${path.relative(workspaceRoot, destPath)}\`.\n\nTo overwrite, delete the file and run again.`);
      } else {
        const relPath = path.relative(workspaceRoot, destPath);
        const activationNote = entry.type === 'agent'
          ? 'The agent is now available as a subagent in Claude Code.'
          : entry.type === 'skill'
          ? 'The skill is auto-discovered by Claude Code.'
          : 'The instruction is loaded automatically for matching files.';

        stream.markdown([
          `✅ **${entry.name}** installed successfully!`,
          '',
          `**File:** \`${relPath}\``,
          `**Type:** ${entry.type}`,
          `**Source:** ${entry.source}`,
          '',
          activationNote,
          '',
          '**Lock it for your team:** `@agent-discovery /apm`',
        ].join('\n'));

        stream.button({ command: 'vscode.open', title: 'Open installed file', arguments: [vscode.Uri.file(destPath)] });
      }
    } catch (err: any) {
      stream.markdown(`Failed to install **${entry.name}**: ${err.message}`);
    }
    return {};
  }

  // /apm — generate apm.yml
  if (request.command === 'apm') {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      stream.markdown('No workspace folder open.');
      return {};
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    stream.progress('Scanning installed agents…');
    const installed = scanInstalledEntries(workspaceRoot);

    const yml = generateApmYml(installed);

    if (installed.length > 0) {
      stream.markdown([
        `Found **${installed.length}** catalog-sourced agent(s) in your workspace.`,
        '',
        'Add this `apm.yml` to your repo root so every developer who clones it gets the same agent setup via `apm install`:',
      ].join('\n'));
    } else {
      stream.markdown('No catalog agents installed yet. Here\'s a starter `apm.yml`:');
    }

    stream.markdown('```yaml\n' + yml + '\n```');

    const apmPath = path.join(workspaceRoot, 'apm.yml');
    const exists = fs.existsSync(apmPath);

    stream.markdown([
      '',
      exists
        ? `> **Note:** \`apm.yml\` already exists in your workspace root.`
        : `> **Next step:** Save as \`apm.yml\` in your repo root and commit it.`,
      '',
      '**Install APM CLI:** `curl -sSL https://aka.ms/apm-unix | sh`',
      '**Then run:** `apm install` — reproduces your full agent setup on any machine.',
    ].join('\n'));

    if (!exists) {
      stream.button({ command: 'agent-discovery.saveApm', title: 'Save apm.yml to workspace root', arguments: [apmPath, yml] });
    }

    return {};
  }

  // Default: search
  const query = request.prompt.trim();
  if (!query) {
    const stats = catalogStats();
    stream.markdown([
      '## Agent Discovery',
      '',
      `Catalog: **${stats.total} entries** from ${stats.sources.join(', ')}`,
      '',
      '**Search:** `@agent-discovery <query>`',
      '**Install:** `@agent-discovery /install <name>`',
      '**Generate apm.yml:** `@agent-discovery /apm`',
      '',
      '**Examples:**',
      '- `@agent-discovery code review`',
      '- `@agent-discovery react frontend`',
      '- `@agent-discovery python testing`',
      '- `@agent-discovery security audit`',
      '- `@agent-discovery azure deployment`',
    ].join('\n'));
    return {};
  }

  if (token.isCancellationRequested) return {};

  stream.progress(`Searching catalog for "${query}"…`);
  const results = searchCatalog(query, 'all', 8);
  stream.markdown(formatResults(results, query));

  if (results.length > 0) {
    stream.button({
      command: 'agent-discovery.searchMore',
      title: 'Show more results',
      arguments: [query],
    });
  }

  return {};
}

// ─── Activate ─────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);

  participant.followupProvider = {
    provideFollowups(result, _ctx, _token) {
      return [
        { prompt: 'code review', label: 'Find code review agents', command: undefined },
        { prompt: '/apm', label: 'Generate apm.yml', command: 'apm' },
      ];
    },
  };

  context.subscriptions.push(
    participant,

    vscode.commands.registerCommand('agent-discovery.saveApm', async (filePath: string, content: string) => {
      fs.writeFileSync(filePath, content, 'utf-8');
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('apm.yml saved! Commit it to share agent setup with your team.');
    }),

    vscode.commands.registerCommand('agent-discovery.searchMore', async (query: string) => {
      const results = searchCatalog(query, 'all', 20);
      const picks = results.map(r => ({
        label: `${r.entry.name} [${r.entry.type}]`,
        description: r.entry.source,
        detail: r.entry.description,
        entry: r.entry,
      }));
      const picked = await vscode.window.showQuickPick(picks, {
        title: `Agent Discovery: "${query}"`,
        placeHolder: 'Select an agent to install',
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (!picked) return;

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders?.length) return;
      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      try {
        const { destPath } = await installEntry(picked.entry, workspaceRoot);
        const relPath = path.relative(workspaceRoot, destPath);
        vscode.window.showInformationMessage(`✅ ${picked.entry.name} installed at ${relPath}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to install: ${err.message}`);
      }
    })
  );
}

export function deactivate() {}
