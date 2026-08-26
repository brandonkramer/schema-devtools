/**
 * Google rich-result and schema.org sanity rule catalog.
 * Based on public Google Search Central documentation.
 * @file
 */

/** @typedef {import('./types.js').TypeRule} TypeRule */

/** @type {TypeRule[]} */
export const RICH_RESULT_RULES = [
  {
    type: 'NewsArticle',
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  },
  {
    type: 'BlogPosting',
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  },
  {
    type: 'Article',
    required: [],
    recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/article',
  },
  {
    type: 'Product',
    required: ['name'],
    recommended: ['image', 'description', 'offers', 'brand', 'sku', 'aggregateRating', 'review'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/product',
  },
  {
    type: 'BreadcrumbList',
    required: ['itemListElement'],
    recommended: [],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb',
  },
  {
    type: 'Event',
    required: ['name', 'startDate', 'location'],
    recommended: ['endDate', 'description', 'image', 'offers', 'performer', 'organizer'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/event',
  },
  {
    type: 'Recipe',
    required: ['name'],
    recommended: ['image', 'author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/recipe',
  },
  {
    type: 'JobPosting',
    required: ['title', 'description', 'datePosted', 'hiringOrganization'],
    recommended: ['jobLocation', 'baseSalary', 'employmentType', 'validThrough'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/job-posting',
  },
  {
    type: 'LocalBusiness',
    required: ['name', 'address'],
    recommended: ['image', 'telephone', 'openingHoursSpecification', 'geo', 'url'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/local-business',
  },
  {
    type: 'Organization',
    required: [],
    recommended: ['name', 'url', 'logo', 'sameAs', 'contactPoint'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/organization',
  },
  {
    type: 'VideoObject',
    required: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    recommended: ['contentUrl', 'duration', 'embedUrl'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/video',
  },
  {
    type: 'SoftwareApplication',
    required: ['name'],
    recommended: ['operatingSystem', 'applicationCategory', 'offers', 'aggregateRating'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/software-app',
  },
  {
    type: 'Course',
    required: ['name', 'provider'],
    recommended: ['description', 'offers'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/course',
  },
  {
    type: 'Review',
    required: ['itemReviewed', 'reviewRating', 'author'],
    recommended: ['datePublished', 'reviewBody'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
  },
  {
    type: 'QAPage',
    required: ['mainEntity'],
    recommended: [],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/qapage',
  },
  {
    type: 'ProfilePage',
    required: ['mainEntity'],
    recommended: ['dateCreated', 'dateModified'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/profile-page',
  },
  {
    type: 'DiscussionForumPosting',
    required: ['author', 'datePublished'],
    recommended: ['url', 'comment'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/discussion-forum',
  },
  {
    type: 'SocialMediaPosting',
    required: ['author', 'datePublished'],
    recommended: ['url', 'comment'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/discussion-forum',
  },
  {
    type: 'ItemList',
    required: ['itemListElement'],
    recommended: ['numberOfItems', 'itemListOrder'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/carousel',
  },
  {
    type: 'Dataset',
    required: ['name'],
    recommended: ['description', 'license', 'creator', 'distribution'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/dataset',
  },
  {
    type: 'ProductGroup',
    required: ['name'],
    recommended: ['hasVariant', 'variesBy', 'productGroupID'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/product-variants',
  },
  {
    type: 'MerchantReturnPolicy',
    required: [],
    recommended: [],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/return-policy',
  },
  {
    type: 'OfferShippingDetails',
    required: [],
    recommended: ['shippingRate', 'deliveryTime', 'shippingDestination'],
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/merchant-listing#shipping',
  },
];

/** Schema types whose Google rich-result feature is no longer supported. */
export const DEPRECATED_TYPES = ['HowTo'];

/** Current Google Search status for FAQPage markup. */
export const FAQ_GOOGLE_STATUS = {
  code: 'FAQ_GOOGLE_UNSUPPORTED',
  message:
    'Google Search no longer shows FAQ rich results. These findings check FAQPage structure only and do not imply Google rich-result eligibility.',
  docsUrl: 'https://developers.google.com/search/updates#faq-deprecation',
};

/**
 * Find the best matching rule for an entity type list.
 * @param {string[]} types
 * @returns {TypeRule|null}
 */
export function matchRule(types) {
  for (const rule of RICH_RESULT_RULES) {
    if (types.includes(rule.type)) return rule;
  }
  return null;
}

/**
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

/**
 * Collect URL-like string values from entity data.
 * @param {Record<string, unknown>} data
 * @returns {Array<{path: string, value: string}>}
 */
export function collectUrlFields(data) {
  const urlProps = new Set([
    'url', 'image', 'logo', 'contentUrl', 'thumbnailUrl', 'embedUrl',
    'sameAs', 'item', 'target', 'urlTemplate', 'mainEntityOfPage', '@id',
  ]);
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
      if (urlProps.has(property)) found.push({ path, value });
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
