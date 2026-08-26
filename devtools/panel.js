/** @typedef {import('../src/types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('../src/types.js').Finding} Finding */

const engine = globalThis.SchemaDT || {};
const EXTRACT_SOURCE = engine.EXTRACT_SOURCE;
const normalize = engine.normalize;
const validate = engine.validate;
const score = engine.score;
const buildAgentBundle = engine.buildAgentBundle;
const toAgentMarkdown = engine.toAgentMarkdown;

/** @type {PageSnapshot | null} */
let snapshot = null;
/** @type {ReturnType<typeof normalize> | null} */
let report = null;
/** @type {Finding[]} */
let findings = [];
/** @type {ReturnType<typeof score> | null} */
let scoreResult = null;
/** @type {ReturnType<typeof buildAgentBundle> | null} */
let agentBundle = null;
/** @type {string | null} */
let selectedEntityId = null;
/** @type {'tree' | 'raw' | 'findings' | 'serp'} */
let activeView = 'tree';
let analysisRun = 0;
let lastWatchGeneration = 0;
let watchTimer = 0;
let analyzing = false;
let panelVisible = true;

const PAGE_WATCH_INSTALL = `(() => {
  const KEY = '__SCHEMA_DEVTOOLS_WATCH__';
  if (window[KEY] && window[KEY].installed) return window[KEY].generation;
  const state = { installed: true, generation: 1, timer: 0 };
  window[KEY] = state;
  const bump = () => {
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = 0;
      if (window[KEY] !== state) return;
      state.generation += 1;
    }, 250);
  };
  const isOverlay = (node) => {
    if (!node || node.nodeType !== 1) return false;
    return node.id === '__schema-dt-hl' || node.getAttribute('data-schema-devtools') === 'overlay';
  };
  const interesting = (node) => {
    if (!node || node.nodeType !== 1) return false;
    if (isOverlay(node)) return false;
    const el = node;
    if (el.tagName === 'SCRIPT') {
      const type = (el.getAttribute('type') || '').split(';', 1)[0].trim().toLowerCase();
      return type === 'application/ld+json';
    }
    return el.hasAttribute('itemscope') || el.hasAttribute('itemtype') || el.hasAttribute('itemprop')
      || el.hasAttribute('typeof') || el.hasAttribute('property') || el.hasAttribute('vocab');
  };
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (isOverlay(m.target)) continue;
      if (m.type === 'characterData') {
        const host = m.target.parentElement;
        if (host && host.tagName === 'SCRIPT') { bump(); return; }
        continue;
      }
      if (interesting(m.target)) { bump(); return; }
      for (const n of m.addedNodes) { if (interesting(n)) { bump(); return; } }
      for (const n of m.removedNodes) { if (interesting(n)) { bump(); return; } }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['type', 'itemscope', 'itemtype', 'itemprop', 'typeof', 'property', 'vocab', 'itemref'],
  });
  state.observer = observer;
  const wrap = (fn) => function wrapped() {
    const result = fn.apply(this, arguments);
    bump();
    return result;
  };
  try {
    state.originalPushState = history.pushState;
    state.originalReplaceState = history.replaceState;
    state.wrappedPushState = wrap(history.pushState);
    state.wrappedReplaceState = wrap(history.replaceState);
    history.pushState = state.wrappedPushState;
    history.replaceState = state.wrappedReplaceState;
  } catch (e) {}
  window.addEventListener('popstate', bump);
  window.addEventListener('hashchange', bump);
  state.bump = bump;
  return state.generation;
})()`;

const PAGE_WATCH_POLL = `(() => (window.__SCHEMA_DEVTOOLS_WATCH__ && window.__SCHEMA_DEVTOOLS_WATCH__.generation) || 0)()`;
const PAGE_WATCH_REMOVE = `(() => {
  const KEY = '__SCHEMA_DEVTOOLS_WATCH__';
  const state = window[KEY];
  if (!state) return false;
  try { state.observer && state.observer.disconnect(); } catch (e) {}
  if (state.timer) clearTimeout(state.timer);
  if (state.bump) {
    window.removeEventListener('popstate', state.bump);
    window.removeEventListener('hashchange', state.bump);
  }
  try {
    if (history.pushState === state.wrappedPushState) history.pushState = state.originalPushState;
    if (history.replaceState === state.wrappedReplaceState) history.replaceState = state.originalReplaceState;
  } catch (e) {}
  delete window[KEY];
  return true;
})()`;

