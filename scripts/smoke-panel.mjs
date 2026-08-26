import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatEvalException, listen } from '../devtools/host.js';
import { matchesSearch, store, visibleEntities } from '../ui/store.js';

const root = new URL('../', import.meta.url);
const panelJs = readFileSync(new URL('devtools/panel.js', root), 'utf8');
const panelApp = readFileSync(new URL('ui/app.js', root), 'utf8');
const toolbarJs = readFileSync(new URL('ui/components/toolbar.js', root), 'utf8');
const entityListJs = readFileSync(new URL('ui/components/entity-list.js', root), 'utf8');
const panelHtml = readFileSync(new URL('devtools/panel.html', root), 'utf8');
const themeCss = readFileSync(new URL('ui/theme.css', root), 'utf8');
const vanJs = readFileSync(new URL('vendor/van.js', root), 'utf8');
const vanXJs = readFileSync(new URL('vendor/van-x.js', root), 'utf8');

assert.match(panelHtml, /type="module" src="panel.js"/, 'Panel must load as an ES module.');
assert.match(panelApp, /from '\.\.\/vendor\/van\.js'/, 'Panel UI must use the vendored VanJS runtime.');
assert.match(panelApp, /van\.tags/, 'Panel UI must use VanJS tag functions.');
assert.doesNotMatch(panelApp, /\.innerHTML/, 'Panel components must not assign innerHTML.');
assert.match(vanJs, /tags:/, 'Vendored VanJS must be self-contained in the extension.');
assert.match(vanXJs, /reactive/, 'Vendored VanX must be self-contained in the extension.');
assert.match(themeCss, /--sys-color-base/, 'Shared theme tokens must include DevTools system colors.');
assert.match(
  panelJs,
  /function selectEntity\(entity, \{ inspect = false, highlight = true \} = \{\}\)/,
  'Entity selection must stay on the Schema tab; inspect() switches DevTools panels.',
);
assert.match(toolbarJs, /id:\s*['"]btn-inspect['"]/, 'Inspect in Elements must remain an explicit action in toolbar.');
assert.match(toolbarJs, /actions\.inspectSelected\(\)/, 'Inspect in Elements must be wired to the explicit button.');
assert.match(
  entityListJs,
  /actions\.selectEntity\(entity,\s*\{\s*inspect:\s*event\.altKey\s*\}\)/,
  'Ordinary entity clicks may inspect only when Alt is held.',
);
assert.doesNotMatch(panelApp, /\.innerHTML/, 'Panel templates must not assign innerHTML.');
assert.doesNotMatch(toolbarJs, /\.innerHTML/, 'Toolbar must not assign innerHTML.');
assert.doesNotMatch(entityListJs, /\.innerHTML/, 'Entity list must not assign innerHTML.');
assert.doesNotMatch(panelJs, /\.innerHTML/, 'Panel analysis must not assign innerHTML.');
assert.match(panelJs, /listen\(chrome\.devtools\?\.network\?\.onNavigated/, 'Navigation refresh must not assume network.onNavigated exists.');
assert.match(panelJs, /formatEvalException/, 'Eval failures must format Chrome exceptionInfo, not dump Operation failed: %s.');

const hostJs = readFileSync(new URL('devtools/host.js', root), 'utf8');
assert.match(hostJs, /details/, 'Eval errors must substitute exceptionInfo.details into description templates.');
assert.match(hostJs, /function listen/, 'Optional Chrome events must be feature-detected before addListener.');

const inspectCalls = [...panelJs.matchAll(/\binspect\(/g)];
assert.equal(inspectCalls.length, 3, 'inspect() must stay limited to inspectExprForEntity.');
assert.match(
  panelJs,
  /function inspectExprForEntity[\s\S]*inspect\(n\);[\s\S]*inspect\(el\);[\s\S]*inspect\(el\);/,
  'Elements reveal must still use inspect() with a serialized selector or JSON-LD DOM index.',
);

const allUi = `${panelJs}\n${panelApp}\n${toolbarJs}\n${entityListJs}`;
const clickSelects = [...allUi.matchAll(/selectEntity\([^)]*\)/g)].map((match) => match[0]);
assert.ok(
  clickSelects.every((call) => !call.includes('inspect: true')),
  'No in-panel click path may hardcode inspect: true.',
);

store.entities = [
  { id: 'entity:1', types: ['Article'], format: 'jsonld', sourceIndex: 0, data: { headline: 'Hello' } },
  { id: 'entity:2', types: ['ImageObject'], format: 'jsonld', sourceIndex: 0, data: { url: 'https://example.com/a.jpg' } },
];
store.query = 'imageobject';
assert.equal(visibleEntities().map((entity) => entity.id).join(','), 'entity:2');
assert.equal(matchesSearch('Article jsonld', 'article'), true);
assert.equal(matchesSearch('Article jsonld', 'product'), false);
store.query = '';

assert.equal(
  formatEvalException({ description: 'Operation failed: %s', details: ['Inspected tab was closed'] }),
  'Operation failed: Inspected tab was closed',
);
assert.equal(formatEvalException({ description: 'Operation failed: %s' }), 'Evaluation failed');
assert.equal(formatEvalException({ isException: true, value: 'page threw' }), 'page threw');
assert.equal(listen(undefined, () => {}), false);
let listened = 0;
assert.equal(listen({ addListener: (handler) => handler() }, () => { listened += 1; }), true);
assert.equal(listened, 1);

console.log('vanjs modular panel selection vs inspect() smoke ok');
