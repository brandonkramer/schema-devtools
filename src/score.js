/**
 * Score findings and entities on a 0–100 scale.
 * @file
 */

/** @typedef {import('./types.js').Entity} Entity */
/** @typedef {import('./types.js').Finding} Finding */
/** @typedef {import('./types.js').ScoreResult} ScoreResult */
/** @typedef {import('./types.js').ScoreLabel} ScoreLabel */

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
  if (entities.length === 0) return 0;
  const formats = new Set(entities.map((e) => e.format));
  let bonus = Math.min(entities.length * 2, 10);
  bonus += formats.size * 3;
  const typed = entities.filter((e) => e.types.length > 0).length;
  bonus += Math.min(typed * 1, 5);
  return Math.min(bonus, 15);
}

/**
 * @param {Entity[]} entities
 * @returns {number}
 */
function richnessBonus(entities) {
  let bonus = 0;
  for (const entity of entities) {
    const propCount = Object.keys(entity.data).filter((k) => !k.startsWith('@')).length;
    bonus += Math.min(propCount, 5);
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

  const coverage = coverageBonus(entities);
  const richness = richnessBonus(entities);
  let total = 70;
  total += coverage;
  total += richness;
  total -= errorCount * 12;
  total -= warningCount * 4;

  const validity = Math.max(0, Math.min(40, 40 - errorCount * 8 - warningCount * 2));

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