const $ = (id) => document.getElementById(id);

function applyTheme(theme = chrome.devtools?.panels?.themeName) {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'default';
}

function setStatus(message, isError = false) {
  const el = $('status');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function showFatal(message) {
  const label = $('score-label');
  if (label) label.textContent = 'Error';
  setStatus(message, true);
}

/**
 * @param {string} source
 * @returns {Promise<unknown>}
 */
function evalInPage(source) {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(source, (result, exceptionInfo) => {
      if (exceptionInfo && Object.keys(exceptionInfo).length > 0) {
        const value = exceptionInfo.value;
        const message =
          (value && typeof value === 'object' && 'message' in value && value.message) ||
          exceptionInfo.description ||
          value ||
          'Evaluation failed';
        reject(new Error(String(message)));
        return;
      }
      resolve(result);
    });
  });
}

/**
 * @param {unknown} raw
 * @returns {PageSnapshot}
 */
function parseSnapshot(raw) {
  if (typeof raw !== 'string') {
    throw new Error(`Unexpected extract result (${typeof raw}). Reload the extension and reopen DevTools.`);
  }
  const parsed = JSON.parse(raw);
  if (parsed && parsed.__extractError) {
    throw new Error(String(parsed.__extractError));
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.jsonld) ||
    !Array.isArray(parsed.microdata) ||
    !Array.isArray(parsed.rdfa)
  ) {
    throw new Error('Extract returned an invalid page snapshot.');
  }
  return /** @type {PageSnapshot} */ (parsed);
}

/**
 * @param {PageSnapshot} snap
 * @param {{ id: string; format: string; sourceIndex: number }} entity
 * @returns {string | null}
 */
function inspectExprForEntity(snap, entity) {
  if (entity.format === 'jsonld') {
    const block = snap.jsonld[entity.sourceIndex];
    if (!block) return null;
    if (typeof block.domIndex === 'number') {
      return `(function(){var nodes=Array.from(document.querySelectorAll('script[type]')).filter(function(n){return (n.getAttribute('type')||'').split(';',1)[0].trim().toLowerCase()==='application/ld+json';});var n=nodes[${block.domIndex}];if(!n)return false;inspect(n);return true;})()`;
    }
    if (block.selector) {
      return `(function(){var el=document.querySelector(${JSON.stringify(block.selector)});if(!el)return false;inspect(el);return true;})()`;
    }
    return null;
  }
  const node =
    entity.format === 'microdata'
      ? snap.microdata[entity.sourceIndex]
      : entity.format === 'rdfa'
        ? snap.rdfa[entity.sourceIndex]
        : null;
  if (!node?.selector) return null;
  return `(function(){var el=document.querySelector(${JSON.stringify(node.selector)});if(!el)return false;inspect(el);return true;})()`;
}

/**
 * @param {PageSnapshot} snap
 * @param {{ format: string; sourceIndex: number }} entity
 * @returns {string | null}
 */
function selectorForEntity(snap, entity) {
  if (entity.format === 'jsonld') {
    const block = snap.jsonld[entity.sourceIndex];
    return block?.selector ?? null;
  }
  const node =
    entity.format === 'microdata'
      ? snap.microdata[entity.sourceIndex]
      : entity.format === 'rdfa'
        ? snap.rdfa[entity.sourceIndex]
        : null;
  return node?.selector ?? null;
}

