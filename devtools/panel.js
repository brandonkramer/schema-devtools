/** @typedef {import('../src/types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('../src/types.js').Finding} Finding */

import { actions, selectedEntity, store } from '../ui/store.js';
import { mountPanel } from '../ui/app.js';
import { formatEvalException, listen } from './host.js';

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
let analysisRun = 0;
let lastWatchGeneration = 0;
let watchTimer = 0;
let analyzing = false;
let panelVisible = true;
const HIGHLIGHT_TOKEN = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const PAGE_WATCH_INSTALL = `(() => {
  const KEY = Symbol.for('schema-devtools.watch');
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
    return node.getAttribute('data-schema-devtools') === 'overlay';
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
      || el.hasAttribute('itemref') || el.hasAttribute('typeof') || el.hasAttribute('property') || el.hasAttribute('vocab');
  };
  const containsInteresting = (node) => {
    if (interesting(node)) return true;
    return Boolean(node && node.nodeType === 1 && node.querySelector(
      'script[type="application/ld+json"], [itemscope], [itemtype], [itemprop], [typeof], [property], [vocab]'
    ));
  };
  const target = document.documentElement || document;
  if (target) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (isOverlay(m.target)) continue;
        if (m.type === 'characterData') {
          const host = m.target.parentElement;
          if (host && (host.tagName === 'SCRIPT' || interesting(host))) { bump(); return; }
          continue;
        }
        if (interesting(m.target)) { bump(); return; }
        for (const n of m.addedNodes) { if (containsInteresting(n)) { bump(); return; } }
        for (const n of m.removedNodes) { if (containsInteresting(n)) { bump(); return; } }
      }
    });
    observer.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'type', 'itemscope', 'itemtype', 'itemprop', 'itemref', 'typeof', 'property', 'vocab',
        'content', 'href', 'src', 'data', 'datetime', 'itemid', 'resource', 'about', 'prefix', 'rel',
      ],
    });
    state.observer = observer;
  }
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

const PAGE_WATCH_REMOVE = `(() => {
  const KEY = Symbol.for('schema-devtools.watch');
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

function applyTheme(theme = chrome.devtools?.panels?.themeName) {
  const name = theme === 'dark' ? 'dark' : 'default';
  document.documentElement.dataset.theme = name;
  store.theme = name;
}

function setStatus(message, isError = false) {
  store.status = message;
  store.statusError = isError;
}

function showFatal(message) {
  store.fatal = message;
  setStatus(message, true);
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
    var token=${JSON.stringify(HIGHLIGHT_TOKEN)};
    document.querySelectorAll('[data-schema-devtools-highlight]').forEach(function(old){
      if(old.getAttribute('data-schema-devtools-highlight')===token) old.remove();
    });
    var el=document.querySelector(${JSON.stringify(selector)});
    if(!el) return false;
    try { el.scrollIntoView({block:'nearest', inline:'nearest'}); } catch (e) {}
    var r=el.getBoundingClientRect();
    var box=document.createElement('div');
    box.setAttribute('data-schema-devtools','overlay');
    box.setAttribute('data-schema-devtools-highlight',token);
    box.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #1a73e8;background:rgba(26,115,232,.15);box-sizing:border-box;top:'+r.top+'px;left:'+r.left+'px;width:'+Math.max(r.width,2)+'px;height:'+Math.max(r.height,2)+'px;';
    document.documentElement.appendChild(box);
    setTimeout(function(){
      document.querySelectorAll('[data-schema-devtools-highlight]').forEach(function(n){
        if(n.getAttribute('data-schema-devtools-highlight')===token) n.remove();
      });
    }, 1600);
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

function selectEntity(entity, { inspect = false, highlight = true } = {}) {
  store.selectedEntityId = entity.id;
  if (inspect) inspectEntity(entity);
  if (highlight) highlightEntity(entity);
}

function syncStore() {
  store.entities = report?.entities ?? [];
  store.findings = findings;
  store.score = scoreResult
    ? {
        total: scoreResult.total,
        label: scoreResult.label,
        errorCount: scoreResult.errorCount,
        warningCount: scoreResult.warningCount,
      }
    : null;
  store.snapshotUrl = snapshot?.url || '';
  store.snapshotCanonical = snapshot?.canonical || '';
  if (store.selectedEntityId && !store.entities.some((entity) => entity.id === store.selectedEntityId)) {
    store.selectedEntityId = store.entities[0]?.id ?? null;
  }
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
    store.engineReady = false;
    showFatal('Engine failed to load. Reload the unpacked extension and reopen DevTools.');
    return;
  }
  analyzing = true;
  const run = ++analysisRun;
  const previousId = store.selectedEntityId;
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
      store.selectedEntityId = previousId;
    } else {
      store.selectedEntityId = report.entities[0]?.id ?? null;
    }
    store.fatal = '';
    syncStore();
    setStatus(
      silent
        ? `Live update · ${snapshot.url || 'page'}`
        : `Analyzed ${snapshot.url || 'page'} at ${snapshot.inspectedAt || 'now'}`,
    );
  } catch (err) {
    if (run === analysisRun) {
      snapshot = null;
      report = null;
      findings = [];
      scoreResult = null;
      agentBundle = null;
      syncStore();
      setStatus(err instanceof Error ? err.message : 'Analysis failed', true);
    }
    throw err;
  } finally {
    if (run === analysisRun) analyzing = false;
  }
}

