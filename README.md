# Schema DevTools

A Chrome DevTools extension for inspecting, validating, and scoring structured data (JSON-LD, Microdata, RDFa) on any web page. All analysis runs locally in your browser — nothing is sent to external servers unless you explicitly open the Rich Results Test or Schema Markup Validator links.

## Features

- **DevTools panel** — Open the **Schema** tab in Chrome DevTools for a full-page schema report
- **Elements sidebar** — Select a node in the Elements panel to see schema on that element
- **Score & findings** — 0–100 score with errors, warnings, and Google rich-result checks
- **Entity browser** — Tree view, raw JSON, findings, and a non-authoritative **SERP Preview** simulation
- **Live updates** — Re-analyzes when JSON-LD/Microdata/RDFa changes or the SPA navigates
- **Graph jumps** — Click `@id` references in the tree to select the target entity
- **In-page highlight** — Hover/click an entity to outline its DOM node
- **Agent exports** — Copy JSON agent bundle or markdown summary for LLM workflows
- **External validators** — One-click links to Google Rich Results Test and validator.schema.org (opens on click only)
- **Dark / light theme** — Follows DevTools theme automatically

## Load unpacked

1. Clone or download this folder.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this project directory (`schema`).
5. Click **Reload** on the extension card after any code change.
6. **Fully close DevTools** (not just the Schema tab), then open it again on the page you want to inspect (`F12` or `Cmd+Option+I`).
7. Select the **Schema** panel. The toolbar icon is only a reminder — analysis always runs against the tab DevTools is attached to.

## Privacy

- No host permissions — the extension does not read tabs in the background.
- No telemetry, analytics, or remote logging.
- Page content is analyzed only when DevTools is open, via `inspectedWindow.eval`.
- External validator links open only when you click them; the current page URL is passed as a query parameter.

See [privacy.html](privacy.html) for the full privacy policy.

## Project structure

```
schema/
├── manifest.json
├── devtools/          # DevTools panel & sidebar UI
├── src/               # Extraction, validation, scoring engine
├── icons/
├── README.md
├── STORE.md
└── privacy.html
```

## Chrome Web Store publish checklist

- [ ] Test on multiple sites (JSON-LD, Microdata, RDFa, no schema)
- [ ] Verify score, findings, entity inspect, and sidebar selection
- [ ] Confirm Rich Results Test and Schema Markup Validator URLs encode correctly
- [ ] Review [privacy.html](privacy.html) — no data collection declared
- [ ] Prepare store assets: 128×128 icon, screenshots (1280×800 or 640×400), promotional tile optional
- [ ] Write listing from [STORE.md](STORE.md)
- [ ] Zip extension root (include `manifest.json`, `devtools/`, `src/`, `icons/`, `privacy.html`) — exclude `.git`, `README.md`, `STORE.md`, `.agents/` if desired
- [ ] Register [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) ($5 one-time)
- [ ] Set category: **Developer Tools**
- [ ] Single purpose: structured data inspection in DevTools
- [ ] Permissions justification: none required (devtools_page only)

## License

Original implementation. Do not redistribute proprietary third-party extension code.
