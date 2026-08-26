import { actions, selectedEntity, store } from './store.js';

/** Install browser-only fallback actions used by the zero-build sandbox. */
export function configureSandboxActions() {
  actions.copyJson = () => {
    const entity = selectedEntity();
    const text = entity ? JSON.stringify(entity.data, null, 2) : JSON.stringify(store.entities.map((item) => item.data), null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    store.status = 'Copied JSON to clipboard';
    store.statusError = false;
  };
  actions.copyScript = () => {
    const entity = selectedEntity();
    const text = entity
      ? `<script type="application/ld+json">\n${JSON.stringify(entity.data, null, 2)}\n</script>`
      : store.entities.map((item) => `<script type="application/ld+json">\n${JSON.stringify(item.data, null, 2)}\n</script>`).join('\n\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    store.status = 'Copied <script> tag to clipboard';
    store.statusError = false;
  };
  actions.downloadJson = () => {
    const data = {
      url: store.snapshotUrl,
      canonical: store.snapshotCanonical,
      score: store.score,
      entities: store.entities,
      findings: store.findings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `schema-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    store.status = 'Downloaded JSON report';
    store.statusError = false;
  };
  actions.copyBundle = () => {
    const bundle = {
      url: store.snapshotUrl,
      canonical: store.snapshotCanonical,
      score: store.score,
      entities: store.entities.map((entity) => ({
        id: entity.id,
        types: entity.types,
        format: entity.format,
        data: entity.data,
      })),
      findings: store.findings,
    };
    if (navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    store.status = 'Copied Agent Bundle to clipboard';
    store.statusError = false;
  };
  actions.copyMarkdown = () => {
    const markdown = `# Structured Data Report: ${store.snapshotUrl || 'Page'}\n\nScore: ${store.score?.total ?? '—'}/100 (${store.score?.label ?? 'none'})\n\n## Entities (${store.entities.length})\n${store.entities.map((entity) => `- **${entity.types.join(', ')}** (${entity.format}): ${entity.id}`).join('\n')}\n\n## Findings (${store.findings.length})\n${store.findings.map((finding) => `- [${finding.severity.toUpperCase()}] ${finding.code}: ${finding.message}`).join('\n')}`;
    if (navigator.clipboard) navigator.clipboard.writeText(markdown);
    store.status = 'Copied Agent Markdown to clipboard';
    store.statusError = false;
  };
  actions.copyAiPrompt = () => {
    const entity = selectedEntity();
    const text = entity ? JSON.stringify(entity.data, null, 2) : JSON.stringify(store.entities.map((item) => item.data), null, 2);
    const prompt = `Here is the structured Schema.org / JSON-LD knowledge graph extracted from ${store.snapshotUrl || 'the page'}:\n\n\`\`\`json\n${text}\n\`\`\`\n\nAnalyze the above semantic entities, relationships, and completeness for search optimization and LLM grounding.`;
    if (navigator.clipboard) navigator.clipboard.writeText(prompt);
    store.status = 'Copied AI Prompt to clipboard';
    store.statusError = false;
  };
}
