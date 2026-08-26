import { html } from '../vendor/arrow.js';
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
  return html`
    <button
      type="button"
      class="tree-link"
      title="${`Jump to ${entity.types.join(', ') || entity.id}`}"
      @click="${(event) => {
        event.stopPropagation();
        actions.selectEntity(entity);
      }}"
    ><span class="tree-link-icon">↗</span> ${label}</button>
  `;
}

function Scalar(value, idMap) {
  if (value === null) return html`<span class="dt-null">null</span>`;
  if (value === undefined) return html`<span class="dt-null">undefined</span>`;
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return EntityLink(target, value);
    return html`<span class="dt-string">${() => `"${value}"`}</span>`;
  }
  if (typeof value === 'number') {
    return html`<span class="dt-number">${() => String(value)}</span>`;
  }
  if (typeof value === 'boolean') {
    return html`<span class="dt-boolean">${() => String(value)}</span>`;
  }
  return html`<span class="dt-value">${() => JSON.stringify(value)}</span>`;
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
  const isCollapsed = Boolean(store.collapsedPaths[collapseKey]);

  if (Array.isArray(value)) {
    if (value.length === 0) return html`<span class="dt-dim">[]</span>`;
    return html`
      <div class="tree-branch">
        <span
          class="${() => `tree-caret ${isCollapsed ? 'collapsed' : 'expanded'}`}"
          @click="${() => actions.toggleCollapse(collapseKey)}"
          title="Toggle expand/collapse"
        ></span>
        <span class="dt-type-summary" @click="${() => actions.toggleCollapse(collapseKey)}">
          ${() => `Array(${value.length})`}
          ${() => (isCollapsed ? html`<span class="dt-preview"> [...]</span>` : '')}
        </span>
        ${() =>
          isCollapsed
            ? ''
            : html`
              <div class="tree-children">
                ${() =>
                  value.map((item, index) => {
                    const childPath = `${path}[${index}]`;
                    const itemKey = `${entityId}:${childPath}`;
                    return html`
                      <div class="tree-node">
                        <span class="dt-index">${() => `${index}:`}</span>
                        ${() => TreeValue(item, idMap, childPath, entityId)}
                      </div>
                    `.key(itemKey);
                  })}
              </div>
            `}
      </div>
    `;
  }

  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj);
  if (keys.length === 0) return html`<span class="dt-dim">{}</span>`;
  if (keys.length === 1 && keys[0] === '@id') return IdRef(obj['@id'], idMap);

  return html`
    <div class="tree-branch">
      <span
        class="${() => `tree-caret ${isCollapsed ? 'collapsed' : 'expanded'}`}"
        @click="${() => actions.toggleCollapse(collapseKey)}"
        title="Toggle expand/collapse"
      ></span>
      <span class="dt-type-summary" @click="${() => actions.toggleCollapse(collapseKey)}">
        ${() => (obj['@type'] ? String(obj['@type']) : 'Object')}
        ${() => (isCollapsed ? html`<span class="dt-preview"> ${previewObject(obj)}</span>` : '')}
      </span>
      ${() =>
        isCollapsed
          ? ''
          : html`
            <div class="tree-children">
              ${() =>
                keys.map((key) => {
                  const val = obj[key];
                  const childPath = `${path}.${key}`;
                  const itemKey = `${entityId}:${childPath}`;
                  const target = val !== null && typeof val === 'object' ? refTarget(val, idMap) : null;
                  const isSpecial = key.startsWith('@');
                  const isNested = val !== null && typeof val === 'object';
                  return html`
                    <div class="tree-node">
                      <span class="${() => `dt-key ${isSpecial ? 'dt-meta-key' : ''}`}">
                        ${() => `${key}:`}
                      </span>
                      ${() =>
                        key === '@id'
                          ? IdRef(val, idMap)
                          : target && !Array.isArray(val) && Object.keys(/** @type {object} */ (val)).length <= 2
                            ? EntityLink(target, String(/** @type {Record<string, unknown>} */ (val)['@id'] || target.id))
                            : isNested
                              ? TreeValue(val, idMap, childPath, entityId)
                              : Scalar(val, idMap)
                      }
                    </div>
                  `.key(itemKey);
                })}
            </div>
          `}
    </div>
  `;
}

