import { mountSidebar, store } from '../ui/sidebar-view.js';
import { formatEvalException, listen } from './host.js';

const engine = globalThis.SchemaDT || {};
const EXTRACT_SOURCE = engine.EXTRACT_SOURCE;
const normalize = engine.normalize;
const validate = engine.validate;

/** @typedef {import('../src/types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('../src/types.js').Finding} Finding */

const SIDEBAR_INSPECT_SOURCE = `(() => { try { return JSON.stringify((${function sidebarInspect() {
  const el = typeof $0 !== 'undefined' ? $0 : null;
  if (!el) return { empty: true };

  const isJsonLd = isJsonLdScript(el);

  if (isJsonLd) {
    const raw = el.textContent || '';
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parseError = { message: e instanceof Error ? e.message : String(e) };
    }
    const scripts = Array.from(document.querySelectorAll('script[type]')).filter(isJsonLdScript);
    const domIndex = scripts.indexOf(el);
    return {
      empty: false,
      format: 'jsonld',
      types: extractTypes(parsed),
      properties: extractKeyProperties(parsed),
      selector:
        domIndex >= 0
          ? 'jsonld:' + domIndex
          : buildSelector(el),
      domIndex,
      sourceIndex: domIndex,
      raw,
      parsed,
      parseError,
    };
  }

  const scope = el.hasAttribute('itemscope') ? el : el.closest('[itemscope]');
  if (scope) {
    const type = scope.getAttribute('itemtype') || '';
    const types = type ? [stripSchemaOrg(type, scope)] : ['Thing'];
    const properties = {};
    const propNodes = Array.from(scope.querySelectorAll('[itemprop]'));
    for (const id of (scope.getAttribute('itemref') || '').split(/\s+/).filter(Boolean)) {
      const ref = document.getElementById(id);
      if (!ref) continue;
      if (ref.hasAttribute('itemprop')) propNodes.push(ref);
      propNodes.push(...ref.querySelectorAll('[itemprop]'));
    }
    new Set(propNodes).forEach((node) => {
      const names = (node.getAttribute('itemprop') || '').split(/\s+/).filter(Boolean);
      const value =
        node.getAttribute('content') ||
        node.getAttribute('href') ||
        node.getAttribute('src') ||
        node.getAttribute('datetime') ||
        node.getAttribute('data') ||
        node.textContent?.trim().slice(0, 120) ||
        '';
      for (const name of names) {
        if (!(name in properties)) properties[name] = value;
      }
    });
    let sourceScope = scope;
    while (sourceScope.hasAttribute('itemprop')) {
      const parentScope = sourceScope.parentElement?.closest('[itemscope]');
      if (!parentScope) break;
      sourceScope = parentScope;
    }
    const topScopes = Array.from(document.querySelectorAll('[itemscope]'))
      .filter((node) => !node.hasAttribute('itemprop'));
    return {
      empty: false,
      format: 'microdata',
      types,
      properties,
      selector: buildSelector(scope),
      sourceIndex: topScopes.indexOf(sourceScope),
    };
  }

  const rdfaRoot = el.hasAttribute('typeof')
    ? el
    : el.closest('[typeof]') || (el.hasAttribute('property') ? el : el.closest('[property]'));
  if (rdfaRoot) {
    const typeofAttr = rdfaRoot.getAttribute('typeof') || '';
    const types = typeofAttr
      ? typeofAttr.split(/\s+/).map((type) => stripSchemaOrg(type, rdfaRoot)).filter(Boolean)
      : ['Thing'];
    const properties = {};
    const propNodes = rdfaRoot.querySelectorAll('[property], [rel]');
    propNodes.forEach((node) => {
      const names = (node.getAttribute('property') || node.getAttribute('rel') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((name) => stripSchemaOrg(name, node));
      const value =
        node.getAttribute('content') ||
        node.getAttribute('resource') ||
        node.getAttribute('href') ||
        node.textContent?.trim().slice(0, 120) ||
        '';
      for (const name of names) {
        if (!(name in properties)) properties[name] = value;
      }
    });
    let sourceRoot = rdfaRoot;
    while (sourceRoot.hasAttribute('property')) {
      const parentType = sourceRoot.parentElement?.closest('[typeof]');
      if (!parentType) break;
      sourceRoot = parentType;
    }
    const topTypes = Array.from(document.querySelectorAll('[typeof]')).filter((node) => {
      return (!node.hasAttribute('property') && !node.hasAttribute('rel')) || !node.parentElement?.closest('[typeof]');
    });
    return {
      empty: false,
      format: 'rdfa',
      types,
      properties,
      selector: buildSelector(rdfaRoot),
      sourceIndex: topTypes.indexOf(sourceRoot),
    };
  }

  return { empty: true };

  function stripSchemaOrg(value, node) {
    const direct = value.match(/^(?:https?:\/\/schema\.org\/|schema:)(.+)$/i);
    if (direct) return direct[1];
    const compact = value.match(/^([^:]+):(.+)$/);
    if (!compact || !node) return value;
    const prefixAttr = node.closest('[prefix]')?.getAttribute('prefix') || '';
    for (const declaration of prefixAttr.matchAll(/(?:^|\s)([A-Za-z][\w.-]*):\s+(\S+)/g)) {
      if (declaration[1] === compact[1] && /^https?:\/\/schema\.org\/?$/i.test(declaration[2])) {
        return compact[2];
      }
    }
    return value;
  }

  function isJsonLdScript(node) {
    if (node.tagName !== 'SCRIPT') return false;
    const type = (node.getAttribute('type') || '').split(';', 1)[0].trim().toLowerCase();
    return type === 'application/ld+json';
  }

  function extractTypes(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data)) {
      return data.flatMap(extractTypes);
    }
    const graph = /** @type {Record<string, unknown>} */ (data)['@graph'];
    const t = /** @type {Record<string, unknown>} */ (data)['@type'];
    const own = t
      ? (Array.isArray(t) ? t : [t]).map((x) => stripSchemaOrg(String(x)))
      : [];
    return graph === undefined ? own : own.concat(extractTypes(graph));
  }

  function extractKeyProperties(data) {
    const props = {};
    if (!data || typeof data !== 'object') return props;
    const items = collectObjects(data);
    const priority = [
      'name',
      'headline',
      'description',
      'url',
      'image',
      'datePublished',
      'author',
      'offers',
      'brand',
    ];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      for (const key of priority) {
        if (key in /** @type {Record<string, unknown>} */ (item) && !(key in props)) {
          props[key] = summarize(/** @type {Record<string, unknown>} */ (item)[key]);
        }
      }
    }
    return props;

    function collectObjects(value) {
      if (!value || typeof value !== 'object') return [];
      if (Array.isArray(value)) return value.flatMap(collectObjects);
      const object = /** @type {Record<string, unknown>} */ (value);
      const graphItems = object['@graph'] === undefined ? [] : collectObjects(object['@graph']);
      return [object, ...graphItems];
    }
  }

  function summarize(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).slice(0, 120);
    }
    if (Array.isArray(value)) return summarize(value[0]);
    if (typeof value === 'object') {
      const obj = /** @type {Record<string, unknown>} */ (value);
      if ('name' in obj) return summarize(obj.name);
      if ('@id' in obj) return summarize(obj['@id']);
      return JSON.stringify(value).slice(0, 120);
    }
    return String(value);
  }

  function buildSelector(node) {
    if (node.id) return '#' + CSS.escape(node.id);
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
    const idx = siblings.indexOf(node) + 1;
    return tag + ':nth-of-type(' + idx + ')';
  }
}.toString()})()); } catch (e) { return JSON.stringify({ empty: true, error: String(e && e.message ? e.message : e) }); } })()`;

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
  const properties = /** @type {Record<string, unknown>} */ (nodeInfo.properties || {});
  const keys = Object.keys(properties);
  store.empty = false;
  store.message = '';
  store.format = format;
  store.types = types.join(', ') || 'Unknown';
  store.properties = keys.length === 0
    ? [{ key: '—', value: 'No key properties' }]
    : keys.map((key) => ({ key, value: String(properties[key] ?? '') }));
  store.findings = filterFindingsForNode(nodeInfo);
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

async function ensureFindings() {
  if (lastSnapshot) return;
  if (!EXTRACT_SOURCE || typeof normalize !== 'function' || typeof validate !== 'function') {
    throw new Error('Schema engine failed to load.');
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
    const raw = await evalInPage(SIDEBAR_INSPECT_SOURCE);
    if (run !== selectionRun) return;
    if (typeof raw !== 'string') throw new Error('Selection inspect did not return a JSON string.');
    const nodeInfo = /** @type {Record<string, unknown>} */ (JSON.parse(raw));
    if (!nodeInfo || nodeInfo.empty) {
      showEmpty();
      return;
    }
    await ensureFindings();
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
  if (!EXTRACT_SOURCE || typeof normalize !== 'function' || typeof validate !== 'function') {
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
