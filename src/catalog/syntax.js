/**
 * Semantic property, ISO format, and syntax check helpers.
 * @file
 */

/** @typedef {import('../types.js').TypeRule} TypeRule */

/**
 * Find the best matching rule for an entity type list.
 * @param {TypeRule[]} catalog
 * @param {string[]} types
 * @returns {TypeRule|null}
 */
export function matchRuleInCatalog(catalog, types) {
  for (const rule of catalog) {
    if (types.includes(rule.type)) return rule;
  }
  return null;
}

/**
 * Check if a property exists and contains non-empty value.
 * @param {Record<string, unknown>} data
 * @param {string} prop
 * @returns {boolean}
 */
export function hasProperty(data, prop) {
  return hasValue(data[prop]);

  /** @param {unknown} val */
  function hasValue(val) {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    if (Array.isArray(val)) return val.some(hasValue);
    if (typeof val === 'object') {
      return Object.values(/** @type {Record<string, unknown>} */ (val)).some(hasValue);
    }
    return true;
  }
}

/**
 * Check if a URL string is relative.
 * @param {unknown} val
 * @returns {boolean}
 */
export function isRelativeUrl(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (!s) return false;
  if (s.startsWith('//') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
    return false;
  }
  return !s.includes(':') || s.startsWith('/') || s.startsWith('#') || s.startsWith('?');
}

const URL_PROPS = new Set([
  'url', 'image', 'logo', 'contentUrl', 'thumbnailUrl', 'embedUrl',
  'sameAs', 'item', 'target', 'urlTemplate', 'mainEntityOfPage', '@id',
]);

/**
 * Collect URL-like string values from entity data.
 * @param {Record<string, unknown>} data
 * @returns {Array<{path: string, value: string}>}
 */
export function collectUrlFields(data) {
  /** @type {Array<{path: string, value: string}>} */
  const found = [];

  visit(data, '', '');
  return found;

  /**
   * @param {unknown} value
   * @param {string} path
   * @param {string} property
   */
  function visit(value, path, property) {
    if (typeof value === 'string') {
      if (URL_PROPS.has(property)) found.push({ path, value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${path}[${i}]`, property));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
      const childPath = path ? `${path}.${key}` : key;
      visit(child, childPath, key);
    }
  }
}

const DATE_PROPS = new Set([
  'datePublished', 'dateModified', 'dateCreated', 'datePosted', 'uploadDate',
  'startDate', 'endDate', 'validFrom', 'validThrough', 'priceValidUntil',
]);

const CURRENCY_PROPS = new Set(['priceCurrency', 'currency']);

const ISO8601_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO4217_RE = /^[A-Z]{3}$/;

/**
 * Check if a date string satisfies ISO 8601 calendar date bounds.
 * @param {string} value
 * @returns {boolean}
 */
export function isIso8601Date(value) {
  const match = ISO8601_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Check if a currency code satisfies ISO 4217 (3 uppercase ASCII letters).
 * @param {string} value
 * @returns {boolean}
 */
export function isIso4217Currency(value) {
  return ISO4217_RE.test(value.trim());
}

/**
 * Walk entity data and emit date / currency / rating field checks.
 * @param {Record<string, unknown>} data
 * @returns {Array<{kind: 'date'|'currency'|'rating', path: string, value: unknown}>}
 */
export function collectValueChecks(data) {
  /** @type {Array<{kind: 'date'|'currency'|'rating', path: string, value: unknown}>} */
  const found = [];
  visit(data, '');
  return found;

  /**
   * @param {unknown} value
   * @param {string} path
   */
  function visit(value, path) {
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const obj = /** @type {Record<string, unknown>} */ (value);
    for (const [key, child] of Object.entries(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      if (DATE_PROPS.has(key) && (typeof child === 'string' || typeof child === 'number')) {
        found.push({ kind: 'date', path: childPath, value: child });
      } else if (CURRENCY_PROPS.has(key) && typeof child === 'string') {
        found.push({ kind: 'currency', path: childPath, value: child });
      } else if (
        (key === 'reviewRating' || key === 'aggregateRating') &&
        child &&
        typeof child === 'object' &&
        !Array.isArray(child)
      ) {
        found.push({ kind: 'rating', path: childPath, value: child });
      }
      visit(child, childPath);
    }
  }
}
