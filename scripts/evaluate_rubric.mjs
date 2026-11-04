// Measures the shipped cue rubric on labeled JSONL. Measurement only: no rule,
// weight, or threshold is fitted from the data, and nothing here ships.
//
//   node scripts/evaluate_rubric.mjs --input data/hc3-eli5.jsonl [--input more.jsonl]
//     [--baseline-ref <git-ref>] [--sensitivity strict|balanced|sensitive] [--research] [--limit N] [--json out.json]
//
// Rows follow training/README.md: {text, authorship: human|ai|mixed, platform?,
// kind?, links?, rendersMarkdown?}; rendersMarkdown defaults to the site adapter's flag. Text published before 30 Nov 2022 can serve as a human-only
// false-positive control set without any AI-labeled data.
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const inputs = [];
let baselineRef = null;
let jsonOut = null;
let limit = Infinity;
let research = false;
let sensitivity = 'balanced';
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--input') inputs.push(args[++index]);
  else if (arg === '--baseline-ref') baselineRef = args[++index];
  else if (arg === '--json') jsonOut = args[++index];
  else if (arg === '--limit') limit = Number(args[++index]);
  else if (arg === '--research') research = true;
  else if (arg === '--sensitivity') sensitivity = args[++index];
  else throw new Error('Unknown argument: ' + arg);
}
if (!inputs.length) throw new Error('Usage: node scripts/evaluate_rubric.mjs --input rows.jsonl [--baseline-ref ref] [--research] [--json out.json]');

const modelBundle = JSON.parse(fs.readFileSync(new URL('models/default-models.json', root), 'utf8'));
const sources = { current: fs.readFileSync(new URL('src/detector.js', root), 'utf8') };
if (baselineRef) sources[baselineRef] = execFileSync('git', ['show', baselineRef + ':src/detector.js'], { cwd: root, encoding: 'utf8' });

// Research signals (research/signals.mjs) are measured here only; they are not
// bundled into the userscripts. ZipPy's zlib engine uses raw deflate, level 9.
let researchSignals = null;
if (research) {
  const { createResearchSignals } = await import(new URL('research/signals.mjs', root));
  const data = (name) => fs.readFileSync(new URL('research/data/' + name, root), 'utf8');
  researchSignals = createResearchSignals({
    seedText: data('zippy-ai-generated.txt'),
    deflateRawSize: (text) => zlib.deflateRawSync(Buffer.from(text, 'utf8'), { level: 9, memLevel: 9 }).length,
    slopWords: JSON.parse(data('slop-words.json')).words,
    slopTrigrams: JSON.parse(data('slop-trigrams.json')).trigrams
  });
}

const PLATFORMS = new Set(['linkedin', 'x', 'reddit', 'facebook', 'youtube']);
// Pass each site's rendersMarkdown flag exactly as the runtime does, read from
// the adapter itself (factories are side-effect-free). Reddit renders Markdown,
// so literal **bold** there must not count as a paste artifact.
const RENDERS_MARKDOWN = Object.fromEntries([...PLATFORMS].map((id) => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('src/platforms/' + id + '.js', root), 'utf8') + '\nthis.adapter = createPlatformAdapter();', context);
  return [id, context.adapter.rendersMarkdown === true];
}));
function engineFactory(source) {
  const context = vm.createContext({ modelBundle });
  vm.runInContext(source + '\nthis.create = createDetectorEngine;', context);
  const cache = new Map();
  return (platform) => {
    const key = PLATFORMS.has(platform) ? platform : 'unknown';
    if (!cache.has(key)) cache.set(key, context.create({ platform: key, modelBundle }));
    return cache.get(key);
  };
}

// The runtime decides visibility; mirror it for releases that predate
// cueAssessment.stamp (0.9.x stamped any matched family, high at 3+).
// "low" is the 0.10 "Possible AI" stamp, reported separately.
function stampOf(analysis) {
  const cues = analysis.cueAssessment;
  if (typeof cues.stamp === 'string') return cues.stamp;
  if (!cues.assessed || !cues.families.length) return 'none';
  return cues.families.length >= 3 ? 'high' : 'moderate';
}

function wilson(hits, n) {
  if (!n) return [0, 0];
  const z = 1.96;
  const p = hits / n;
  const denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

function rate(hits, n) {
  const [low, high] = wilson(hits, n);
  return { hits, n, rate: n ? hits / n : 0, ci95: [low, high] };
}

function bucket(words) {
  return words < 20 ? '0-19' : words < 50 ? '20-49' : words < 120 ? '50-119' : '120+';
}

// Rank-based ROC AUC for a continuous research signal; ties count half.
function auc(humanValues, aiValues) {
  if (!humanValues.length || !aiValues.length) return null;
  const all = [...humanValues.map((value) => [value, 0]), ...aiValues.map((value) => [value, 1])].sort((a, b) => a[0] - b[0]);
  let rankSum = 0;
  for (let index = 0; index < all.length;) {
    let end = index;
    while (end + 1 < all.length && all[end + 1][0] === all[index][0]) end += 1;
    const averageRank = (index + end + 2) / 2;
    for (let k = index; k <= end; k += 1) if (all[k][1] === 1) rankSum += averageRank;
    index = end + 1;
  }
  return (rankSum - aiValues.length * (aiValues.length + 1) / 2) / (humanValues.length * aiValues.length);
}

const rows = [];
for (const path of inputs) {
  if (rows.length >= limit) break;
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const authorship = String(row.authorship || row.label || '').toLowerCase();
    const label = ['0', 'human'].includes(authorship) ? 'human' : ['1', 'ai'].includes(authorship) ? 'ai' : 'mixed';
    rows.push({ ...row, label });
    if (rows.length >= limit) break;
  }
}