function SeverityIcon(severity) {
  const kind = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  return html`<span class="${`sev sev-${kind}`}" title="${kind}" aria-hidden="true"></span>`;
}

function FindingsList(all, _entityId = '') {
  return html`
    <div class="findings-container">
      ${() => {
        const findings = visibleFindings(all);
        if (findings.length === 0) {
          return html`
            <div class="empty-box">
              <span class="empty-icon">✓</span>
              <p class="empty-title">${() => (store.findings.length ? 'No findings match this filter.' : 'All schema validations passed!')}</p>
              <p class="empty-desc">${() => (store.findings.length ? 'Try clearing your search query.' : 'No errors or warnings detected on this page.')}</p>
            </div>
          `.key(`empty-findings:${store.snapshotUrl}`);
        }
        return html`
          <ul class="findings">
            ${() =>
              findings.map((finding) => html`
                <li class="${() => `finding severity-${finding.severity}`}">
                  ${SeverityIcon(finding.severity)}
                  <div class="finding-body">
                    <div class="finding-header">
                      <span class="finding-code">${() => finding.code}</span>
                      ${() => (finding.path ? html`<span class="finding-path">${finding.path}</span>` : '')}
                    </div>
                    <div class="finding-message">${() => finding.message}</div>
                    ${() =>
                      finding.docsUrl && /^https?:\/\//i.test(finding.docsUrl)
                        ? html`<a class="finding-docs" href="${finding.docsUrl}" target="_blank" rel="noopener">Official Documentation ↗</a>`
                        : ''}
                  </div>
                </li>
              `.key(`${store.snapshotUrl}:${finding.code}:${finding.entityId ?? ''}:${finding.path ?? ''}`))}
          </ul>
        `.key(`findings-list:${store.snapshotUrl}:${findings.length}`);
      }}
    </div>
  `;
}

function GraphView() {
  const graph = buildEntityGraph();
  if (graph.nodes.length === 0) {
    return html`
      <div class="empty-box">
        <span class="empty-icon">🕸️</span>
        <p class="empty-title">No Entities to Graph</p>
        <p class="empty-desc">No structured data entities were found on this page.</p>
      </div>
    `;
  }
  return html`
    <div class="graph-container">
      <div class="graph-header">
        <span class="graph-stat"><strong>${() => graph.nodes.length}</strong> Entities</span>
        <span class="graph-stat"><strong>${() => graph.edges.length}</strong> Relationships</span>
        <span class="graph-stat"><strong>${() => graph.orphaned.length}</strong> Isolated</span>
      </div>

      ${() =>
        graph.edges.length > 0
          ? html`
            <div class="graph-section">
              <div class="graph-section-title">Connected Entity Relationships</div>
              <div class="graph-edges-list">
                ${() =>
                  graph.edges.map((edge) => html`
                    <div class="graph-edge-card">
                      <button
                        type="button"
                        class="${() => `graph-node-btn${store.selectedEntityId === edge.source.id ? ' active' : ''}`}"
                        @click="${() => actions.selectEntity(edge.source)}"
                      >
                        <span class="graph-node-type">${edge.source.types.join(', ') || 'Entity'}</span>
                        <span class="graph-node-name">${entityLabel(edge.source)}</span>
                      </button>
                      <div class="graph-edge-arrow">
                        <span class="graph-edge-label">${edge.relation}</span>
                        <span class="graph-arrow-icon">──▶</span>
                      </div>
                      <button
                        type="button"
                        class="${() => `graph-node-btn${store.selectedEntityId === edge.target.id ? ' active' : ''}`}"
                        @click="${() => actions.selectEntity(edge.target)}"
                      >
                        <span class="graph-node-type">${edge.target.types.join(', ') || 'Entity'}</span>
                        <span class="graph-node-name">${entityLabel(edge.target)}</span>
                      </button>
                    </div>
                  `)}
              </div>
            </div>
          `
          : ''}

      <div class="graph-section">
        <div class="graph-section-title">All Entity Nodes</div>
        <div class="graph-nodes-grid">
          ${() =>
            graph.nodes.map((node) => {
              const isOrphan = graph.orphaned.some((o) => o.id === node.id);
              return html`
                <div
                  class="${() => `graph-card${store.selectedEntityId === node.id ? ' selected' : ''}${isOrphan ? ' orphan' : ''}`}"
                  @click="${() => actions.selectEntity(node)}"
                >
                  <div class="graph-card-header">
                    <span class="entity-type">${node.types.join(', ') || 'Unknown'}</span>
                    <span class="${`format-chip format-${node.format}`}">${node.format}</span>
                  </div>
                  <div class="graph-card-label">${entityLabel(node)}</div>
                  ${isOrphan ? html`<span class="orphan-tag">Standalone</span>` : ''}
                </div>
              `.key(node.id);
            })}
        </div>
      </div>
    </div>
  `;
}

