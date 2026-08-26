import van from '../../vendor/van.js';
import { actions, buildEntityGraph, entityLabel, store } from '../store.js';

const { div, span, p, button, strong } = van.tags;

export function GraphView() {
  const graph = buildEntityGraph();
  if (graph.nodes.length === 0) {
    return div(
      { class: 'empty-box' },
      span({ class: 'empty-icon' }, '🕸️'),
      p({ class: 'empty-title' }, 'No Entities to Graph'),
      p({ class: 'empty-desc' }, 'No structured data entities were found on this page.'),
    );
  }
  return div(
    { class: 'graph-container' },
    div(
      { class: 'graph-header' },
      span({ class: 'graph-stat' }, strong(graph.nodes.length), ' Entities'),
      span({ class: 'graph-stat' }, strong(graph.edges.length), ' Relationships'),
      span({ class: 'graph-stat' }, strong(graph.orphaned.length), ' Isolated'),
    ),
    graph.edges.length > 0
      ? div(
          { class: 'graph-section' },
          div({ class: 'graph-section-title' }, 'Connected Entity Relationships'),
          div(
            { class: 'graph-edges-list' },
            graph.edges.map((edge) =>
              div(
                { class: 'graph-edge-card' },
                button(
                  {
                    type: 'button',
                    class: () => `graph-node-btn ${store.selectedEntityId === edge.source.id ? 'active' : ''}`,
                    onclick: () => actions.selectEntity(edge.source),
                  },
                  span({ class: 'graph-node-type' }, edge.source.types.join(', ') || 'Entity'),
                  span({ class: 'graph-node-name' }, entityLabel(edge.source)),
                ),
                div(
                  { class: 'graph-edge-arrow' },
                  span({ class: 'graph-edge-label' }, edge.relation),
                  span({ class: 'graph-arrow-icon' }, '──▶'),
                ),
                button(
                  {
                    type: 'button',
                    class: () => `graph-node-btn ${store.selectedEntityId === edge.target.id ? 'active' : ''}`,
                    onclick: () => actions.selectEntity(edge.target),
                  },
                  span({ class: 'graph-node-type' }, edge.target.types.join(', ') || 'Entity'),
                  span({ class: 'graph-node-name' }, entityLabel(edge.target)),
                ),
              ),
            ),
          ),
        )
      : '',
    div(
      { class: 'graph-section' },
      div({ class: 'graph-section-title' }, 'All Entity Nodes'),
      div(
        { class: 'graph-nodes-grid' },
        graph.nodes.map((node) => {
          const isOrphan = graph.orphaned.some((o) => o.id === node.id);
          return div(
            {
              class: () => `graph-card ${store.selectedEntityId === node.id ? 'selected' : ''} ${isOrphan ? 'orphan' : ''}`,
              onclick: () => actions.selectEntity(node),
            },
            div(
              { class: 'graph-card-header' },
              span({ class: 'entity-type' }, node.types.join(', ') || 'Unknown'),
              span({ class: `format-chip format-${node.format}` }, node.format),
            ),
            div({ class: 'graph-card-label' }, entityLabel(node)),
            isOrphan ? span({ class: 'orphan-tag' }, 'Standalone') : '',
          );
        }),
      ),
    ),
  );
}
