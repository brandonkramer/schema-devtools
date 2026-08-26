#!/usr/bin/env node

import { normalize } from '../src/normalize.js';
import { validate } from '../src/validate.js';
import { score } from '../src/score.js';
import { FIXTURES } from '../sandbox/fixtures.js';

const target = process.argv[2];

async function querySMV(html) {
  try {
    const params = new URLSearchParams();
    params.append('html', html);
    const res = await fetch('https://validator.schema.org/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await res.text();
    const jsonStr = text.replace(/^\)\]\}\x27\n?/, '');
    return JSON.parse(jsonStr);
  } catch (err) {
    return { error: err.message };
  }
}

async function compareSnapshot(name, url, canonical, rawJsonBlocks) {
  console.log(`\n============================================================`);
  console.log(`🔬 Comparing: ${name}`);
  console.log(`============================================================`);

  const html = `<!DOCTYPE html><html><head>${rawJsonBlocks
    .map((b) => `<script type="application/ld+json">${typeof b === 'string' ? b : JSON.stringify(b)}</script>`)
    .join('')}</head><body></body></html>`;

  const snapshot = {
    url,
    canonical,
    jsonld: rawJsonBlocks.map((b, index) => {
      const parsed = typeof b === 'string' ? JSON.parse(b) : b;
      return { index, raw: JSON.stringify(parsed), parsed, parseError: null, selector: `jsonld:${index}` };
    }),
    microdata: [],
    rdfa: [],
  };

  // 1. Local Schema DevTools Engine
  const { entities } = normalize(snapshot);
  const findings = validate(snapshot, entities);
  const quality = score(findings, entities);

  // 2. Official Schema.org Validator
  const smvData = await querySMV(html);
  const smvNodes = smvData.tripleGroups?.[0]?.nodes || [];
  const smvErrors = smvNodes.reduce((acc, n) => acc + (n.errors?.length || 0), 0);

  console.log(`📌 Extracted Types:`);
  console.log(`   • Schema DevTools:  [${entities.map((e) => e.types.join(', ')).join(' | ')}] (${entities.length} entities)`);
  console.log(`   • validator.schema: [${smvNodes.map((n) => n.types?.map((t) => t.value).join(', ')).join(' | ')}] (${smvNodes.length} nodes)`);

  console.log(`\n📊 Syntax & Error Validation:`);
  console.log(`   • Schema DevTools:  ${quality.errorCount} errors, ${quality.warningCount} warnings · Score: ${quality.total}/100 [${quality.label.toUpperCase()}]`);
  console.log(`   • validator.schema: ${smvErrors} errors`);

  if (findings.length > 0) {
    console.log(`\n💡 Schema DevTools Rich-Result Recommendations:`);
    findings.slice(0, 4).forEach((f) => {
      console.log(`   • [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
    });
    if (findings.length > 4) console.log(`   • ...and ${findings.length - 4} more recommendations`);
  }

  const isConsistent = quality.errorCount === smvErrors;
  console.log(`\n🎯 Result: ${isConsistent ? '✅ Highly Consistent' : '⚠️ Divergence Detected'}`);
}

async function run() {
  if (target) {
    let rawBlocks = [];
    if (target.startsWith('http://') || target.startsWith('https://')) {
      const res = await fetch(target);
      const html = await res.text();
      const matches = html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of matches) {
        try { rawBlocks.push(JSON.parse(m[1])); } catch {}
      }
    }
    await compareSnapshot(target, target, target, rawBlocks);
  } else {
    for (const [key, fixture] of Object.entries(FIXTURES)) {
      await compareSnapshot(fixture.name, fixture.url, fixture.canonical, fixture.entities.map((e) => e.data));
    }
  }
  console.log('\n============================================================\n');
}

run();
