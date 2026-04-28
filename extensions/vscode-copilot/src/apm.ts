import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as os from 'os';

const APM_VERSION = '0.9.4';
const APM_BASE_URL = `https://github.com/microsoft/apm/releases/download/v${APM_VERSION}`;

interface PlatformAsset {
  asset: string;      // filename in GitHub Releases
  isZip: boolean;
}

function platformAsset(): PlatformAsset | null {
  const plat = process.platform;
  const arch = process.arch;

  if (plat === 'darwin' && arch === 'arm64') {
    return { asset: 'apm-darwin-arm64.tar.gz', isZip: false };
  }
  if (plat === 'darwin' && arch === 'x64') {
    return { asset: 'apm-darwin-x86_64.tar.gz', isZip: false };
  }
  if (plat === 'linux' && arch === 'arm64') {
    return { asset: 'apm-linux-arm64.tar.gz', isZip: false };
  }
  if (plat === 'linux' && arch === 'x64') {
    return { asset: 'apm-linux-x86_64.tar.gz', isZip: false };
  }
  if (plat === 'win32' && arch === 'x64') {
    return { asset: 'apm-windows-x86_64.zip', isZip: true };
  }
  return null;
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      https.get(u, { headers: { 'User-Agent': 'agent-discovery-vscode/0.1' } }, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve()));
        out.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

function extract(archivePath: string, destDir: string, isZip: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];

    if (isZip) {
      cmd = 'powershell';
      args = ['-NoProfile', '-Command', `Expand-Archive -Force -Path "${archivePath}" -DestinationPath "${destDir}"`];
    } else {
      cmd = 'tar';
      args = ['xzf', archivePath, '-C', destDir];
    }

    const proc = child_process.spawn(cmd, args, { stdio: 'pipe' });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

/** Recursively find first file with the given name inside dir. */
function findFile(dir: string, name: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) { return found; }
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

/** Run `binaryPath --version`; throw with stdout+stderr if it exits non-zero. */
function verifyBinary(binaryPath: string): void {
  const result = child_process.spawnSync(binaryPath, ['--version'], { timeout: 10_000 });
  if (result.status !== 0) {
    const out = (result.stdout?.toString() ?? '') + (result.stderr?.toString() ?? '');
    throw new Error(
      `APM binary self-test failed (exit ${result.status}).\n${out}\n` +
      `Check that _internal/ exists as a sibling of: ${binaryPath}`
    );
  }
}

/**
 * Returns the path to the apm binary, downloading it on first use.
 * Subsequent calls return immediately if the binary is already present.
 *
 * The archive may contain the binary inside a platform-named subdirectory
 * (e.g. apm-darwin-arm64/apm). We locate it dynamically so that _internal/
 * always lands as a sibling of the binary regardless of the archive layout.
 */
export async function ensureApmBinary(context: vscode.ExtensionContext): Promise<string> {
  const asset = platformAsset();
  if (!asset) {
    throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`);
  }

  const binaryName = process.platform === 'win32' ? 'apm.exe' : 'apm';
  const storageDir = context.globalStorageUri.fsPath;
  const binDir = path.join(storageDir, 'apm-bin', APM_VERSION);
  // Final resting place: binDir/apm-home/<binaryName>  (+ _internal/ as sibling)
  const finalHome = path.join(binDir, 'apm-home');
  const binaryPath = path.join(finalHome, binaryName);

  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Agent Discovery: Downloading APM…',
      cancellable: false,
    },
    async progress => {
      fs.mkdirSync(binDir, { recursive: true });

      const archivePath = path.join(os.tmpdir(), asset.asset);
      const url = `${APM_BASE_URL}/${asset.asset}`;

      progress.report({ message: `Fetching ${asset.asset}…` });
      await downloadFile(url, archivePath);

      // Use a temp dir inside binDir so rename stays on the same volume
      const extractTmp = path.join(binDir, `extract-tmp-${Date.now()}`);
      fs.mkdirSync(extractTmp, { recursive: true });

      try {
        progress.report({ message: 'Extracting…' });
        await extract(archivePath, extractTmp, asset.isZip);

        // Find the binary anywhere in the extracted tree
        const foundBinary = findFile(extractTmp, binaryName);
        if (!foundBinary) {
          throw new Error(`Could not find '${binaryName}' inside the archive`);
        }

        // The binary's parent is the "home" dir — _internal/ is already its sibling
        const extractedHome = path.dirname(foundBinary);

        if (fs.existsSync(finalHome)) {
          fs.rmSync(finalHome, { recursive: true, force: true });
        }
        // Atomic rename: keeps _internal/ alongside the binary
        fs.renameSync(extractedHome, finalHome);
      } finally {
        try { fs.rmSync(extractTmp, { recursive: true, force: true }); } catch { /* ignore */ }
        try { fs.rmSync(archivePath, { force: true }); } catch { /* ignore */ }
      }

      if (process.platform !== 'win32') {
        fs.chmodSync(binaryPath, 0o755);
      }

      // Fail loud if the binary can't load its Python runtime
      verifyBinary(binaryPath);

      return binaryPath;
    }
  );
}

/**
 * Runs `apm install` in the given workspace root.
 * Returns combined stdout+stderr output.
 */
export function runApmInstall(binaryPath: string, workspaceRoot: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(binaryPath, ['install'], {
      cwd: workspaceRoot,
      stdio: 'pipe',
    });

    const chunks: Buffer[] = [];
    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr.on('data', (d: Buffer) => chunks.push(d));

    proc.on('close', code => {
      const output = Buffer.concat(chunks).toString('utf-8');
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`apm install exited with code ${code}\n${output}`));
      }
    });

    proc.on('error', reject);
  });
}
