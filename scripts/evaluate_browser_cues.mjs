// Synthetic ablation of the list/prose boundary; not an authorship benchmark.
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/detector.js', import.meta.url), 'utf8');
const modelBundle = JSON.parse(fs.readFileSync(new URL('../models/default-models.json', import.meta.url), 'utf8'));
const list = ['gate', 'door', 'roof', 'shed', 'wall']
  .map((item) => '- We inspect the ' + item + ' after work today').join('\n');
const ablated = source.replace(
  'const prose = parsed.sentences.filter((sentence) => !sentence.isList);',
  'const prose = parsed.sentences;'
);
if (ablated === source) throw new Error('List ablation no longer matches the detector; update the experiment.');

function assess(code) {
  const context = vm.createContext({ modelBundle });
  vm.runInContext(code + '\nthis.engine = createDetectorEngine({ platform: "linkedin", modelBundle });', context);
  const result = context.engine.analyze(list);
  return {
    words: result.metrics.wordCount,
    sentencesOrItems: result.metrics.sentenceCount,
    patterns: Array.from(result.cueAssessment.families, (family) => family.name)
  };
}

console.log(JSON.stringify({
  input: list,
  listsTreatedAsProse: assess(ablated),
  releasedRules: assess(source)
}, null, 2));