function Detail() {
  if (store.activeView === 'graph') return GraphView().key(`graph-view:${store.snapshotUrl}`);
  if (store.activeView === 'findings') return FindingsList(true).key(`findings:${store.snapshotUrl}`);
  if (store.activeView === 'serp') {
    const cards = serpCards();
    if (cards.length === 0) {
      return html`
        <div class="empty-box">
          <span class="empty-icon">🌐</span>
          <p class="empty-title">No SERP Preview Available</p>
          <p class="empty-desc">SERP simulation is available for Product, Article, Recipe, Breadcrumb, Event, Job, ProfilePage, and LocalBusiness entities.</p>
        </div>
      `.key(`serp-empty:${store.snapshotUrl}`);
    }
    return html`
      <div class="serp-container">
        <div class="serp-disclaimer">
          <span>ℹ️ Simulated Google Search Preview (Non-authoritative representation of rich snippet rendering)</span>
        </div>
        ${() =>
          cards.map((card) => html`
            <article class="serp-card">
              <div class="serp-card-top">
                <div class="serp-cite-row">
                  <span class="serp-kind-badge">${card.kind}</span>
                  <span class="serp-cite">${card.cite}</span>
                </div>
                <button type="button" class="serp-title" @click="${() => actions.selectEntity(card.entity)}">
                  ${card.title}
                </button>
              </div>
              <div class="serp-card-body">
                ${card.image ? html`<img class="serp-thumb" alt="" src="${card.image}" loading="lazy">` : ''}
                <div class="serp-snippet-wrap">
                  ${card.meta ? html`<div class="serp-meta">${card.meta}</div>` : ''}
                  <div class="serp-snippet">${card.snippet}</div>
                </div>
              </div>
            </article>
          `.key(card.entity.id))}
      </div>
    `.key(`serp:${store.snapshotUrl}`);
  }

  const entity = selectedEntity();
  if (!entity) {
    return html`
      <div class="empty-box">
        <span class="empty-icon">🔍</span>
        <p class="empty-title">Select an entity to inspect</p>
        <p class="empty-desc">Choose an entity from the left pane to view structured properties, raw JSON, or validation findings.</p>
      </div>
    `.key(`empty:${store.snapshotUrl}`);
  }
  if (store.activeView === 'raw') {
    return html`
      <div class="raw-wrapper">
        <div class="raw-toolbar">
          <button
            type="button"
            class="${() => `tb-btn${store.sandboxOpen ? ' tb-btn-primary' : ''}`}"
            @click="${() => {
              if (store.sandboxOpen) actions.closeSandbox();
              else actions.openSandbox(entity);
            }}"
          >
            ${() => (store.sandboxOpen ? '✕ Close Editor' : '✏️ Edit & Test Fixes')}
          </button>
          ${() =>
            store.sandboxOpen
              ? html`
                <button type="button" class="tb-btn" @click="${() => actions.resetSandbox(entity)}">
                  ↩️ Reset
                </button>
                <button type="button" class="tb-btn tb-btn-primary" @click="${() => actions.copyJson()}">
                  📋 Copy Fixed JSON
                </button>
              `
              : html`
                <button type="button" class="tb-btn" @click="${() => actions.copyJson()}">
                  📋 Copy Raw
                </button>
              `}
        </div>

        ${() =>
          store.sandboxOpen
            ? html`
              <div class="sandbox-container">
                <div class="${() => `sandbox-status-bar ${store.sandboxStatus.valid ? 'status-valid' : 'status-invalid'}`}">
                  <span>${() => (store.sandboxStatus.valid ? '✓' : '⚠')}</span>
                  <span>${() => store.sandboxStatus.message}</span>
                </div>
                <textarea
                  class="sandbox-textarea"
                  spellcheck="false"
                  rows="20"
                  value="${() => store.sandboxText}"
                  @input="${(e) => {
                    store.sandboxText = e.target.value;
                    actions.validateSandbox();
                  }}"
                ></textarea>
              </div>
            `
            : html`<pre class="raw">${() => JSON.stringify(entity.data, null, 2)}</pre>`}
      </div>
    `.key(`raw:${store.snapshotUrl}:${entity.id}`);
  }
  return html`
    <div class="tree-root">
      ${() => TreeValue(entity.data, entityIdIndex(), 'root', entity.id)}
    </div>
  `.key(`tree:${store.snapshotUrl}:${entity.id}`);
}

