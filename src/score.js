/**
 * Score findings and entities on a 0–100 scale.
 * @file
 */

/** @typedef {import('./types.js').Entity} Entity */
/** @typedef {import('./types.js').Finding} Finding */
/** @typedef {import('./types.js').ScoreResult} ScoreResult */
/** @typedef {import('./types.js').ScoreLabel} ScoreLabel */

import { LOCAL_BUSINESS_TYPES, RICH_RESULT_RULES } from './catalog/rich-results.js';

function matchingRules(entity) {
  return RICH_RESULT_RULES.filter((rule) => {
    return entity.types.includes(rule.type) || (rule.type === 'LocalBusiness' && entity.types.some((type) => LOCAL_BUSINESS_TYPES.has(type)));
  });
}

/**
 * @param {number} total
 * @returns {ScoreLabel}
 */
function labelFromTotal(total) {
  if (total >= 90) return 'excellent';
  if (total >= 70) return 'good';
  if (total >= 50) return 'fair';
  return 'poor';
}

/**
 * @param {Entity[]} entities
 * @returns {number}
 */
function coverageBonus(entities) {
  const qualifying = entities.filter((entity) => matchingRules(entity).length > 0);
  if (qualifying.length === 0) return 0;
  const formats = new Set(qualifying.map((entity) => entity.format));
  return Math.min(qualifying.length * 5 + formats.size * 5, 15);
}

/**
 * @param {Entity[]} entities
 * @returns {number}
 */
function richnessBonus(entities) {
  let bonus = 0;
  for (const entity of entities) {
    const meaningful = new Set(
      matchingRules(entity).flatMap((rule) => [...rule.required, ...rule.recommended]),
    );
    for (const property of meaningful) {
      if (property in entity.data) bonus += 1;
    }
  }
  return Math.min(bonus, 15);
}

/**
 * Compute schema quality score.
 * @param {Finding[]} findings
 * @param {Entity[]} entities
 * @returns {ScoreResult}
 */
export function score(findings, entities) {
  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  if (entities.length === 0) {
    return {
      total: 0,
      label: 'none',
      breakdown: { coverage: 0, validity: 0, richness: 0, agent: 0 },
      errorCount,
      warningCount,
    };
  }

  const qualifying = entities.some((entity) => matchingRules(entity).length > 0);
  const coverage = coverageBonus(entities);
  const richness = richnessBonus(entities);
  const baseValidity = qualifying ? 70 : 40;
  const validity = Math.max(0, baseValidity - errorCount * 12 - warningCount * 4);
  let total = validity + coverage + richness;

  total = Math.round(Math.max(0, Math.min(100, total)));

  return {
    total,
    label: labelFromTotal(total),
    breakdown: {
      coverage: Math.min(coverage, 15),
      validity,
      richness: Math.min(richness, 15),
      agent: 0,
    },
    errorCount,
    warningCount,
  };
}
