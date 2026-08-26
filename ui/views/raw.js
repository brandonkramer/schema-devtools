import van from '../../vendor/van.js';
import { actions, store } from '../store.js';

const { div, span, button, textarea, pre } = van.tags;

export function RawView(entity) {
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
