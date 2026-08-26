import van from '../vendor/van.js';
import vanX from '../vendor/van-x.js';

/** @typedef {import('../src/types.js').Finding} Finding */

export const store = vanX.reactive({
  theme: 'default',
  empty: true,
  message: 'No schema on this node',
  format: '',
  types: '',
  properties: /** @type {Array<{key: string, value: string}>} */ ([]),
  findings: /** @type {Finding[]} */ ([]),
});

const { div, span, p, h2, h3, dl, dt, dd, section, ul, li } = van.tags;

function SeverityIcon(severity) {
  const kind = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  return span({ class: `sev sev-${kind}`, title: kind, 'aria-hidden': 'true' });
}

export const SidebarApp = () => {
  return div(
    { class: 'sidebar', 'data-theme': () => store.theme },
    () => {
      if (store.empty) {
        return p({ class: 'empty' }, () => store.message);
      }
      return div(
        div(
          { class: 'type-row' },
          span({ class: 'format-chip' }, () => store.format),
          h2({ class: 'type-name' }, () => store.types),
        ),
        section(
          h3({ class: 'section-label' }, 'Key properties'),
          dl(
            { class: 'props' },
            () =>
              store.properties.map((prop) => [
                dt(prop.key),
                dd({ title: prop.value }, prop.value),
              ]),
          ),
        ),
        () => {
          if (store.findings.length === 0) return null;
          return section(
            h3({ class: 'section-label' }, 'Findings'),
            ul(
              { class: 'findings' },
              store.findings.map((finding) =>
                li(
                  { class: `finding severity-${finding.severity}` },
                  SeverityIcon(finding.severity),
                  div(
                    span({ class: 'finding-code' }, finding.code),
                    span({ class: 'finding-message' }, finding.message),
                  ),
                ),
              ),
            ),
          );
        },
      );
    },
  );
};

export function mountSidebar(root) {
  root.replaceChildren();
  van.add(root, SidebarApp());
}