function highlightExpr(selector) {
  return `(function(){
    var id='__schema-dt-hl';
    var old=document.getElementById(id);
    if(old) old.remove();
    var el=document.querySelector(${JSON.stringify(selector)});
    if(!el) return false;
    try { el.scrollIntoView({block:'nearest', inline:'nearest'}); } catch (e) {}
    var r=el.getBoundingClientRect();
    var box=document.createElement('div');
    box.id=id;
    box.setAttribute('data-schema-devtools','overlay');
    box.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #1a73e8;background:rgba(26,115,232,.15);box-sizing:border-box;top:'+r.top+'px;left:'+r.left+'px;width:'+Math.max(r.width,2)+'px;height:'+Math.max(r.height,2)+'px;';
    document.documentElement.appendChild(box);
    setTimeout(function(){ var n=document.getElementById(id); if(n) n.remove(); }, 1600);
    return true;
  })()`;
}

async function highlightEntity(entity) {
  if (!snapshot) return;
  const selector = selectorForEntity(snapshot, entity);
  if (!selector) return;
  try {
    await evalInPage(highlightExpr(selector));
  } catch {
    /* overlay is best-effort */
  }
}

/**
 * @returns {Map<string, {id: string, types: string[], format: string, sourceIndex: number, data: Record<string, unknown>}>}
 */
function entityIdIndex() {
  const map = new Map();
  for (const entity of report?.entities ?? []) {
    const ids = [entity.id];
    const atId = entity.data['@id'];
    if (typeof atId === 'string') ids.push(atId);
    for (const id of ids) {
      if (typeof id !== 'string' || !id) continue;
      map.set(id, entity);
      const hash = id.includes('#') ? `#${id.slice(id.indexOf('#') + 1)}` : '';
      if (hash && hash !== '#') map.set(hash, entity);
    }
  }
  return map;
}

/**
 * @param {unknown} value
 * @param {ReturnType<typeof entityIdIndex>} map
 */
function refTarget(value, map) {
  if (typeof value === 'string') return map.get(value) || null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const id = /** @type {Record<string, unknown>} */ (value)['@id'];
    if (typeof id === 'string') return map.get(id) || null;
  }
  return null;
}

function selectEntity(entity, { inspect = true, highlight = true } = {}) {
  selectedEntityId = entity.id;
  renderEntities();
  if (activeView === 'findings') renderAllFindings();
  else if (activeView === 'serp') renderSerp();
  else renderDetail();
  if (inspect) inspectEntity(entity);
  if (highlight) highlightEntity(entity);
}

async function analyze(options = {}) {
  const silent = Boolean(options.silent);
  const keepSelection = options.keepSelection !== false;
  if (
    !EXTRACT_SOURCE ||
    typeof normalize !== 'function' ||
    typeof validate !== 'function' ||
    typeof score !== 'function' ||
    typeof buildAgentBundle !== 'function' ||
    typeof toAgentMarkdown !== 'function'
  ) {
    showFatal('Engine failed to load. Reload the unpacked extension and reopen DevTools.');
    return;
  }
  analyzing = true;
  const run = ++analysisRun;
  const previousId = selectedEntityId;
  if (!silent) setStatus('Analyzing page…');
  try {
    let raw;
    try {
      raw = await evalInPage(EXTRACT_SOURCE);
    } catch (err) {
      if (run !== analysisRun) return;
      throw err;
    }
    if (run !== analysisRun) return;
    const result = parseSnapshot(raw);
    snapshot = result;
    report = normalize(snapshot);
    findings = validate(snapshot, report.entities);
    scoreResult = score(findings, report.entities);
    agentBundle = buildAgentBundle({
      snapshot,
      entities: report.entities,
      findings,
      score: scoreResult,
    });
    if (keepSelection && previousId && report.entities.some((entity) => entity.id === previousId)) {
      selectedEntityId = previousId;
    } else {
      selectedEntityId = report.entities[0]?.id ?? null;
    }
    render();
    setStatus(
      silent
        ? `Live update · ${snapshot.url || 'page'}`
        : `Analyzed ${snapshot.url || 'page'} at ${snapshot.inspectedAt || 'now'}`,
    );
  } finally {
    if (run === analysisRun) analyzing = false;
  }
}

