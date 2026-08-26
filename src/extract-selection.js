/** Inspect the selected Elements node. This function is serialized into the inspected page. */
export function inspectSelectedSchemaNode() {
  const el = typeof $0 !== 'undefined' ? $0 : null;
  if (!el) return { empty: true };

  const isJsonLd = isJsonLdScript(el);
  if (isJsonLd) {
    const raw = el.textContent || '';
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parseError = { message: error instanceof Error ? error.message : String(error) };
    }
    const scripts = Array.from(document.querySelectorAll('script[type]')).filter(isJsonLdScript);
    const domIndex = scripts.indexOf(el);
    return {
      empty: false,
      format: 'jsonld',
      types: extractTypes(parsed),
      properties: extractKeyProperties(parsed),
      selector: domIndex >= 0 ? `jsonld:${domIndex}` : buildSelector(el),
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
    while (true) {
      const parentType = sourceRoot.parentElement?.closest('[typeof]');
      if (!parentType || !hasRdfaRelation(sourceRoot, parentType)) break;
      sourceRoot = parentType;
    }
    const topTypes = Array.from(document.querySelectorAll('[typeof]')).filter((node) => {
      const parentType = node.parentElement?.closest('[typeof]');
      return !parentType || !hasRdfaRelation(node, parentType);
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

  function hasRdfaRelation(node, parentType) {
    let current = node;
    while (current && current !== parentType) {
      if (current.hasAttribute('property') || current.hasAttribute('rel')) return true;
      current = current.parentElement;
    }
    return false;
  }

  function isJsonLdScript(node) {
    if (node.tagName !== 'SCRIPT') return false;
    const type = (node.getAttribute('type') || '').split(';', 1)[0].trim().toLowerCase();
    return type === 'application/ld+json';
  }

  function extractTypes(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data)) return data.flatMap(extractTypes);
    const graph = data['@graph'];
    const type = data['@type'];
    const own = type
      ? (Array.isArray(type) ? type : [type]).map((value) => stripSchemaOrg(String(value)))
      : [];
    return graph === undefined ? own : own.concat(extractTypes(graph));
  }

  function extractKeyProperties(data) {
    const properties = {};
    if (!data || typeof data !== 'object') return properties;
    const priority = ['name', 'headline', 'description', 'url', 'image', 'datePublished', 'author', 'offers', 'brand'];
    for (const item of collectObjects(data)) {
      if (!item || typeof item !== 'object') continue;
      for (const key of priority) {
        if (key in item && !(key in properties)) properties[key] = summarize(item[key]);
      }
    }
    return properties;

    function collectObjects(value) {
      if (!value || typeof value !== 'object') return [];
      if (Array.isArray(value)) return value.flatMap(collectObjects);
      const graphItems = value['@graph'] === undefined ? [] : collectObjects(value['@graph']);
      return [value, ...graphItems];
    }
  }

  function summarize(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).slice(0, 120);
    }
    if (Array.isArray(value)) return summarize(value[0]);
    if (typeof value === 'object') {
      if ('name' in value) return summarize(value.name);
      if ('@id' in value) return summarize(value['@id']);
      return JSON.stringify(value).slice(0, 120);
    }
    return String(value);
  }

  function buildSelector(node) {
    if (node.id) return `#${CSS.escape(node.id)}`;
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
    return `${tag}:nth-of-type(${siblings.indexOf(node) + 1})`;
  }
}

/** Eval source for chrome.devtools.inspectedWindow.eval; returns a JSON string. */
export const SELECTION_EXTRACT_SOURCE = `(() => {
  try {
    return JSON.stringify((${inspectSelectedSchemaNode.toString()})());
  } catch (error) {
    return JSON.stringify({ empty: true, error: String(error && error.message ? error.message : error) });
  }
})()`;
