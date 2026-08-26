import van from '../../vendor/van.js';
import { actions, entityLabel, store, visibleEntities } from '../store.js';

const { div, span, p, section, ul, li } = van.tags;

export function EntityListPane() {
  return section(
    { class: 'pane entities-pane' },
    div(
      { class: 'pane-header' },
      span({ class: 'pane-title' }, 'Entities'),
      span({ class: 'pill-badge' }, () => store.entities.length),
    ),
    () => {
      const entities = visibleEntities();
      if (store.entities.length === 0) {
        return p({ class: 'empty-list' }, 'No structured data entities found on this page.');
      }
      if (entities.length === 0) {
        return p({ class: 'empty-list' }, `No entities match "${store.query}".`);
      }
      return ul(
        { class: 'entity-list' },
        entities.map((entity) => {
          const label = entityLabel(entity);
          return li(
            {
              class: () => `entity-item ${store.selectedEntityId === entity.id ? 'selected' : ''}`,
              title: 'Click to select · Alt-click to inspect in Elements',
              onclick: (event) => actions.selectEntity(entity, { inspect: event.altKey }),
              onmouseenter: () => actions.highlightEntity(entity),
            },
            div(
              { class: 'entity-row-top' },
              span({ class: 'entity-type' }, entity.types.join(', ') || 'Unknown'),
              span({ class: `format-chip format-${entity.format}` }, entity.format),
            ),
            label ? div({ class: 'entity-label', title: label }, label) : '',
          );
        }),
      );
    },
  );
}
