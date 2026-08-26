/**
 * Normalize page snapshot into flat entities.
 * @file
 */

/** @typedef {import('./types.js').PageSnapshot} PageSnapshot */
/** @typedef {import('./types.js').Entity} Entity */
/** @typedef {import('./types.js').NormalizedBlock} NormalizedBlock */
/** @typedef {import('./types.js').NormalizeResult} NormalizeResult */

const SCHEMA_PREFIX_RE = /^(?:https?:\/\/schema\.org\/|schema:)/i;

/**
 * Strip schema.org URI prefix from a type string.
 * @param {string} type
 * @returns {string}
 */
export function stripSchemaPrefix(type) {
  if (!type || typeof type !== 'string') return type;
  return type.replace(SCHEMA_PREFIX_RE, '');
}

/**
 * @param {unknown} typeField
 * @returns {string[]}
 */
function extractTypes(typeField) {
  if (!typeField) return [];
  const raw = Array.isArray(typeField) ? typeField : [typeField];
  const types = [];
  for (const t of raw) {
    if (typeof t === 'string') {
      const stripped = stripSchemaPrefix(t.trim());
      if (stripped) types.push(stripped);
    }
  }
  return types;
}

/**
 * @param {string} format
 * @param {number} sourceIndex
 * @param {string} basePath
 * @param {unknown} value
 * @param {Entity[]} entities
 * @param {string[]} entityIds
 */
/**
 * @param {string} format
 * @param {number} sourceIndex
 * @param {string} basePath
 * @param {unknown} value
 * @param {Entity[]} entities
 * @param {string[]} entityIds
 * @param {unknown} [inheritedContext]
 */
function flattenJsonValue(format, sourceIndex, basePath, value, entities, entityIds, inheritedContext, depth = 0) {
  if (depth > 50) return;
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      flattenJsonValue(format, sourceIndex, `${basePath}[${i}]`, item, entities, entityIds, inheritedContext, depth + 1);
    });
    return;
  }

  if (typeof value !== 'object') return;

  const obj = /** @type {Record<string, unknown>} */ (value);
  const context = obj['@context'] !== undefined ? obj['@context'] : inheritedContext;
  const graph = obj['@graph'];

  if (graph !== undefined) {
    flattenJsonValue(format, sourceIndex, `${basePath}/@graph`, graph, entities, entityIds, context, depth + 1);
    const restKeys = Object.keys(obj).filter((k) => k !== '@graph');
    const hasEntityData = restKeys.some((k) => k !== '@context' && k !== '@id');
    if (hasEntityData) {
      const rest = { ...obj };
      delete rest['@graph'];
      if (rest['@context'] === undefined && context !== undefined) rest['@context'] = context;
      addEntity(format, sourceIndex, basePath, rest, entities, entityIds);
    }
    return;
  }

  const data = context !== undefined && obj['@context'] === undefined
    ? { '@context': context, ...obj }
    : obj;
  addEntity(format, sourceIndex, basePath, data, entities, entityIds);
}

/**
 * @param {string} format
 * @param {number} sourceIndex
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @param {Entity[]} entities
 * @param {string[]} entityIds
 */
function addEntity(format, sourceIndex, path, data, entities, entityIds) {
  if (entities.length >= 1000) return;
  const types = extractTypes(data['@type']);
  const idField = data['@id'];
  const preferredId = typeof idField === 'string' && idField
    ? idField
    : `${format}:${sourceIndex}:${path}`;
  const id = uniqueEntityId(preferredId, entities);

  const entity = {
    id,
    types,
    format,
    sourceIndex,
    data,
    path,
  };
  entities.push(entity);
  entityIds.push(id);
}

/**
 * @param {string} preferredId
 * @param {Entity[]} entities
 */
