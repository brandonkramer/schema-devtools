import { readText, readUrl, store } from '../store.js';

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

function safeHttpUrl(value) {
  return /^https?:\/\//i.test(value) ? value : '';
}

export function serpCards() {
  const cards = [];
  const seen = new Set();
  for (const entity of store.entities) {
    const key = entity.types.find((type) => [
      'Product', 'Recipe', 'NewsArticle', 'Article', 'BlogPosting', 'BreadcrumbList', 'Event',
      'JobPosting', 'ProfilePage', 'VideoObject', 'MediaObject', 'Review', 'CriticReview',
      'UserReview', 'LocalBusiness', 'Restaurant', 'Store', 'FoodEstablishment',
      'AutomotiveBusiness', 'FinancialService', 'LodgingBusiness',
    ].includes(type));
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
  if (types.some((type) => ['LocalBusiness', 'Restaurant', 'Store', 'FoodEstablishment', 'AutomotiveBusiness', 'FinancialService', 'LodgingBusiness'].includes(type))) {
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
  if (types.includes('Review') || types.includes('CriticReview') || types.includes('UserReview')) {
    const item = data.itemReviewed && typeof data.itemReviewed === 'object' ? /** @type {Record<string, unknown>} */ (data.itemReviewed) : {};
    const itemName = readText(item.name) || readText(data.name) || 'Reviewed Item';
    const author = data.author && typeof data.author === 'object' ? readText(/** @type {Record<string, unknown>} */(data.author).name) : readText(data.author);
    const rating = readRating(data.reviewRating || data);
    const bits = [];
    if (rating) bits.push(`${starString(rating.value, rating.best)} ${rating.value}/${rating.best}`);
    if (author) bits.push(`By ${author}`);
    if (data.datePublished) bits.push(readText(data.datePublished));
    return {
      entity,
      kind: 'Review',
      cite,
      title: `${itemName} — Review`,
      snippet: (readText(data.reviewBody || data.description) || '').slice(0, 160),
      meta: bits.join(' · '),
      image,
    };
  }
  return null;
}