export const PanelApp = () => html`
  <div class="${() => `app theme-${store.theme}`}" data-theme="${() => store.theme}" @click="${() => actions.closeExportMenu()}">
    <header class="toolbar">
      <div class="score-card" title="${() => `Quality Score: ${store.score?.total ?? '—'}/100 (${scoreLabel()})`}">
        <div
          class="${() => `score-ring label-${store.score?.label || 'none'}`}"
          style="${() => `--score:${store.score?.total ?? 0}`}"
        >
          <span class="score-val">${() => (store.score ? String(store.score.total) : '—')}</span>
        </div>
        <div class="score-details">
          <div class="score-title-row">
            <span class="score-grade">${() => scoreLabel()}</span>
          </div>
          <div class="score-badges">
            <span class="badge-err">${() => `${store.score?.errorCount ?? 0} errors`}</span>
            <span class="badge-warn">${() => `${store.score?.warningCount ?? 0} warnings`}</span>
          </div>
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <div class="action-group">
        <button
          type="button"
          class="tb-btn tb-btn-primary"
          title="Re-analyze inspected page"
          @click="${(e) => { e.stopPropagation(); actions.refresh(); }}"
        >
          <span class="tb-icon">↻</span> Refresh
        </button>

        <button
          type="button"
          class="tb-btn"
          id="btn-inspect"
          title="Reveal source node in Elements panel"
          @click="${(e) => { e.stopPropagation(); actions.inspectSelected(); }}"
        >
          <span class="tb-icon">🎯</span> Inspect in Elements
        </button>

        <div class="dropdown-wrap" @click="${(e) => e.stopPropagation()}">
          <button
            type="button"
            class="${() => `tb-btn tb-btn-dropdown${store.exportMenuOpen ? ' active' : ''}`}"
            @click="${() => actions.toggleExportMenu()}"
            title="Export schema or agent bundles"
          >
            <span class="tb-icon">📋</span> Export <span class="caret">▾</span>
          </button>

          ${() =>
            store.exportMenuOpen
              ? html`
                <div class="dropdown-menu">
                  <button type="button" class="menu-item" @click="${() => { actions.copyJson(); actions.closeExportMenu(); }}">
                    <span>Copy JSON</span> <small>Selected entity</small>
                  </button>
                  <button type="button" class="menu-item" @click="${() => { actions.copyScript(); actions.closeExportMenu(); }}">
                    <span>Copy &lt;script&gt; Tag</span> <small>JSON-LD</small>
                  </button>
                  <div class="menu-sep"></div>
                  <button type="button" class="menu-item" @click="${() => { actions.copyBundle(); actions.closeExportMenu(); }}">
                    <span>Copy Agent Bundle</span> <small>AI JSON</small>
                  </button>
                  <button type="button" class="menu-item" @click="${() => { actions.copyMarkdown(); actions.closeExportMenu(); }}">
                    <span>Copy Agent Markdown</span> <small>Prompt ready</small>
                  </button>
                  <button type="button" class="menu-item" @click="${() => { actions.copyAiPrompt(); actions.closeExportMenu(); }}">
                    <span>Copy for AI Prompt</span> <small>LLM / RAG prompt</small>
                  </button>
                  <div class="menu-sep"></div>
                  <button type="button" class="menu-item" @click="${() => { actions.downloadJson(); actions.closeExportMenu(); }}">
                    <span>Download Report (.json)</span>
                  </button>
                </div>
              `
              : ''}
        </div>
      </div>

      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          type="search"
          class="tb-search"
          placeholder="Filter entities, properties, findings…"
          autocomplete="off"
          spellcheck="false"
          value="${() => store.query}"
          @input="${(event) => { store.query = event.target.value; }}"
        >
        ${() =>
          store.query
            ? html`
              <button
                type="button"
                class="search-clear"
                title="Clear filter"
                @click="${() => { store.query = ''; }}"
              >✕</button>
            `
            : ''}
      </div>

      <div class="external-group">
        <button
          type="button"
          class="tb-btn tb-btn-link"
          title="Open current page in Google Rich Results Test"
          @click="${(e) => { e.stopPropagation(); actions.openRichResults(); }}"
        >
          Google Rich Results ↗
        </button>
        <button
          type="button"
          class="tb-btn tb-btn-link"
          title="Open current page in Schema.org Validator"
          @click="${(e) => { e.stopPropagation(); actions.openSchemaValidator(); }}"
        >
          Schema.org ↗
        </button>
      </div>
    </header>

    <main class="main">
      <section class="pane entities-pane">
        <div class="pane-header">
          <span class="pane-title">Entities</span>
          <span class="pill-badge">${() => store.entities.length}</span>
        </div>

        ${() => {
          const entities = visibleEntities();
          if (store.entities.length === 0) {
            return html`<p class="empty-list">No structured data entities found on this page.</p>`.key(`empty:${store.snapshotUrl}`);
          }
          if (entities.length === 0) {
            return html`<p class="empty-list">No entities match "${() => store.query}".</p>`.key(`empty-filter:${store.snapshotUrl}`);
          }
          return html`
            <ul class="entity-list">
              ${() =>
                entities.map((entity) => {
                  return html`
                    <li
                      class="${() => `entity-item${store.selectedEntityId === entity.id ? ' selected' : ''}`}"
                      title="Click to select · Alt-click to inspect in Elements"
                      @click="${(event) => actions.selectEntity(entity, { inspect: event.altKey })}"
                      @mouseenter="${() => actions.highlightEntity(entity)}"
                    >
                      <div class="entity-row-top">
                        <span class="entity-type">${() => entity.types.join(', ') || 'Unknown'}</span>
                        <span class="${() => `format-chip format-${entity.format}`}">${() => entity.format}</span>
                      </div>
                      ${() => {
                        const label = entityLabel(entity);
                        return label ? html`<div class="entity-label" title="${() => label}">${() => label}</div>` : '';
                      }}
                    </li>
                  `.key(`${store.snapshotUrl}:${entity.id}`);
                })}
            </ul>
          `.key(`list:${store.snapshotUrl}:${entities.length}`);
        }}
      </section>

      <section class="pane detail-pane">
        <div class="view-tabs">
          ${VIEWS.map(([id, label]) => html`
            <button
              type="button"
              class="${() => `tab${store.activeView === id ? ' active' : ''}`}"
              @click="${() => { store.activeView = id; }}"
            >
              ${label}
              ${() => {
                if (id !== 'findings') return '';
                const count = store.findings.length;
                if (count === 0) return '';
                const hasError = store.findings.some((f) => f.severity === 'error');
                const hasWarning = store.findings.some((f) => f.severity === 'warning');
                const kind = hasError ? 'error' : hasWarning ? 'warning' : 'info';
                return html`<span class="${`tab-badge tab-badge-${kind}`}">${count}</span>`;
              }}
            </button>
          `.key(id))}
        </div>
        <div class="view-content">
          ${() => Detail()}
        </div>
      </section>
    </main>

    <footer class="${() => `status-bar${store.statusError ? ' status-error' : ''}`}" role="status">
      <span class="status-dot">●</span>
      <span class="status-text">${() => store.status || 'Ready'}</span>
      <span class="status-meta">${() => (store.snapshotUrl ? store.snapshotUrl : '')}</span>
    </footer>
  </div>
`;

export function mountPanel(root) {
  PanelApp()(root);
}
