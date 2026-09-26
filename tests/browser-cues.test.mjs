import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEngine, loadDom } from './helpers.mjs';

const ordinary = 'I fixed the back gate after work on Tuesday. The hinge still squeaks, but the latch finally closes and the dog cannot nose it open anymore.';
const framed = 'Here are the key takeaways from this week. In conclusion, we need to check the new release with the support team before we ship it to everyone.';
const tweet = (id, body) => '<article role="article" id="' + id + '"><div data-testid="User-Name">Author</div><div data-testid="tweetText">' + body + '</div></article>';
const wait = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) await wait(10);
  assert.ok(predicate(), 'expected browser update did not arrive');
}
function browser(t, html, options) {
  const dom = loadDom('x', '<!doctype html><body>' + html + '</body>', 'https://x.com/home', options);
  t.after(() => { dom.window.__controller.stop(); dom.window.close(); });
  return dom.window;
}
function ids(analysis) { return Array.from(analysis.cueAssessment.families, (family) => family.id); }

test('ordinary refusals and quoted model references do not imply self-reference', () => {
  const engine = loadEngine('x');
  for (const text of [
    'I cannot attend the meeting tomorrow because my train is cancelled.',
    'The article quoted "as an AI" while discussing the way we use chatbots.',
    "The article quoted 'as an AI' while discussing the way we use chatbots.",
    'The article quoted “as an AI 🙂” while discussing the way we use chatbots.',
    'The article quoted \x60as an AI\x60 while discussing the way we use chatbots.'
  ]) assert.ok(!ids(engine.analyze(text)).includes('self-disclosure'));
  const result = engine.analyze('As an AI language model, I can help you think about the problem.');
  assert.ok(ids(result).includes('self-disclosure'));
});

test('one parser handles line breaks, abbreviations, decimals and URLs', () => {
  const engine = loadEngine();
  const text = 'Dr. Smith paid 3.50 for it. We read https://example.com/a.\nThen we went home.';
  const full = engine.extractFeatures(text);
  const light = engine.analyze(text);
  assert.equal(full.metrics.sentenceCount, 3);
  assert.equal(light.metrics.sentenceCount, 3);
  assert.equal(full.metrics.sentenceLenCV, light.metrics.sentenceLenCV);
  const uneven = engine.analyze('Buy the milk\nCall the plumber about the leaking kitchen sink\nCheck whether the replacement part has finally arrived at the local hardware shop today\nSend our invoice\nTake the dog outside before leaving for the afternoon appointment');
  assert.equal(uneven.metrics.sentenceCount, 5);
  assert.ok(uneven.metrics.sentenceLenCV > 0.28);
  assert.ok(!ids(uneven).includes('sentence-uniformity'));
});

test('phrase matches cannot bridge an excluded quotation', () => {
  const result = loadEngine().analyze('The article describes it as "a joke" an AI design and discusses how the software works for us.');
  assert.ok(!ids(result).includes('self-disclosure'));
  const openings = loadEngine().analyze('We "carefully" tested the gate today. We "also" tested the shed this afternoon. We "finally" tested the roof before the rain arrived.');
  assert.ok(!ids(openings).includes('repeated-openings'));
});

test('a list contributes structure without manufacturing rhythm or repetition cues', () => {
  const result = loadEngine().analyze([
    '- We inspect the gate after work today',
    '- We inspect the door after work today',
    '- We inspect the roof after work today',
    '- We inspect the shed after work today',
    '- We inspect the wall after work today'
  ].join('\n'));
  assert.deepEqual(ids(result), ['structured-presentation']);
});

test('repeated multiword openings have exact source spans', () => {
  const result = loadEngine().analyze('We tested the gate carefully after work. We tested the door with a new lock. We tested the roof before the rain came.');
  const cue = result.cueAssessment.families.find((family) => family.id === 'repeated-openings');
  assert.ok(cue);
  assert.equal(cue.spans.length, 3);
  for (const span of cue.spans) assert.equal(result.sourceText.slice(span.start, span.end), 'We tested the');
  const short = loadEngine().analyze('Dinner is ready. Bring your plate. Wash your hands.');
  assert.ok(!ids(short).includes('repeated-openings'));
});

