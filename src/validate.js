/**
 * Validate snapshot and entities against rules catalog.
 * @file
 */

import {
  RICH_RESULT_RULES,
  LOCAL_BUSINESS_TYPES,
  DEPRECATED_TYPES,
  FAQ_GOOGLE_STATUS,
  hasProperty,
  hasPropertyPath,
  isRelativeUrl,
  collectUrlFields,
  collectValueChecks,
  isIso8601Date,
  isIso4217Currency,
} from './rules.js';

/** @typedef {import('./types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('./types.js').Entity} Entity */
/** @typedef {import('./types.js').Finding} Finding */

/**
 * @param {Finding[]} findings
 * @param {Finding} finding
 */
function pushFinding(findings, finding) {
  findings.push(finding);
}

/**
 * @param {unknown} val
 * @returns {string|null}
 */
function readName(val) {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) {
    const obj = /** @type {Record<string, unknown>} */ (val);
    if (typeof obj.name === 'string') return obj.name;
  }
  return null;
}

function isLocalBusiness(types) {
  return types.some((type) => LOCAL_BUSINESS_TYPES.has(type));
}

/**
 * Check if author name appears packed with commas (multiple authors in one string).
 * @param {Record<string, unknown>} data
 * @returns {boolean}
 */
function hasPackedAuthorName(data) {
  const author = data.author;
  if (typeof author === 'string') {
    return author.includes(',') && author.split(',').filter((s) => s.trim()).length > 1;
  }
  if (Array.isArray(author)) {
    return author.some((a) => typeof a === 'string' && a.includes(','));
  }
  if (typeof author === 'object' && author !== null) {
    const name = readName(author);
    if (name && name.includes(',') && name.split(',').filter((s) => s.trim()).length > 1) return true;
  }
  return false;
}

/**
 * Validate FAQPage mainEntity structure.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateFaqStructure(data) {
  /** @type {Finding[]} */
  const findings = [];
  const main = data.mainEntity;
  const items = Array.isArray(main) ? main : main ? [main] : [];

  if (items.length === 0) {
    findings.push({
      severity: 'error',
      code: 'FAQ_EMPTY_MAIN_ENTITY',
      message: 'FAQPage mainEntity must contain Question items.',
      path: 'mainEntity',
      docsUrl: FAQ_GOOGLE_STATUS.docsUrl,
    });
    return findings;
  }

  items.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      findings.push({
        severity: 'error',
        code: 'FAQ_INVALID_QUESTION',
        message: `FAQ item ${i + 1} must be a Question object.`,
        path: `mainEntity[${i}]`,
      });
      return;
    }
    const q = /** @type {Record<string, unknown>} */ (item);
    const qTypes = q['@type'];
    const typeList = Array.isArray(qTypes) ? qTypes : qTypes ? [qTypes] : [];
    const isQuestion = typeList.some((t) => String(t).includes('Question'));
    if (!hasProperty(q, 'name')) {
      findings.push({
        severity: 'error',
        code: 'FAQ_MISSING_QUESTION_NAME',
        message: `FAQ Question ${i + 1} is missing name.`,
        path: `mainEntity[${i}].name`,
      });
    }
    if (!isQuestion) {
      findings.push({
        severity: 'warning',
        code: 'FAQ_INVALID_QUESTION_TYPE',
        message: `FAQ item ${i + 1} should have @type Question.`,
        path: `mainEntity[${i}].@type`,
      });
    }
    const answer = q.acceptedAnswer;
    if (!answer) {
      findings.push({
        severity: 'error',
        code: 'FAQ_MISSING_ANSWER',
        message: `FAQ Question ${i + 1} is missing acceptedAnswer.`,
        path: `mainEntity[${i}].acceptedAnswer`,
      });
    } else if (typeof answer === 'object' && answer !== null) {
      const a = /** @type {Record<string, unknown>} */ (answer);
      if (!hasProperty(a, 'text') && !hasProperty(a, 'name')) {
        findings.push({
          severity: 'warning',
          code: 'FAQ_ANSWER_MISSING_TEXT',
          message: `FAQ acceptedAnswer ${i + 1} should include text.`,
          path: `mainEntity[${i}].acceptedAnswer.text`,
        });
      }
    }
  });

  return findings;
}

