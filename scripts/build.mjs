import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const target = ['chrome110'];

function outputPath(relativePath) {
  const path = join(dist, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

function normalizeTimestamps(path) {
  const timestamp = new Date('1980-01-01T00:00:00.000Z');
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) normalizeTimestamps(child);
    if (statSync(child).isFile()) utimesSync(child, timestamp, timestamp);
  }
}

async function minifyHtml(relativePath) {
  let html = readFileSync(join(root, relativePath), 'utf8');
  for (const match of [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)]) {
    const result = await transform(match[1], { loader: 'css', minify: true });
    html = html.replace(match[0], `<style>${result.code.trim()}</style>`);
  }
  html = html.replace(/>\s+</g, '><').trim();
  writeFileSync(outputPath(relativePath), `${html}\n`);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execFileSync(process.execPath, [join(root, 'scripts/bundle.mjs')], { stdio: 'inherit' });
const engineSource = readFileSync(join(root, 'devtools/engine.classic.js'), 'utf8');
const engine = await transform(engineSource, {
  charset: 'utf8',
  legalComments: 'none',
  minify: true,
  target,
});
writeFileSync(outputPath('devtools/engine.classic.js'), engine.code);

await build({
  absWorkingDir: root,
  bundle: true,
  charset: 'utf8',
  chunkNames: 'chunks/[name]-[hash]',
  entryNames: '[name]',
  entryPoints: {
    panel: 'devtools/panel.js',
    sidebar: 'devtools/sidebar.js',
  },
  format: 'esm',
  legalComments: 'none',
  minify: true,
  outdir: join(dist, 'devtools'),
  platform: 'browser',
  sourcemap: false,
  splitting: true,
  target,
  treeShaking: true,
});

await build({
  absWorkingDir: root,
  bundle: true,
  charset: 'utf8',
  entryPoints: ['devtools/devtools.js'],
  format: 'iife',
  legalComments: 'none',
  minify: true,
  outfile: join(dist, 'devtools/devtools.js'),
  platform: 'browser',
  sourcemap: false,
  target,
});

await build({
  absWorkingDir: root,
  bundle: true,
  charset: 'utf8',
  entryNames: '[name]',
  entryPoints: {
    panel: 'ui/panel.css',
    sidebar: 'ui/sidebar.css',
    theme: 'ui/theme.css',
  },
  legalComments: 'none',
  minify: true,
  outdir: join(dist, 'ui'),
  sourcemap: false,
  target,
});

for (const html of [
  'popup.html',
  'devtools/devtools.html',
  'devtools/panel.html',
  'devtools/sidebar.html',
]) {
  await minifyHtml(html);
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
writeFileSync(outputPath('manifest.json'), `${JSON.stringify(manifest)}\n`);
mkdirSync(outputPath('icons'), { recursive: true });
for (const icon of Object.values(manifest.icons || {})) {
  copyFileSync(join(root, icon), outputPath(icon));
}
for (const license of ['LICENSE.txt', 'NOTICE.txt']) {
  const source = join(root, 'vendor', license);
  if (existsSync(source)) copyFileSync(source, outputPath(join('vendor', license)));
}

normalizeTimestamps(dist);

console.log(`built ${dist}`);
