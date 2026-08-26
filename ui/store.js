import vanX from '../vendor/van-x.js';

/** @typedef {import('../src/types.js').Finding} Finding */

export const store = vanX.reactive({
  theme: 'default',
  query: '',
  activeView: /** @type {'tree' | 'raw' | 'graph' | 'findings' | 'serp'} */ ('tree'),
  status: '',
  statusError: false,
  fatal: '',
  engineReady: true,
  selectedEntityId: /** @type {string | null} */ (null),
  entities: /** @type {Array<{id: string, types: string[], format: string, sourceIndex: number, data: Record<string, unknown>}>} */ ([]),
  findings: /** @type {Finding[]} */ ([]),
  score: /** @type {{ total: number, label: string, errorCount: number, warningCount: number } | null} */ (null),
  snapshotUrl: '',
  snapshotCanonical: '',
  collapsedPaths: /** @type {Record<string, boolean>} */ ({}),
  exportMenuOpen: false,
  sandboxOpen: false,
  sandboxText: '',
  sandboxEntityId: /** @type {string | null} */ (null),
  sandboxStatus: /** @type {{ valid: boolean, message: string, score: number | null, errorCount: number, warningCount: number }} */ ({
    valid: true,
    message: 'Ready for editing',
    score: null,
    errorCount: 0,
    warningCount: 0,
  }),
});

export const actions = {
  refresh: () => {},
  selectEntity: (_entity, _options) => {},
  inspectSelected: () => {},
  highlightEntity: (_entity) => {},
  copyJson: () => {},
  copyScript: () => {},
  downloadJson: () => {},
  copyBundle: () => {},
  copyMarkdown: () => {},
  copyAiPrompt: () => {},
  openRichResults: () => {},
  openSchemaValidator: () => {},
  toggleCollapse: (path) => {
    store.collapsedPaths[path] = !store.collapsedPaths[path];
  },
  toggleExportMenu: () => {
    store.exportMenuOpen = !store.exportMenuOpen;
  },
  closeExportMenu: () => {
    store.exportMenuOpen = false;
  },
  openSandbox: (entity) => {
    store.sandboxOpen = true;
    store.sandboxEntityId = entity.id;
    store.sandboxText = JSON.stringify(entity.data, null, 2);
    actions.validateSandbox();
  },
  closeSandbox: () => {
    store.sandboxOpen = false;
  },
  resetSandbox: (entity) => {
    store.sandboxText = JSON.stringify(entity.data, null, 2);
    actions.validateSandbox();
  },
  validateSandbox: () => {
    try {
      const parsed = JSON.parse(store.sandboxText);
      const entity = selectedEntity();
      if (!entity) return;
      const engine = globalThis.SchemaDT || {};
      if (typeof engine.validate === 'function' && typeof engine.score === 'function') {
        const dummySnapshot = { url: store.snapshotUrl, canonical: store.snapshotCanonical, jsonld: [], microdata: [], rdfa: [] };
        const testEntity = { ...entity, data: parsed };
        const testFindings = engine.validate(dummySnapshot, [testEntity]);
        const testScore = engine.score(testFindings, [testEntity]);
        store.sandboxStatus = {
          valid: true,
          message: `Valid JSON-LD · Quality Score ${testScore.total}/100`,
          score: testScore.total,
          errorCount: testScore.errorCount,
          warningCount: testScore.warningCount,
        };
      } else {
        store.sandboxStatus = { valid: true, message: 'Valid JSON syntax', score: null, errorCount: 0, warningCount: 0 };
      }
    } catch (e) {
      store.sandboxStatus = {
        valid: false,
        message: e instanceof Error ? e.message : 'Invalid JSON syntax',
        score: null,
        errorCount: 1,
        warningCount: 0,
      };
    }
  },
};

/**
 * @param {string} text
 * @param {string} query
 */
export function matchesSearch(text, query) {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function selectedEntity() {
  return store.entities.find((entity) => entity.id === store.selectedEntityId) || null;
}

export function visibleEntities() {
  const query = store.query.trim();
  if (!query) return store.entities;
  return store.entities.filter((entity) => {
    const haystack = `${entity.types.join(' ')} ${entity.format} ${entity.id} ${entityLabel(entity)} ${JSON.stringify(entity.data)}`;
    return matchesSearch(haystack, query);
  });
}

export function visibleFindings(all = false) {
  const query = store.query.trim();
  const entity = selectedEntity();
  const list = all || store.activeView === 'findings' || !entity
    ? store.findings
    : store.findings.filter((finding) => finding.entityId === entity.id);
  if (!query) return list;
  return list.filter((finding) => {
    const haystack = `${finding.code} ${finding.message} ${finding.severity} ${finding.entityId ?? ''}`;
    return matchesSearch(haystack, query);
  });
}

export function entityIdIndex() {
  const map = new Map();
  for (const entity of store.entities) {
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
export function refTarget(value, map) {
  if (typeof value === 'string') return map.get(value) || null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const id = /** @type {Record<string, unknown>} */ (value)['@id'];
    if (typeof id === 'string') return map.get(id) || null;
  }
  return null;
}

/**
 * @param {unknown} value
 */
export function readText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return readText(value[0]);
  if (value && typeof value === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (value);
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.headline === 'string') return obj.headline;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj['@value'] === 'string') return obj['@value'];
  }
  return '';
}

