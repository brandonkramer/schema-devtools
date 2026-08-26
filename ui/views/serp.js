import van from '../../vendor/van.js';
import { serpCards } from '../features/serp.js';
import { actions } from '../store.js';

const { div, span, p, button, article } = van.tags;

export function SerpView() {
  const cards = serpCards();
  if (cards.length === 0) {
    return div(
      { class: 'empty-box' },
      span({ class: 'empty-icon' }, '🌐'),
      p({ class: 'empty-title' }, 'No SERP Preview Available'),
      p({
        class: 'empty-desc',
      }, 'SERP simulation is available for Product, Article, Recipe, Review, Video, Job, Event, Breadcrumb, ProfilePage, LocalBusiness, Movie, Organization, VacationRental, and SoftwareApplication entities.'),
    );
  }
  return div(
    { class: 'serp-container' },
    div(
      { class: 'serp-disclaimer' },
      span('ℹ️ Simulated Google Search Preview (Non-authoritative representation of rich snippet rendering)'),
    ),
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
          button(
            {
              type: 'button',
              class: 'serp-title',
              onclick: () => actions.selectEntity(card.entity),
            },
            card.title,
          ),
        ),
        div(
          { class: 'serp-card-body' },
          div(
            { class: 'serp-snippet-wrap' },
            card.meta ? div({ class: 'serp-meta' }, card.meta) : '',
            div({ class: 'serp-snippet' }, card.snippet),
            card.stars
              ? div(
                  { class: 'serp-stars' },
                  span({ class: 'serp-star-glyphs' }, card.stars),
                  card.reviewBy ? span({ class: 'serp-review-by' }, ` ${card.reviewBy}`) : '',
                )
              : '',
          ),
        ),
      ),
    ),
  );
}
