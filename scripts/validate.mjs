#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalize } from '../src/normalize.js';
import { validate } from '../src/validate.js';
import { score } from '../src/score.js';
import { buildAgentBundle } from '../src/agent.js';

const target = process.argv[2];

if (!target) {
  console.log(`
Schema DevTools — CLI Validator

Usage:
  npm run validate <file.json | file.html | https://url>
  node scripts/validate.mjs <file.json | file.html | https://url>

Examples:
  npm run validate ./sandbox/fixtures.js
  npm run validate https://example.com/product
`);
  process.exit(1);
}

async function run() {
  let content = '';
  let url = target;

  if (target.startsWith('http://') || target.startsWith('https://')) {
    console.log(`🌐 Fetching URL: ${target}...`);
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SchemaDT-CLI/1.0' },
      });
      content = await res.text();
    } catch (e) {
      console.error(`❌ Failed to fetch ${target}:`, e.message);
      process.exit(1);
    }
  } else {
    const fullPath = resolve(process.cwd(), target);
    if (!existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      process.exit(1);
    }
    content = readFileSync(fullPath, 'utf8');
    url = `file://${fullPath}`;
  }

  let snapshot;

  // Check if target is a JSON file or HTML
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      snapshot = {
        url,
        canonical: url,
        jsonld: items.map((raw, index) => ({
          raw: JSON.stringify(raw),
          parsed: raw,
          parseError: null,
          index,
          selector: `jsonld:${index}`,
        })),
        microdata: [],
        rdfa: [],
      };
    } catch (err) {
      console.error(`❌ Invalid JSON syntax: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Basic regex extract for JSON-LD scripts in HTML
    const jsonld = [];
    const scriptMatches = content.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    let index = 0;
    for (const match of scriptMatches) {
      const raw = match[1].trim();
      try {
        const parsed = JSON.parse(raw);
        jsonld.push({ raw, parsed, parseError: null, index, selector: `jsonld:${index}` });
      } catch (err) {
        jsonld.push({ raw, parsed: null, parseError: { message: err.message }, index, selector: `jsonld:${index}` });
      }
      index++;
    }
    snapshot = {
      url,
      canonical: url,
      jsonld,
      microdata: [],
      rdfa: [],
    };
  }

  const { entities } = normalize(snapshot);
  const findings = validate(snapshot, entities);
  const quality = score(findings, entities);

  console.log('\n============================================================');
  console.log(`📊 Analysis Results for: ${url}`);
  console.log('============================================================');
  console.log(`Score:        ${quality.total}/100 [${quality.label.toUpperCase()}]`);
  console.log(`Entities:     ${entities.length} detected`);
  console.log(`Errors:       ${quality.errorCount}`);
  console.log(`Warnings:     ${quality.warningCount}`);
  console.log('------------------------------------------------------------');

  if (entities.length > 0) {
    console.log('\n🏷️  Entities Detected:');
    entities.forEach((entity, i) => {
      console.log(`  ${i + 1}. [${entity.format.toUpperCase()}] ${entity.types.join(', ') || 'Thing'} (${entity.id})`);
    });
  }

  if (findings.length > 0) {
    console.log('\n🔍 Validation Findings:');
    findings.forEach((finding, i) => {
      const icon = finding.severity === 'error' ? '❌' : finding.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
      console.log(`  ${icon} [${finding.code}] ${finding.message}`);
      if (finding.path) console.log(`     Path: ${finding.path}`);
      if (finding.docsUrl) console.log(`     Docs: ${finding.docsUrl}`);
    });
  } else {
    console.log('\n✅ All Schema.org & Google Rich-Result checks passed cleanly!');
  }
  console.log('============================================================\n');
}

run();
