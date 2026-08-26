# Schema DevTools

A lightweight Chrome DevTools extension for inspecting, debugging, validating, and scoring structured data (**JSON-LD**, **Microdata**, **RDFa**) on any web page. 

All analysis runs **100% locally in your browser** — zero host permissions, zero telemetry, and nothing is sent to external servers unless you explicitly click the Google Rich Results Test or Schema Markup Validator links.

---

## ✨ Features

- 🛠️ **Dedicated DevTools Panel** — Adds a **Schema** tab to Chrome DevTools for comprehensive page-level structured data inspection.
- 🔍 **Elements Sidebar Pane** — Inspect elements directly in the **Elements** panel with a synced **Schema** sidebar showing markup and properties on the selected DOM node (`$0`).
- 📊 **Quality Score & Findings** — 0–100 quality score with real-time error, warning, and info breakdowns against Schema.org and Google Search Central rich-result guidelines.
- 🌳 **Interactive Views & Workspaces:**
  - **Tree View** — Interactive, collapsible tree view with syntax color-coding and `@id` graph navigation links.
  - **Raw JSON Sandbox** — In-panel interactive JSON editor (`✏️ Edit & Test Fixes`) with live syntax checking and real-time score recalculation.
  - **Findings View** — Filterable list of validation findings with direct documentation links.
  - **SERP Preview** — Google Search rich preview simulations for `Product`, `Recipe`, `Article`, `Event`, `Job`, `ProfilePage`, and `LocalBusiness` / `Restaurant` / `Store`.
  - **Knowledge Graph** — Visual entity relationship graph showing `@id` connections and orphaned standalone entities.
- ⚡ **Live SPA & Mutation Updates** — Automatically detects dynamic schema changes, client-side route changes (Next.js, Nuxt, Shopify, React), and DOM mutations.
- 🎯 **In-Page DOM Highlighting** — Hovering or clicking an entity outlines its corresponding visual DOM node on the live webpage.
- 🧭 **Inspect in Elements** — Optional reveal of the source node in the Elements panel (button or Alt-click). Ordinary clicks stay on the Schema tab.
- 🤖 **AI & GEO (Generative Engine Optimization) Readiness** — One-click **Copy for AI Prompt**, **Copy Agent Bundle** (JSON), and **Copy Agent Markdown** for seamless integration with LLMs and AI search engines.
- 🔗 **External Validators** — Direct one-click links to Google Rich Results Test and `validator.schema.org` (opens with encoded page URL only on explicit click).
- 🌓 **Native Theme Parity** — Uses Chrome DevTools system colors and follows the `default` / `dark` theme.

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

## 💻 Local Development & Sandbox

You can develop and test the UI without loading unpacked extensions into Chrome DevTools:

```bash
# Start the local browser sandbox testbed
npm run dev
# 👉 Open http://localhost:3333 in your browser
```

Switch between realistic mock fixtures (E-Commerce, Multi-Author Article, Restaurant Knowledge Graph, Deprecated Schema) with live score validation and theme toggling.

---

## 🧪 CLI Validator & Tests

### Validate any File or URL from Terminal
```bash
# Validate a local JSON-LD file
npm run validate ./path/to/schema.json

# Validate a live website directly
npm run validate https://example.com/product
```

### Run Full Test Suite
```bash
# Runs bundle engine, smoke checks, rule audits, and security guardrails
npm test
```

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
├── sandbox/                 # Standalone local development sandbox
│   ├── index.html           # Browser testbed for rapid UI development
│   └── fixtures.js          # Realistic mock schema fixtures
├── vendor/                  # Vendored VanJS 1.6.1 & VanX 0.6.3 (zero-build)
│   ├── van.js
│   └── van-x.js
├── ui/                      # Modular VanJS reactive UI & Styles
│   ├── store.js             # VanX deep reactive proxy store & actions
│   ├── app.js               # Main Schema panel layout orchestrator
│   ├── sidebar-view.js      # Elements sidebar VanJS view
│   ├── theme.css            # System color & typography design tokens
│   ├── panel.css            # Panel layout, tree, graph, & SERP styles
│   ├── sidebar.css          # Elements sidebar styles
│   ├── components/          # Reusable UI components
│   │   ├── toolbar.js       # Main header toolbar & export menu
│   │   ├── score-card.js    # Quality score ring & error badges
│   │   └── entity-list.js   # Left master entity sidebar pane
│   └── views/               # Dedicated workspace views
│       ├── tree.js          # Recursive monospace tree inspector
│       ├── raw.js           # Raw JSON view & sandbox editor
│       ├── findings.js      # Validation findings list & severity badges
│       ├── serp.js          # Google SERP rich preview cards
│       └── graph.js         # Visual entity knowledge graph
├── devtools/                # Chrome DevTools host integration
│   ├── devtools.html        # Entrypoint initializing Schema panel & Elements sidebar
│   ├── devtools.js          # Chrome panel/sidebar registration
│   ├── panel.html           # Main Schema DevTools panel container
│   ├── panel.js             # Host eval, theme sync, SPA mutation poller
│   ├── sidebar.html         # Elements panel Schema sidebar container
│   ├── sidebar.js           # $0 DOM inspection host controller
│   ├── host.js              # Shared host utilities & exception formatting
│   └── engine.classic.js    # Bundled schema engine (generated)
├── src/                     # Core extraction, validation & scoring engine
│   ├── catalog/             # Modular declarative rule definitions
│   │   ├── rich-results.js  # 23 Google Search gallery rules
│   │   ├── deprecations.js  # Deprecated Schema.org types
│   │   └── syntax.js        # Strict JSON-LD syntax validators
│   ├── extract.js           # In-page DOM snapshot & metadata extraction
│   ├── normalize.js         # Flattening & entity normalization
│   ├── rules.js             # Catalog loader & rule aggregation
│   ├── validate.js          # Findings & validation engine
│   ├── score.js             # 0–100 quality scoring algorithm
│   ├── agent.js             # AI agent JSON bundle & markdown export builders
│   └── types.js             # JSDoc type definitions
├── scripts/                 # CLI & automation tooling
│   ├── dev.mjs              # Local sandbox dev server (http://localhost:3333)
│   ├── test.mjs             # Unified test suite (engine, UI, catalog, guardrails)
│   ├── bundle.mjs           # Classic engine bundler (devtools/engine.classic.js)
│   ├── validate.mjs         # Terminal CLI schema validator (files & live URLs)
│   └── compare.mjs          # Automated comparison with validator.schema.org
└── icons/                   # Extension icons (16px, 32px, 48px, 128px)
```

---

## 📄 License

Original implementation. Licensed under the MIT License.
