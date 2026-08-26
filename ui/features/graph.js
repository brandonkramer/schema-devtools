import { entityIdIndex, refTarget, store } from '../store.js';

/** Build graph edges and relationship links across entities. */
export function buildEntityGraph() {
  const idMap = entityIdIndex();
  const edges = [];
  const connectedIds = new Set();
  const relationProperties = [
    'author', 'publisher', 'creator', 'brand', 'itemReviewed', 'hasVariant',
    'parentOrganization', 'subOrganization', 'provider', 'isPartOf', 'mainEntity',
    'organizer', 'performer', 'about', 'subjectOf', 'location', 'seller',
    'hiringOrganization', 'alumniOf', 'memberOf', 'worksFor', 'owns', 'knows',
  ];

  for (const source of store.entities) {
    for (const property of relationProperties) {
      const value = source.data[property];
      if (!value) continue;
      const targets = Array.isArray(value) ? value : [value];
      for (const target of targets) {
        const matched = refTarget(target, idMap);
        if (matched && matched.id !== source.id) {
          edges.push({ source, target: matched, relation: property });
          connectedIds.add(source.id);
          connectedIds.add(matched.id);
        }
      }
    }
  }

  return {
    nodes: store.entities,
    edges,
    orphaned: store.entities.filter((entity) => !connectedIds.has(entity.id)),
    connectedCount: connectedIds.size,
  };
}
