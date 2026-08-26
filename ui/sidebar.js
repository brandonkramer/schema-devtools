import { html, reactive } from '../vendor/arrow.js';

/** @typedef {import('../src/types.js').Finding} Finding */

export const store = reactive({
  theme: 'default',
  empty: true,
  message: 'No schema on this node',
  format: '',
  types: '',
  properties: /** @type {Array<{key: string, value: string}>} */ ([]),
  findings: /** @type {Finding[]} */ ([]),
});

function SeverityIcon(severity) {
  const kind = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  return html`<span class="${`sev sev-${kind}`}" title="${kind}" aria-hidden="true"></span>`;
}

export const SidebarApp = () => html`
  <div class="sidebar" data-theme="${() => store.theme}">
    ${() => store.empty
      ? html`<p class="empty">${store.message}</p>`
      : html`
        <div>
          <div class="type-row">
            <span class="format-chip">${store.format}</span>
            <h2 class="type-name">${store.types}</h2>
          </div>
          <section>
            <h3 class="section-label">Key properties</h3>
            <dl class="props">
              ${() => store.properties.map((prop) => html`
                <dt>${prop.key}</dt>
                <dd title="${prop.value}">${prop.value}</dd>
              `.key(prop.key))}
            </dl>
          </section>
          ${() => store.findings.length === 0 ? '' : html`
            <section>
              <h3 class="section-label">Findings</h3>
              <ul class="findings">
                ${() => store.findings.map((finding) => html`
                  <li class="${`finding severity-${finding.severity}`}">
                    ${() => SeverityIcon(finding.severity)}
                    <div>
                      <span class="finding-code">${finding.code}</span>
                      <span class="finding-message">${finding.message}</span>
                    </div>
                  </li>
                `.key(`${finding.code}:${finding.entityId ?? ''}`))}
              </ul>
            </section>
          `}
        </div>
      `}
  </div>
`;

export function mountSidebar(root) {
  SidebarApp()(root);
}
