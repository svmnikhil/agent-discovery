const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  loader: { '.json': 'json' },
  logLevel: 'info',
};

function copyBundledSkill() {
  const src = path.join(__dirname, 'bundled-skill');
  const dst = path.join(__dirname, 'dist', 'bundled-skill');
  if (!fs.existsSync(src)) {
    console.warn('[esbuild] bundled-skill/ not present; run `node scripts/fetch-skill.mjs` first.');
    return;
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log(`[esbuild] copied bundled-skill/ → dist/bundled-skill/`);
}

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    copyBundledSkill();
    return ctx.watch();
  });
} else {
  esbuild.build(buildOptions).then(copyBundledSkill).catch(() => process.exit(1));
}