/**
 * Extract a human-friendly primary label for an entity (headline, name, product title, filename).
 * @param {{ id: string, types: string[], format: string, data: Record<string, unknown> }} entity
 */
export function entityLabel(entity) {
  if (!entity || !entity.data) return '';
  const d = entity.data;
  const directName = readText(d.headline || d.name || d.title);
  if (directName) return directName;

  if (entity.types.includes('ImageObject')) {
    const caption = readText(d.caption);
    if (caption) return caption;
    const url = readUrl(d.contentUrl || d.url);
    if (url) {
      try {
        const path = new URL(url, 'https://example.com').pathname;
        const filename = path.split('/').filter(Boolean).pop();
        if (filename) return decodeURIComponent(filename);
      } catch {}
    }
  }

  if (entity.types.includes('BreadcrumbList')) {
    const list = Array.isArray(d.itemListElement) ? d.itemListElement : [];
    if (list.length) return `${list.length} item${list.length === 1 ? '' : 's'}`;
  }

  const atId = typeof d['@id'] === 'string' ? d['@id'] : '';
  if (atId) {
    if (atId.includes('#')) return `#${atId.split('#').pop()}`;
    try {
      const parsed = new URL(atId, 'https://example.com');
      return parsed.pathname !== '/' ? parsed.pathname : parsed.hostname;
    } catch {
      return atId;
    }
  }
  return '';
}

/**
 * @param {unknown} value
 */
