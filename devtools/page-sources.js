/** Install the bounded schema mutation and history watcher inside the inspected page. */
export function installPageWatch() {
  const key = Symbol.for('schema-devtools.watch');
  if (window[key] && window[key].installed) return window[key].generation;
  const state = { installed: true, generation: 1, timer: 0 };
  window[key] = state;
  const bump = () => {
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = 0;
      if (window[key] !== state) return;
      state.generation += 1;
    }, 250);
  };
  const isOverlay = (node) => {
    if (!node || node.nodeType !== 1) return false;
    return node.getAttribute('data-schema-devtools') === 'overlay';
  };
  const interesting = (node) => {
    if (!node || node.nodeType !== 1 || isOverlay(node)) return false;
    if (node.tagName === 'SCRIPT') {
      const type = (node.getAttribute('type') || '').split(';', 1)[0].trim().toLowerCase();
      return type === 'application/ld+json';
    }
    return node.hasAttribute('itemscope') || node.hasAttribute('itemtype') || node.hasAttribute('itemprop')
      || node.hasAttribute('itemref') || node.hasAttribute('typeof') || node.hasAttribute('property') || node.hasAttribute('vocab')
      || (node.hasAttribute('rel') && Boolean(node.closest('[typeof], [vocab], [prefix]')));
  };
  const containsInteresting = (node) => {
    if (interesting(node)) return true;
    if (!node || node.nodeType !== 1) return false;
    for (const match of node.querySelectorAll(
      'script[type], [itemscope], [itemtype], [itemprop], [itemref], [typeof], [property], [vocab], [prefix], [rel]',
    )) {
      if (interesting(match)) return true;
    }
    return false;
  };
  const target = document.documentElement || document;
  if (target) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (isOverlay(mutation.target)) continue;
        if (mutation.type === 'characterData') {
          const host = mutation.target.parentElement;
          if (host && (host.tagName === 'SCRIPT' || interesting(host))) { bump(); return; }
          continue;
        }
        if (mutation.type === 'attributes' && mutation.oldValue !== null) {
          const name = mutation.attributeName;
          const oldType = name === 'type' && String(mutation.oldValue).split(';', 1)[0].trim().toLowerCase();
          if (
            oldType === 'application/ld+json' ||
            ['itemscope', 'itemtype', 'itemprop', 'itemref', 'typeof', 'property', 'vocab', 'prefix', 'rel'].includes(name)
          ) { bump(); return; }
        }
        if (interesting(mutation.target)) { bump(); return; }
        for (const node of mutation.addedNodes) { if (containsInteresting(node)) { bump(); return; } }
        for (const node of mutation.removedNodes) { if (containsInteresting(node)) { bump(); return; } }
      }
    });
    observer.observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        'type', 'itemscope', 'itemtype', 'itemprop', 'itemref', 'typeof', 'property', 'vocab',
        'content', 'href', 'src', 'data', 'datetime', 'itemid', 'resource', 'about', 'prefix', 'rel',
      ],
    });
    state.observer = observer;
  }
  const wrap = (fn) => function wrapped() {
    const result = fn.apply(this, arguments);
    bump();
    return result;
  };
  try {
    state.originalPushState = history.pushState;
    state.originalReplaceState = history.replaceState;
    state.wrappedPushState = wrap(history.pushState);
    state.wrappedReplaceState = wrap(history.replaceState);
    history.pushState = state.wrappedPushState;
    history.replaceState = state.wrappedReplaceState;
  } catch {}
  window.addEventListener('popstate', bump);
  window.addEventListener('hashchange', bump);
  state.bump = bump;
  return state.generation;
}

/** Remove the inspected-page watcher and restore wrapped history methods. */
export function removePageWatch() {
  const key = Symbol.for('schema-devtools.watch');
  const state = window[key];
  if (!state) return false;
  try { state.observer && state.observer.disconnect(); } catch {}
  if (state.timer) clearTimeout(state.timer);
  if (state.bump) {
    window.removeEventListener('popstate', state.bump);
    window.removeEventListener('hashchange', state.bump);
  }
  try {
    if (history.pushState === state.wrappedPushState) history.pushState = state.originalPushState;
    if (history.replaceState === state.wrappedReplaceState) history.replaceState = state.originalReplaceState;
  } catch {}
  delete window[key];
  return true;
}

export const PAGE_WATCH_INSTALL = `(${installPageWatch.toString()})()`;
export const PAGE_WATCH_REMOVE = `(${removePageWatch.toString()})()`;