function uniqueEntityId(preferredId, entities) {
  if (!entities.some((entity) => entity.id === preferredId)) return preferredId;
  let duplicate = 2;
  while (entities.some((entity) => entity.id === `${preferredId}#duplicate-${duplicate}`)) {
    duplicate++;
  }
  return `${preferredId}#duplicate-${duplicate}`;
}

/**
 * @param {import('./types.js').MarkupNode} node
 * @param {number} sourceIndex
 * @param {Entity[]} entities
 * @param {string[]} entityIds
 */
function normalizeMarkupValue(value, depth = 0) {
  if (depth > 50 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => normalizeMarkupValue(item, depth + 1));
  if (typeof value !== 'object') return value;

  const obj = /** @type {Record<string, unknown>} */ (value);
  if (
    (obj.format === 'microdata' || obj.format === 'rdfa') &&
    'type' in obj &&
    obj.properties &&
    typeof obj.properties === 'object'
  ) {
    const typeField = obj.type;
    const types = Array.isArray(typeField)
      ? typeField.map((type) => stripSchemaPrefix(String(type))).filter(Boolean)
      : typeof typeField === 'string'
        ? typeField.split(/\s+/).map((type) => stripSchemaPrefix(type)).filter(Boolean)
        : [];
    const data = {};
    for (const [property, child] of Object.entries(/** @type {Record<string, unknown>} */ (obj.properties))) {
      data[stripSchemaPrefix(property)] = normalizeMarkupValue(child, depth + 1);
    }
    if (types.length) data['@type'] = types.length === 1 ? types[0] : types;
    return data;
  }

  const normalized = {};
  for (const [key, child] of Object.entries(obj)) {
    normalized[key] = normalizeMarkupValue(child, depth + 1);
  }
  return normalized;
}

function normalizeMarkupNode(node, sourceIndex, entities, entityIds) {
  const normalizedNode = /** @type {Record<string, unknown>} */ (normalizeMarkupValue(node));
  const typeField = normalizedNode['@type'];
  let types;
  if (Array.isArray(typeField)) {
    types = typeField.map((t) => stripSchemaPrefix(String(t)));
  } else if (typeof typeField === 'string') {
    types = typeField.split(/\s+/).map((t) => stripSchemaPrefix(t)).filter(Boolean);
  } else {
    types = [];
  }

  const data = normalizedNode;

  const idField = data['@id'];
  const preferredId = typeof idField === 'string' && idField
    ? idField
    : `${node.format}:${sourceIndex}`;
  const id = uniqueEntityId(preferredId, entities);
  const entity = {
    id,
    types,
    format: node.format,
    sourceIndex,
    data,
    path: node.selector,
  };
  entities.push(entity);
  entityIds.push(id);
}

/**
 * Flatten snapshot markup into entities and source blocks.
 * @param {PageSnapshot} snapshot
 * @returns {NormalizeResult}
 */
export function normalize(snapshot) {
  /** @type {NormalizedBlock[]} */
  const blocks = [];
  /** @type {Entity[]} */
  const entities = [];

  for (const block of snapshot.jsonld) {
    const entityIds = [];
    if (block.parsed !== null && typeof block.parsed === 'object') {
      flattenJsonValue('jsonld', block.index, '$', block.parsed, entities, entityIds);
    }
    blocks.push({
      format: 'jsonld',
      sourceIndex: block.index,
      selector: block.selector,
      entityIds,
    });
  }

  snapshot.microdata.forEach((node, i) => {
    const entityIds = [];
    normalizeMarkupNode(node, i, entities, entityIds);
    blocks.push({
      format: 'microdata',
      sourceIndex: i,
      selector: node.selector,
      entityIds,
    });
  });

  snapshot.rdfa.forEach((node, i) => {
    const entityIds = [];
    normalizeMarkupNode(node, i, entities, entityIds);
    blocks.push({
      format: 'rdfa',
      sourceIndex: i,
      selector: node.selector,
      entityIds,
    });
  });

  return { blocks, entities };
}
