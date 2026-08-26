/**
 * Validate snapshot and entities against rules catalog.
 * @file
 */

import {
  RICH_RESULT_RULES,
  LOCAL_BUSINESS_TYPES,
  ORGANIZATION_TYPES,
  VEHICLE_LISTING_TYPES,
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

function isOrganization(types) {
  return types.some((type) => ORGANIZATION_TYPES.has(type));
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>|null}
 */
function firstRecord(value) {
  if (Array.isArray(value)) return firstRecord(value[0]);
  if (value && typeof value === 'object') return /** @type {Record<string, unknown>} */ (value);
  return null;
}

/**
 * Check a property path while following local JSON-LD @id references.
 * @param {Record<string, unknown>} data
 * @param {string} path
 * @param {Entity[]} entities
 */
function hasEntityPropertyPath(data, path, entities) {
  if (hasPropertyPath(data, path)) return true;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return false;
  return visit(data, 0, 0, new Set());

  function visit(value, index, depth, seen) {
    if (depth > 50 || value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some((item) => visit(item, index, depth + 1, seen));
    if (typeof value !== 'object') return false;
    const obj = /** @type {Record<string, unknown>} */ (value);
    const child = obj[parts[index]];
    if (child !== undefined) {
      return index === parts.length - 1
        ? hasProperty({ value: child }, 'value')
        : visit(child, index + 1, depth + 1, seen);
    }
    const ref = obj['@id'];
    if (typeof ref !== 'string' || seen.has(ref)) return false;
    const target = entities.find((entity) => entity.id === ref || entity.data['@id'] === ref);
    if (!target) return false;
    const nextSeen = new Set(seen);
    nextSeen.add(ref);
    return visit(target.data, index, depth + 1, nextSeen);
  }
}

/**
 * Resolve a local JSON-LD node reference while preserving inline overrides.
 * @param {unknown} value
 * @param {Entity[]} entities
 * @returns {Record<string, unknown>|null}
 */
function resolveEntityObject(value, entities) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const object = /** @type {Record<string, unknown>} */ (value);
  const ref = object['@id'];
  if (typeof ref !== 'string') return object;
  const target = entities.find((entity) => entity.id === ref || entity.data['@id'] === ref);
  return target ? { ...target.data, ...object } : object;
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
      severity: 'info',
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
        severity: 'info',
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
        severity: 'info',
        code: 'FAQ_MISSING_QUESTION_NAME',
        message: `FAQ Question ${i + 1} is missing name.`,
        path: `mainEntity[${i}].name`,
      });
    }
    if (!isQuestion) {
      findings.push({
        severity: 'info',
        code: 'FAQ_INVALID_QUESTION_TYPE',
        message: `FAQ item ${i + 1} should have @type Question.`,
        path: `mainEntity[${i}].@type`,
      });
    }
    const answer = q.acceptedAnswer;
    if (!answer) {
      findings.push({
        severity: 'info',
        code: 'FAQ_MISSING_ANSWER',
        message: `FAQ Question ${i + 1} is missing acceptedAnswer.`,
        path: `mainEntity[${i}].acceptedAnswer`,
      });
    } else if (typeof answer === 'object' && answer !== null) {
      const a = /** @type {Record<string, unknown>} */ (answer);
      if (!hasProperty(a, 'text') && !hasProperty(a, 'name')) {
        findings.push({
          severity: 'info',
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
function validateBreadcrumbStructure(data, entities) {
  /** @type {Finding[]} */
  const findings = [];
  const list = data.itemListElement;
  const items = Array.isArray(list) ? list : list ? [list] : [];

  if (items.length < 2) {
    findings.push({
      severity: 'error',
      code: 'BREADCRUMB_TOO_SHORT',
      message: 'BreadcrumbList requires at least 2 ListItem elements for Google breadcrumb eligibility.',
      path: 'itemListElement',
    });
  }

  items.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      findings.push({
        severity: 'error',
        code: 'BREADCRUMB_INVALID_LIST_ITEM',
        message: `Breadcrumb item ${i + 1} must be a ListItem object.`,
        path: `itemListElement[${i}]`,
      });
      return;
    }
    const li = resolveEntityObject(item, entities) || {};
    const types = Array.isArray(li['@type']) ? li['@type'] : li['@type'] ? [li['@type']] : [];
    if (!types.some((type) => String(type).replace(/^(?:https?:\/\/schema\.org\/|schema:)/i, '') === 'ListItem')) {
      findings.push({
        severity: 'error',
        code: 'BREADCRUMB_INVALID_LIST_ITEM',
        message: `Breadcrumb item ${i + 1} must have @type ListItem.`,
        path: `itemListElement[${i}].@type`,
      });
    }
    if (!hasProperty(li, 'name') && !hasEntityPropertyPath(li, 'item.name', entities)) {
      findings.push({
        severity: 'error',
        code: 'BREADCRUMB_MISSING_NAME',
        message: `Breadcrumb ListItem ${i + 1} is missing name.`,
        path: `itemListElement[${i}].name`,
      });
    }
    if (!hasProperty(li, 'position')) {
      findings.push({
        severity: 'error',
        code: 'BREADCRUMB_MISSING_POSITION',
        message: `Breadcrumb ListItem ${i + 1} is missing position.`,
        path: `itemListElement[${i}].position`,
      });
    }
    if (i < items.length - 1 && !hasProperty(li, 'item')) {
      findings.push({
        severity: 'error',
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
 * Validate QAPage mainEntity.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateQAPage(data, entities) {
  /** @type {Finding[]} */
  const findings = [];
  const main = data.mainEntity;
  if (!main) return findings;
  const items = Array.isArray(main) ? main : [main];
  if (items.length !== 1) {
    findings.push({
      severity: 'error',
      code: 'QA_INVALID_QUESTION_COUNT',
      message: 'QAPage must contain exactly one Question under mainEntity.',
      path: 'mainEntity',
    });
  }
  items.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      findings.push({
        severity: 'error',
        code: 'QA_INVALID_QUESTION',
        message: `QAPage mainEntity ${i + 1} must be a Question object.`,
        path: `mainEntity[${i}]`,
      });
      return;
    }
    const q = resolveEntityObject(item, entities) || {};
    const questionTypes = Array.isArray(q['@type']) ? q['@type'] : q['@type'] ? [q['@type']] : [];
    if (!questionTypes.some((type) => {
      const value = String(type);
      return value === 'Question' || /(?:schema\.org\/|schema:)Question$/.test(value);
    })) {
      findings.push({
        severity: 'error',
        code: 'QA_INVALID_QUESTION',
        message: `QAPage mainEntity ${i + 1} must have @type Question.`,
        path: `mainEntity[${i}].@type`,
      });
    }
    if (!hasProperty(q, 'name')) {
      findings.push({
        severity: 'error',
        code: 'QA_MISSING_QUESTION_NAME',
        message: `QAPage Question ${i + 1} is missing name.`,
        path: `mainEntity[${i}].name`,
      });
    }
    if (!hasProperty(q, 'answerCount')) {
      findings.push({
        severity: 'error',
        code: 'QA_MISSING_ANSWER_COUNT',
        message: `QAPage Question ${i + 1} is missing answerCount.`,
        path: `mainEntity[${i}].answerCount`,
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
    for (const [property, rawAnswers] of [['acceptedAnswer', q.acceptedAnswer], ['suggestedAnswer', q.suggestedAnswer]]) {
      const answers = Array.isArray(rawAnswers) ? rawAnswers : rawAnswers ? [rawAnswers] : [];
      answers.forEach((answer, answerIndex) => {
        const resolvedAnswer = resolveEntityObject(answer, entities);
        if (!resolvedAnswer || !hasEntityPropertyPath(resolvedAnswer, 'text', entities)) {
          findings.push({
            severity: 'error',
            code: 'QA_ANSWER_MISSING_TEXT',
            message: `QAPage ${property} ${answerIndex + 1} is missing text.`,
            path: `mainEntity[${i}].${property}[${answerIndex}].text`,
          });
        }
      });
    }
  });
  return findings;
}

/**
 * Validate Google carousel ItemList structure.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateItemList(data, entities) {
  /** @type {Finding[]} */
  const findings = [];
  const rawItems = data.itemListElement;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  if (items.length < 2) {
    findings.push({
      severity: 'error',
      code: 'CAROUSEL_TOO_SHORT',
      message: 'Google carousel ItemList markup requires at least two ListItem elements.',
      path: 'itemListElement',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/carousel',
    });
  }
  /** @type {Set<string>[]} */
  const itemTypeSets = [];
  const supportedTypes = new Set(['Course', 'Movie', 'Recipe', 'Restaurant']);
  items.forEach((item, index) => {
    const path = `itemListElement[${index}]`;
    if (typeof item !== 'object' || item === null) {
      findings.push({
        severity: 'error',
        code: 'CAROUSEL_INVALID_LIST_ITEM',
        message: `Carousel item ${index + 1} must be a ListItem object.`,
        path,
      });
      return;
    }
    const listItem = resolveEntityObject(item, entities) || {};
    const listItemTypes = Array.isArray(listItem['@type']) ? listItem['@type'] : listItem['@type'] ? [listItem['@type']] : [];
    if (!listItemTypes.some((type) => String(type).replace(/^(?:https?:\/\/schema\.org\/|schema:)/i, '') === 'ListItem')) {
      findings.push({
        severity: 'error',
        code: 'CAROUSEL_INVALID_LIST_ITEM',
        message: `Carousel item ${index + 1} must have @type ListItem.`,
        path: `${path}.@type`,
      });
    }
    if (!hasProperty(listItem, 'position')) {
      findings.push({
        severity: 'error',
        code: 'CAROUSEL_MISSING_POSITION',
        message: `Carousel ListItem ${index + 1} is missing position.`,
        path: `${path}.position`,
      });
    }
    if (!hasProperty(listItem, 'url') && !hasProperty(listItem, 'item')) {
      findings.push({
        severity: 'error',
        code: 'CAROUSEL_MISSING_ITEM',
        message: `Carousel ListItem ${index + 1} requires url or item.`,
        path,
      });
    }
    if (hasProperty(listItem, 'item')) {
      if (!hasEntityPropertyPath(listItem, 'item.name', entities)) {
        findings.push({
          severity: 'error',
          code: 'CAROUSEL_MISSING_ITEM_NAME',
          message: `Carousel ListItem ${index + 1} item is missing name.`,
          path: `${path}.item.name`,
        });
      }
      if (!hasEntityPropertyPath(listItem, 'item.url', entities)) {
        findings.push({
          severity: 'error',
          code: 'CAROUSEL_MISSING_ITEM_URL',
          message: `Carousel ListItem ${index + 1} item is missing url.`,
          path: `${path}.item.url`,
        });
      }
      const nested = resolveEntityObject(listItem.item, entities);
      if (nested) {
        const type = nested['@type'];
        const typeList = Array.isArray(type) ? type : type ? [type] : [];
        const normalizedTypes = new Set(typeList.map((value) => {
          return String(value).replace(/^(?:https?:\/\/schema\.org\/|schema:)/i, '');
        }));
        itemTypeSets.push(normalizedTypes);
        if (![...normalizedTypes].some((value) => supportedTypes.has(value))) {
          findings.push({
            severity: 'error',
            code: 'CAROUSEL_UNSUPPORTED_ITEM_TYPE',
            message: `Carousel ListItem ${index + 1} must contain a Course, Movie, Recipe, or Restaurant item.`,
            path: `${path}.item.@type`,
          });
        }
      }
    }
  });
  const sharedTypes = itemTypeSets.length
    ? [...itemTypeSets[0]].filter((type) => itemTypeSets.every((types) => types.has(type)))
    : [];
  if (itemTypeSets.length > 1 && sharedTypes.length === 0) {
    findings.push({
      severity: 'error',
      code: 'CAROUSEL_MIXED_ITEM_TYPES',
      message: 'All items in a Google carousel ItemList must be of the same type.',
      path: 'itemListElement',
    });
  }
  return findings;
}

/**
 * Validate nested Product variants when they are present on a ProductGroup.
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateProductGroup(data, entities) {
  const rawVariants = data.hasVariant;
  const variants = Array.isArray(rawVariants) ? rawVariants : rawVariants ? [rawVariants] : [];
  if (variants.length === 0 || hasProperty(data, 'productGroupID')) return [];
  if (variants.some((variant) => {
    const resolved = resolveEntityObject(variant, entities);
    return Boolean(resolved && hasProperty(resolved, 'inProductGroupWithID'));
  })) return [];
  return [{
    severity: 'error',
    code: 'PRODUCT_GROUP_MISSING_ID',
    message: 'ProductGroup requires productGroupID or inProductGroupWithID on its variants.',
    path: 'productGroupID',
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/product-variants',
  }];
}

/**
 * Google only requires itemReviewed when the Review is not nested through another entity's review property.
 * @param {Record<string, unknown>} data
 * @param {Entity[]} entities
 * @returns {Finding[]}
 */
function validateReview(data, entities) {
  const reviewEntity = entities.find((entity) => entity.data === data);
  const reviewId = typeof data['@id'] === 'string' ? data['@id'] : reviewEntity?.id;
  const isNested = entities.some((entity) => {
    if (entity === reviewEntity) return false;
    const reviews = Array.isArray(entity.data.review) ? entity.data.review : [entity.data.review];
    return reviews.some((review) => {
      if (review === data) return true;
      if (!reviewId || typeof review !== 'object' || review === null || Array.isArray(review)) return false;
      return review['@id'] === reviewId;
    });
  });
  if (isNested) return [];

  return ['itemReviewed', 'itemReviewed.name']
    .filter((path) => !hasEntityPropertyPath(data, path, entities))
    .map((path) => ({
      severity: 'error',
      code: `MISSING_${path.replaceAll('.', '_').toUpperCase()}`,
      message: `Review is missing required property "${path}".`,
      path,
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet',
    }));
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
function validateProfilePage(data, entities) {
  const main = data.mainEntity;
  if (main === undefined || main === null) return [];
  const entity = resolveEntityObject(main, entities);
  if (!entity) {
    return [{
      severity: 'error',
      code: 'PROFILE_INVALID_MAIN_ENTITY',
      message: 'ProfilePage mainEntity must be a Person or Organization object.',
      path: 'mainEntity',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/profile-page',
    }];
  }
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
  if (hasEntityPropertyPath(entity, 'name', entities) || hasEntityPropertyPath(entity, 'alternateName', entities)) return [];
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
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateMemberProgram(data) {
  if (hasProperty(data, 'name')) return [];
  return [{
    severity: 'error',
    code: 'MEMBER_PROGRAM_MISSING_NAME',
    message: 'MemberProgram requires name.',
    path: 'name',
    docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/loyalty-program',
  }];
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} typeSuffix
 * @param {(obj: Record<string, unknown>) => Finding[]} validator
 * @returns {Finding[]}
 */
function validateNestedType(data, typeSuffix, validator) {
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
    if (typeList.some((type) => String(type).endsWith(typeSuffix))) {
      findings.push(...validator(obj).map((finding) => ({
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

const PRODUCT_IDENTIFIER_PATHS = ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14', 'isbn'];

/**
 * @param {Record<string, unknown>} data
 * @param {Entity[]} entities
 * @returns {boolean}
 */
function isMerchantListing(data, entities) {
  return hasEntityPropertyPath(data, 'offers.price', entities)
    || hasEntityPropertyPath(data, 'offers.priceSpecification.price', entities);
}

/**
 * Merchant listing extras beyond the Product snippet anyOf rule.
 * @param {Record<string, unknown>} data
 * @param {Entity[]} entities
 * @returns {Finding[]}
 */
function validateMerchantListing(data, entities) {
  if (!isMerchantListing(data, entities)) return [];
  /** @type {Finding[]} */
  const findings = [];
  const docsUrl = 'https://developers.google.com/search/docs/appearance/structured-data/merchant-listing';

  if (!hasEntityPropertyPath(data, 'image', entities)) {
    findings.push({
      severity: 'error',
      code: 'MERCHANT_MISSING_IMAGE',
      message: 'Merchant listings require an image in addition to a buyable offer.',
      path: 'image',
      docsUrl,
    });
  }
  if (
    !hasEntityPropertyPath(data, 'offers.priceCurrency', entities)
    && !hasEntityPropertyPath(data, 'offers.priceSpecification.priceCurrency', entities)
  ) {
    findings.push({
      severity: 'error',
      code: 'MERCHANT_MISSING_PRICE_CURRENCY',
      message: 'Merchant listings require offers.priceCurrency.',
      path: 'offers.priceCurrency',
      docsUrl,
    });
  }

  const offer = firstRecord(data.offers);
  const rawPrice = offer && hasProperty(offer, 'price')
    ? offer.price
    : firstRecord(offer?.priceSpecification)?.price;
  const price = typeof rawPrice === 'number' ? rawPrice : typeof rawPrice === 'string' ? Number(rawPrice) : NaN;
  if (!Number.isNaN(price) && price <= 0) {
    findings.push({
      severity: 'error',
      code: 'MERCHANT_PRICE_NOT_POSITIVE',
      message: 'Merchant listing prices must be greater than zero.',
      path: 'offers.price',
      docsUrl,
    });
  }

  if (!PRODUCT_IDENTIFIER_PATHS.some((path) => hasEntityPropertyPath(data, path, entities))) {
    findings.push({
      severity: 'warning',
      code: 'MERCHANT_MISSING_IDENTIFIER',
      message: 'Merchant listings should include a GTIN or ISBN so Google can match the product.',
      path: 'gtin',
      docsUrl,
    });
  }
  if (
    offer
    && !hasProperty(offer, 'shippingDetails')
    && !hasProperty(offer, 'hasShippingService')
    && !hasProperty(data, 'hasShippingService')
  ) {
    findings.push({
      severity: 'info',
      code: 'MERCHANT_MISSING_SHIPPING',
      message: 'Merchant listings can show shipping when Offer.shippingDetails or organization shipping policy is present.',
      path: 'offers.shippingDetails',
      docsUrl,
    });
  }
  if (
    !hasProperty(data, 'hasMerchantReturnPolicy')
    && !(offer && hasProperty(offer, 'hasMerchantReturnPolicy'))
  ) {
    findings.push({
      severity: 'info',
      code: 'MERCHANT_MISSING_RETURN_POLICY',
      message: 'Merchant listings can show returns when a MerchantReturnPolicy is present on the offer or organization.',
      path: 'hasMerchantReturnPolicy',
      docsUrl,
    });
  }

  const specs = [];
  if (offer) {
    const raw = offer.priceSpecification;
    if (Array.isArray(raw)) specs.push(...raw);
    else if (raw) specs.push(raw);
  }
  for (const spec of specs) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue;
    const row = /** @type {Record<string, unknown>} */ (spec);
    if (hasProperty(row, 'priceType') && hasProperty(row, 'validForMemberTier')) {
      findings.push({
        severity: 'warning',
        code: 'MERCHANT_PRICE_TYPE_CONFLICT',
        message: 'Do not set priceType and validForMemberTier on the same UnitPriceSpecification.',
        path: 'offers.priceSpecification',
        docsUrl,
      });
      break;
    }
  }

  if ('hasAdultConsideration' in data) {
    const value = data.hasAdultConsideration;
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      findings.push({
        severity: 'warning',
        code: 'INVALID_ADULT_CONSIDERATION',
        message: 'hasAdultConsideration must be a boolean.',
        path: 'hasAdultConsideration',
        docsUrl,
      });
    }
  }

  return findings;
}

const PAYWALL_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'WebPageElement']);

/**
 * @param {string[]} types
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validatePaywallAndSpeakable(types, data) {
  if (!types.some((type) => PAYWALL_TYPES.has(type))) return [];
  /** @type {Finding[]} */
  const findings = [];
  const free = data.isAccessibleForFree;
  const isPaywalled = free === false || free === 'false' || free === 'False';
  if (isPaywalled && !hasProperty(data, 'hasPart')) {
    findings.push({
      severity: 'warning',
      code: 'PAYWALL_MISSING_HAS_PART',
      message: 'Paywalled content should include hasPart with a cssSelector for the accessible section.',
      path: 'hasPart',
      docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/paywalled-content',
    });
  }
  if (data.speakable) {
    const speakable = firstRecord(data.speakable);
    if (speakable && !hasProperty(speakable, 'cssSelector') && !hasProperty(speakable, 'xpath')) {
      findings.push({
        severity: 'warning',
        code: 'SPEAKABLE_MISSING_SELECTOR',
        message: 'speakable requires cssSelector or xpath.',
        path: 'speakable',
        docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/speakable',
      });
    }
  }
  return findings;
}

/**
 * @param {string[]} types
 * @param {Record<string, unknown>} data
 * @returns {Finding[]}
 */
function validateRetiredFeatureHints(types, data) {
  /** @type {Finding[]} */
  const findings = [];
  if (types.includes('Event')) {
    const mode = String(data.eventAttendanceMode || '');
    if (mode.includes('OnlineEventAttendanceMode') && !mode.includes('MixedEventAttendanceMode')) {
      findings.push({
        severity: 'info',
        code: 'EVENT_ONLINE_GOOGLE_UNSUPPORTED',
        message: 'Google Event rich results require a publicly bookable physical location; online-only events are not eligible.',
        path: 'eventAttendanceMode',
        docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/event',
      });
    }
  }
  if (
    types.some((type) => VEHICLE_LISTING_TYPES.has(type))
    && !types.includes('Product')
  ) {
    findings.push({
      severity: 'info',
      code: 'VEHICLE_LISTING_GOOGLE_UNSUPPORTED',
      message: 'Google retired the vehicle listing rich result. Product merchant markup can still describe a vehicle for sale.',
      path: '@type',
      docsUrl: 'https://developers.google.com/search/updates',
    });
  }
  if (hasProperty(data, 'estimatedSalary')) {
    findings.push({
      severity: 'info',
      code: 'ESTIMATED_SALARY_GOOGLE_UNSUPPORTED',
      message: 'Google retired estimated salary rich results.',
      path: 'estimatedSalary',
      docsUrl: 'https://developers.google.com/search/updates',
    });
  }
  return findings;
}

/**
 * @param {string} haystack
 * @param {string} value
 */
function visibleHasText(haystack, value) {
  const needle = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (needle.length < 4) return true;
  return haystack.includes(needle);
}

/**
 * @param {string} haystack
 * @param {string} price
 */
function visibleHasPrice(haystack, price) {
  const text = String(price).trim();
  if (!text) return true;
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.,])${escaped}(?![\\d])`).test(haystack);
}

/**
 * @param {string} haystack
 * @param {string} phone
 */
function visibleHasPhone(haystack, phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return true;
  const hayDigits = haystack.replace(/\D/g, '');
  return hayDigits.includes(digits);
}

/**
 * Conservative markup-vs-visible checks. Missing page text skips the check.
 * @param {string} haystack
 * @param {Entity} entity
 * @returns {Finding[]}
 */
function validateVisibleMatch(haystack, entity) {
  const { types, data, id } = entity;
  /** @type {Finding[]} */
  const findings = [];

  /**
   * @param {string} path
   * @param {string} label
   * @param {'text' | 'price' | 'phone'} kind
   */
  function check(path, label, kind = 'text') {
    if (!hasPropertyPath(data, path) && !(path.includes('.') && hasPropertyPath(data, path))) return;
    const parts = path.split('.');
    let value = /** @type {unknown} */ (data);
    for (const part of parts) {
      if (!value || typeof value !== 'object') return;
      value = Array.isArray(value)
        ? /** @type {unknown[]} */ (value)[0]
        : /** @type {Record<string, unknown>} */ (value)[part];
    }
    const text = readName(value) || (typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '');
    if (!text) return;
    const ok = kind === 'price'
      ? visibleHasPrice(haystack, text)
      : kind === 'phone'
        ? visibleHasPhone(haystack, text)
        : visibleHasText(haystack, text);
    if (!ok) {
      findings.push({
        severity: 'warning',
        code: 'VISIBLE_MISMATCH',
        message: `${label} "${text}" does not appear in the visible page text.`,
        entityId: id,
        path,
        docsUrl: 'https://developers.google.com/search/docs/appearance/structured-data/sd-policies',
      });
    }
  }

  if (types.includes('Product') || types.includes('SoftwareApplication')) {
    check('name', 'Product name');
    check('offers.price', 'Offer price', 'price');
  }
  if (types.includes('NewsArticle') || types.includes('Article') || types.includes('BlogPosting')) {
    check('headline', 'Headline');
    if (!hasProperty(data, 'headline')) check('name', 'Article name');
  }
  if (types.includes('Recipe') || types.includes('Event') || types.includes('Movie') || types.includes('VacationRental')) {
    check('name', `${types[0]} name`);
  }
  if (types.includes('JobPosting')) {
    check('title', 'Job title');
  }
  if (isLocalBusiness(types)) {
    check('name', 'Business name');
    check('telephone', 'Telephone', 'phone');
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
  if (path.endsWith('aggregateRating') && !hasProperty(rating, 'ratingCount') && !hasProperty(rating, 'reviewCount')) {
    findings.push({
      severity: 'error',
      code: 'RATING_MISSING_COUNT',
      message: `Aggregate rating at ${path} requires ratingCount or reviewCount.`,
      path,
    });
  }
  return findings;
}

/**
 * @param {Entity} entity
 * @param {Entity[]} entities
 * @returns {Finding[]}
 */
function validateEntity(entity, entities) {
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
    return types.includes(candidate.type)
      || (candidate.type === 'LocalBusiness' && isLocalBusiness(types))
      || (candidate.type === 'Organization' && isOrganization(types));
  })) {
    for (const req of rule.required) {
      if (!hasEntityPropertyPath(data, req, entities)) {
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
      if (!hasEntityPropertyPath(data, rec, entities)) {
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
      if (!alternatives.some((path) => hasEntityPropertyPath(data, path, entities))) {
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
    findings.push(...validateBreadcrumbStructure(data, entities).map((f) => ({ ...f, entityId: id })));
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

  if (types.includes('QAPage')) {
    findings.push(...validateQAPage(data, entities).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('ItemList')) {
    findings.push(...validateItemList(data, entities).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('ProductGroup')) {
    findings.push(...validateProductGroup(data, entities).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('Review')) {
    findings.push(...validateReview(data, entities).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('DiscussionForumPosting') || types.includes('SocialMediaPosting')) {
    findings.push(...validateDiscussionPost(data).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('ProfilePage')) {
    findings.push(...validateProfilePage(data, entities).map((f) => ({ ...f, entityId: id })));
  }

  if (types.includes('MerchantReturnPolicy')) {
    findings.push(...validateMerchantReturnPolicy(data).map((f) => ({ ...f, entityId: id })));
  }

  findings.push(...validateNestedMerchantReturnPolicies(data).map((f) => ({ ...f, entityId: id })));
  findings.push(...validateNestedType(data, 'MemberProgram', validateMemberProgram).map((f) => ({ ...f, entityId: id })));

  if (types.includes('Product')) {
    findings.push(...validateMerchantListing(data, entities).map((f) => ({ ...f, entityId: id })));
  }

  findings.push(...validatePaywallAndSpeakable(types, data).map((f) => ({ ...f, entityId: id })));
  findings.push(...validateRetiredFeatureHints(types, data).map((f) => ({ ...f, entityId: id })));

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
  }

  if (snapshot.robots && typeof snapshot.robots === 'string') {
    const robotsLower = snapshot.robots.toLowerCase();
    if (robotsLower.includes('noindex')) {
      pushFinding(findings, {
        severity: 'warning',
        code: 'ROBOTS_NOINDEX',
        message: 'Page meta robots contains "noindex". Google will not index this page or display its rich results in search.',
        docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
      });
    }
    if (robotsLower.includes('nosnippet') || robotsLower.includes('max-snippet:0')) {
      pushFinding(findings, {
        severity: 'warning',
        code: 'ROBOTS_NOSNIPPET',
        message: 'Page meta robots contains "nosnippet" or "max-snippet:0". Google will not display text snippets or rich result previews for this page.',
        docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
      });
    }
  }

  const visibleText = typeof snapshot.visibleText === 'string'
    ? snapshot.visibleText.toLowerCase().replace(/\s+/g, ' ')
    : '';

  for (const entity of entities) {
    findings.push(...validateEntity(entity, entities));
    if (visibleText) findings.push(...validateVisibleMatch(visibleText, entity));
  }

  return findings;
}

export { RICH_RESULT_RULES };
