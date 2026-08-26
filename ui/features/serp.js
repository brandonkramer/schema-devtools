import { entityIdIndex, readText, readUrl, refTarget, store } from '../store.js';

/**
 * @param {unknown} value
 * @param {ReturnType<typeof entityIdIndex>} idMap
 * @returns {Record<string, unknown>}
 */
function resolveRecord(value, idMap) {
  const target = refTarget(value, idMap);
  const inline = value && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
  return target ? { ...target.data, ...inline } : firstRecord(value);
}

/**
 * @param {Record<string, unknown>} data
 * @param {ReturnType<typeof entityIdIndex>} idMap
 */
function readRating(data, idMap, depth = 0) {
  if (depth > 2) return null;
  const raw = data.aggregateRating || data.reviewRating || (data.ratingValue != null ? data : null);
  const obj = resolveRecord(raw, idMap);
  if (!obj || obj.ratingValue == null) {
    if (depth > 0 || !data.review) return null;
    const nested = resolveRecord(data.review, idMap);
    return Object.keys(nested).length ? readRating(nested, idMap, depth + 1) : null;
  }
  const value = Number(obj.ratingValue);
  if (Number.isNaN(value)) return null;
  const best = Number(obj.bestRating ?? 5) || 5;
  const count = obj.ratingCount ?? obj.reviewCount;
  return { value, best, count: count == null ? '' : String(count) };
}

/**
 * @param {Record<string, unknown>} data
 * @param {ReturnType<typeof entityIdIndex>} idMap
 */
function readAuthorName(data, idMap) {
  const author = resolveRecord(data.author, idMap);
  return readText(author.name) || readText(data.author);
}