function renderScore() {
  const ring = $('score-ring');
  const valueEl = $('score-value');
  const labelEl = $('score-label');
  const errorEl = $('error-count');
  const warningEl = $('warning-count');

  if (!scoreResult) {
    valueEl.textContent = '—';
    labelEl.textContent = 'No data';
    ring.className = 'score-ring';
    errorEl.textContent = '0 errors';
    warningEl.textContent = '0 warnings';
    return;
  }

  valueEl.textContent = String(scoreResult.total);
  labelEl.textContent = scoreResult.label;
  ring.className = `score-ring label-${scoreResult.label}`;
  errorEl.textContent = `${scoreResult.errorCount} error${scoreResult.errorCount === 1 ? '' : 's'}`;
  warningEl.textContent = `${scoreResult.warningCount} warning${scoreResult.warningCount === 1 ? '' : 's'}`;
}

/**
 * @param {string} query
 */
function matchesSearch(text, query) {
  return text.toLowerCase().includes(query.toLowerCase());
}

function renderEntities() {
  const list = $('entity-list');
  const empty = $('entities-empty');
  const countEl = $('entity-count');
  const query = $('search').value.trim();

  list.replaceChildren();
  const entities = report?.entities ?? [];
  countEl.textContent = String(entities.length);

  if (entities.length === 0) {
    empty.classList.remove('hidden');
    document.querySelector('.detail-section')?.classList.remove('has-selection');
    return;
  }
  empty.classList.add('hidden');

  for (const entity of entities) {
    const types = entity.types.join(', ') || 'Unknown';
    const haystack = `${types} ${entity.format} ${entity.id} ${JSON.stringify(entity.data)}`;
    const filtered = query && !matchesSearch(haystack, query);

    const li = document.createElement('li');
    li.className = 'entity-item';
    if (entity.id === selectedEntityId) li.classList.add('selected');
    if (filtered) li.classList.add('filtered-out');

    const typeSpan = document.createElement('span');
    typeSpan.className = 'entity-type';
    typeSpan.textContent = types;
    typeSpan.title = types;

    const meta = document.createElement('span');
    meta.className = 'entity-meta';
    meta.textContent = `${entity.format} · ${entity.id}`;

    li.append(typeSpan, meta);
    li.addEventListener('click', () => selectEntity(entity));
    li.addEventListener('mouseenter', () => highlightEntity(entity));
    list.append(li);
  }

  document.querySelector('.detail-section')?.classList.toggle('has-selection', Boolean(selectedEntityId));
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @param {ReturnType<typeof entityIdIndex>} [idMap]
 * @returns {HTMLElement}
 */
function renderTreeValue(value, depth = 0, idMap = entityIdIndex()) {
  const wrap = document.createElement('div');
  wrap.className = 'tree-node';
  wrap.style.marginLeft = `${depth * 12}px`;

  if (value === null) {
    const span = document.createElement('span');
    span.className = 'tree-value';
    span.textContent = 'null';
    wrap.append(span);
    return wrap;
  }
  if (typeof value !== 'object') {
    wrap.append(renderScalar(value, idMap));
    return wrap;
  }
  if (Array.isArray(value)) {
    const label = document.createElement('div');
    const type = document.createElement('span');
    type.className = 'tree-type';
    type.textContent = `Array[${value.length}]`;
    label.append(type);
    wrap.append(label);
    value.forEach((item, i) => {
      const row = document.createElement('div');
      row.style.marginLeft = `${(depth + 1) * 12}px`;
      const key = document.createElement('span');
      key.className = 'tree-key';
      key.textContent = `[${i}]`;
      row.append(key, document.createTextNode(' '), renderTreeValue(item, depth + 2, idMap));
      wrap.append(row);
    });
    return wrap;
  }

  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === '@id') {
    wrap.append(renderIdRef(obj['@id'], idMap));
    return wrap;
  }

  for (const key of keys) {
    const row = document.createElement('div');
    row.style.marginLeft = `${depth * 12}px`;
    const keyEl = document.createElement('span');
    keyEl.className = 'tree-key';
    keyEl.textContent = key;
    row.append(keyEl, document.createTextNode(': '));
    const val = obj[key];
    if (key === '@id' || key === '@id'.toLowerCase()) {
      row.append(renderIdRef(val, idMap));
    } else if (val !== null && typeof val === 'object') {
      const target = refTarget(val, idMap);
      if (target && !Array.isArray(val) && Object.keys(/** @type {object} */ (val)).length <= 2) {
        row.append(renderEntityLink(target, String(/** @type {Record<string, unknown>} */ (val)['@id'] || target.id)));
      } else {
        row.append(renderTreeValue(val, depth + 1, idMap));
      }
    } else {
      row.append(renderScalar(val, idMap));
    }
    wrap.append(row);
  }
  return wrap;
}

