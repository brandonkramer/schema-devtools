/**
 * Rule catalog audit and validation script.
 * Asserts structural validity, documentation URLs, and property naming in src/catalog/.
 * @file
 */

import { RICH_RESULT_RULES } from '../src/catalog/rich-results.js';
import { DEPRECATED_TYPES, FAQ_GOOGLE_STATUS } from '../src/catalog/deprecations.js';

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`❌ [ERROR] ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`⚠️ [WARN] ${msg}`);
  warnings++;
}

console.log('🔍 Auditing Schema Rule Catalog...\n');

// 1. Check Rich Result Rules
const seenTypes = new Set();

for (const rule of RICH_RESULT_RULES) {
  if (!rule.type || typeof rule.type !== 'string') {
    error(`Rule missing valid 'type' string: ${JSON.stringify(rule)}`);
    continue;
  }

  if (seenTypes.has(rule.type)) {
    error(`Duplicate rule for type: '${rule.type}'`);
  }
  seenTypes.add(rule.type);

  if (!Array.isArray(rule.required)) {
    error(`Rule '${rule.type}' required properties must be an Array.`);
  }

  if (!Array.isArray(rule.recommended)) {
    error(`Rule '${rule.type}' recommended properties must be an Array.`);
  }

  if (!rule.docsUrl || typeof rule.docsUrl !== 'string' || !rule.docsUrl.startsWith('https://')) {
    error(`Rule '${rule.type}' docsUrl must be a valid https:// URL. Found: ${rule.docsUrl}`);
  }

  // Check property naming
  const allProps = [...(rule.required || []), ...(rule.recommended || [])];
  for (const prop of allProps) {
    if (typeof prop !== 'string' || !/^[a-zA-Z0-9_@]+$/.test(prop)) {
      warn(`Rule '${rule.type}' has non-standard property name: '${prop}'`);
    }
  }
}

// 2. Check Deprecations
for (const dep of DEPRECATED_TYPES) {
  if (typeof dep !== 'string' || !dep.trim()) {
    error(`Deprecated type entry must be a non-empty string: ${JSON.stringify(dep)}`);
  }
}

// 3. Check FAQ Status
if (!FAQ_GOOGLE_STATUS.code || !FAQ_GOOGLE_STATUS.message || !FAQ_GOOGLE_STATUS.docsUrl) {
  error(`FAQ_GOOGLE_STATUS is missing required fields (code, message, docsUrl).`);
}

console.log(`📊 Catalog Summary:`);
console.log(`   - Active Rich Result Rules: ${RICH_RESULT_RULES.length}`);
console.log(`   - Deprecated Types:         ${DEPRECATED_TYPES.length} (${DEPRECATED_TYPES.join(', ')})`);
console.log(`   - FAQ Notice Status:        Configured`);
console.log(`   - Errors:                   ${errors}`);
console.log(`   - Warnings:                 ${warnings}\n`);

if (errors > 0) {
  console.error('❌ Rule catalog audit failed.');
  process.exit(1);
} else {
  console.log('✅ Rule catalog audit passed cleanly.');
}
