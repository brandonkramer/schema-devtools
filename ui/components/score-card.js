import van from '../../vendor/van.js';
import { store } from '../store.js';

const { div, span } = van.tags;

export function scoreLabel() {
  if (store.fatal) return 'Error';
  return store.score?.label || 'No data';
}

export function ScoreCard() {
  return div(
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
  );
}
