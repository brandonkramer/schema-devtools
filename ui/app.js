import van from '../vendor/van.js';
import {
  actions,
  buildEntityGraph,
  entityIdIndex,
  entityLabel,
  geoReadiness,
  refTarget,
  selectedEntity,
  serpCards,
  store,
  visibleEntities,
  visibleFindings,
} from './store.js';

const {
  div,
  span,
  p,
  button,
  input,
  textarea,
  a,
  header,
  main,
  section,
  ul,
  li,
  article,
  img,
  pre,
  small,
  strong,
  footer,
} = van.tags;

const VIEWS = [
  ['tree', 'Tree'],
  ['raw', 'Raw JSON'],
  ['findings', 'Findings'],
  ['serp', 'SERP Preview'],
  ['graph', 'Graph'],
];

function scoreLabel() {
  if (store.fatal) return 'Error';
  return store.score?.label || 'No data';
}

function EntityLink(entity, label) {
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

function Scalar(value, idMap) {
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

function IdRef(value, idMap) {
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return EntityLink(target, value);
  }
  return Scalar(value, idMap);
}

function previewObject(obj) {
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

function TreeValue(value, idMap, path = 'root', entityId = '') {
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
        () => (store.collapsedPaths[collapseKey] ? span({ class: 'dt-preview' }, ' [...]') : null),
      ),
      () =>
        store.collapsedPaths[collapseKey]
          ? null
          : div(
              { class: 'tree-children' },
              value.map((item, index) => {
                const childPath = `${path}[${index}]`;
                return div(
                  { class: 'tree-node' },
                  span({ class: 'dt-index' }, `${index}:`),
                  TreeValue(item, idMap, childPath, entityId),
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
      () => (store.collapsedPaths[collapseKey] ? span({ class: 'dt-preview' }, ` ${previewObject(obj)}`) : null),
    ),
    () =>
      store.collapsedPaths[collapseKey]
        ? null
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
                      ? TreeValue(val, idMap, childPath, entityId)
                      : Scalar(val, idMap),
              );
            }),
          ),
  );
}

function SeverityIcon(severity) {
  const kind = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  return span({ class: `sev sev-${kind}`, title: kind, 'aria-hidden': 'true' });
}

function FindingsList(all) {
  return div(
    { class: 'findings-container' },
    () => {
      const findings = visibleFindings(all);
      if (findings.length === 0) {
        return div(
          { class: 'empty-box' },
          span({ class: 'empty-icon' }, '✓'),
          p({ class: 'empty-title' }, store.findings.length ? 'No findings match this filter.' : 'All schema validations passed!'),
          p({ class: 'empty-desc' }, store.findings.length ? 'Try clearing your search query.' : 'No errors or warnings detected on this page.'),
        );
      }
      return ul(
        { class: 'findings' },
        findings.map((finding) =>
          li(
            { class: `finding severity-${finding.severity}` },
            SeverityIcon(finding.severity),
            div(
              { class: 'finding-body' },
              div(
                { class: 'finding-header' },
                span({ class: 'finding-code' }, finding.code),
                finding.path ? span({ class: 'finding-path' }, finding.path) : null,
              ),
              div({ class: 'finding-message' }, finding.message),
              finding.docsUrl && /^https?:\/\//i.test(finding.docsUrl)
                ? a({ class: 'finding-docs', href: finding.docsUrl, target: '_blank', rel: 'noopener' }, 'Official Documentation ↗')
                : null,
            ),
          ),
        ),
      );
    },
  );
}

function GraphView() {
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
      : null,
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
            isOrphan ? span({ class: 'orphan-tag' }, 'Standalone') : null,
          );
        }),
      ),
    ),
  );
}

