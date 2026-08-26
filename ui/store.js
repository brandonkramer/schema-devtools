import { reactive } from '../vendor/arrow.js';

/** @typedef {import('../src/types.js').Finding} Finding */

export const store = reactive({
  theme: 'default',
  query: '',
  activeView: /** @type {'tree' | 'raw' | 'findings' | 'serp'} */ ('tree'),
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
  openRichResults: () => {},
  openSchemaValidator: () => {},
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
    const haystack = `${entity.types.join(' ')} ${entity.format} ${entity.id} ${JSON.stringify(entity.data)}`;
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
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj['@value'] === 'string') return obj['@value'];
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
      ['Product', 'Recipe', 'NewsArticle', 'Article', 'BlogPosting', 'BreadcrumbList', 'Event', 'JobPosting'].includes(type),
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
  return null;
}
