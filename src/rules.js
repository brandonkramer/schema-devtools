/**
 * Google rich-result and schema.org rule catalog aggregator.
 * Re-exports declarative rules and validation helpers from src/catalog/.
 * @file
 */

import { LOCAL_BUSINESS_TYPES, ORGANIZATION_TYPES, REVIEW_SNIPPET_TYPES, RICH_RESULT_RULES, VEHICLE_LISTING_TYPES } from './catalog/rich-results.js';
import { DEPRECATED_TYPES, FAQ_GOOGLE_STATUS } from './catalog/deprecations.js';
import {
  matchRuleInCatalog,
  hasProperty,
  hasPropertyPath,
  isRelativeUrl,
  collectUrlFields,
  isIso8601Date,
  isIso4217Currency,
  collectValueChecks,
} from './catalog/syntax.js';

/** @typedef {import('./types.js').TypeRule} TypeRule */

export {
  RICH_RESULT_RULES,
  LOCAL_BUSINESS_TYPES,
  ORGANIZATION_TYPES,
  REVIEW_SNIPPET_TYPES,
  VEHICLE_LISTING_TYPES,
  DEPRECATED_TYPES,
  FAQ_GOOGLE_STATUS,
  hasProperty,
  hasPropertyPath,
  isRelativeUrl,
  collectUrlFields,
  isIso8601Date,
  isIso4217Currency,
  collectValueChecks,
};

/**
 * Find the best matching rule for an entity type list.
 * @param {string[]} types
 * @returns {TypeRule|null}
 */
export function matchRule(types) {
  return matchRuleInCatalog(RICH_RESULT_RULES, types);
}
