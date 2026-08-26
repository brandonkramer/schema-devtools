import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const archive = join(buildDir, `schema-devtools-${version}.zip`);

function releaseFiles(path, prefix = '') {
  return readdirSync(path, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relative = join(prefix, entry.name);
      return entry.isDirectory() ? releaseFiles(join(path, entry.name), relative) : [relative];
    });
}

execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
mkdirSync(buildDir, { recursive: true });
rmSync(archive, { force: true });

const result = spawnSync('zip', ['-X', '-9', '-q', archive, ...releaseFiles(join(root, 'dist'))], {
  cwd: join(root, 'dist'),
  encoding: 'utf8',
});
if (result.status !== 0) {
  throw new Error(result.stderr || 'Unable to create release ZIP. Install the zip command and retry.');
}

console.log(`wrote ${archive}`);
execFileSync(process.execPath, [join(root, 'scripts/size.mjs'), '--check'], { stdio: 'inherit' });
