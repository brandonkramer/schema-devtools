import van from '../../vendor/van.js';
import { actions, store } from '../store.js';
import { ScoreCard } from './score-card.js';

const { div, span, button, input, header, small } = van.tags;

export function Toolbar() {
  return header(
    { class: 'toolbar' },
    ScoreCard(),
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
  );
}