const report = { purpose: 'Rule measurement only; nothing is fitted or shipped from these rows.', inputs, sensitivity, n: rows.length, engines: {} };
for (const [name, source] of Object.entries(sources)) {
  const engineFor = engineFactory(source);
  const byLabel = {};
  const families = {};
  const byLength = {};
  const researchValues = {};
  for (const row of rows) {
    const platform = String(row.platform || 'unknown');
    const engine = engineFor(platform);
    const rendersMarkdown = typeof row.rendersMarkdown === 'boolean' ? row.rendersMarkdown : RENDERS_MARKDOWN[platform] === true;
    const analysis = engine.analyze(String(row.text || ''), {
      kind: row.kind === 'post' ? 'post' : 'comment', links: Array.isArray(row.links) ? row.links : [], rendersMarkdown
    }, { cueSensitivity: sensitivity });
    const stamp = stampOf(analysis);
    const label = row.label;
    const entry = byLabel[label] || (byLabel[label] = { n: 0, assessed: 0, stamped: 0, high: 0, possible: 0 });
    entry.n += 1;
    if (analysis.cueAssessment.assessed) entry.assessed += 1;
    if (stamp === 'moderate' || stamp === 'high') entry.stamped += 1;
    if (stamp === 'high') entry.high += 1;
    if (stamp === 'low') entry.possible += 1;
    for (const family of analysis.cueAssessment.families) {
      const counts = families[family.id] || (families[family.id] = {});
      counts[label] = (counts[label] || 0) + 1;
    }
    const lengthKey = bucket(analysis.metrics.wordCount);
    const lengthEntry = (byLength[lengthKey] || (byLength[lengthKey] = {}));
    const lengthLabel = lengthEntry[label] || (lengthEntry[label] = { n: 0, stamped: 0 });
    lengthLabel.n += 1;
    if (stamp === 'moderate' || stamp === 'high') lengthLabel.stamped += 1;
    if (researchSignals && name === 'current') {
      const signals = researchSignals(String(row.text || ''));
      for (const [key, value] of Object.entries(signals)) {
        if (!Number.isFinite(value)) continue;
        const values = researchValues[key] || (researchValues[key] = { human: [], ai: [] });
        if (label === 'human' || label === 'ai') values[label].push(value);
      }
    }
  }
  const summary = { labels: {}, families: {}, length: {}, research: {} };
  for (const [label, entry] of Object.entries(byLabel)) {
    summary.labels[label] = {
      n: entry.n, assessed: rate(entry.assessed, entry.n),
      stamped: rate(entry.stamped, entry.n), high: rate(entry.high, entry.n),
      possible: rate(entry.possible, entry.n), anyStamp: rate(entry.stamped + entry.possible, entry.n)
    };
  }
  for (const [id, counts] of Object.entries(families)) {
    summary.families[id] = {};
    for (const label of Object.keys(byLabel)) summary.families[id][label] = rate(counts[label] || 0, byLabel[label].n);
    const human = summary.families[id].human;
    const ai = summary.families[id].ai;
    summary.families[id].likelihoodRatio = human && ai && human.rate ? ai.rate / human.rate : null;
  }
  for (const [lengthKey, labels] of Object.entries(byLength)) {
    summary.length[lengthKey] = Object.fromEntries(Object.entries(labels).map(([label, entry]) => [label, rate(entry.stamped, entry.n)]));
  }
  for (const [key, values] of Object.entries(researchValues)) {
    const mean = (list) => list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;
    summary.research[key] = { auc: auc(values.human, values.ai), meanHuman: mean(values.human), meanAi: mean(values.ai) };
  }
  report.engines[name] = summary;
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2) + '\n');
const pct = (value) => (100 * value.rate).toFixed(1) + '% [' + (100 * value.ci95[0]).toFixed(1) + '–' + (100 * value.ci95[1]).toFixed(1) + ']';
for (const [name, summary] of Object.entries(report.engines)) {
  console.log('\n== ' + name);
  for (const [label, entry] of Object.entries(summary.labels)) {
    console.log(`${label.padEnd(6)} n=${String(entry.n).padStart(5)}  AI Detected ${pct(entry.stamped)}  high ${pct(entry.high)}  Possible AI ${pct(entry.possible)}  any ${pct(entry.anyStamp)}`);
  }
  console.log('family'.padEnd(26) + 'human'.padEnd(24) + 'ai'.padEnd(24) + 'LR+');
  for (const [id, entry] of Object.entries(summary.families).sort()) {
    console.log(id.padEnd(26) + (entry.human ? pct(entry.human) : '-').padEnd(24) + (entry.ai ? pct(entry.ai) : '-').padEnd(24) +
      (entry.likelihoodRatio === null ? '-' : entry.likelihoodRatio.toFixed(1)));
  }
  for (const [lengthKey, labels] of Object.entries(summary.length).sort()) {
    console.log('length ' + lengthKey.padEnd(7) + Object.entries(labels).map(([label, value]) => label + ' ' + pct(value)).join('   '));
  }
  for (const [key, value] of Object.entries(summary.research)) {
    console.log('research ' + key.padEnd(24) + 'AUC ' + (value.auc === null ? '-' : value.auc.toFixed(3)) +
      '  mean human ' + (value.meanHuman ?? 0).toFixed(4) + '  mean ai ' + (value.meanAi ?? 0).toFixed(4));
  }
}
