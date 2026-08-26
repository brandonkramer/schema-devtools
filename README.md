# Schema DevTools

A Chrome DevTools extension for inspecting, debugging, validating, and scoring structured data (**JSON-LD**, **Microdata**, **RDFa**) on any web page. 

All analysis runs **100% locally in your browser** — zero host permissions, zero telemetry, and nothing is sent to external servers unless you explicitly click the Google Rich Results Test or Schema Markup Validator links.

---

## ✨ Features

- 🛠️ **Dedicated DevTools Panel** — Adds a **Schema** tab to Chrome DevTools for comprehensive page-level structured data inspection.
- 🔍 **Elements Sidebar Pane** — Inspect elements directly in the **Elements** panel with a synced **Schema** sidebar showing markup and properties on the selected DOM node (`$0`).
- 📊 **Quality Score & Findings** — 0–100 quality score with real-time error, warning, and info breakdowns against Schema.org and Google Search Central rich-result guidelines.
- 🌳 **Entity Browser & Views:**
  - **Tree View** — Interactive, collapsible tree view with syntax color-coding and `@id` graph navigation links.
  - **Raw JSON View** — Formatted JSON-LD payload with line/column syntax error indicators.
  - **Findings View** — Filterable list of validation findings with direct documentation links.
  - **SERP Preview** — Non-authoritative Google Search card simulation for Products, Articles, Recipes, and Breadcrumbs.
- ⚡ **Live SPA & Mutation Updates** — Automatically detects dynamic schema changes, client-side route changes (Next.js, Nuxt, Shopify, React), and DOM mutations.
- 🎯 **In-Page DOM Highlighting** — Hovering or clicking an entity outlines its corresponding visual DOM node on the live webpage.
- 🤖 **AI Agent & LLM Exports** — One-click **Copy Agent Bundle** (structured JSON) and **Copy Agent Markdown** for seamless integration with Claude, Cursor, Copilot, and LLM coding assistants.
- 🔗 **External Validators** — Direct one-click links to Google Rich Results Test and `validator.schema.org` (opens with encoded page URL only on explicit click).
- 🌓 **Native Theme Parity** — Automatically adapts to Chrome DevTools light and dark themes.

---

## 🚀 Getting Started (Load Unpacked)

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select this directory.
5. Open Chrome DevTools on any webpage (`F12` or `Cmd + Option + I` on Mac / `Ctrl + Shift + I` on Windows/Linux).
6. Select the **Schema** tab in DevTools.

> **Tip:** If you make changes to extension files, click **Reload** on the extension card in `chrome://extensions` and reopen DevTools.

---

## 🔒 Privacy & Security

- **Zero Host Permissions:** The extension requests no background network or tab permissions (`host_permissions`).
- **No Background Data Access:** Code executes only when DevTools is actively open on a tab via `chrome.devtools.inspectedWindow.eval`.
- **Zero Telemetry / Analytics:** No tracking, usage analytics, or remote logging.
- **Local-Only Processing:** All JSON-LD parsing, microdata extraction, validation rules, and scoring logic run entirely client-side.

See [privacy.html](privacy.html) for the full privacy policy.

---

## 📁 Project Structure

```text
schema/
├── manifest.json            # Manifest V3 configuration (devtools_page)
├── popup.html               # Extension toolbar action hint
├── privacy.html             # Local-only privacy policy
├── README.md                # Project documentation
├── STORE.md                 # Chrome Web Store listing metadata
├── devtools/                # DevTools panel & sidebar UI
│   ├── devtools.html        # Entrypoint initializing Schema panel & Elements sidebar
│   ├── devtools.js
│   ├── panel.html           # Main Schema DevTools panel UI
│   ├── panel.js
│   ├── panel.css
│   ├── sidebar.html         # Elements panel Schema sidebar pane
│   ├── sidebar.js
│   └── sidebar.css
├── src/                     # Core extraction, validation & scoring engine
│   ├── extract.js           # In-page DOM snapshot & metadata extraction
│   ├── normalize.js         # Flattening & entity normalization
│   ├── rules.js             # Google rich-result & Schema.org rule catalog
│   ├── validate.js          # Findings & validation engine
│   ├── score.js             # 0–100 quality scoring algorithm
│   ├── agent.js             # AI agent JSON bundle & markdown export builders
│   └── types.js             # JSDoc type definitions
├── scripts/                 # Build & smoke verification scripts
│   ├── bundle-engine.mjs    # Engine bundler for classic DevTools script
│   └── smoke-engine.mjs     # Smoke tests for engine logic
└── icons/                   # Extension icons (16px, 32px, 48px, 128px)
```

---

## 🧪 Development & Testing

Run smoke tests for the extraction, normalization, validation, and scoring engine:

```bash
# Run smoke tests
node scripts/smoke-engine.mjs

# Rebuild classic bundle after modifying files in src/
node scripts/bundle-engine.mjs
```

---

## 📦 Chrome Web Store Checklist

- [x] Manifest V3 compliant (`devtools_page` only)
- [x] Zero host permissions declared
- [x] 100% local analysis verified
- [x] Privacy policy ready in `privacy.html`
- [x] Listing copy prepared in `STORE.md`
- [x] Icons ready in `icons/` (16, 32, 48, 128px)

---

## 📄 License

Original implementation. Licensed under the MIT License.