function Detail() {
  if (store.activeView === 'graph') return GraphView();
  if (store.activeView === 'findings') return FindingsList(true);
  if (store.activeView === 'serp') {
    const cards = serpCards();
    if (cards.length === 0) {
      return div(
        { class: 'empty-box' },
        span({ class: 'empty-icon' }, '🌐'),
        p({ class: 'empty-title' }, 'No SERP Preview Available'),
        p({ class: 'empty-desc' }, 'SERP simulation is available for Product, Article, Recipe, Breadcrumb, Event, Job, ProfilePage, and LocalBusiness entities.'),
      );
    }
    return div(
      { class: 'serp-container' },
      div({ class: 'serp-disclaimer' }, span('ℹ️ Simulated Google Search Preview (Non-authoritative representation of rich snippet rendering)')),
      cards.map((card) =>
        article(
          { class: 'serp-card' },
          div(
            { class: 'serp-card-top' },
            div(
              { class: 'serp-cite-row' },
              span({ class: 'serp-kind-badge' }, card.kind),
              span({ class: 'serp-cite' }, card.cite),
            ),
            button({ type: 'button', class: 'serp-title', onclick: () => actions.selectEntity(card.entity) }, card.title),
          ),
          div(
            { class: 'serp-card-body' },
            card.image ? img({ class: 'serp-thumb', alt: '', src: card.image, loading: 'lazy' }) : null,
            div(
              { class: 'serp-snippet-wrap' },
              card.meta ? div({ class: 'serp-meta' }, card.meta) : null,
              div({ class: 'serp-snippet' }, card.snippet),
            ),
          ),
        ),
      ),
    );
  }

  const entity = selectedEntity();
  if (!entity) {
    return div(
      { class: 'empty-box' },
      span({ class: 'empty-icon' }, '🔍'),
      p({ class: 'empty-title' }, 'Select an entity to inspect'),
      p({ class: 'empty-desc' }, 'Choose an entity from the left pane to view structured properties, raw JSON, or validation findings.'),
    );
  }
  if (store.activeView === 'raw') {
    return div(
      { class: 'raw-wrapper' },
      div(
        { class: 'raw-toolbar' },
        button(
          {
            type: 'button',
            class: () => `tb-btn ${store.sandboxOpen ? 'tb-btn-primary' : ''}`,
            onclick: () => {
              if (store.sandboxOpen) actions.closeSandbox();
              else actions.openSandbox(entity);
            },
          },
          () => (store.sandboxOpen ? '✕ Close Editor' : '✏️ Edit & Test Fixes'),
        ),
        () =>
          store.sandboxOpen
            ? [
                button({ type: 'button', class: 'tb-btn', onclick: () => actions.resetSandbox(entity) }, '↩️ Reset'),
                button({ type: 'button', class: 'tb-btn tb-btn-primary', onclick: () => actions.copyJson() }, '📋 Copy Fixed JSON'),
              ]
            : button({ type: 'button', class: 'tb-btn', onclick: () => actions.copyJson() }, '📋 Copy Raw'),
      ),
      () =>
        store.sandboxOpen
          ? div(
              { class: 'sandbox-container' },
              div(
                { class: () => `sandbox-status-bar ${store.sandboxStatus.valid ? 'status-valid' : 'status-invalid'}` },
                span(() => (store.sandboxStatus.valid ? '✓' : '⚠')),
                span(() => store.sandboxStatus.message),
              ),
              textarea({
                class: 'sandbox-textarea',
                spellcheck: false,
                rows: 20,
                value: () => store.sandboxText,
                oninput: (e) => {
                  store.sandboxText = e.target.value;
                  actions.validateSandbox();
                },
              }),
            )
          : pre({ class: 'raw' }, JSON.stringify(entity.data, null, 2)),
    );
  }

  return div(
    { class: 'tree-root' },
    TreeValue(entity.data, entityIdIndex(), 'root', entity.id),
  );
}

