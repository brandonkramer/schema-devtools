import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { FIXTURES } from '../sandbox/fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });

function loadEngine(path) {
  const context = {};
  vm.runInNewContext(readFileSync(path, 'utf8'), context);
  return context.SchemaDT;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshotFor(fixture) {
  return {
    url: fixture.url,
    title: fixture.name,
    canonical: fixture.canonical,
    robots: null,
    inspectedAt: '2026-08-26T00:00:00.000Z',
    jsonld: [{
      index: 0,
      raw: JSON.stringify({ '@context': 'https://schema.org', '@graph': fixture.entities.map((entity) => entity.data) }),
      parsed: { '@context': 'https://schema.org', '@graph': fixture.entities.map((entity) => entity.data) },
      parseError: null,
      selector: 'jsonld:0',
      domIndex: 0,
    }],
    microdata: [],
    rdfa: [],
    agent: { hasModelContext: false, modelContext: null, hasLlmsTxtLink: false },
  };
}

const source = loadEngine(join(root, 'devtools/engine.classic.js'));
const release = loadEngine(join(dist, 'devtools/engine.classic.js'));
for (const name of ['EXTRACT_SOURCE', 'SELECTION_EXTRACT_SOURCE', 'normalize', 'validate', 'score', 'buildAgentBundle', 'toAgentMarkdown']) {
  assert.equal(typeof release[name], typeof source[name], `Distribution engine export ${name} must match source.`);
}

new vm.Script(release.EXTRACT_SOURCE);
new vm.Script(release.SELECTION_EXTRACT_SOURCE);
const selectionContext = { $0: null };
const selectionResult = vm.runInNewContext(release.SELECTION_EXTRACT_SOURCE, selectionContext);
assert.deepEqual(JSON.parse(selectionResult), { empty: true });

for (const [key, fixture] of Object.entries(FIXTURES)) {
  const snapshot = snapshotFor(fixture);
  const sourceNormalized = source.normalize(snapshot);
  const releaseNormalized = release.normalize(snapshot);
  assert.deepEqual(plain(releaseNormalized), plain(sourceNormalized), `${key}: normalized output changed after minification.`);

  const sourceFindings = source.validate(snapshot, sourceNormalized.entities);
  const releaseFindings = release.validate(snapshot, releaseNormalized.entities);
  assert.deepEqual(plain(releaseFindings), plain(sourceFindings), `${key}: findings changed after minification.`);

  const sourceScore = source.score(sourceFindings, sourceNormalized.entities);
  const releaseScore = release.score(releaseFindings, releaseNormalized.entities);
  assert.deepEqual(plain(releaseScore), plain(sourceScore), `${key}: score changed after minification.`);

  const input = { snapshot, entities: sourceNormalized.entities, findings: sourceFindings, score: sourceScore };
  assert.deepEqual(
    plain(release.buildAgentBundle(input)),
    plain(source.buildAgentBundle(input)),
    `${key}: agent bundle changed after minification.`,
  );
}

const sourceManifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const distManifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
assert.deepEqual(distManifest, sourceManifest, 'Distribution manifest must match source exactly.');
assert.equal(distManifest.manifest_version, 3);
assert(!('permissions' in distManifest) || distManifest.permissions.length === 0);
assert(!('host_permissions' in distManifest) || distManifest.host_permissions.length === 0);
for (const icon of Object.values(distManifest.icons || {})) {
  assert(existsSync(join(dist, icon)), `Distribution icon ${icon} must exist.`);
}

const panelHtml = readFileSync(join(dist, 'devtools/panel.html'), 'utf8');
const sidebarHtml = readFileSync(join(dist, 'devtools/sidebar.html'), 'utf8');
assert.match(panelHtml, /type="module" src="panel\.js"/);
assert.match(sidebarHtml, /type="module" src="sidebar\.js"/);
assert(existsSync(join(dist, 'devtools/chunks')), 'Dynamic view chunks must be emitted.');
const chunks = readdirSync(join(dist, 'devtools/chunks'));
assert(chunks.some((file) => file.startsWith('lazy-') && file.endsWith('.js')), 'Optional views must be emitted as a lazy chunk.');

const forbidden = ['src', 'scripts', 'sandbox', '.agents', 'node_modules'];
for (const path of forbidden) assert(!existsSync(join(dist, path)), `${path} must not ship in the release artifact.`);
assert(!readdirSync(dist, { recursive: true }).some((path) => String(path).endsWith('.map')), 'Source maps must not ship.');

console.log(`Distribution parity passed for ${Object.keys(FIXTURES).length} fixtures.`);
