import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const maxUnpacked = 120_000;
const maxZip = 43_000;
const stretchUnpacked = 90_000;
const stretchZip = 35_000;
const sourceRuntimeBaseline = 218_892;
const sourceZipBaseline = 64_340;

function directorySize(path) {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = join(path, entry.name);
    return total + (entry.isDirectory() ? directorySize(child) : statSync(child).size);
  }, 0);
}

if (!existsSync(dist)) throw new Error('dist/ does not exist. Run npm run build first.');

const unpacked = directorySize(dist);
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const archive = join(root, 'build', `schema-devtools-${packageJson.version}.zip`);
const zipped = existsSync(archive) ? statSync(archive).size : null;

console.log(`unpacked: ${unpacked.toLocaleString()} bytes (budget ${maxUnpacked.toLocaleString()})`);
console.log(zipped === null
  ? 'zip:      not built'
  : `zip:      ${zipped.toLocaleString()} bytes (budget ${maxZip.toLocaleString()})`);
console.log(`reduction: ${Math.round((1 - unpacked / sourceRuntimeBaseline) * 100)}% unpacked${
  zipped === null ? '' : ` / ${Math.round((1 - zipped / sourceZipBaseline) * 100)}% zip`
}`);
if (unpacked > stretchUnpacked || (zipped !== null && zipped > stretchZip)) {
  console.log(`stretch:  ${stretchUnpacked.toLocaleString()} unpacked / ${stretchZip.toLocaleString()} zip not yet reached`);
}

if (process.argv.includes('--check')) {
  if (unpacked > maxUnpacked) throw new Error(`Unpacked artifact exceeds budget by ${unpacked - maxUnpacked} bytes.`);
  if (zipped === null) throw new Error('Release ZIP does not exist. Run npm run package first.');
  if (zipped > maxZip) throw new Error(`Release ZIP exceeds budget by ${zipped - maxZip} bytes.`);
}
