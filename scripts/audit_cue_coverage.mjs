// Synthetic behavior probes, not labeled human/AI data or an accuracy benchmark.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const probes = JSON.parse(fs.readFileSync(new URL('tests/fixtures/cue-audit.json', root), 'utf8'));
const modelBundle = JSON.parse(fs.readFileSync(new URL('models/default-models.json', root), 'utf8'));
const sources = { current: fs.readFileSync(new URL('src/detector.js', root), 'utf8') };
const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 2 || args[0] !== '--baseline-ref') throw new Error('Usage: node scripts/audit_cue_coverage.mjs [--baseline-ref git-ref]');
  sources[args[1]] = execFileSync('git', ['show', args[1] + ':src/detector.js'], { cwd: root, encoding: 'utf8' });
}
const engines = Object.fromEntries(Object.entries(sources).map(([name, source]) => {
  const context = vm.createContext({ modelBundle });
  vm.runInContext(source + '\nthis.engine = createDetectorEngine({ platform: "linkedin", modelBundle });', context);
  return [name, context.engine];
}));
console.log(JSON.stringify({
  purpose: 'Synthetic rule-coverage audit. No authorship labels, accuracy estimate, or calibration evidence.',
  detectorSha256: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, crypto.createHash('sha256').update(source).digest('hex')])),
  probes: probes.map(probe => ({ ...probe, results: Object.fromEntries(Object.entries(engines).map(([name, engine]) => {
    const a = engine.analyze(probe.text, {kind:'post'});
    return [name, {words:a.metrics.wordCount, sample:a.cueAssessment.coverage.level,
      families:Array.from(a.cueAssessment.families, f => f.id), assessed:a.cueAssessment.assessed ?? true}];
  })) }))
}, null, 2));