function formatScore(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function starString(value, best) {
  const scaled = (value / best) * 5;
  let full = Math.floor(scaled);
  const frac = scaled - full;
  let half = false;
  if (frac >= 0.75) full += 1;
  else if (frac >= 0.25) half = true;
  full = Math.max(0, Math.min(5, full));
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  return `${'★'.repeat(full)}${half ? '½' : ''}${'☆'.repeat(empty)}`;
}

function findPageReview() {
  return store.entities.find((entity) =>
    entity.types.some((type) => ['Review', 'CriticReview', 'UserReview'].includes(type))
  ) || null;
}

function safeHttpUrl(value) {
  return /^https?:\/\//i.test(value) ? value : '';
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function firstRecord(value) {
  if (Array.isArray(value)) return firstRecord(value[0]);
  if (value && typeof value === 'object') return /** @type {Record<string, unknown>} */ (value);
  return {};
}

function shippingChip(offer) {
  const details = firstRecord(offer.shippingDetails);
  const rate = firstRecord(details.shippingRate);
  const amount = readText(rate.value ?? rate.price);
  if (!amount) return '';
  if (amount === '0' || amount === '0.00' || amount === '0.0') return 'Free shipping';
  const currency = readText(rate.currency || rate.priceCurrency);
  return currency ? `${currency} ${amount} shipping` : `${amount} shipping`;
}

function returnsChip(data, offer) {
  const policy = firstRecord(data.hasMerchantReturnPolicy || offer.hasMerchantReturnPolicy);
  const days = readText(policy.merchantReturnDays);
  const fees = readText(policy.returnFees);
  if (fees.includes('FreeReturn')) return days ? `${days}-day free returns` : 'Free returns';
  if (days) return `${days}-day returns`;
  return '';
}

function memberPriceChip(offer) {
  const raw = offer.priceSpecification;
  const specs = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const spec of specs) {
    if (!spec || typeof spec !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (spec);
    if (!row.validForMemberTier) continue;
    const price = readText(row.price);
    const currency = readText(row.priceCurrency);
    if (price) return currency ? `Member ${currency} ${price}` : `Member ${price}`;
    return 'Member price';
  }
  return '';
}

const LOCAL_SERP_TYPES = [
  'LocalBusiness', 'Restaurant', 'Store', 'FoodEstablishment',
  'AutomotiveBusiness', 'FinancialService', 'LodgingBusiness',
];
const ORG_SERP_TYPES = [
  'Organization', 'OnlineStore', 'OnlineBusiness', 'NewsMediaOrganization', 'Corporation',
];

export function serpCards() {
  const cards = [];
  const seen = new Set();
  const idMap = entityIdIndex();
  for (const entity of store.entities) {
    const key = entity.types.find((type) => [
      'Product', 'Recipe', 'NewsArticle', 'Article', 'BlogPosting', 'BreadcrumbList', 'Event',
      'JobPosting', 'ProfilePage', 'VideoObject', 'MediaObject', 'Review', 'CriticReview',
      'UserReview', 'VacationRental', 'Movie', 'SoftwareApplication',
      'LocalBusiness', 'Restaurant', 'Store', 'FoodEstablishment',
      'AutomotiveBusiness', 'FinancialService', 'LodgingBusiness',
      'Organization', 'OnlineStore', 'OnlineBusiness', 'NewsMediaOrganization', 'Corporation',
    ].includes(type));
    if (!key || seen.has(`${key}:${entity.id}`)) continue;
    const card = serpCardFor(entity, idMap);
    if (!card) continue;
    seen.add(`${key}:${entity.id}`);
    cards.push({ stars: '', reviewBy: '', ...card });
  }
  return cards;
}

function serpCardFor(entity, idMap) {
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
    const offerObj = firstRecord(data.offers);
    const price = readText(offerObj.price);
    const currency = readText(offerObj.priceCurrency);
    const avail = readText(offerObj.availability).replace(/^https?:\/\/schema\.org\//, '');
    const rating = readRating(data, idMap);
    const bits = [];
    if (price) bits.push(currency ? `${currency} ${price}` : price);
    if (avail) bits.push(avail);
    const member = memberPriceChip(offerObj);
    if (member) bits.push(member);
    const shipping = shippingChip(offerObj);
    if (shipping) bits.push(shipping);
    const returns = returnsChip(data, offerObj);
    if (returns) bits.push(returns);
    return {
      entity,
      kind: 'Product',
      cite,
      title: readText(data.name) || 'Product',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.join(' · '),
      stars: rating ? `${starString(rating.value, rating.best)} ${formatScore(rating.value)}${rating.count ? ` (${rating.count})` : ''}` : '',
      image,
    };
  }
  if (types.includes('Recipe')) {
    const rating = readRating(data, idMap);
    const bits = [readText(data.totalTime || data.cookTime), readText(data.recipeYield)];
    return {
      entity,
      kind: 'Recipe',
      cite,
      title: readText(data.name) || 'Recipe',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.filter(Boolean).join(' · '),
      stars: rating ? `${starString(rating.value, rating.best)} ${formatScore(rating.value)}` : '',
      image,
    };
  }
  if (types.includes('NewsArticle') || types.includes('Article') || types.includes('BlogPosting')) {
    const pageReview = findPageReview();
    const rating = pageReview ? readRating(pageReview.data, idMap) : null;
    const reviewBy = pageReview ? readAuthorName(pageReview.data, idMap) : '';
    return {
      entity,
      kind: types.includes('NewsArticle') ? 'Article' : types[0],
      cite,
      title: readText(data.headline || data.name) || 'Article',
      snippet: [readText(data.datePublished), readAuthorName(data, idMap) || readText(data.author)].filter(Boolean).join(' · '),
      meta: (readText(data.description) || '').slice(0, 140),
      stars: rating ? `${starString(rating.value, rating.best)} ${formatScore(rating.value)}` : '',
      reviewBy: reviewBy ? `Review by ${reviewBy}` : '',
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
  if (types.includes('VideoObject') || types.includes('MediaObject')) {
    const upload = readText(data.uploadDate);
    const duration = readText(data.duration);
    const bits = [];
    if (duration) bits.push(`▶ ${duration.replace(/^PT/, '')}`);
    if (upload) bits.push(upload);
    return {
      entity,
      kind: 'Video',
      cite,
      title: readText(data.name) || 'Video',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.join(' · '),
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
  if (types.includes('VacationRental')) {
    const rating = readRating(data, idMap);
    const place = firstRecord(data.containsPlace);
    const occupancy = readText(firstRecord(place.occupancy).value);
    const addr = data.address && typeof data.address === 'object'
      ? [readText(/** @type {Record<string, unknown>} */ (data.address).addressLocality), readText(/** @type {Record<string, unknown>} */ (data.address).addressRegion)].filter(Boolean).join(', ')
      : readText(data.address);
    const bits = [];
    if (rating) bits.push(`${starString(rating.value, rating.best)} ${rating.value}${rating.count ? ` (${rating.count})` : ''}`);
    if (occupancy) bits.push(`Sleeps ${occupancy}`);
    if (addr) bits.push(addr);
    return {
      entity,
      kind: 'VacationRental',
      cite,
      title: readText(data.name) || 'Vacation rental',
      snippet: (readText(data.description) || addr || '').slice(0, 160),
      meta: bits.join(' · '),
      image,
    };
  }
  if (types.includes('Movie')) {
    const rating = readRating(data, idMap);
    const bits = [readText(data.director), readText(data.dateCreated)].filter(Boolean);
    if (rating) bits.unshift(`${starString(rating.value, rating.best)} ${rating.value}`);
    return {
      entity,
      kind: 'Movie',
      cite,
      title: readText(data.name) || 'Movie',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.join(' · '),
      image,
    };
  }
  if (types.includes('SoftwareApplication') && !types.includes('Product')) {
    const rating = readRating(data, idMap);
    const offer = firstRecord(data.offers);
    const bits = [readText(data.applicationCategory), readText(data.operatingSystem)].filter(Boolean);
    const price = readText(offer.price);
    if (price) bits.push(readText(offer.priceCurrency) ? `${readText(offer.priceCurrency)} ${price}` : price);
    if (rating) bits.unshift(`${starString(rating.value, rating.best)} ${rating.value}`);
    return {
      entity,
      kind: 'SoftwareApplication',
      cite,
      title: readText(data.name) || 'App',
      snippet: (readText(data.description) || '').slice(0, 160),
      meta: bits.join(' · '),
      image,
    };
  }
  if (types.some((type) => LOCAL_SERP_TYPES.includes(type))) {
    const rating = readRating(data, idMap);
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
  if (types.includes('Review') || types.includes('CriticReview') || types.includes('UserReview')) {
    const item = resolveRecord(data.itemReviewed, idMap);
    const itemName = readText(item.name) || readText(data.name) || 'Reviewed Item';
    const author = readAuthorName(data, idMap);
    const rating = readRating(data, idMap);
    return {
      entity,
      kind: 'Review',
      cite,
      title: `${itemName} — Review`,
      snippet: (readText(data.reviewBody || data.description) || '').slice(0, 160),
      meta: data.datePublished ? readText(data.datePublished) : '',
      stars: rating ? `${starString(rating.value, rating.best)} ${formatScore(rating.value)}${rating.best !== 5 ? `/${rating.best}` : ''}` : '',
      reviewBy: author ? `Review by ${author}` : '',
      image,
    };
  }
  if (types.some((type) => ORG_SERP_TYPES.includes(type)) && !types.includes('Brand')) {
    const bits = [];
    if (readText(data.vatID) || readText(data.iso6523Code)) bits.push('Verified identifiers');
    const sameAs = Array.isArray(data.sameAs) ? data.sameAs : data.sameAs ? [data.sameAs] : [];
    if (sameAs.length) bits.push(`${sameAs.length} profile${sameAs.length === 1 ? '' : 's'}`);
    if (data.hasMerchantReturnPolicy) bits.push('Returns');
    if (data.hasMemberProgram) bits.push('Loyalty');
    return {
      entity,
      kind: 'Organization',
      cite,
      title: readText(data.name) || 'Organization',
      snippet: (readText(data.description) || readText(data.legalName) || '').slice(0, 160),
      meta: bits.join(' · '),
      image: safeHttpUrl(readUrl(data.logo || data.image)),
    };
  }
  return null;
}
