chrome.devtools.panels.create(
  'Schema',
  'icons/icon-32.png',
  'devtools/panel.html',
  (panel) => {
    const notifyVisibility = (visible) => {
      chrome.runtime.sendMessage({ type: 'schema-panel-visibility', visible }, () => {
        void chrome.runtime.lastError;
      });
    };
    panel.onShown.addListener(() => notifyVisibility(true));
    panel.onHidden.addListener(() => notifyVisibility(false));
  },
);

chrome.devtools.panels.elements.createSidebarPane('Schema', (sidebar) => {
  sidebar.setPage('devtools/sidebar.html');
});