/**
 * @param {unknown} value
 * @param {ReturnType<typeof entityIdIndex>} idMap
 */
function renderScalar(value, idMap) {
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return renderEntityLink(target, value);
  }
  const span = document.createElement('span');
  span.className = 'tree-value';
  span.textContent = JSON.stringify(value);
  return span;
}

/**
 * @param {unknown} value
 * @param {ReturnType<typeof entityIdIndex>} idMap
 */
function renderIdRef(value, idMap) {
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return renderEntityLink(target, value);
  }
  return renderScalar(value, idMap);
}

/**
 * @param {{ id: string; types: string[] }} entity
 * @param {string} label
 */
function renderEntityLink(entity, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tree-link';
  btn.textContent = label;
  btn.title = `Jump to ${entity.types.join(', ') || entity.id}`;
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    selectEntity(entity);
  });
  return btn;
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDetail() {
  const entity = report?.entities.find((e) => e.id === selectedEntityId);
  const treeEl = $('view-tree');
  const rawEl = $('view-raw');
  const findingsEl = $('view-findings');

  treeEl.replaceChildren();
  rawEl.textContent = '';
  findingsEl.replaceChildren();

  if (!entity) return;

  treeEl.append(renderTreeValue(entity.data));
  rawEl.textContent = JSON.stringify(entity.data, null, 2);

  const query = $('search').value.trim();
  const sourceBlock = report?.blocks.find((block) => {
    return block.format === entity.format && block.sourceIndex === entity.sourceIndex;
  });
  const entityFindings = findings.filter((finding) => {
    if (finding.entityId) return finding.entityId === entity.id;
    return Boolean(sourceBlock && finding.path === sourceBlock.selector);
  });

  for (const finding of entityFindings) {
    const haystack = `${finding.code} ${finding.message} ${finding.severity}`;
    const filtered = query && !matchesSearch(haystack, query);
    const li = document.createElement('li');
    li.className = `finding-item severity-${finding.severity}`;
    if (filtered) li.classList.add('filtered-out');

    const code = document.createElement('span');
    code.className = 'finding-code';
    code.textContent = finding.code;

    const msg = document.createElement('span');
    msg.className = 'finding-message';
    msg.textContent = finding.message;

    li.append(code, msg);
    if (finding.docsUrl) {
      const docs = document.createElement('a');
      docs.className = 'finding-docs';
      docs.href = finding.docsUrl;
      docs.target = '_blank';
      docs.rel = 'noopener';
      docs.textContent = 'Docs';
      li.append(docs);
    }
    findingsEl.append(li);
  }
}

function renderAllFindings() {
  const findingsEl = $('view-findings');
  if (activeView !== 'findings') return;

  findingsEl.replaceChildren();
  const query = $('search').value.trim();

  for (const finding of findings) {
    const haystack = `${finding.code} ${finding.message} ${finding.severity} ${finding.entityId ?? ''}`;
    const filtered = query && !matchesSearch(haystack, query);
    const li = document.createElement('li');
    li.className = `finding-item severity-${finding.severity}`;
    if (filtered) li.classList.add('filtered-out');

    const code = document.createElement('span');
    code.className = 'finding-code';
    code.textContent = finding.code;

    const msg = document.createElement('span');
    msg.className = 'finding-message';
    msg.textContent = finding.message;

    li.append(code, msg);
    findingsEl.append(li);
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function readText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return readText(value[0]);
  if (value && typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.headline === 'string') return obj.headline;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj['@value'] === 'string') return obj['@value'];
  }
  return '';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function readUrl(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return readUrl(value[0]);
  if (value && typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (typeof obj.url === 'string') return obj.url;
    if (typeof obj.contentUrl === 'string') return obj.contentUrl;
    if (typeof obj['@id'] === 'string' && obj['@id'].startsWith('http')) return obj['@id'];
  }
  return '';
}