/**
 * Validate BreadcrumbList itemListElement.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateBreadcrumbStructure(data) {
  /** @type {Finding[]} */
  const findings = [];
  const list = data.itemListElement;
  const items = Array.isArray(list) ? list : list ? [list] : [];

  if (items.length < 2) {
    findings.push({
      severity: 'warning',
      code: 'BREADCRUMB_TOO_SHORT',
      message: 'BreadcrumbList should have at least 2 ListItem elements.',
      path: 'itemListElement',
    });
  }

  items.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) return;
    const li = /** @type {Record<string, unknown>} */ (item);
    if (!hasProperty(li, 'name')) {
      findings.push({
        severity: 'error',
        code: 'BREADCRUMB_MISSING_NAME',
        message: `Breadcrumb ListItem ${i + 1} is missing name.`,
        path: `itemListElement[${i}].name`,
      });
    }
    if (li.position === undefined) {
      findings.push({
        severity: 'warning',
        code: 'BREADCRUMB_MISSING_POSITION',
        message: `Breadcrumb ListItem ${i + 1} is missing position.`,
        path: `itemListElement[${i}].position`,
      });
    }
    if (i < items.length - 1 && !hasProperty(li, 'item')) {
      findings.push({
        severity: 'warning',
        code: 'BREADCRUMB_MISSING_ITEM',
        message: `Breadcrumb ListItem ${i + 1} is missing item URL.`,
        path: `itemListElement[${i}].item`,
      });
    }
  });

  return findings;
}

/**
 * Validate WebSite SearchAction.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateWebSiteSearchAction(data) {
  /** @type {Finding[]} */
  const findings = [];
  const action = data.potentialAction;
  if (!action) return findings;

  const actions = Array.isArray(action) ? action : [action];
  for (const a of actions) {
    if (typeof a !== 'object' || a === null) continue;
    const act = /** @type {Record<string, unknown>} */ (a);
    const types = act['@type'];
    const typeList = Array.isArray(types) ? types : types ? [types] : [];
    if (typeList.some((t) => String(t).includes('SearchAction'))) {
      findings.push({
        severity: 'info',
        code: 'SEARCH_ACTION_GOOGLE_UNSUPPORTED',
        message: 'Google retired the sitelinks search box; SearchAction is no longer needed for that feature.',
        path: 'potentialAction',
        docsUrl: 'https://developers.google.com/search/blog/2024/10/sitelinks-search-box',
      });
      break;
    }
  }
  return findings;
}

/**
 * Validate JobPosting hiringOrganization.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateJobPosting(data) {
  /** @type {Finding[]} */
  const findings = [];
  const org = data.hiringOrganization;
  if (typeof org === 'object' && org !== null) {
    const o = /** @type {Record<string, unknown>} */ (org);
    if (!hasProperty(o, 'name') && !hasProperty(o, 'sameAs')) {
      findings.push({
        severity: 'warning',
        code: 'JOB_MISSING_ORG_NAME',
        message: 'JobPosting hiringOrganization should include name or sameAs.',
        path: 'hiringOrganization.name',
      });
    }
  }
  return findings;
}