export const PanelApp = () => {
  return div(
    {
      class: () => `app theme-${store.theme}`,
      'data-theme': () => store.theme,
      onclick: () => actions.closeExportMenu(),
    },
    header(
      { class: 'toolbar' },
      div(
        {
          class: 'score-card',
          title: () => `Quality Score: ${store.score?.total ?? '—'}/100 (${scoreLabel()})`,
        },
        div(
          {
            class: () => `score-ring label-${store.score?.label || 'none'}`,
            style: () => `--score:${store.score?.total ?? 0}`,
          },
          span({ class: 'score-val' }, () => (store.score ? String(store.score.total) : '—')),
        ),
        div(
          { class: 'score-details' },
          div({ class: 'score-title-row' }, span({ class: 'score-grade' }, () => scoreLabel())),
          div(
            { class: 'score-badges' },
            span({ class: 'badge-err' }, () => `${store.score?.errorCount ?? 0} errors`),
            span({ class: 'badge-warn' }, () => `${store.score?.warningCount ?? 0} warnings`),
          ),
        ),
      ),
      div({ class: 'toolbar-divider' }),
      div(
        { class: 'action-group' },
        button(
          {
            type: 'button',
            class: 'tb-btn tb-btn-primary',
            title: 'Re-analyze inspected page',
            onclick: (e) => {
              e.stopPropagation();
              actions.refresh();
            },
          },
          span({ class: 'tb-icon' }, '↻'),
          ' Refresh',
        ),
        button(
          {
            type: 'button',
            class: 'tb-btn',
            id: 'btn-inspect',
            title: 'Reveal source node in Elements panel',
            onclick: (e) => {
              e.stopPropagation();
              actions.inspectSelected();
            },
          },
          span({ class: 'tb-icon' }, '🎯'),
          ' Inspect in Elements',
        ),
        div(
          {
            class: 'dropdown-wrap',
            onclick: (e) => e.stopPropagation(),
          },
          button(
            {
              type: 'button',
              class: () => `tb-btn tb-btn-dropdown ${store.exportMenuOpen ? 'active' : ''}`,
              onclick: () => actions.toggleExportMenu(),
              title: 'Export schema or agent bundles',
            },
            span({ class: 'tb-icon' }, '📋'),
            ' Export ',
            span({ class: 'caret' }, '▾'),
          ),
          () =>
            store.exportMenuOpen
              ? div(
                  { class: 'dropdown-menu' },
                  button(
                    {
                      type: 'button',
                      class: 'menu-item',
                      onclick: () => {
                        actions.copyJson();
                        actions.closeExportMenu();
                      },
                    },
                    span('Copy JSON'),
                    small('Selected entity'),
                  ),
                  button(
                    {
                      type: 'button',
                      class: 'menu-item',
                      onclick: () => {
                        actions.copyScript();
                        actions.closeExportMenu();
                      },
                    },
                    span('Copy <script> Tag'),
                    small('JSON-LD'),
                  ),
                  div({ class: 'menu-sep' }),
                  button(
                    {
                      type: 'button',
                      class: 'menu-item',
                      onclick: () => {
                        actions.copyBundle();
                        actions.closeExportMenu();
                      },
                    },
                    span('Copy Agent Bundle'),
                    small('AI JSON'),
                  ),
                  button(
                    {
                      type: 'button',
                      class: 'menu-item',
                      onclick: () => {
                        actions.copyMarkdown();
                        actions.closeExportMenu();
                      },
                    },
                    span('Copy Agent Markdown'),
                    small('Prompt ready'),
                  ),
                  button(
                    {
                      type: 'button',
                      class: 'menu-item',
                      onclick: () => {
                        actions.copyAiPrompt();
                        actions.closeExportMenu();
                      },
                    },
                    span('Copy for AI Prompt'),
                    small('LLM / RAG prompt'),
                  ),
                  div({ class: 'menu-sep' }),
                  button(
                    {
                      type: 'button',
                      class: 'menu-item',
                      onclick: () => {
                        actions.downloadJson();
                        actions.closeExportMenu();
                      },
                    },
                    span('Download Report (.json)'),
                  ),
                )
              : null,
        ),
      ),
      div(
        { class: 'search-wrap' },
        span({ class: 'search-icon' }, '🔍'),
        input({
          type: 'search',
          class: 'tb-search',
          placeholder: 'Filter entities, properties, findings…',
          autocomplete: 'off',
          spellcheck: false,
          value: () => store.query,
          oninput: (e) => {
            store.query = e.target.value;
          },
        }),
        () =>
          store.query
            ? button(
                {
                  type: 'button',
                  class: 'search-clear',
                  title: 'Clear filter',
                  onclick: () => {
                    store.query = '';
                  },
                },
                '✕',
              )
            : null,
      ),
      div(
        { class: 'external-group' },
        button(
          {
            type: 'button',
            class: 'tb-btn tb-btn-link',
            title: 'Open current page in Google Rich Results Test',
            onclick: (e) => {
              e.stopPropagation();
              actions.openRichResults();
            },
          },
          'Google Rich Results ↗',
        ),
        button(
          {
            type: 'button',
            class: 'tb-btn tb-btn-link',
            title: 'Open current page in Schema.org Validator',
            onclick: (e) => {
              e.stopPropagation();
              actions.openSchemaValidator();
            },
          },
          'Schema.org ↗',
        ),
      ),
    ),
    main(
      { class: 'main' },
      section(
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
                label ? div({ class: 'entity-label', title: label }, label) : null,
              );
            }),
          );
        },
      ),
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
                if (id !== 'findings') return null;
                const count = store.findings.length;
                if (count === 0) return null;
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
            // Read snapshotUrl to ensure full re-render on navigation
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
