import { html } from '../vendor/arrow.js';
import {
  actions,
  entityIdIndex,
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
    >${label}</button>
  `;
}

function Scalar(value, idMap) {
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return EntityLink(target, value);
  }
  return html`<span class="tree-value">${JSON.stringify(value)}</span>`;
}

function IdRef(value, idMap) {
  if (typeof value === 'string') {
    const target = idMap.get(value);
    if (target) return EntityLink(target, value);
  }
  return Scalar(value, idMap);
}

function TreeChild(key, val, idMap) {
  const target = val !== null && typeof val === 'object' ? refTarget(val, idMap) : null;
  const compact = target && !Array.isArray(val) && Object.keys(/** @type {object} */ (val)).length <= 2;
  if (key === '@id') return IdRef(val, idMap);
  if (compact) {
    return EntityLink(target, String(/** @type {Record<string, unknown>} */ (val)['@id'] || target.id));
  }
  if (val !== null && typeof val === 'object') return TreeValue(val, idMap);
  return Scalar(val, idMap);
}

function TreeValue(value, idMap) {
  if (value === null) return html`<span class="tree-value">null</span>`;
  if (typeof value !== 'object') return Scalar(value, idMap);
  if (Array.isArray(value)) {
    return html`
      <div>
        <span class="tree-type">${`Array[${value.length}]`}</span>
        <div class="tree-children">
          ${() => value.map((item, index) => html`
            <div class="tree-row">
              <span class="tree-key">${`[${index}]`}</span>
              ${() => TreeValue(item, idMap)}
            </div>
          `.key(index))}
        </div>
      </div>
    `;
  }
  const obj = /** @type {Record<string, unknown>} */ (value);
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === '@id') return IdRef(obj['@id'], idMap);
  return html`
    <div class="tree-children">
      ${() => keys.map((key) => html`
        <div class="tree-row">
          <span class="tree-key">${`${key}:`}</span>
          ${() => TreeChild(key, obj[key], idMap)}
        </div>
      `.key(key))}
    </div>
  `;
}

function SeverityIcon(severity) {
  const kind = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  return html`<span class="${`sev sev-${kind}`}" title="${kind}" aria-hidden="true"></span>`;
}

function FindingsList(all) {
  const findings = visibleFindings(all);
  if (findings.length === 0) {
    return html`<p class="empty">${store.findings.length ? 'No findings match this filter.' : 'No findings.'}</p>`;
  }
  return html`
    <ul class="findings">
      ${() => findings.map((finding) => html`
        <li class="${`finding severity-${finding.severity}`}">
          ${() => SeverityIcon(finding.severity)}
          <div class="finding-body">
            <span class="finding-code">${finding.code}</span>
            <span class="finding-message">${finding.message}</span>
            ${() => finding.docsUrl && /^https?:\/\//i.test(finding.docsUrl)
              ? html`<a class="finding-docs" href="${finding.docsUrl}" target="_blank" rel="noopener">Docs</a>`
              : ''}
          </div>
        </li>
      `.key(`${finding.code}:${finding.entityId ?? ''}:${finding.path ?? ''}`))}
    </ul>
  `;
}

function Detail() {
  const entity = selectedEntity();
  if (!entity) return html`<p class="empty">Select an entity to inspect its data.</p>`;
  if (store.activeView === 'raw') {
    return html`<pre class="raw">${JSON.stringify(entity.data, null, 2)}</pre>`;
  }
  if (store.activeView === 'findings') return FindingsList(true);
  if (store.activeView === 'serp') {
    const cards = serpCards();
    if (cards.length === 0) {
      return html`<p class="serp-empty">No Product, Article, Recipe, Breadcrumb, Event, or Job entities to preview.</p>`;
    }
    return html`
      <div>
        ${() => cards.map((card) => html`
          <article class="serp-card">
            ${() => card.image ? html`<img class="serp-thumb" alt="" src="${card.image}">` : ''}
            <div class="serp-kind">${card.kind}</div>
            <div class="serp-cite">${card.cite}</div>
            <button type="button" class="serp-title" @click="${() => actions.selectEntity(card.entity)}">${card.title}</button>
            <div class="serp-snippet">${card.snippet}</div>
            ${() => card.meta ? html`<div class="serp-meta">${card.meta}</div>` : ''}
          </article>
        `.key(card.entity.id))}
      </div>
    `;
  }
  return html`<div class="tree">${() => TreeValue(entity.data, entityIdIndex())}</div>`;
}

export const PanelApp = () => html`
  <div class="app" data-theme="${() => store.theme}">
    <header class="toolbar">
      <div class="score-block">
        <div
          class="${() => `score-gauge label-${store.score?.label || 'none'}`}"
          style="${() => `--score:${store.score?.total ?? 0}`}"
          aria-label="Schema score"
        >
          <span class="score-value">${() => store.score ? String(store.score.total) : '—'}</span>
        </div>
        <div class="score-meta">
          <span class="score-label">${() => scoreLabel()}</span>
          <div class="metrics">
            <span class="metric metric-error">${() => `${store.score?.errorCount ?? 0} errors`}</span>
            <span class="metric metric-warning">${() => `${store.score?.warningCount ?? 0} warnings`}</span>
            <span class="metric">${() => `${store.entities.length} entities`}</span>
          </div>
        </div>
      </div>
      <div class="toolbar-actions">
        <input
          type="search"
          class="search"
          placeholder="Search entities & findings…"
          autocomplete="off"
          spellcheck="false"
          value="${() => store.query}"
          @input="${(event) => { store.query = event.target.value; }}"
        >
        <div class="btn-row">
          <button type="button" class="btn" @click="${() => actions.refresh()}">Refresh</button>
          <button type="button" id="btn-inspect" class="btn" @click="${() => actions.inspectSelected()}">Inspect in Elements</button>
          <button type="button" class="btn" @click="${() => actions.copyJson()}">Copy JSON</button>
          <button type="button" class="btn" @click="${() => actions.copyScript()}">Copy script tag</button>
          <button type="button" class="btn" @click="${() => actions.downloadJson()}">Download JSON</button>
          <button type="button" class="btn" @click="${() => actions.copyBundle()}">Copy agent bundle</button>
          <button type="button" class="btn" @click="${() => actions.copyMarkdown()}">Copy agent markdown</button>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-link" @click="${() => actions.openRichResults()}">Rich Results Test</button>
          <button type="button" class="btn btn-link" @click="${() => actions.openSchemaValidator()}">Schema Markup Validator</button>
        </div>
      </div>
    </header>
    <main class="main">
      <section class="pane entities-pane">
        <h2 class="pane-title">Entities <span class="badge">${() => store.entities.length}</span></h2>
        ${() => {
          const entities = visibleEntities();
          if (store.entities.length === 0) {
            return html`<p class="empty">No schema entities found on this page.</p>`;
          }
          if (entities.length === 0) {
            return html`<p class="empty">No entities match this search.</p>`;
          }
          return html`
            <ul class="entity-list">
              ${() => entities.map((entity) => html`
                <li
                  class="${() => `entity-item${store.selectedEntityId === entity.id ? ' selected' : ''}`}"
                  title="Select this entity. Alt-click to reveal its source in Elements."
                  @click="${(event) => actions.selectEntity(entity, { inspect: event.altKey })}"
                  @mouseenter="${() => actions.highlightEntity(entity)}"
                >
                  <span class="entity-type">${entity.types.join(', ') || 'Unknown'}</span>
                  <span class="entity-meta">
                    <span class="format-chip">${entity.format}</span>
                    <span class="entity-id">${entity.id}</span>
                  </span>
                </li>
              `.key(entity.id))}
            </ul>
          `;
        }}
      </section>
      <section class="pane">
        <div class="view-tabs">
          ${() => VIEWS.map(([id, label]) => html`
            <button
              type="button"
              class="${() => `tab${store.activeView === id ? ' active' : ''}`}"
              @click="${() => { store.activeView = id; }}"
            >${label}</button>
          `.key(id))}
        </div>
        <div class="view-content">
          ${() => Detail()}
        </div>
      </section>
    </main>
    <footer class="${() => `status${store.statusError ? ' error' : ''}`}" role="status">${() => store.status}</footer>
  </div>
`;

export function mountPanel(root) {
  PanelApp()(root);
}
