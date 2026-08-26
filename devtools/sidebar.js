import { mountSidebar, store } from '../ui/sidebar-view.js';
import { formatEvalException, listen } from './host.js';

const engine = globalThis.SchemaDT || {};
const EXTRACT_SOURCE = engine.EXTRACT_SOURCE;
const SELECTION_EXTRACT_SOURCE = engine.SELECTION_EXTRACT_SOURCE;
const normalize = engine.normalize;
const validate = engine.validate;

/** @typedef {import('../src/types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('../src/types.js').Finding} Finding */

/** @type {PageSnapshot | null} */
let lastSnapshot = null;
/** @type {Finding[]} */
let lastFindings = [];
/** @type {Array<{id: string; format: string; sourceIndex: number}>} */
let lastEntities = [];
let selectionRun = 0;
let pageRun = 0;

function applyTheme(theme = chrome.devtools?.panels?.themeName) {
  const name = theme === 'dark' ? 'dark' : 'default';
  document.documentElement.dataset.theme = name;
  store.theme = name;
}

/**
 * @param {string} source
 * @returns {Promise<unknown>}
 */
function evalInPage(source) {
  return new Promise((resolve, reject) => {
    if (!chrome.devtools?.inspectedWindow?.eval) {
      reject(new Error('DevTools inspectedWindow is unavailable.'));
      return;
    }
    chrome.devtools.inspectedWindow.eval(source, (result, exceptionInfo) => {
      if (exceptionInfo && Object.keys(exceptionInfo).length > 0) {
        reject(new Error(formatEvalException(exceptionInfo)));
        return;
      }
      resolve(result);
    });
  });
}

function showEmpty(message = 'No schema on this node') {
  store.empty = true;
  store.message = message;
  store.format = '';
  store.types = '';
  store.properties = [];
  store.findings = [];
}

/**
 * @param {Record<string, unknown>} nodeInfo
 */
function showContent(nodeInfo) {
  const format = String(nodeInfo.format || '');
  const types = /** @type {string[]} */ (nodeInfo.types || []);
  const sourceIndex = Number(nodeInfo.sourceIndex);
  const entity = Number.isInteger(sourceIndex) && sourceIndex >= 0
    ? lastEntities.find((candidate) => {
        return candidate.format === format && candidate.sourceIndex === sourceIndex &&
          candidate.types.some((type) => types.includes(type));
      })
    : null;
  const properties = entity?.data || /** @type {Record<string, unknown>} */ (nodeInfo.properties || {});
  const keys = Object.keys(properties).filter((key) => !key.startsWith('@'));
  store.empty = false;
  store.message = '';
  store.format = format;
  store.types = types.join(', ') || 'Unknown';
  store.properties = keys.length === 0
    ? [{ key: '—', value: 'No key properties' }]
    : keys.map((key) => ({ key, value: summarizeValue(properties[key]) }));
  store.findings = filterFindingsForNode(nodeInfo);
}

function summarizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, 120);
  if (Array.isArray(value)) return value.length > 1 ? `${summarizeValue(value[0])} (+${value.length - 1})` : summarizeValue(value[0]);
  if (typeof value === 'object') {
    const object = /** @type {Record<string, unknown>} */ (value);
    if ('name' in object) return summarizeValue(object.name);
    if ('@id' in object) return summarizeValue(object['@id']);
    if ('@type' in object) return summarizeValue(object['@type']);
    try {
      return JSON.stringify(value).slice(0, 120);
    } catch {
      return '[Object]';
    }
  }
  return String(value).slice(0, 120);
}

/**
 * @param {Record<string, unknown>} nodeInfo
 * @returns {Finding[]}
 */