export function readUrl(value) {
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
export function readRating(data) {
  const rating = data.aggregateRating || data.reviewRating;
  if (!rating || typeof rating !== 'object' || Array.isArray(rating)) return null;
  const obj = /** @type {Record<string, unknown>} */ (rating);
  const value = Number(obj.ratingValue);
  if (Number.isNaN(value)) return null;
  const best = Number(obj.bestRating ?? 5) || 5;
  const count = obj.ratingCount ?? obj.reviewCount;
  return { value, best, count: count == null ? '' : String(count) };
}

export function starString(value, best) {
  const filled = Math.round((value / best) * 5);
  return `${'★'.repeat(Math.max(0, Math.min(5, filled)))}${'☆'.repeat(Math.max(0, 5 - filled))}`;
}

export function safeHttpUrl(value) {
  return /^https?:\/\//i.test(value) ? value : '';
}

export function serpCards() {
  const cards = [];
  const seen = new Set();
  for (const entity of store.entities) {
    const key = entity.types.find((type) =>
      ['Product', 'Recipe', 'NewsArticle', 'Article', 'BlogPosting', 'BreadcrumbList', 'Event', 'JobPosting', 'ProfilePage'].includes(type),
    );
    if (!key || seen.has(`${key}:${entity.id}`)) continue;
    const card = serpCardFor(entity);
    if (!card) continue;
    seen.add(`${key}:${entity.id}`);
    cards.push(card);
  }
  return cards;
}

function serpCardFor(entity) {
  const { types, data } = entity;
  const cite = (readUrl(data.url) || store.snapshotCanonical || store.snapshotUrl || '').replace(/^https?:\/\//, '');
  const image = safeHttpUrl(readUrl(data.image || data.thumbnailUrl));
  if (types.includes('BreadcrumbList')) {
    const items = Array.isArray(data.itemListElement) ? data.itemListElement : [];
    const names = items.map((item) => {
      if (!item || typeof item !== 'object') return '';
      const obj = /** @type {Record<string, unknown>} */ (item);
      return readText(obj.name) || readText(obj.item);
    }).filter(Boolean);
    return {
      entity,
      kind: 'Breadcrumb',
      cite,
      title: names.join(' › ') || 'BreadcrumbList',
      snippet: `${names.length} crumb${names.length === 1 ? '' : 's'}`,
      meta: '',
      image,
    };
  }
  if (types.includes('Product')) {
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
    return {
      entity,
      kind: 'Product',
      cite,
      title: readText(data.name) || 'Product',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.join(' · '),
      image,
    };
  }
  if (types.includes('Recipe')) {
    const rating = readRating(data);
    const bits = [readText(data.totalTime || data.cookTime), readText(data.recipeYield)];
    if (rating) bits.unshift(`${starString(rating.value, rating.best)} ${rating.value}`);
    return {
      entity,
      kind: 'Recipe',
      cite,
      title: readText(data.name) || 'Recipe',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.filter(Boolean).join(' · '),
      image,
    };
  }
  if (types.includes('NewsArticle') || types.includes('Article') || types.includes('BlogPosting')) {
    return {
      entity,
      kind: types.includes('NewsArticle') ? 'Article' : types[0],
      cite,
      title: readText(data.headline || data.name) || 'Article',
      snippet: [readText(data.datePublished), readText(data.author)].filter(Boolean).join(' · '),
      meta: (readText(data.description) || '').slice(0, 140),
      image,
    };
  }
  if (types.includes('Event')) {
    return {
      entity,
      kind: 'Event',
      cite,
      title: readText(data.name) || 'Event',
      snippet: [readText(data.startDate), readText(data.location)].filter(Boolean).join(' · '),
      meta: '',
      image,
    };
  }
  if (types.includes('JobPosting')) {
    return {
      entity,
      kind: 'Job',
      cite,
      title: readText(data.title) || 'Job posting',
      snippet: [readText(data.hiringOrganization), readText(data.jobLocation)].filter(Boolean).join(' · '),
      meta: '',
      image,
    };
  }
  if (types.includes('ProfilePage')) {
    const main = data.mainEntity && typeof data.mainEntity === 'object' ? /** @type {Record<string, unknown>} */ (data.mainEntity) : {};
    return {
      entity,
      kind: 'Profile',
      cite,
      title: readText(main.name || data.name) || 'Creator Profile',
      snippet: readText(main.description || data.description).slice(0, 160),
      meta: readText(main.jobTitle || main.alternateName),
      image: safeHttpUrl(readUrl(main.image || data.image)),
    };
  }
  if (types.some((t) => ['LocalBusiness', 'Restaurant', 'Store', 'FoodEstablishment', 'AutomotiveBusiness', 'FinancialService', 'LodgingBusiness'].includes(t))) {
    const rating = readRating(data);
    const bits = [];
    if (rating) bits.push(`${starString(rating.value, rating.best)} ${rating.value}${rating.count ? ` (${rating.count})` : ''}`);
    const price = readText(data.priceRange);
    if (price) bits.push(price);
    const addr = data.address && typeof data.address === 'object'
      ? [readText(/** @type {Record<string, unknown>} */(data.address).streetAddress), readText(/** @type {Record<string, unknown>} */(data.address).addressLocality)].filter(Boolean).join(', ')
      : readText(data.address);
    if (addr) bits.push(addr);
    const tel = readText(data.telephone);
    if (tel) bits.push(tel);
    return {
      entity,
      kind: 'LocalBusiness',
      cite,
      title: readText(data.name) || 'Local Business',
      snippet: (readText(data.description) || addr || '').slice(0, 160),
      meta: bits.join(' · '),
      image,
    };
  }
  return null;
}

/**
 * Build graph edges and relationship links across entities.
 */
export function buildEntityGraph() {
  const idMap = entityIdIndex();
  const edges = [];
  const connectedIds = new Set();

  const REL_PROPS = [
    'author', 'publisher', 'creator', 'brand', 'itemReviewed', 'hasVariant',
    'parentOrganization', 'subOrganization', 'provider', 'isPartOf', 'mainEntity',
    'organizer', 'performer', 'about', 'subjectOf', 'location', 'seller',
    'hiringOrganization', 'alumniOf', 'memberOf', 'worksFor', 'owns', 'knows',
  ];

  for (const source of store.entities) {
    const data = source.data;
    for (const prop of REL_PROPS) {
      const val = data[prop];
      if (!val) continue;
      const targets = Array.isArray(val) ? val : [val];
      for (const t of targets) {
        const matched = refTarget(t, idMap);
        if (matched && matched.id !== source.id) {
          edges.push({
            source,
            target: matched,
            relation: prop,
          });
          connectedIds.add(source.id);
          connectedIds.add(matched.id);
        }
      }
    }
  }

  const orphaned = store.entities.filter((e) => !connectedIds.has(e.id));
  return {
    nodes: store.entities,
    edges,
    orphaned,
    connectedCount: connectedIds.size,
  };
}

/**
 * Evaluate Generative Engine Optimization (GEO) & AI-readiness metrics.
 */
export function geoReadiness() {
  let sameAsCount = 0;
  let explicitIdCount = 0;
  let authorClarityCount = 0;
  let totalArticles = 0;

  for (const entity of store.entities) {
    const data = entity.data;
    if (typeof data['@id'] === 'string' && data['@id'].trim()) {
      explicitIdCount++;
    }
    const sameAs = data.sameAs;
    if (sameAs) {
      const urls = Array.isArray(sameAs) ? sameAs : [sameAs];
      sameAsCount += urls.filter((u) => typeof u === 'string' && u.startsWith('http')).length;
    }
    if (entity.types.some((t) => ['Article', 'NewsArticle', 'BlogPosting'].includes(t))) {
      totalArticles++;
      if (data.author && typeof data.author === 'object') authorClarityCount++;
    }
  }

  const total = store.entities.length;
  const idRatio = total > 0 ? explicitIdCount / total : 0;
  const articleClarityRatio = totalArticles > 0 ? authorClarityCount / totalArticles : 1;

  let geoScore = 50;
  if (sameAsCount > 0) geoScore += Math.min(sameAsCount * 10, 20);
  if (idRatio >= 0.5) geoScore += 15;
  if (articleClarityRatio >= 0.8) geoScore += 15;

  return {
    geoScore: Math.min(geoScore, 100),
    sameAsCount,
    explicitIdCount,
    totalEntities: total,
    hasSameAs: sameAsCount > 0,
    hasGoodIds: idRatio >= 0.5,
    hasAuthorClarity: articleClarityRatio >= 0.8,
  };
}
