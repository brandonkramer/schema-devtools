/**
 * Page-context extraction. Self-contained — no imports, no extension APIs.
 * @file
 */

/**
 * Extract schema markup and page metadata from the current document.
 * Must run inside the inspected page via chrome.devtools.inspectedWindow.eval.
 * @returns {import('./types.js').PageSnapshot}
 */
export function extractPageSchema() {
  const MAX_JSONLD_BLOCKS = 100;
  const MAX_JSONLD_CHARS = 500_000;
  const MAX_MARKUP_NODES = 500;
  const MAX_MARKUP_PROPERTIES = 10_000;
  const MAX_NESTING = 50;
  const MAX_TEXT_CHARS = 100_000;
  const MAX_MARKUP_TEXT_CHARS = 1_000_000;
  let markupPropertyCount = 0;
  let markupTextChars = 0;

  /** @param {Element} el */
  function buildSelector(el) {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement && depth++ < MAX_NESTING) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let part = node.tagName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        const cls = node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) part += '.' + cls.map((c) => CSS.escape(c)).join('.');
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(node) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  /** @param {Element} el */
  function isJsonLdScript(el) {
    if (el.tagName !== 'SCRIPT') return false;
    const type = (el.getAttribute('type') ?? '').split(';', 1)[0].trim().toLowerCase();
    return type === 'application/ld+json';
  }

  /**
   * @param {Record<string, unknown>} props
   * @param {string} names
   * @param {unknown} value
   */
  function addProperties(props, names, value) {
    for (const name of names.split(/\s+/).filter(Boolean)) {
      if (markupPropertyCount >= MAX_MARKUP_PROPERTIES) return;
      if (name.length > 500) continue;
      let boundedValue = value;
      if (typeof boundedValue === 'string') {
        const remaining = MAX_MARKUP_TEXT_CHARS - markupTextChars;
        if (remaining <= 0) return;
        boundedValue = boundedValue.slice(0, Math.min(MAX_TEXT_CHARS, remaining));
        markupTextChars += boundedValue.length;
      }
      markupPropertyCount++;
      if (props[name] === undefined) {
        props[name] = boundedValue;
      } else if (Array.isArray(props[name])) {
        /** @type {unknown[]} */ (props[name]).push(boundedValue);
      } else {
        props[name] = [props[name], boundedValue];
      }
    }
  }

  /**
   * @param {string} raw
   * @returns {{parsed: unknown|null, parseError: {message: string, line?: number, column?: number}|null}}
   */
  function parseJsonLd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { parsed: null, parseError: { message: 'Empty JSON-LD block' } };
    }
    try {
      return { parsed: JSON.parse(trimmed), parseError: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const posMatch = message.match(/position\s+(\d+)/i);
      let line;
      let column;
      if (posMatch) {
        const pos = Number(posMatch[1]);
        let col = 1;
        let ln = 1;
        for (let i = 0; i < pos && i < trimmed.length; i++) {
          if (trimmed[i] === '\n') {
            ln++;
            col = 1;
          } else {
            col++;
          }
        }
        line = ln;
        column = col;
      }
      return { parsed: null, parseError: { message, line, column } };
    }
  }

  /**
   * @param {Element} scope
   * @returns {Record<string, unknown>}
   */
  function extractMicrodataProps(scope, depth = 0) {
    const props = /** @type {Record<string, unknown>} */ ({});
    /** @type {Array<{el: Element; root: Element}>} */
    const propEls = [];
    const seen = new Set();

    addPropertyRoot(scope, false);
    for (const id of (scope.getAttribute('itemref') ?? '').split(/\s+/).filter(Boolean)) {
      const ref = document.getElementById(id);
      if (ref) addPropertyRoot(ref, true);
    }

    for (const { el, root } of propEls) {
      if (markupPropertyCount >= MAX_MARKUP_PROPERTIES || markupTextChars >= MAX_MARKUP_TEXT_CHARS) break;
      let between = el.parentElement;
      const stop = root.parentElement;
      while (between && between !== stop) {
        if (between !== scope && between.hasAttribute('itemscope')) break;
        between = between.parentElement;
      }
      if (between && between !== stop) continue;

      const names = el.getAttribute('itemprop');
      if (!names) continue;

      let value;
      if (el.hasAttribute('itemscope')) {
        value = buildMicrodataItem(el, depth + 1);
      } else {
        value = readMicrodataValue(el);
      }
      addProperties(props, names, value);
    }
    return props;

    /**
     * @param {Element} root
     * @param {boolean} includeRoot
     */
    function addPropertyRoot(root, includeRoot) {
      const candidates = [
        ...(includeRoot && root.hasAttribute('itemprop') ? [root] : []),
        ...root.querySelectorAll('[itemprop]'),
      ];
      for (const el of candidates) {
        if (seen.has(el)) continue;
        seen.add(el);
        propEls.push({ el, root });
      }
    }
  }

  /**
   * @param {Element} el
   * @returns {unknown}
   */
  function readMicrodataValue(el) {
    const tag = el.tagName;
    if (tag === 'META') {
      return el.getAttribute('content') ?? el.getAttribute('value') ?? '';
    }
    if (tag === 'LINK' || tag === 'A') {
      return el.getAttribute('href') ?? el.textContent?.trim() ?? '';
    }
    if (tag === 'IMG' || tag === 'AUDIO' || tag === 'EMBED' || tag === 'IFRAME' || tag === 'SOURCE') {
      return el.getAttribute('src') ?? el.getAttribute('data') ?? '';
    }
    if (tag === 'TIME') {
      return el.getAttribute('datetime') ?? el.textContent?.trim() ?? '';
    }
    if (tag === 'OBJECT') {
      return el.getAttribute('data') ?? '';
    }
    return el.textContent?.trim().slice(0, MAX_TEXT_CHARS) ?? '';
  }

  /**
   * @param {Element} el
   * @returns {import('./types.js').MarkupNode}
   */
  function buildMicrodataItem(el, depth = 0) {
    const itemtype = el.getAttribute('itemtype') ?? '';
    const types = itemtype.split(/\s+/).filter(Boolean);
    const type = types.length === 1 ? types[0] : types;
    const properties = depth >= MAX_NESTING ? {} : extractMicrodataProps(el, depth);
    const itemid = el.getAttribute('itemid');
    if (itemid) properties['@id'] = itemid;
    return {
      format: 'microdata',
      type,
      properties,
      selector: buildSelector(el),
    };
  }

  /** @returns {import('./types.js').MarkupNode[]} */
  function extractMicrodata() {
    const items = [];
    const scopes = document.querySelectorAll('[itemscope]');
    for (const el of scopes) {
      // An item is top-level when it is not itself a property of another item.
      if (!el.hasAttribute('itemprop')) {
        items.push(buildMicrodataItem(el));
        if (items.length >= MAX_MARKUP_NODES) break;
      }
    }
    return items;
  }

  /**
   * @param {Element} el
   * @returns {Record<string, unknown>}
   */
  function extractRdfaProps(el, depth = 0) {
    const props = /** @type {Record<string, unknown>} */ ({});
    const propEls = el.querySelectorAll('[property], [rel]');
    for (const propEl of propEls) {
      if (markupPropertyCount >= MAX_MARKUP_PROPERTIES || markupTextChars >= MAX_MARKUP_TEXT_CHARS) break;
      if (!el.contains(propEl) || propEl === el) continue;
      let between = propEl.parentElement;
      while (between && between !== el) {
        if (between.hasAttribute('typeof')) break;
        between = between.parentElement;
      }
      if (between && between !== el) continue;

      const names = propEl.getAttribute('property') ?? propEl.getAttribute('rel');
      if (!names) continue;
      const expandedNames = names.split(/\s+/).filter(Boolean).map((name) => expandRdfaTerm(name, propEl)).join(' ');
      const nestedTypes = propEl.hasAttribute('typeof')
        ? [propEl]
        : Array.from(propEl.querySelectorAll('[typeof]')).filter((node) => {
            return node.parentElement?.closest('[typeof]') === el;
          });
      if (nestedTypes.length) {
        for (const node of nestedTypes) {
          addProperties(props, expandedNames, buildRdfaNode(node, depth + 1));
        }
        continue;
      }

      let value;
      if (propEl.hasAttribute('content')) {
        value = propEl.getAttribute('content');
      } else if (propEl.tagName === 'A' || propEl.tagName === 'LINK') {
        value = propEl.getAttribute('resource') ?? propEl.getAttribute('href') ?? propEl.textContent?.trim() ?? '';
      } else if (propEl.tagName === 'IMG') {
        value = propEl.getAttribute('src') ?? '';
      } else {
        value = propEl.getAttribute('resource') ?? propEl.getAttribute('href') ?? propEl.textContent?.trim().slice(0, MAX_TEXT_CHARS) ?? '';
      }
      addProperties(props, expandedNames, value);
    }
    return props;
  }

  /**
   * @param {Element} el
   * @returns {import('./types.js').MarkupNode}
   */
  function buildRdfaNode(el, depth = 0) {
    const typeofAttr = el.getAttribute('typeof') ?? '';
    const types = typeofAttr.split(/\s+/).filter(Boolean).map((type) => expandRdfaTerm(type, el));
    const resource = el.getAttribute('resource') ?? el.getAttribute('about') ?? el.getAttribute('href') ?? '';
    const properties = depth >= MAX_NESTING ? {} : extractRdfaProps(el, depth);
    if (resource) properties['@id'] = resource;
    const type = types.length === 1 ? types[0] : types.length ? types : 'Thing';
    return {
      format: 'rdfa',
      type,
      properties,
      selector: buildSelector(el),
    };
  }

  /**
   * Resolve schema.org RDFa terms while leaving unrelated vocabularies intact.
   * @param {string} term
   * @param {Element} el
   */
  function expandRdfaTerm(term, el) {
    const absolute = term.match(/^https?:\/\/schema\.org\/(.+)$/i);
    if (absolute) return absolute[1];
    const compact = term.match(/^([^:]+):(.+)$/);
    if (!compact) return term;
    if (compact[1].toLowerCase() === 'schema') return compact[2];

    const prefixAttr = el.closest('[prefix]')?.getAttribute('prefix') ?? '';
    const declarations = prefixAttr.matchAll(/(?:^|\s)([A-Za-z][\w.-]*):\s+(\S+)/g);
    for (const declaration of declarations) {
      if (declaration[1] === compact[1] && /^https?:\/\/schema\.org\/?$/i.test(declaration[2])) {
        return compact[2];
      }
    }
    return term;
  }

  /** @returns {import('./types.js').MarkupNode[]} */
  function extractRdfa() {
    const items = [];
    const typeEls = document.querySelectorAll('[typeof]');
    for (const el of typeEls) {
      const parentType = el.parentElement?.closest('[typeof]');
      let relation = false;
      let node = el;
      while (node && node !== parentType) {
        if (node.hasAttribute('property') || node.hasAttribute('rel')) {
          relation = true;
          break;
        }
        node = node.parentElement;
      }
      if (!parentType || !relation) {
        items.push(buildRdfaNode(el));
        if (items.length >= MAX_MARKUP_NODES) break;
      }
    }
    return items;
  }

  /** @returns {import('./types.js').JsonLdBlock[]} */
  function extractJsonLd() {
    const scripts = Array.from(document.querySelectorAll('script[type]')).filter(isJsonLdScript);
    const blocks = [];
    let domIndex = 0;
    for (const script of scripts.slice(0, MAX_JSONLD_BLOCKS)) {
      const fullRaw = script.textContent ?? '';
      const raw = fullRaw.slice(0, MAX_JSONLD_CHARS);
      const result = fullRaw.length > MAX_JSONLD_CHARS
        ? { parsed: null, parseError: { message: `JSON-LD block exceeds ${MAX_JSONLD_CHARS} characters and was skipped.` } }
        : parseJsonLd(raw);
      blocks.push({
        index: blocks.length,
        raw,
        parsed: result.parsed,
        parseError: result.parseError,
        selector: buildSelector(script),
        domIndex,
      });
      domIndex++;
    }
    if (scripts.length > MAX_JSONLD_BLOCKS) {
      blocks.push({
        index: blocks.length,
        raw: '',
        parsed: null,
        parseError: { message: `JSON-LD extraction stopped after ${MAX_JSONLD_BLOCKS} blocks.` },
        selector: 'jsonld:truncated',
      });
    }
    return blocks;
  }

  /** @returns {import('./types.js').AgentSurface} */
  function extractAgentSurface() {
    let hasModelContext = false;
    /** @type {object|null} */
    let modelContext = null;

    let ctx;
    try {
      ctx = document.modelContext;
    } catch {
      ctx = undefined;
    }
    if (ctx && typeof ctx === 'object') {
      hasModelContext = true;
      try {
        const serialized = /** @type {Record<string, unknown>} */ ({});
        const ctxObj = /** @type {Record<string, unknown>} */ (ctx);
        const tools = ctxObj.tools;
        if (Array.isArray(tools)) {
          serialized.tools = tools.slice(0, 50).map((tool) => {
            if (typeof tool !== 'object' || tool === null) return tool;
            const t = /** @type {Record<string, unknown>} */ (tool);
            const out = {};
            for (const key of ['name', 'description', 'inputSchema', 'parameters', 'type']) {
              if (key in t && typeof t[key] !== 'function') out[key] = t[key];
            }
            return out;
          });
        }
        const encoded = JSON.stringify(serialized);
        modelContext = encoded.length <= MAX_JSONLD_CHARS
          ? JSON.parse(encoded)
          : { truncated: true, message: 'Model context metadata exceeds the export limit.' };
      } catch {
        modelContext = null;
      }
    }

    let hasLlmsTxtLink = false;
    const links = document.querySelectorAll('link[rel]');
    for (const link of links) {
      const rel = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
      const href = link.getAttribute('href') ?? '';
      if (rel.includes('describedby') && /(?:^|\/)llms\.txt(?:[?#]|$)/i.test(href)) {
        hasLlmsTxtLink = true;
        break;
      }
    }
    if (!hasLlmsTxtLink) {
      const anchors = document.querySelectorAll('a[href]');
      for (const a of anchors) {
        if (/(?:^|\/)llms\.txt(?:[?#]|$)/i.test(a.getAttribute('href') ?? '')) {
          hasLlmsTxtLink = true;
          break;
        }
      }
    }

    return { hasModelContext, modelContext, hasLlmsTxtLink };
  }

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const robotsMeta = Array.from(document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]'))
    .map((el) => el.getAttribute('content') || '')
    .filter(Boolean)
    .join(', ');

  return {
    url: location.href,
    title: document.title ?? '',
    canonical: canonicalEl?.getAttribute('href') ?? null,
    robots: robotsMeta || null,
    inspectedAt: new Date().toISOString(),
    jsonld: extractJsonLd(),
    microdata: extractMicrodata(),
    rdfa: extractRdfa(),
    agent: extractAgentSurface(),
  };
}

/** Eval source for chrome.devtools.inspectedWindow.eval — returns a JSON string. */
export const EXTRACT_SOURCE = `(() => {
  try {
    const data = (${extractPageSchema.toString()})();
    return JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({
      __extractError: err && err.message ? err.message : String(err)
    });
  }
})()`;
