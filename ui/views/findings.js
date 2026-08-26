import van from '../../vendor/van.js';
import { store, visibleFindings } from '../store.js';

const { div, span, p, a, ul, li } = van.tags;

export function SeverityIcon(severity) {
  const kind = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  return span({ class: `sev sev-${kind}`, title: kind, 'aria-hidden': 'true' });
}

export function FindingsList(all = true) {
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