/**
 * @param {Record<string, unknown>} data
 */
function readRating(data) {
  const rating = data.aggregateRating || data.reviewRating;
  if (!rating || typeof rating !== 'object' || Array.isArray(rating)) return null;
  const obj = /** @type {Record<string, unknown>} */ (rating);
  const value = Number(obj.ratingValue);
  if (Number.isNaN(value)) return null;
  const best = Number(obj.bestRating ?? 5) || 5;
  const count = obj.ratingCount ?? obj.reviewCount;
  return { value, best, count: count == null ? '' : String(count) };
}

function starString(value, best) {
  const filled = Math.round((value / best) * 5);
  return `${'★'.repeat(Math.max(0, Math.min(5, filled)))}${'☆'.repeat(Math.max(0, 5 - filled))}`;
}

/**
 * @param {{ types: string[]; data: Record<string, unknown>; id: string }} entity
 * @returns {HTMLElement | null}
 */
function buildSerpCard(entity) {
  const types = entity.types;
  const data = entity.data;
  const card = document.createElement('article');
  card.className = 'serp-card';

  const kind = document.createElement('div');
  kind.className = 'serp-kind';

  const cite = document.createElement('div');
  cite.className = 'serp-cite';
  cite.textContent = (readUrl(data.url) || snapshot?.canonical || snapshot?.url || '').replace(/^https?:\/\//, '');

  const title = document.createElement('div');
  title.className = 'serp-title';
  title.addEventListener('click', () => selectEntity(entity));

  const snippet = document.createElement('div');
  snippet.className = 'serp-snippet';

  const meta = document.createElement('div');
  meta.className = 'serp-meta';

  const imageUrl = readUrl(data.image || data.thumbnailUrl);
  if (imageUrl && !imageUrl.startsWith('/') && !imageUrl.startsWith('#')) {
    const img = document.createElement('img');
    img.className = 'serp-thumb';
    img.alt = '';
    img.src = imageUrl;
    card.append(img);
  }

  if (types.includes('BreadcrumbList')) {
    kind.textContent = 'Breadcrumb';
    const items = Array.isArray(data.itemListElement) ? data.itemListElement : [];
    const names = items.map((item) => {
      if (!item || typeof item !== 'object') return '';
      const obj = /** @type {Record<string, unknown>} */ (item);
      return readText(obj.name) || readText(obj.item);
    }).filter(Boolean);
    title.textContent = names.join(' › ') || 'BreadcrumbList';
    snippet.textContent = `${names.length} crumb${names.length === 1 ? '' : 's'}`;
  } else if (types.includes('Product')) {
    kind.textContent = 'Product';
    title.textContent = readText(data.name) || 'Product';
    snippet.textContent = (readText(data.description) || '').slice(0, 160);
    const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
    const offerObj = offer && typeof offer === 'object' ? /** @type {Record<string, unknown>} */ (offer) : {};
    const price = readText(offerObj.price);
    const currency = readText(offerObj.priceCurrency);
    const avail = readText(offerObj.availability).replace(/^https?:\/\/schema\.org\//, '');
    const rating = readRating(data);
    const bits = [];
    if (rating) bits.push(`${starString(rating.value, rating.best)} ${rating.value}${rating.count ? ` (${rating.count})` : ''}`);
    if (price) bits.push(currency ? `${currency} ${price}` : price);
    if (avail) bits.push(avail);
    meta.textContent = bits.join(' · ');
  } else if (types.includes('Recipe')) {
    kind.textContent = 'Recipe';
    title.textContent = readText(data.name) || 'Recipe';
    snippet.textContent = (readText(data.description) || '').slice(0, 160);
    const rating = readRating(data);
    const bits = [readText(data.totalTime || data.cookTime), readText(data.recipeYield)];
    if (rating) bits.unshift(`${starString(rating.value, rating.best)} ${rating.value}`);
    meta.textContent = bits.filter(Boolean).join(' · ');
  } else if (types.includes('NewsArticle') || types.includes('Article') || types.includes('BlogPosting')) {
    kind.textContent = types.includes('NewsArticle') ? 'Article' : types[0];
    title.textContent = readText(data.headline || data.name) || 'Article';
    const author = readText(data.author);
    const date = readText(data.datePublished);
    snippet.textContent = [date, author].filter(Boolean).join(' · ');
    meta.textContent = (readText(data.description) || '').slice(0, 140);
  } else if (types.includes('Event')) {
    kind.textContent = 'Event';
    title.textContent = readText(data.name) || 'Event';
    snippet.textContent = [readText(data.startDate), readText(data.location)].filter(Boolean).join(' · ');
  } else if (types.includes('JobPosting')) {
    kind.textContent = 'Job';
    title.textContent = readText(data.title) || 'Job posting';
    snippet.textContent = [readText(data.hiringOrganization), readText(data.jobLocation)].filter(Boolean).join(' · ');
  } else {
    return null;
  }

  card.prepend(kind);
  card.append(cite, title, snippet);
  if (meta.textContent) card.append(meta);
  return card;
}

function renderSerp() {
  const pane = $('view-serp');
  if (!pane) return;
  pane.replaceChildren();
  const entities = report?.entities ?? [];
  const cards = [];
  const seen = new Set();
  for (const entity of entities) {
    const key = entity.types.find((t) =>
      ['Product', 'Recipe', 'NewsArticle', 'Article', 'BlogPosting', 'BreadcrumbList', 'Event', 'JobPosting'].includes(t),
    );
    if (!key || seen.has(`${key}:${entity.id}`)) continue;
    const card = buildSerpCard(entity);
    if (!card) continue;
    seen.add(`${key}:${entity.id}`);
    cards.push(card);
  }
  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'serp-empty';
    empty.textContent = 'No Product, Article, Recipe, Breadcrumb, Event, or Job entities to preview.';
    pane.append(empty);
    return;
  }
  for (const card of cards) pane.append(card);
}

function render() {
  renderScore();
  renderEntities();
  if (activeView === 'findings') renderAllFindings();
  else if (activeView === 'serp') renderSerp();
  else renderDetail();
}

/**
 * @param {{ id: string; format: string; sourceIndex: number }} entity
 */
async function inspectEntity(entity) {
  if (!snapshot) return;
  const expr = inspectExprForEntity(snapshot, entity);
  if (!expr) {
    setStatus('No DOM selector available for this entity', true);
    return;
  }
  try {
    const inspected = await evalInPage(expr);
    if (!inspected) {
      setStatus('The schema source node is no longer in the document', true);
      return;
    }
    setStatus(`Inspecting ${entity.types.join(', ') || entity.id}`);
    highlightEntity(entity);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Inspect failed', true);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard');
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      setStatus(copied ? 'Copied to clipboard' : 'Copy failed', !copied);
    } catch {
      setStatus('Copy failed', true);
    }
  }
}

