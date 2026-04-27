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
  binPath: string;    // path inside extracted dir
  isZip: boolean;
}

function platformAsset(): PlatformAsset | null {
  const plat = process.platform;
  const arch = process.arch;

  if (plat === 'darwin' && arch === 'arm64') {
    return { asset: 'apm-darwin-arm64.tar.gz', binPath: 'apm-darwin-arm64/apm', isZip: false };
  }
  if (plat === 'darwin' && arch === 'x64') {
    return { asset: 'apm-darwin-x86_64.tar.gz', binPath: 'apm-darwin-x86_64/apm', isZip: false };
  }
  if (plat === 'linux' && arch === 'arm64') {
    return { asset: 'apm-linux-arm64.tar.gz', binPath: 'apm-linux-arm64/apm', isZip: false };
  }
  if (plat === 'linux' && arch === 'x64') {
    return { asset: 'apm-linux-x86_64.tar.gz', binPath: 'apm-linux-x86_64/apm', isZip: false };
  }
  if (plat === 'win32' && arch === 'x64') {
    return { asset: 'apm-windows-x86_64.zip', binPath: 'apm-windows-x86_64/apm.exe', isZip: true };
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
      // Windows: PowerShell Expand-Archive
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

/**
 * Returns the path to the apm binary, downloading it on first use.
 * Subsequent calls return immediately if the binary is already present.
 */
export async function ensureApmBinary(context: vscode.ExtensionContext): Promise<string> {
  const asset = platformAsset();
  if (!asset) {
    throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`);
  }

  const storageDir = context.globalStorageUri.fsPath;
  const binDir = path.join(storageDir, 'apm-bin', APM_VERSION);
  const binName = process.platform === 'win32' ? 'apm.exe' : 'apm';
  const binPath = path.join(binDir, binName);

  if (fs.existsSync(binPath)) {
    return binPath;
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

      progress.report({ message: 'Extracting…' });
      const extractDir = path.join(os.tmpdir(), `apm-extract-${Date.now()}`);
      fs.mkdirSync(extractDir, { recursive: true });
      await extract(archivePath, extractDir, asset.isZip);

      // Copy binary to stable location
      const extractedBin = path.join(extractDir, asset.binPath);
      fs.copyFileSync(extractedBin, binPath);
      if (process.platform !== 'win32') {
        fs.chmodSync(binPath, 0o755);
      }

      // Cleanup temp files
      try { fs.rmSync(archivePath, { force: true }); } catch { /* ignore */ }
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }

      return binPath;
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
