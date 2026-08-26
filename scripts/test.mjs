import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'Bundle Schema Engine', cmd: 'node', args: ['scripts/bundle-engine.mjs'] },
  { name: 'Schema Engine Smoke Checks', cmd: 'node', args: ['scripts/smoke-engine.mjs'] },
  { name: 'Rule Catalog & Syntax Audit', cmd: 'node', args: ['scripts/audit-rules.mjs'] },
  { name: 'VanJS Panel & Sidebar Smoke Checks', cmd: 'node', args: ['scripts/smoke-panel.mjs'] },
  {
    name: 'Security & Dependency Guardrails',
    cmd: 'git',
    args: ['grep', '\\.agents', '--', ':!.agents', ':!*.md', ':!.cursor', ':!.gitignore', ':!scripts/test.mjs'],
    allowEmpty: true,
  },
];

console.log('🧪 Running Full Schema DevTools Verification Suite...\n');

let allPassed = true;

for (const step of steps) {
  process.stdout.write(`⏳ ${step.name}... `);
  const result = spawnSync(step.cmd, step.args, { encoding: 'utf8' });

  if (step.allowEmpty && result.stdout.trim() === '') {
    console.log('✅ Passed');
    continue;
  }

  if (result.status === 0 && !step.allowEmpty) {
    console.log('✅ Passed');
  } else if (result.status !== 0 && step.allowEmpty && result.stdout.trim() === '') {
    console.log('✅ Passed');
  } else {
    console.log('❌ FAILED');
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    allPassed = false;
    break;
  }
}

if (!allPassed) {
  console.error('\n❌ Test suite failed.');
  process.exit(1);
} else {
  console.log('\n🎉 All test suites and security guardrails passed cleanly!');
}