/**
 * @param {{ id: string; format: string; sourceIndex: number; types?: string[] }} entity
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
    setStatus(`Opened ${entity.types?.join(', ') || entity.id} in Elements`);
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

function bindActions() {
  actions.refresh = () => {
    analyze().catch((err) => setStatus(err instanceof Error ? err.message : 'Refresh failed', true));
  };
  actions.selectEntity = selectEntity;
  actions.highlightEntity = highlightEntity;
  actions.inspectSelected = () => {
    const entity = selectedEntity();
    if (!entity) {
      setStatus('Select an entity to inspect in Elements', true);
      return;
    }
    inspectEntity(entity);
  };
  actions.copyJson = () => {
    const entity = selectedEntity();
    if (store.sandboxOpen && store.sandboxEntityId === entity?.id) {
      copyText(store.sandboxText);
      return;
    }
    if (entity) {
      copyText(JSON.stringify(entity.data, null, 2));
      return;
    }
    if (!snapshot?.jsonld?.length) {
      setStatus('No JSON to copy', true);
      return;
    }
    const parsed = snapshot.jsonld.map((block) => block.parsed).filter((item) => item !== null);
    copyText(JSON.stringify(parsed.length === 1 ? parsed[0] : parsed, null, 2));
  };
  actions.copyScript = () => {
    if (!snapshot?.jsonld?.length) {
      setStatus('No JSON-LD blocks to copy', true);
      return;
    }
    const tags = snapshot.jsonld
      .map((block) => `<script type="application/ld+json">\n${block.raw}\n</script>`)
      .join('\n\n');
    copyText(tags);
  };
  actions.downloadJson = () => {
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
  };
  actions.copyBundle = () => {
    if (!agentBundle) {
      setStatus('No agent bundle to copy', true);
      return;
    }
    copyText(JSON.stringify(agentBundle, null, 2));
  };
  actions.copyMarkdown = () => {
    if (!agentBundle) {
      setStatus('No agent markdown to copy', true);
      return;
    }
    copyText(toAgentMarkdown(agentBundle));
  };
  actions.copyAiPrompt = () => {
    if (!agentBundle) {
      setStatus('No agent bundle to copy', true);
      return;
    }
    const md = toAgentMarkdown(agentBundle);
    const aiPrompt = `Here is the structured Schema.org / JSON-LD knowledge graph extracted from ${snapshot?.url || 'the page'}:\n\n${md}\n\nAnalyze the above semantic entities, relationships, and completeness for search optimization and LLM grounding.`;
    copyText(aiPrompt);
    setStatus('Copied AI Prompt to clipboard');
  };
  const isLocalUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    try {
      const parsed = new URL(rawUrl);
      return (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1' ||
        parsed.protocol === 'file:' ||
        parsed.hostname.endsWith('.local') ||
        parsed.hostname.endsWith('.internal')
      );
    } catch {
      return false;
    }
  };

  const getFullSchemaSnippet = () => {
    if (snapshot?.jsonld?.length) {
      return snapshot.jsonld.map((b) => b.raw).join('\n\n');
    }
    if (store.entities.length) {
      return JSON.stringify(store.entities.map((e) => e.data), null, 2);
    }
    return '';
  };

  actions.openRichResults = () => {
    const url = getPageUrl();
    if (!url) {
      setStatus('No page URL available', true);
      return;
    }
    if (isLocalUrl(url)) {
      const snippet = getFullSchemaSnippet();
      if (snippet) copyText(snippet);
      openExternal('https://search.google.com/test/rich-results');
      setStatus('Localhost is not crawlable by Googlebot. Copied schema to clipboard for Code Snippet test.');
      return;
    }
    openExternal(`https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`);
  };
  actions.openSchemaValidator = () => {
    const url = getPageUrl();
    if (!url) {
      setStatus('No page URL available', true);
      return;
    }
    if (isLocalUrl(url)) {
      const snippet = getFullSchemaSnippet();
      if (snippet) copyText(snippet);
      openExternal('https://validator.schema.org/#code=');
      setStatus('Localhost is not crawlable by Schema.org. Copied schema to clipboard for Code Snippet test.');
      return;
    }
    openExternal(`https://validator.schema.org/#url=${encodeURIComponent(url)}`);
  };
}

async function startPageWatch() {
  if (!panelVisible || watchTimer) return;
  try {
    const generation = await evalInPage(PAGE_WATCH_INSTALL);
    if (typeof generation === 'number') lastWatchGeneration = generation;
  } catch {}
  watchTimer = setInterval(() => {
    pollPageWatch().catch(() => {});
  }, 400);
}

function stopPageWatch() {
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = 0;
  lastWatchGeneration = 0;
  evalInPage(PAGE_WATCH_REMOVE).catch(() => {});
}

async function pollPageWatch() {
  if (!panelVisible || analyzing) return;
  try {
    const info = /** @type {{ gen: number, url: string, readyState: string } | null} */ (
      await evalInPage(`(() => ({
        gen: (window[Symbol.for('schema-devtools.watch')] && window[Symbol.for('schema-devtools.watch')].generation) || 0,
        url: location.href,
        readyState: document.readyState
      }))()`)
    );
    if (!info || typeof info !== 'object') return;

    const currentUrl = snapshot?.url || '';
    const urlChanged = Boolean(info.url && info.url !== currentUrl);
    const watchNeedsInstall = info.gen === 0;
    const genBumped = typeof info.gen === 'number' && info.gen > lastWatchGeneration;

    if (urlChanged || watchNeedsInstall || genBumped) {
      if (watchNeedsInstall || urlChanged) {
        lastWatchGeneration = 0;
        const newGen = await evalInPage(PAGE_WATCH_INSTALL).catch(() => 0);
        if (typeof newGen === 'number') lastWatchGeneration = newGen;
      } else {
        lastWatchGeneration = info.gen;
      }
      await analyze({ silent: !urlChanged, keepSelection: !urlChanged });
    }
  } catch {
    /* inspected page may be navigating or reloading */
  }
}

function init() {
  try {
    bindActions();
    applyTheme();
    mountPanel(document.getElementById('app'));
    chrome.devtools?.panels?.setThemeChangeHandler?.(applyTheme);
    listen(chrome.devtools?.network?.onNavigated, () => {
      stopPageWatch();
      lastWatchGeneration = 0;
      snapshot = null;
      if (!panelVisible) return;
      analyze({ silent: false, keepSelection: false })
        .then(() => startPageWatch())
        .catch((err) => showFatal(err instanceof Error ? err.message : 'Navigation analysis failed'));
      setTimeout(() => {
        analyze({ silent: true, keepSelection: true }).catch(() => {});
      }, 350);
      setTimeout(() => {
        analyze({ silent: true, keepSelection: true }).catch(() => {});
      }, 900);
    });
    listen(chrome.runtime?.onMessage, (message) => {
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
    analyze()
      .then(() => startPageWatch())
      .catch((err) => showFatal(err instanceof Error ? err.message : 'Initial analysis failed'));
  } catch (err) {
    showFatal(err instanceof Error ? err.message : 'Panel failed to start');
  }
}

init();
