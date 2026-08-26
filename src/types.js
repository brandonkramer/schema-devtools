/**
 * @file JSDoc typedefs for Schema DevTools engine.
 */

/** @typedef {"error"|"warning"|"info"} Severity */

/** @typedef {object} JsonLdBlock
 * @property {number} index
 * @property {string} raw
 * @property {unknown|null} parsed
 * @property {{message: string, line?: number, column?: number}|null} parseError
 * @property {string} selector
 * @property {number} [domIndex]
 */

/** @typedef {object} MarkupNode
 * @property {string} format
 * @property {string|string[]} type
 * @property {Record<string, unknown>} properties
 * @property {string} selector
 */

/** @typedef {object} AgentSurface
 * @property {boolean} hasModelContext
 * @property {object|null} modelContext
 * @property {boolean} hasLlmsTxtLink
 */

/** @typedef {object} PageSnapshot
 * @property {string} url
 * @property {string} title
 * @property {string|null} canonical
 * @property {string|null} robots
 * @property {string} inspectedAt
 * @property {JsonLdBlock[]} jsonld
 * @property {MarkupNode[]} microdata
 * @property {MarkupNode[]} rdfa
 * @property {AgentSurface} agent
 */

/** @typedef {object} Entity
 * @property {string} id
 * @property {string[]} types
 * @property {string} format
 * @property {number} sourceIndex
 * @property {Record<string, unknown>} data
 * @property {string} path
 */

/** @typedef {object} NormalizedBlock
 * @property {string} format
 * @property {number} sourceIndex
 * @property {string} selector
 * @property {string[]} entityIds
 */

/** @typedef {object} NormalizeResult
 * @property {NormalizedBlock[]} blocks
 * @property {Entity[]} entities
 */

/** @typedef {object} Finding
 * @property {Severity} severity
 * @property {string} code
 * @property {string} message
 * @property {string} [entityId]
 * @property {string} [path]
 * @property {string} [docsUrl]
 */

/** @typedef {"excellent"|"good"|"fair"|"poor"|"none"} ScoreLabel */

/** @typedef {object} ScoreBreakdown
 * @property {number} coverage
 * @property {number} validity
 * @property {number} richness
 * @property {number} agent
 */

/** @typedef {object} ScoreResult
 * @property {number} total
 * @property {ScoreLabel} label
 * @property {ScoreBreakdown} breakdown
 * @property {number} errorCount
 * @property {number} warningCount
 */

/** @typedef {object} AgentBundleSummary
 * @property {number} jsonld
 * @property {number} microdata
 * @property {number} rdfa
 * @property {number} entities
 * @property {number} errors
 * @property {number} warnings
 */

/** @typedef {object} AgentBundle
 * @property {number} version
 * @property {string} tool
 * @property {string} url
 * @property {string} title
 * @property {string|null} canonical
 * @property {string} inspectedAt
 * @property {ScoreResult} score
 * @property {AgentBundleSummary} summary
 * @property {Entity[]} entities
 * @property {Finding[]} findings
 * @property {AgentSurface} agent
 */

/** @typedef {object} AnalyzeResult
 * @property {PageSnapshot} snapshot
 * @property {Entity[]} entities
 * @property {Finding[]} findings
 * @property {ScoreResult} score
 * @property {AgentBundle} bundle
 */

/** @typedef {object} TypeRule
 * @property {string} type
 * @property {string[]} required  Property paths required together, e.g. offers.price
 * @property {string[]} recommended
 * @property {string[][]} [anyOf]  Alternative property-path groups; one path per group is required
 * @property {string} docsUrl
 */

export {};