test('repeated phrases are contiguous and do not reuse counted openings', () => {
  const result = loadEngine().analyze(
    'I left the blue paper lanterns beside the door because we were planning to decorate the garden before the guests arrived. ' +
    'After lunch my sister moved the blue paper lanterns beside the door and asked us to check the weather before carrying everything outside.'
  );
  const cue = result.cueAssessment.families.find((family) => family.id === 'content-repetition');
  assert.ok(cue);
  for (const span of cue.spans) {
    assert.ok(result.sourceText.slice(span.start, span.end).split(/\s+/).length >= 3);
  }
  const openings = loadEngine().analyze(
    'We tested the old garden gate before the rain arrived and noticed that its rusty hinge needed oil. ' +
    'We tested the old garden gate after lunch and discovered a small crack along the lower wooden panel. ' +
    'We tested the old garden gate again on Tuesday, when my neighbor brought a replacement latch and several useful tools.'
  );
  assert.ok(ids(openings).includes('repeated-openings'));
  assert.ok(!ids(openings).includes('content-repetition'));
});

test('unsupported and uncertain language are distinct from zero matched cues', () => {
  const engine = loadEngine();
  for (const text of [
    'Сегодня была хорошая погода. Мы пошли гулять в парк. Потом вернулись домой и приготовили ужин.',
    'No puedo asistir a la reunión de mañana. La oficina está cerrada y vamos a trabajar desde casa esta semana.'
  ]) {
    const result = engine.analyze(text);
    assert.equal(result.label.level, 'unassessed');
    assert.equal(result.cueAssessment.assessed, false);
  }
  assert.equal(engine.analyze(ordinary).label.level, 'cue-none');
});

test('DOM extraction preserves rendered boundaries and excludes quotes and code', (t) => {
  const window = browser(t, tweet('p',
    '<p>First paragraph.</p><p>Second paragraph.<br>Third line.</p>' +
    '<ul><li>We check the gate.</li><li>We oil the hinge.</li><li>We close the latch.</li></ul>' +
    '<blockquote>As an AI, here are the key takeaways.</blockquote><pre><code>const secret = 42;</code></pre>'));
  const result = window.__controller.getAnalysis(window.document.getElementById('p'));
  assert.match(result.sourceText, /First paragraph\.\n+Second paragraph\.\nThird line\./);
  assert.match(result.sourceText, /- We check the gate\./);
  assert.doesNotMatch(result.sourceText, /As an AI|secret/);
  assert.equal(result.excluded.quotes, 1);
  assert.equal(result.excluded.code, 1);
});

test('excluded DOM code cannot join unrelated words into a phrase', (t) => {
  const window = browser(t, tweet('p', 'The article describes it as <code>value = 42</code> an AI design and discusses how the software works for us.'));
  const result = window.__controller.getAnalysis(window.document.getElementById('p'));
  assert.ok(!ids(result).includes('self-disclosure'));
});

test('a longer quoted X post cannot replace its author commentary', (t) => {
  const window = browser(t, '<article role="article" id="p"><div data-testid="User-Name">Author</div>' +
    '<div data-testid="tweetText">' + ordinary + '</div>' +
    '<div role="link"><div data-testid="tweetText">' + framed.repeat(3) + '</div></div></article>');
  const result = window.__controller.getAnalysis(window.document.getElementById('p'));
  assert.equal(result.sourceText, ordinary);
  assert.equal(result.excluded.quotes, 1);
});

test('paragraphs and line breaks inside list items retain list ownership', (t) => {
  const list = ['gate', 'door', 'roof', 'shed', 'wall'].map((item) =>
    '<li><p>We inspect the ' + item + '</p><p>after work<br>today</p></li>').join('');
  const window = browser(t, tweet('p', '<ul>' + list + '</ul>'));
  const result = window.__controller.getAnalysis(window.document.getElementById('p'));
  assert.deepEqual(ids(result), ['structured-presentation']);
  assert.equal(result.metrics.sentenceCount, 5);
  assert.match(result.sourceText, /- We inspect the gate after work today/);
});

test('literal line breaks in pre-wrap text survive extraction', (t) => {
  const window = browser(t, tweet('p', '<span style="white-space:pre-wrap">We opened the gate.\nWe closed the door.\nWe checked the lock.</span>'));
  const result = window.__controller.getAnalysis(window.document.getElementById('p'));
  assert.match(result.sourceText, /gate\.\nWe/);
  assert.equal(result.metrics.sentenceCount, 3);
});

test('badges expose short and uncertain samples neutrally', (t) => {
  const window = browser(t, tweet('short', 'I agree with your point. That is helpful!') + tweet('unknown', 'No puedo asistir a la reunión de mañana.'));
  const short = window.document.querySelector('#short .ai-heuristic-badge');
  const unknown = window.document.querySelector('#unknown .ai-heuristic-badge');
  assert.match(short.textContent, /Short sample/);
  assert.equal(short.dataset.cueTone, 'neutral');
  assert.match(unknown.textContent, /not assessed.*Language uncertain/);
  assert.equal(unknown.dataset.cueTone, 'neutral');
});