function getPageUrl() {
  return snapshot?.url || '';
}

function openExternal(url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
  setStatus('Opened external validator');
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = /** @type {'tree' | 'raw' | 'findings' | 'serp'} */ (tab.getAttribute('data-view'));
      activeView = view;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.view-pane').forEach((pane) => {
        pane.classList.toggle('active', pane.id === `view-${view}`);
      });
      if (view === 'findings') renderAllFindings();
      else if (view === 'serp') renderSerp();
      else renderDetail();
    });
  });
}

function setupActions() {
  $('btn-refresh').addEventListener('click', () => {
    analyze().catch((err) => setStatus(err instanceof Error ? err.message : 'Refresh failed', true));
  });

  $('search').addEventListener('input', () => render());

  $('btn-copy-json').addEventListener('click', () => {
    const entity = report?.entities.find((e) => e.id === selectedEntityId);
    if (entity) {
      copyText(JSON.stringify(entity.data, null, 2));
      return;
    }
    if (!snapshot?.jsonld?.length) {
      setStatus('No JSON to copy', true);
      return;
    }
    const parsed = snapshot.jsonld.map((b) => b.parsed).filter((p) => p !== null);
    copyText(JSON.stringify(parsed.length === 1 ? parsed[0] : parsed, null, 2));
  });

  $('btn-copy-script').addEventListener('click', () => {
    if (!snapshot?.jsonld?.length) {
      setStatus('No JSON-LD blocks to copy', true);
      return;
    }
    const tags = snapshot.jsonld
      .map((block) => `<script type="application/ld+json">\n${block.raw}\n</script>`)
      .join('\n\n');
    copyText(tags);
  });

  $('btn-download').addEventListener('click', () => {
    if (!agentBundle) {
      setStatus('No report to download', true);
      return;
    }
    const blob = new Blob([JSON.stringify(agentBundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'schema-report.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    setStatus('Downloaded schema-report.json');
  });

  $('btn-copy-bundle').addEventListener('click', () => {
    if (!agentBundle) {
      setStatus('No agent bundle to copy', true);
      return;
    }
    copyText(JSON.stringify(agentBundle, null, 2));
  });

  $('btn-copy-markdown').addEventListener('click', () => {
    if (!agentBundle) {
      setStatus('No agent markdown to copy', true);
      return;
    }
    copyText(toAgentMarkdown(agentBundle));
  });

  $('btn-rich-results').addEventListener('click', () => {
    const url = getPageUrl();
    if (!url) {
      setStatus('No page URL available', true);
      return;
    }
    openExternal(`https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`);
  });

  $('btn-schema-validator').addEventListener('click', () => {
    const url = getPageUrl();
    if (!url) {
      setStatus('No page URL available', true);
      return;
    }
    openExternal(`https://validator.schema.org/#url=${encodeURIComponent(url)}`);
  });
}

async function startPageWatch() {
  if (watchTimer || !panelVisible) return;
  const generation = await evalInPage(PAGE_WATCH_INSTALL);
  if (typeof generation === 'number') lastWatchGeneration = generation;
  watchTimer = setInterval(() => {
    pollPageWatch().catch(() => {});
  }, 900);
}

function stopPageWatch() {
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = 0;
  lastWatchGeneration = 0;
  evalInPage(PAGE_WATCH_REMOVE).catch(() => {});
}

async function pollPageWatch() {
  if (analyzing) return;
  try {
    const gen = await evalInPage(PAGE_WATCH_POLL);
    if (typeof gen === 'number' && gen > lastWatchGeneration) {
      lastWatchGeneration = gen;
      await analyze({ silent: true, keepSelection: true });
    }
  } catch {
    /* inspected page may be gone */
  }
}

function init() {
  try {
    applyTheme();
    chrome.devtools.panels.setThemeChangeHandler?.(applyTheme);
    chrome.devtools.network.onNavigated.addListener(() => {
      stopPageWatch();
      analyze()
        .then(() => startPageWatch())
        .catch((err) => showFatal(err instanceof Error ? err.message : 'Navigation analysis failed'));
    });
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type !== 'schema-panel-visibility') return;
      panelVisible = Boolean(message.visible);
      if (!panelVisible) {
        stopPageWatch();
      } else {
        analyze({ silent: true, keepSelection: true })
          .then(() => startPageWatch())
          .catch(() => {});
      }
    });
    window.addEventListener('pagehide', stopPageWatch);
    setupTabs();
    setupActions();
    analyze()
      .then(() => startPageWatch())
      .catch((err) => showFatal(err instanceof Error ? err.message : 'Initial analysis failed'));
  } catch (err) {
    showFatal(err instanceof Error ? err.message : 'Panel failed to start');
  }
}

init();
