import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const panelJs = readFileSync(new URL('devtools/panel.js', root), 'utf8');
const panelHtml = readFileSync(new URL('devtools/panel.html', root), 'utf8');

assert.match(
  panelJs,
  /function selectEntity\(entity, \{ inspect = false, highlight = true \} = \{\}\)/,
  'Entity selection must stay on the Schema tab; inspect() switches DevTools panels.',
);
assert.match(
  panelHtml,
  /id="btn-inspect"/,
  'Inspect in Elements must remain an explicit action.',
);
assert.match(
  panelJs,
  /\$\('btn-inspect'\)\.addEventListener\('click'/,
  'Inspect in Elements must be wired to the explicit button.',
);
assert.match(
  panelJs,
  /selectEntity\(entity, \{ inspect: event\.altKey \}\)/,
  'Ordinary entity clicks may inspect only when Alt is held.',
);

const inspectCalls = [...panelJs.matchAll(/\binspect\(/g)];
assert.equal(inspectCalls.length, 3, 'inspect() must stay limited to inspectExprForEntity.');
assert.match(
  panelJs,
  /function inspectExprForEntity[\s\S]*inspect\(n\);[\s\S]*inspect\(el\);[\s\S]*inspect\(el\);/,
  'Elements reveal must still use inspect() with a serialized selector or JSON-LD DOM index.',
);

const clickSelects = [...panelJs.matchAll(/selectEntity\(entity(?:,\s*\{[^}]*\})?\)/g)].map(
  (match) => match[0],
);
assert.ok(
  clickSelects.every((call) => !call.includes('inspect: true')),
  'No in-panel click path may hardcode inspect: true.',
);

console.log('panel selection vs inspect() smoke ok');