test('examples highlight exact text and diagnostics are deferred until expanded', async (t) => {
  const window = browser(t, tweet('p', framed));
  const post = window.document.getElementById('p');
  const original = post.querySelector('[data-testid="tweetText"]').innerHTML;
  const result = window.__controller.getAnalysis(post);
  let diagnosticCalls = 0;
  const diagnose = result.getDiagnostics;
  result.getDiagnostics = () => { diagnosticCalls += 1; return diagnose(); };
  post.querySelector('.ai-heuristic-badge').click();
  const dialog = window.document.querySelector('[role="dialog"]');
  const highlights = [...dialog.querySelectorAll('mark')].map((mark) => mark.textContent);
  assert.ok(highlights.includes('Here are'));
  for (const phrase of highlights) assert.ok(framed.includes(phrase));
  assert.equal(post.querySelector('[data-testid="tweetText"]').innerHTML, original);
  assert.equal(diagnosticCalls, 0);
  dialog.querySelector('details').open = true;
  await until(() => dialog.querySelector('.ai-heuristic-popover__technical').textContent);
  assert.equal(diagnosticCalls, 1);
  dialog.querySelector('details').open = false;
  dialog.querySelector('details').open = true;
  await wait();
  assert.equal(diagnosticCalls, 1);
});

test('mutations only re-extract affected posts and ignore unrelated UI', async (t) => {
  const window = browser(t, tweet('one', ordinary) + tweet('two', framed) + '<div id="clock"></div>');
  await wait();
  const reads = [];
  const read = window.aiHeuristicReadContent;
  window.aiHeuristicReadContent = (node) => { reads.push(node.closest('article')?.id); return read(node); };
  window.document.querySelector('#two [data-testid="tweetText"]').firstChild.data += ' We checked again.';
  await until(() => reads.length);
  assert.deepEqual(reads, ['two']);
  reads.length = 0;
  window.document.getElementById('clock').textContent = 'Updated elsewhere';
  window.document.querySelector('#one .ai-heuristic-badge').click();
  await wait();
  assert.deepEqual(reads, []);
});

test('duplicate text uses the bounded analysis cache', async (t) => {
  const window = browser(t, tweet('one', ordinary));
  let analyses = 0;
  const analyze = window.__controller.engine.analyze;
  window.__controller.engine.analyze = (...args) => { analyses += 1; return analyze(...args); };
  window.document.body.insertAdjacentHTML('beforeend', tweet('two', ordinary));
  await until(() => window.document.querySelector('#two .ai-heuristic-badge'));
  assert.equal(analyses, 0);
});

test('offscreen posts wait for intersection and edits are fresh on entry', async (t) => {
  let io;
  const window = browser(t, tweet('one', ordinary) + tweet('two', framed), {
    autoScan: false,
    setup(window) {
      window.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; this.observed = new Set(); io = this; }
        observe(element) { this.observed.add(element); }
        unobserve(element) { this.observed.delete(element); }
        disconnect() { this.observed.clear(); }
        enter(element) { this.callback([{ target: element, isIntersecting: true }]); }
      };
    }
  });
  const one = window.document.getElementById('one');
  const two = window.document.getElementById('two');
  assert.equal(io.observed.size, 2);
  assert.equal(window.__controller.getAnalysis(one), undefined);
  io.enter(one);
  await until(() => window.__controller.getAnalysis(one));
  assert.equal(window.__controller.getAnalysis(two), undefined);
  two.querySelector('[data-testid="tweetText"]').textContent = ordinary;
  await wait();
  io.enter(two);
  await until(() => window.__controller.getAnalysis(two));
  assert.equal(window.__controller.getAnalysis(two).sourceText, ordinary);
  two.remove();
  await until(() => !io.observed.has(two));
});

test('empty posts remove stale badges and stopping cancels queued work', async (t) => {
  const window = browser(t, tweet('p', ordinary));
  window.document.querySelector('[data-testid="tweetText"]').textContent = '';
  await until(() => !window.document.querySelector('.ai-heuristic-badge'));
  window.document.querySelector('[data-testid="tweetText"]').textContent = framed;
  window.__controller.stop();
  await wait();
  assert.equal(window.document.querySelector('.ai-heuristic-badge'), null);
});

test('a badge removed by the site is restored from cached analysis', async (t) => {
  const window = browser(t, tweet('p', ordinary));
  window.document.querySelector('.ai-heuristic-badge').remove();
  await until(() => window.document.querySelector('.ai-heuristic-badge'));
  assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length, 1);
});