/**
 * Validate QAPage mainEntity.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateQAPage(data) {
  /** @type {Finding[]} */
  const findings = [];
  const main = data.mainEntity;
  if (!main) return findings;
  const items = Array.isArray(main) ? main : [main];
  items.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) return;
    const q = /** @type {Record<string, unknown>} */ (item);
    if (!hasProperty(q, 'name')) {
      findings.push({
        severity: 'error',
        code: 'QA_MISSING_QUESTION_NAME',
        message: `QAPage Question ${i + 1} is missing name.`,
        path: `mainEntity[${i}].name`,
      });
    }
    if (!q.acceptedAnswer && !q.suggestedAnswer) {
      findings.push({
        severity: 'error',
        code: 'QA_MISSING_ANSWER',
        message: `QAPage Question ${i + 1} needs acceptedAnswer or suggestedAnswer.`,
        path: `mainEntity[${i}]`,
      });
    }
  });
  return findings;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateDiscussionPost(data) {
  /** @type {Finding[]} */
  const findings = [];
  const hasContent =
    hasProperty(data, 'text') ||
    hasProperty(data, 'image') ||
    hasProperty(data, 'video') ||
    hasProperty(data, 'url');
  if (!hasContent) {
    findings.push({
      severity: 'error',
      code: 'FORUM_MISSING_CONTENT',
      message: 'DiscussionForumPosting requires text, image, video, or a URL to the full post.',
      path: 'text',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/discussion-forum',
    });
  }
  return findings;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateProfilePage(data) {
  const main = data.mainEntity;
  if (main === undefined || main === null) return [];
  if (typeof main !== 'object' || Array.isArray(main)) {
    return [{
      severity: 'error',
      code: 'PROFILE_INVALID_MAIN_ENTITY',
      message: 'ProfilePage mainEntity must be a Person or Organization object.',
      path: 'mainEntity',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/profile-page',
    }];
  }
  const entity = /** @type {Record<string, unknown>} */ (main);
  const types = entity['@type'];
  const typeList = Array.isArray(types) ? types : types ? [types] : [];
  const isProfileSubject = typeList.some((type) => {
    const value = String(type);
    return value === 'Person' || value === 'Organization' || /(?:schema\.org\/|schema:)(Person|Organization)$/.test(value);
  });
  if (!isProfileSubject) {
    return [{
      severity: 'error',
      code: 'PROFILE_INVALID_MAIN_ENTITY',
      message: 'ProfilePage mainEntity must be a Person or Organization object.',
      path: 'mainEntity.@type',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/profile-page',
    }];
  }
  if (hasProperty(entity, 'name') || hasProperty(entity, 'alternateName')) return [];
  return [{
    severity: 'error',
    code: 'PROFILE_MISSING_IDENTITY',
    message: 'ProfilePage mainEntity requires name or alternateName.',
    path: 'mainEntity.name',
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/profile-page',
  }];
}

/**
 * Validate return-policy objects embedded in Organization or Product markup.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateNestedMerchantReturnPolicies(data) {
  /** @type {Finding[]} */
  const findings = [];

  function visit(value, path, depth) {
    if (depth > 50 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    const obj = /** @type {Record<string, unknown>} */ (value);
    const types = obj['@type'];
    const typeList = Array.isArray(types) ? types : types ? [types] : [];
    if (typeList.some((type) => String(type).endsWith('MerchantReturnPolicy'))) {
      findings.push(...validateMerchantReturnPolicy(obj).map((finding) => ({
        ...finding,
        path: path ? `${path}.${finding.path}` : finding.path,
      })));
    }
    for (const [key, child] of Object.entries(obj)) {
      visit(child, path ? `${path}.${key}` : key, depth + 1);
    }
  }

  for (const [key, value] of Object.entries(data)) visit(value, key, 0);
  return findings;
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateMerchantReturnPolicy(data) {
  if (hasProperty(data, 'merchantReturnLink')) return [];
  /** @type {Finding[]} */
  const findings = [];
  if (!hasProperty(data, 'applicableCountry')) {
    findings.push({
      severity: 'error',
      code: 'RETURN_POLICY_MISSING_COUNTRY',
      message: 'MerchantReturnPolicy requires applicableCountry unless merchantReturnLink is used.',
      path: 'applicableCountry',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/return-policy',
    });
  }
  if (!hasProperty(data, 'returnPolicyCategory')) {
    findings.push({
      severity: 'error',
      code: 'RETURN_POLICY_MISSING_CATEGORY',
      message: 'MerchantReturnPolicy requires returnPolicyCategory unless merchantReturnLink is used.',
      path: 'returnPolicyCategory',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/return-policy',
    });
  } else if (
    String(data.returnPolicyCategory).endsWith('MerchantReturnFiniteReturnWindow') &&
    !hasProperty(data, 'merchantReturnDays')
  ) {
    findings.push({
      severity: 'error',
      code: 'RETURN_POLICY_MISSING_DAYS',
      message: 'A finite MerchantReturnPolicy requires merchantReturnDays.',
      path: 'merchantReturnDays',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/return-policy',
    });
  }
  return findings;
}

/**
 * @param {Record<string, unknown>} rating
 * @param {string} path
 * @returns {Finding[]}
 */
function validateRatingObject(rating, path) {
  /** @type {Finding[]} */
  const findings = [];
  const raw = rating.ratingValue;
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  const best = typeof rating.bestRating === 'number' ? rating.bestRating
    : typeof rating.bestRating === 'string' ? Number(rating.bestRating) : 5;
  const worst = typeof rating.worstRating === 'number' ? rating.worstRating
    : typeof rating.worstRating === 'string' ? Number(rating.worstRating) : 1;
  if (raw === undefined || raw === null || raw === '') {
    findings.push({
      severity: 'error',
      code: 'RATING_MISSING_VALUE',
      message: `Rating at ${path} is missing ratingValue.`,
      path: `${path}.ratingValue`,
    });
    return findings;
  }
  if (Number.isNaN(num)) {
    findings.push({
      severity: 'error',
      code: 'RATING_NOT_NUMERIC',
      message: `Rating value "${String(raw)}" at ${path} is not numeric.`,
      path: `${path}.ratingValue`,
    });
    return findings;
  }
  if (num < worst || num > best) {
    findings.push({
      severity: 'warning',
      code: 'RATING_OUT_OF_BOUNDS',
      message: `Rating ${num} at ${path} is outside ${worst}–${best}.`,
      path: `${path}.ratingValue`,
    });
  }
  return findings;
}

/**
 * @param {Entity} entity
 * @returns {Finding[]}
 */
function validateEntity(entity) {
  /** @type {Finding[]} */
  const findings = [];
  const { types, data, id, format } = entity;

  if (types.length === 0) {
    pushFinding(findings, {
      severity: 'error',
      code: 'MISSING_TYPE',
      message: 'Entity is missing @type.',
      entityId: id,
      path: entity.path,
    });
  }

  for (const dep of DEPRECATED_TYPES) {
    if (types.includes(dep)) {
      pushFinding(findings, {
        severity: 'info',
        code: `${dep.toUpperCase()}_GOOGLE_UNSUPPORTED`,
        message: `${dep} structured data is no longer supported as a Google rich result.`,
        entityId: id,
        path: entity.path,
        docsUrl: 'https://developers.google.com/search/updates',
      });
    }
  }

  if (format === 'jsonld' && !('@context' in data)) {
    pushFinding(findings, {
      severity: 'warning',
      code: 'MISSING_CONTEXT',
      message: 'JSON-LD entity block is missing @context.',
      entityId: id,
      path: '@context',
      docsUrl: 'https://schema.org/docs/gs.html',
    });
  }

  if (format === 'jsonld' && '@context' in data) {
    const ctx = data['@context'];
    const ctxStr = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
    if (!ctxStr || !ctxStr.includes('schema.org')) {
      pushFinding(findings, {
        severity: 'warning',
        code: 'NON_SCHEMA_CONTEXT',
        message: `@context does not reference schema.org${ctxStr ? `: ${ctxStr.slice(0, 80)}` : '.'}`,
        entityId: id,
        path: '@context',
      });
    }
  }

  for (const rule of RICH_RESULT_RULES.filter((candidate) => {
    return types.includes(candidate.type) || (candidate.type === 'LocalBusiness' && isLocalBusiness(types));
  })) {
    for (const req of rule.required) {
      if (!hasPropertyPath(data, req)) {
        pushFinding(findings, {
          severity: 'error',
          code: `MISSING_${req.replaceAll('.', '_').toUpperCase()}`,
          message: `${rule.type} is missing required property "${req}".`,
          entityId: id,
          path: req,
          docsUrl: rule.docsUrl,
        });
      }
    }
    for (const rec of rule.recommended) {
      if (!hasPropertyPath(data, rec)) {
        pushFinding(findings, {
          severity: 'info',
          code: `RECOMMENDED_${rec.replaceAll('.', '_').toUpperCase()}`,
          message: `${rule.type} is missing recommended property "${rec}".`,
          entityId: id,
          path: rec,
          docsUrl: rule.docsUrl,
        });
      }
    }
    for (const alternatives of rule.anyOf ?? []) {
      if (!alternatives.some((path) => hasPropertyPath(data, path))) {
        pushFinding(findings, {
          severity: 'error',
          code: `MISSING_${alternatives.join('_OR_').toUpperCase()}`,
          message: `${rule.type} requires one of: ${alternatives.map((path) => `"${path}"`).join(', ')}.`,
          entityId: id,
          path: alternatives.join(' | '),
          docsUrl: rule.docsUrl,
        });
      }
    }
  }

  if (types.includes('Product')) {
    const hasOfferSignal =
      hasProperty(data, 'offers') ||
      hasProperty(data, 'review') ||
      hasProperty(data, 'aggregateRating');
    if (!hasOfferSignal) {
      pushFinding(findings, {
        severity: 'warning',
        code: 'PRODUCT_MISSING_OFFER_OR_REVIEW',
        message: 'Product should include offers, review, or aggregateRating to qualify for rich results.',
        entityId: id,
        path: 'offers',
        docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/product',
      });
    }
  }

  if (types.includes('FAQPage')) {
    findings.push(...validateFaqStructure(data).map((f) => ({ ...f, entityId: id })));
    pushFinding(findings, {
      severity: 'info',
      code: FAQ_GOOGLE_STATUS.code,
      message: FAQ_GOOGLE_STATUS.message,
      entityId: id,
      docsUrl: FAQ_GOOGLE_STATUS.docsUrl,
    });
  }

  if (types.includes('BreadcrumbList')) {
    findings.push(...validateBreadcrumbStructure(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('WebSite')) {
    findings.push(...validateWebSiteSearchAction(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('SearchAction')) {
    pushFinding(findings, {
      severity: 'info',
      code: 'SEARCH_ACTION_GOOGLE_UNSUPPORTED',
      message: 'Google retired the sitelinks search box; SearchAction is no longer needed for that feature.',
      entityId: id,
      path: entity.path,
      docsUrl: 'https://developers.google.com/search/blog/2024/10/sitelinks-search-box',
    });
  }

  if (types.includes('JobPosting')) {
    findings.push(...validateJobPosting(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('QAPage')) {
    findings.push(...validateQAPage(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('DiscussionForumPosting') || types.includes('SocialMediaPosting')) {
    findings.push(...validateDiscussionPost(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('ProfilePage')) {
    findings.push(...validateProfilePage(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('MerchantReturnPolicy')) {
    findings.push(...validateMerchantReturnPolicy(data).map((f) => ({ ...f, entityId: id })));
  }

  findings.push(...validateNestedMerchantReturnPolicies(data).map((f) => ({ ...f, entityId: id })));

  if (hasPackedAuthorName(data)) {
    pushFinding(findings, {
      severity: 'warning',
      code: 'PACKED_AUTHOR_NAME',
      message: 'Author name appears to contain multiple names packed with commas; use separate author objects.',
      entityId: id,
      path: 'author',
    });
  }

  for (const { path, value } of collectUrlFields(data)) {
    if (isRelativeUrl(value)) {
      pushFinding(findings, {
        severity: 'warning',
        code: 'RELATIVE_URL',
        message: `Relative URL in "${path}": ${value}`,
        entityId: id,
        path,
      });
    }
  }

  for (const check of collectValueChecks(data)) {
    if (check.kind === 'date') {
      const text = String(check.value);
      if (!isIso8601Date(text)) {
        pushFinding(findings, {
          severity: 'warning',
          code: 'INVALID_DATE',
          message: `"${text}" at ${check.path} is not a valid ISO 8601 date.`,
          entityId: id,
          path: check.path,
        });
      }
    } else if (check.kind === 'currency') {
      const text = String(check.value).trim();
      if (!isIso4217Currency(text)) {
        pushFinding(findings, {
          severity: 'warning',
          code: 'INVALID_CURRENCY',
          message: `"${text}" at ${check.path} is not a 3-letter ISO 4217 currency code.`,
          entityId: id,
          path: check.path,
        });
      }
    } else if (check.kind === 'rating' && check.value && typeof check.value === 'object') {
      findings.push(
        ...validateRatingObject(/** @type {Record<string, unknown>} */ (check.value), check.path)
          .map((f) => ({ ...f, entityId: id })),
      );
    }
  }

  return findings;
}

/**
 * Validate page snapshot and normalized entities.
 * @param {PageSnapshot} snapshot
 * @param {Entity[]} entities
 * @returns {Finding[]}
 */
export function validate(snapshot, entities) {
  /** @type {Finding[]} */
  const findings = [];

  for (const block of snapshot.jsonld) {
    if (block.parseError) {
      const loc = block.parseError.line
        ? ` (line ${block.parseError.line}, column ${block.parseError.column ?? '?'})`
        : '';
      pushFinding(findings, {
        severity: 'error',
        code: 'JSONLD_PARSE',
        message: `JSON-LD parse error${loc}: ${block.parseError.message}`,
        path: block.selector,
      });
    }
    if (block.parsed === null && !block.parseError) {
      pushFinding(findings, {
        severity: 'error',
        code: 'JSONLD_EMPTY',
        message: 'JSON-LD block is empty or failed to parse.',
        path: block.selector,
      });
    } else if (block.parsed !== null && !block.parseError) {
      if (Array.isArray(block.parsed) && block.parsed.length === 0) {
        pushFinding(findings, {
          severity: 'error',
          code: 'JSONLD_EMPTY',
          message: 'JSON-LD block contains an empty top-level array.',
          path: block.selector,
        });
      } else if (
        typeof block.parsed !== 'object' ||
        (Array.isArray(block.parsed) && block.parsed.some((item) => {
          return typeof item !== 'object' || item === null || Array.isArray(item);
        }))
      ) {
        pushFinding(findings, {
          severity: 'error',
          code: 'JSONLD_INVALID_TOP_LEVEL',
          message: 'JSON-LD top-level value must be an object or an array of objects.',
          path: block.selector,
        });
      } else if (
        !Array.isArray(block.parsed) &&
        '@graph' in /** @type {Record<string, unknown>} */ (block.parsed) &&
        (
          /** @type {Record<string, unknown>} */ (block.parsed)['@graph'] === null ||
          typeof /** @type {Record<string, unknown>} */ (block.parsed)['@graph'] !== 'object' ||
          (Array.isArray(/** @type {Record<string, unknown>} */ (block.parsed)['@graph']) &&
            /** @type {unknown[]} */ (/** @type {Record<string, unknown>} */ (block.parsed)['@graph']).length === 0)
        )
      ) {
        pushFinding(findings, {
          severity: 'error',
          code: 'JSONLD_EMPTY',
          message: 'JSON-LD @graph must contain an array of entity objects.',
          path: block.selector,
        });
      } else if (
        !Array.isArray(block.parsed) &&
        Array.isArray(/** @type {Record<string, unknown>} */ (block.parsed)['@graph']) &&
        /** @type {unknown[]} */ (/** @type {Record<string, unknown>} */ (block.parsed)['@graph']).some((item) => {
          return typeof item !== 'object' || item === null || Array.isArray(item);
        })
      ) {
        pushFinding(findings, {
          severity: 'error',
          code: 'JSONLD_INVALID_GRAPH',
          message: 'JSON-LD @graph entries must be entity objects.',
          path: block.selector,
        });
      }
    }
  }

  if (
    entities.length === 0 &&
    snapshot.jsonld.length === 0 &&
    snapshot.microdata.length === 0 &&
    snapshot.rdfa.length === 0
  ) {
    pushFinding(findings, {
      severity: 'info',
      code: 'NO_SCHEMA',
      message: 'No structured data (JSON-LD, Microdata, or RDFa) found on this page.',
    });
    return findings;
  }

  for (const entity of entities) {
    findings.push(...validateEntity(entity));
  }

  return findings;
}

export { RICH_RESULT_RULES };
