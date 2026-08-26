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
function flattenJsonValue(format, sourceIndex, basePath, value, entities, entityIds, inheritedContext) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      flattenJsonValue(format, sourceIndex, `${basePath}[${i}]`, item, entities, entityIds, inheritedContext);
    });
    return;
  }

  if (typeof value !== 'object') return;

  const obj = /** @type {Record<string, unknown>} */ (value);
  const context = obj['@context'] !== undefined ? obj['@context'] : inheritedContext;
  const graph = obj['@graph'];

  if (graph !== undefined) {
    flattenJsonValue(format, sourceIndex, `${basePath}/@graph`, graph, entities, entityIds, context);
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
function normalizeMarkupNode(node, sourceIndex, entities, entityIds) {
  const typeField = node.type;
  let types;
  if (Array.isArray(typeField)) {
    types = typeField.map((t) => stripSchemaPrefix(String(t)));
  } else if (typeof typeField === 'string') {
    types = typeField.split(/\s+/).map((t) => stripSchemaPrefix(t)).filter(Boolean);
  } else {
    types = [];
  }

  /** @type {Record<string, unknown>} */
  const data = {};
  for (const [property, value] of Object.entries(node.properties)) {
    const normalizedProperty = stripSchemaPrefix(property);
    if (data[normalizedProperty] === undefined) {
      data[normalizedProperty] = value;
    } else if (Array.isArray(data[normalizedProperty])) {
      /** @type {unknown[]} */ (data[normalizedProperty]).push(value);
    } else {
      data[normalizedProperty] = [data[normalizedProperty], value];
    }
  }
  if (types.length) data['@type'] = types.length === 1 ? types[0] : types;

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
