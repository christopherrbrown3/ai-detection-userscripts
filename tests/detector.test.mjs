import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEngine, loadModels } from './helpers.mjs';

test('short text gets an exact cue count and sample class', () => {
  const engine = loadEngine('x');
  const analysis = engine.analyze('Great point. I agree!', { kind: 'post' }, { sensitivity: 'balanced' });
  assert.equal(analysis.label.level, 'cue-none');
  assert.equal(analysis.label.text, '0/6 cue families');
  assert.equal(analysis.cueAssessment.coverage.level, 'short');
});

test('phrase features use boundaries and normalize curly apostrophes', () => {
  const engine = loadEngine();
  assert.equal(engine.countPhraseHits('This revision is clearer.', ['vision']), 0);
  assert.equal(engine.countPhraseHits('Let’s dive in. Let\'s dive in!', ["let's dive in"]), 2);
});

test('hashed character n-grams are fixed-size and normalized', () => {
  const engine = loadEngine();
  const vector = engine.hashedCharacterNgrams('A varied sample with punctuation, contractions, and 123 numbers.');
  assert.equal(vector.length, 128);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-12);
});

test('long text exposes explainable cue families and plain-language evidence', () => {
  const engine = loadEngine('reddit');
  const text = [
    'I tried this last Tuesday after the bus was late, and honestly the first attempt was a mess. The cable slipped, I dropped a screw, and my neighbor laughed at the noise.',
    'Here are the key takeaways. First, leverage a robust strategic framework. Moreover, it is important to unlock scalable outcomes. In conclusion, these actionable steps elevate the journey.',
    'Back in my kitchen I changed the bracket, used the old wrench, and finally got it working. It still rattles sometimes, so I would not call the result perfect.'
  ].join(' ');
  const analysis = engine.analyze(text, { kind: 'post' }, { sensitivity: 'balanced' });
  assert.notEqual(analysis.evidence.level, 'insufficient');
  assert.ok(analysis.segments.length >= 2);
  assert.match(analysis.disclaimer, /not proof/i);
  assert.equal(analysis.calibrated, false);
  assert.equal(analysis.label.text, `${analysis.cueAssessment.families.length}/6 cue families`);
  assert.ok(analysis.cueAssessment.families.some((family) => family.id === 'formulaic-framing'));
  assert.ok(analysis.cueAssessment.families.every((family) => family.detail.length > 10));
});

test('cue rubric distinguishes a highly patterned post from an irregular anecdote', () => {
  const engine = loadEngine('linkedin');
  const patterned = engine.analyze(
    [
      'Two years apart. Two different data pipelines. The exact same result — to the millisecond.',
      "Here's what made it worth examining: the later run followed a completely different path.",
      'Result: one section improved — another habit remained unchanged.',
      'The first record tells you the ceiling moved. The tied record tells you exactly where the ceiling is.'
    ].join(' '),
    { kind: 'post' },
    { sensitivity: 'balanced' }
  );
  const anecdote = engine.analyze(
    'I rebuilt the shelf on Tuesday after measuring it wrong twice. The drill slipped, the dog barked at me, and I borrowed a square from my neighbor before dinner. It still leans a little, but the books finally fit.',
    { kind: 'post' },
    { sensitivity: 'balanced' }
  );
  assert.equal(patterned.label.level, 'cue-multiple');
  assert.equal(patterned.label.text, `${patterned.cueAssessment.families.length}/6 cue families`);
  assert.equal(anecdote.label.level, 'cue-none');
  assert.ok(patterned.cueAssessment.points > anecdote.cueAssessment.points);
  assert.ok(patterned.cueAssessment.families.some((family) => family.id === 'parallel-rhythm'));
  assert.ok(patterned.cueAssessment.families.some((family) => family.id === 'structured-presentation'));
});

test('uncalibrated cue rubric presents an exact family count', () => {
  const engine = loadEngine('linkedin');
  const analysis = engine.analyze(
    'Here are the key takeaways from this strategic journey. Moreover, a robust framework can unlock scalable outcomes for every stakeholder. In conclusion, these actionable steps offer a clear path forward for the entire organization.',
    { kind: 'post' },
    { sensitivity: 'balanced' }
  );
  assert.equal(analysis.label.text, `${analysis.cueAssessment.families.length}/6 cue families`);
  assert.ok(['cue-none', 'cue-one', 'cue-multiple'].includes(analysis.label.level));
});

test('held-out calibration metadata changes the runtime score path', () => {
  const bundle = loadModels();
  const copy = JSON.parse(JSON.stringify(bundle));
  copy.models['linkedin:post'].calibration = { slope: 0, intercept: 0 };
  const engine = loadEngine('linkedin', copy);
  const analysis = engine.analyze(
    'This is a sufficiently long English post with several ordinary sentences. It contains enough words to establish a usable evidence level and test the calibrated scoring path safely.',
    { kind: 'post' },
    { sensitivity: 'balanced' }
  );
  assert.equal(analysis.signal, 0.5);
  assert.equal(analysis.calibrated, true);
});
