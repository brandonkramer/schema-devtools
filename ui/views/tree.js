import van from '../../vendor/van.js';
import { actions, refTarget, store } from '../store.js';

const { div, span, button } = van.tags;

export function EntityLink(entity, label) {
  return button(
    {
      type: 'button',
      class: 'tree-link',
      title: `Jump to ${entity.types.join(', ') || entity.id}`,
      onclick: (event) => {
        event.stopPropagation();
        actions.selectEntity(entity);
      },
    },
    span({ class: 'tree-link-icon' }, '↗'),
    ' ',
    label,
  );
}

export function Scalar(value, idMap) {
  if (value === null) return span({ class: 'dt-null' }, 'null');
  if (value === undefined) return span({ class: 'dt-null' }, 'undefined');
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return EntityLink(target, value);
    return span({ class: 'dt-string' }, `"${value}"`);
  }
  if (typeof value === 'number') return span({ class: 'dt-number' }, String(value));
  if (typeof value === 'boolean') return span({ class: 'dt-boolean' }, String(value));
  return span({ class: 'dt-value' }, JSON.stringify(value));
}

export function IdRef(value, idMap) {
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return EntityLink(target, value);
  }
  return Scalar(value, idMap);
}

export function previewObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const type = obj['@type'];
  const name = obj.name || obj.headline || obj.title;
  if (type && name) return `{ @type: "${type}", name: "${String(name).slice(0, 24)}" }`;
  if (type) return `{ @type: "${type}" }`;
  if (name) return `{ name: "${String(name).slice(0, 24)}" }`;
  const first = keys.slice(0, 3).map((k) => `${k}: …`).join(', ');
  return `{ ${first} }`;
}

export function TreeValue(value, idMap, path = 'root', entityId = '', depth = 0) {
  if (depth > 50) return span({ class: 'dt-dim' }, '… nested data omitted');
  if (value === null || typeof value !== 'object') {
    return Scalar(value, idMap);
  }

  const collapseKey = `${entityId}:${path}`;

  if (Array.isArray(value)) {
    if (value.length === 0) return span({ class: 'dt-dim' }, '[]');
    return div(
      { class: 'tree-branch' },
      span({
        class: () => `tree-caret ${store.collapsedPaths[collapseKey] ? 'collapsed' : 'expanded'}`,
        onclick: () => actions.toggleCollapse(collapseKey),
        title: 'Toggle expand/collapse',
      }),
      span(
        {
          class: 'dt-type-summary',
          onclick: () => actions.toggleCollapse(collapseKey),
        },
        `Array(${value.length})`,
        () => (store.collapsedPaths[collapseKey] ? span({ class: 'dt-preview' }, ' [...]') : ''),
      ),
      () =>
        store.collapsedPaths[collapseKey]
          ? ''
          : div(
              { class: 'tree-children' },
              value.map((item, index) => {
                const childPath = `${path}[${index}]`;
                return div(
                  { class: 'tree-node' },
                  span({ class: 'dt-index' }, `${index}:`),
                   TreeValue(item, idMap, childPath, entityId, depth + 1),
                );
              }),
            ),
    );
  }

  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj);
  if (keys.length === 0) return span({ class: 'dt-dim' }, '{}');
  if (keys.length === 1 && keys[0] === '@id') return IdRef(obj['@id'], idMap);

  return div(
    { class: 'tree-branch' },
    span({
      class: () => `tree-caret ${store.collapsedPaths[collapseKey] ? 'collapsed' : 'expanded'}`,
      onclick: () => actions.toggleCollapse(collapseKey),
      title: 'Toggle expand/collapse',
    }),
    span(
      {
        class: 'dt-type-summary',
        onclick: () => actions.toggleCollapse(collapseKey),
      },
      obj['@type'] ? String(obj['@type']) : 'Object',
      () => (store.collapsedPaths[collapseKey] ? span({ class: 'dt-preview' }, ` ${previewObject(obj)}`) : ''),
    ),
    () =>
      store.collapsedPaths[collapseKey]
        ? ''
        : div(
            { class: 'tree-children' },
            keys.map((key) => {
              const val = obj[key];
              const childPath = `${path}.${key}`;
              const target = val !== null && typeof val === 'object' ? refTarget(val, idMap) : null;
              const isSpecial = key.startsWith('@');
              const isNested = val !== null && typeof val === 'object';
              return div(
                { class: 'tree-node' },
                span({ class: `dt-key ${isSpecial ? 'dt-meta-key' : ''}` }, `${key}:`),
                key === '@id'
                  ? IdRef(val, idMap)
                  : target && !Array.isArray(val) && Object.keys(/** @type {object} */ (val)).length <= 2
                    ? EntityLink(target, String(/** @type {Record<string, unknown>} */ (val)['@id'] || target.id))
                    : isNested
                       ? TreeValue(val, idMap, childPath, entityId, depth + 1)
                      : Scalar(val, idMap),
              );
            }),
          ),
  );
}

export function TreeView(entity, idMap) {
  return div(
    { class: 'tree-root' },
    TreeValue(entity.data, idMap, 'root', entity.id),
  );
}
