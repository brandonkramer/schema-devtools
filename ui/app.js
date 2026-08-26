import van from '../vendor/van.js';
import { EntityListPane } from './components/entity-list.js';
import { Toolbar } from './components/toolbar.js';
import { actions, entityIdIndex, selectedEntity, store } from './store.js';
import { TreeView } from './views/tree.js';

const { div, span, p, button, main, section, footer } = van.tags;

const VIEWS = [
  ['tree', 'Tree'],
  ['raw', 'Raw JSON'],
  ['graph', 'Graph'],
  ['findings', 'Findings'],
  ['serp', 'SERP Preview'],
];

const loadedViews = { tree: { TreeView } };
const loadingViews = {};
const viewErrors = {};
const viewRevision = van.state(0);
let lazyViews;
const loadLazyViews = () => {
  lazyViews ||= import('./views/lazy.js').catch((error) => {
    lazyViews = null;
    throw error;
  });
  return lazyViews;
};
const viewLoaders = {
  raw: loadLazyViews,
  graph: loadLazyViews,
  findings: loadLazyViews,
  serp: loadLazyViews,
};

async function loadView(id) {
  if (loadedViews[id] || !viewLoaders[id]) return;
  if (!loadingViews[id]) {
    loadingViews[id] = viewLoaders[id]()
      .then((module) => {
        loadedViews[id] = module;
        delete viewErrors[id];
      })
      .catch((error) => {
        viewErrors[id] = error instanceof Error ? error.message : String(error);
        delete loadingViews[id];
      })
      .finally(() => {
        viewRevision.val++;
      });
  }
  await loadingViews[id];
}

function activateView(id) {
  store.activeView = id;
  void loadView(id);
}

function EmptyDetail(title, desc, icon = '🔍') {
  return div(
    { class: 'empty-box' },
    span({ class: 'empty-icon' }, icon),
    p({ class: 'empty-title' }, title),
    p({ class: 'empty-desc' }, desc),
  );
}

function Detail() {
  viewRevision.val;
  const activeView = store.activeView;
  const module = loadedViews[activeView];
  if (!module) {
    return EmptyDetail(
      viewErrors[activeView] ? 'Unable to load view' : 'Loading view',
      viewErrors[activeView] || 'Preparing this view…',
      viewErrors[activeView] ? '!' : '…',
    );
  }

  if (activeView === 'graph') return module.GraphView();
  if (activeView === 'findings') return module.FindingsList(true);
  if (activeView === 'serp') return module.SerpView();

  const entity = selectedEntity();
  if (!entity) {
    return EmptyDetail(
      'Select an entity to inspect',
      'Choose an entity from the left pane to view structured properties, raw JSON, or validation findings.',
    );
  }

  if (activeView === 'raw') return module.RawView(entity);
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
                onclick: () => activateView(id),
                onmouseenter: () => { void loadView(id); },
                onfocus: () => { void loadView(id); },
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
