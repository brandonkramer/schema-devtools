/**
 * Convenience analyze pipeline.
 * @file
 */

import { normalize } from './normalize.js';
import { validate } from './validate.js';
import { score } from './score.js';
import { buildAgentBundle } from './agent.js';

/** @typedef {import('./types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('./types.js').AnalyzeResult} AnalyzeResult */

/**
 * Run full analysis on a page snapshot.
 * @param {PageSnapshot} snapshot
 * @returns {AnalyzeResult}
 */
export function analyze(snapshot) {
  const { entities } = normalize(snapshot);
  const findings = validate(snapshot, entities);
  const scoreResult = score(findings, entities);
  const bundle = buildAgentBundle({
    snapshot,
    entities,
    findings,
    score: scoreResult,
  });

  return {
    snapshot,
    entities,
    findings,
    score: scoreResult,
    bundle,
  };
}
