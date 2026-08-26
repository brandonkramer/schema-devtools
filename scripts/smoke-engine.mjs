import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { EXTRACT_SOURCE } from '../src/extract.js';
import { normalize } from '../src/normalize.js';
import { validate } from '../src/validate.js';
import { score } from '../src/score.js';

const root = new URL('../', import.meta.url);

function snapshotFor(parsed, agent = { hasModelContext: false, modelContext: null, hasLlmsTxtLink: false }) {
  return {
    url: 'https://example.test/page',
    title: 'Example',
    canonical: 'https://example.test/page',
    robots: null,
    inspectedAt: '2026-08-26T00:00:00.000Z',
    jsonld: [{
      index: 0,
      raw: JSON.stringify(parsed),
      parsed,
      parseError: null,
      selector: 'script:nth-of-type(1)',
      domIndex: 0,
    }],
    microdata: [],
    rdfa: [],
    agent,
  };
}

function inspect(parsed) {
  const snapshot = snapshotFor(parsed);
  const { entities } = normalize(snapshot);
  const findings = validate(snapshot, entities);
  return { entities, findings, score: score(findings, entities) };
}

function hasCode(result, code) {
  return result.findings.some((finding) => finding.code === code);
}

const faq = inspect({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [{
    '@type': 'Question',
    name: 'Question?',
    acceptedAnswer: { '@type': 'Answer', text: 'Answer.' },
  }],
});
assert(hasCode(faq, 'FAQ_GOOGLE_UNSUPPORTED'));
assert.equal(faq.findings.filter((finding) => finding.severity !== 'info').length, 0);
assert.equal(faq.score.total, score([], faq.entities).total);

const website = inspect({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  potentialAction: { '@type': 'SearchAction' },
});
assert(hasCode(website, 'SEARCH_ACTION_GOOGLE_UNSUPPORTED'));
assert(!hasCode(website, 'WEBSITE_MISSING_SEARCH_ACTION'));

const howTo = inspect({ '@context': 'https://schema.org', '@type': 'HowTo', name: 'Task' });
assert(hasCode(howTo, 'HOWTO_GOOGLE_UNSUPPORTED'));
assert.equal(howTo.findings.find((finding) => finding.code === 'HOWTO_GOOGLE_UNSUPPORTED')?.severity, 'info');

const profile = inspect({
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  mainEntity: { '@type': 'Person' },
});
assert(hasCode(profile, 'PROFILE_MISSING_IDENTITY'));

const forum = inspect({
  '@context': 'https://schema.org',
  '@type': 'DiscussionForumPosting',
  author: { '@type': 'Person', name: 'A. Person' },
  datePublished: '2026-08-26T12:00:00Z',
  image: 'https://example.test/image.jpg',
});
assert(!hasCode(forum, 'FORUM_MISSING_CONTENT'));

const linkedReturnPolicy = inspect({
  '@context': 'https://schema.org',
  '@type': 'MerchantReturnPolicy',
  merchantReturnLink: 'https://example.test/returns',
});
assert(!linkedReturnPolicy.findings.some((finding) => finding.code.startsWith('RETURN_POLICY_MISSING_')));

const finiteReturnPolicy = inspect({
  '@context': 'https://schema.org',
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
});
assert(hasCode(finiteReturnPolicy, 'RETURN_POLICY_MISSING_DAYS'));

const invalidDate = inspect({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Invalid calendar date',
  datePublished: '2026-02-30',
});
assert(hasCode(invalidDate, 'INVALID_DATE'));

const agentEntities = faq.entities;
const plainScore = score([], agentEntities);
const scoreWithIgnoredAgentArgument = score([], agentEntities, {
  hasModelContext: true,
  modelContext: null,
  hasLlmsTxtLink: true,
});
assert.deepEqual(scoreWithIgnoredAgentArgument, plainScore);
assert.equal(plainScore.breakdown.agent, 0);

assert.equal(typeof EXTRACT_SOURCE, 'string');
assert(EXTRACT_SOURCE.includes('JSON.stringify(data)'));
assert(EXTRACT_SOURCE.includes("rel.includes('describedby')"));
assert(!EXTRACT_SOURCE.includes('navigator.modelContext'));

const bundleSource = readFileSync(new URL('../devtools/engine.classic.js', import.meta.url), 'utf8');
assert(!/^\s*(?:import|export)\s/m.test(bundleSource));
const sandbox = {};
vm.runInNewContext(bundleSource, sandbox);
assert.equal(typeof sandbox.SchemaDT?.validate, 'function');
assert.equal(typeof sandbox.SchemaDT?.score, 'function');

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert(!('host_permissions' in manifest));
assert(!('permissions' in manifest) || manifest.permissions.length === 0);

const panelSource = readFileSync(new URL('../devtools/panel.js', import.meta.url), 'utf8');
assert(panelSource.includes('setThemeChangeHandler'));
assert(!panelSource.includes('panels.onThemeChanged'));
assert(!panelSource.includes('window.__SCHEMA_DEVTOOLS__ ='));
assert(panelSource.includes('PAGE_WATCH_REMOVE'));

console.log('Schema engine smoke checks passed.');