function filterFindingsForNode(nodeInfo) {
  const types = new Set(/** @type {string[]} */ (nodeInfo.types || []).map((type) => type.toLowerCase()));
  const format = String(nodeInfo.format || '');
  const sourceIndex = Number(nodeInfo.sourceIndex);

  if (Number.isInteger(sourceIndex) && sourceIndex >= 0) {
    const entityIds = new Set(
      lastEntities
        .filter((entity) => entity.format === format && entity.sourceIndex === sourceIndex)
        .map((entity) => entity.id),
    );
    const blockPath = format === 'jsonld' ? lastSnapshot?.jsonld[sourceIndex]?.selector : null;
    return lastFindings.filter((finding) => {
      if (finding.entityId) return entityIds.has(finding.entityId);
      return Boolean(blockPath && finding.path === blockPath);
    }).slice(0, 12);
  }

  return lastFindings.filter((finding) => {
    if (nodeInfo.parseError && finding.code === 'JSONLD_PARSE') return true;
    const msg = finding.message.toLowerCase();
    for (const type of types) {
      if (msg.includes(type.toLowerCase())) return true;
    }
    if (format === 'jsonld' && finding.code.startsWith('JSONLD')) return true;
    if (format === 'microdata' && finding.code.includes('MICRODATA')) return true;
    if (format === 'rdfa' && finding.code.includes('RDFA')) return true;
    return false;
  }).slice(0, 12);
}

async function ensureFindings(refresh = false) {
  if (lastSnapshot && !refresh) return;
  if (!EXTRACT_SOURCE || typeof normalize !== 'function' || typeof validate !== 'function') {
    throw new Error('Schema engine failed to load.');
  }
  if (refresh) {
    lastSnapshot = null;
    lastFindings = [];
    lastEntities = [];
  }
  const run = pageRun;
  try {
    const raw = await evalInPage(EXTRACT_SOURCE);
    if (run !== pageRun) return;
    if (typeof raw !== 'string') throw new Error('Extract did not return a JSON string.');
    const snap = JSON.parse(raw);
    if (snap?.__extractError) throw new Error(String(snap.__extractError));
    if (!snap || !Array.isArray(snap.jsonld)) throw new Error('Extract returned an invalid snapshot.');
    lastSnapshot = snap;
    const { entities } = normalize(snap);
    lastEntities = entities;
    lastFindings = validate(snap, entities);
  } catch (err) {
    lastFindings = [];
    lastEntities = [];
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('has no execution context') && !msg.includes('Inspected tab was closed')) {
      console.warn('Schema sidebar analysis note:', msg);
    }
  }
}

async function onSelectionChanged() {
  const run = ++selectionRun;
  try {
    const raw = await evalInPage(SELECTION_EXTRACT_SOURCE);
    if (run !== selectionRun) return;
    if (typeof raw !== 'string') throw new Error('Selection inspect did not return a JSON string.');
    const nodeInfo = /** @type {Record<string, unknown>} */ (JSON.parse(raw));
    if (!nodeInfo || nodeInfo.empty) {
      showEmpty();
      return;
    }
    await ensureFindings(true);
    if (run !== selectionRun) return;
    showContent(nodeInfo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('has no execution context') || msg.includes('Inspected tab was closed') || msg.includes('Cannot access contents of url')) {
      // Expected transient state during page navigation
      showEmpty('Select an element with schema markup');
      return;
    }
    showEmpty(err instanceof Error ? err.message : 'Unable to inspect this node');
  }
}

function init() {
  applyTheme();
  mountSidebar(document.getElementById('app'));
  if (!EXTRACT_SOURCE || !SELECTION_EXTRACT_SOURCE || typeof normalize !== 'function' || typeof validate !== 'function') {
    showEmpty('Schema engine failed to load. Reload the extension and reopen DevTools.');
    return;
  }
  chrome.devtools?.panels?.setThemeChangeHandler?.(applyTheme);
  listen(chrome.devtools?.panels?.elements?.onSelectionChanged, () => {
    onSelectionChanged();
  });
  listen(chrome.devtools.network?.onNavigated, () => {
    pageRun++;
    lastSnapshot = null;
    lastFindings = [];
    lastEntities = [];
    onSelectionChanged();
  });
  onSelectionChanged();
}

init();
