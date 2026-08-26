import van from '../vendor/van.js';
import { EntityListPane } from './components/entity-list.js';
import { Toolbar } from './components/toolbar.js';
import { actions, entityIdIndex, selectedEntity, store } from './store.js';
import { FindingsList } from './views/findings.js';
import { GraphView } from './views/graph.js';
import { RawView } from './views/raw.js';
import { SerpView } from './views/serp.js';
import { TreeView } from './views/tree.js';

const { div, span, p, button, main, section, footer } = van.tags;

const VIEWS = [
  ['tree', 'Tree'],
  ['raw', 'Raw JSON'],
  ['graph', 'Graph'],
  ['findings', 'Findings'],
  ['serp', 'SERP Preview'],
];

function EmptyDetail(title, desc, icon = '🔍') {
  return div(
    { class: 'empty-box' },
    span({ class: 'empty-icon' }, icon),
    p({ class: 'empty-title' }, title),
    p({ class: 'empty-desc' }, desc),
  );
}

function Detail() {
  if (store.activeView === 'graph') return GraphView();
  if (store.activeView === 'findings') return FindingsList(true);
  if (store.activeView === 'serp') return SerpView();

  const entity = selectedEntity();
  if (!entity) {
    return EmptyDetail(
      'Select an entity to inspect',
      'Choose an entity from the left pane to view structured properties, raw JSON, or validation findings.',
    );
  }

  if (store.activeView === 'raw') return RawView(entity);
  return TreeView(entity, entityIdIndex());
}

export const PanelApp = () => {
  return div(
    {
      class: () => `app theme-${store.theme}`,
      'data-theme': () => store.theme,
      onclick: () => actions.closeExportMenu(),
    },
    Toolbar(),
    main(
      { class: 'main' },
      EntityListPane(),
      section(
        { class: 'pane detail-pane' },
        div(
          { class: 'view-tabs' },
          VIEWS.map(([id, label]) =>
            button(
              {
                type: 'button',
                class: () => `tab ${store.activeView === id ? 'active' : ''}`,
                onclick: () => {
                  store.activeView = id;
                },
              },
              label,
              () => {
                if (id !== 'findings') return '';
                const count = store.findings.length;
                if (count === 0) return '';
                const hasError = store.findings.some((f) => f.severity === 'error');
                const hasWarning = store.findings.some((f) => f.severity === 'warning');
                const kind = hasError ? 'error' : hasWarning ? 'warning' : 'info';
                return span({ class: `tab-badge tab-badge-${kind}` }, count);
              },
            ),
          ),
        ),
        div(
          { class: 'view-content' },
          () => {
            // Read snapshotUrl so URL change mounts fresh views
            const _url = store.snapshotUrl;
            return Detail();
          },
        ),
      ),
    ),
    footer(
      {
        class: () => `status-bar ${store.statusError ? 'status-error' : ''}`,
        role: 'status',
      },
      span({ class: 'status-dot' }, '●'),
      span({ class: 'status-text' }, () => store.status || 'Ready'),
      span({ class: 'status-meta' }, () => (store.snapshotUrl ? store.snapshotUrl : '')),
    ),
  );
};

export function mountPanel(root) {
  root.replaceChildren();
  van.add(root, PanelApp());
}
