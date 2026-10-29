import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { closeDoms, loadDom, loadGeneratedDom, loadEngine } from './helpers.mjs';

afterEach(closeDoms);
const ordinary = 'I fixed the gate after work yesterday. The hinge needs oil but the latch still closes with a gentle push.';
const moderate = 'Here are the key takeaways from this week. In conclusion, we need to check the new release with the support team before we ship it to everyone.';
const high = moderate + '\n- Check the first item\n- Check the second item\n- Check the third item\nAs an AI, I can help with your question.';
const contrast = 'We need not another enormous dashboard, but a clear explanation of what happened when the server stopped responding to requests. Our goal is not just a much faster launch, but a careful release that we can support for the next several years.';
const engine = loadEngine('x');
const families = text => engine.analyze(text, {kind:'post'}).cueAssessment.families;
const tweet = (id, text) => `<article role="article" id="${id}"><div data-testid="User-Name">Example</div><div data-testid="tweetText" style="white-space:pre-wrap;font-size:18px;line-height:27px">${text}</div></article>`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) await wait(10);
  assert.ok(predicate(), 'expected stamp state');
}
function pointer(window, node, type, pointerType = 'mouse') {
  const event = new window.Event(type);
  Object.defineProperty(event, 'pointerType', {value:pointerType});
  node.dispatchEvent(event);
}

test('repeated contrast adds one framing family with exact spans; a single contrast does not', () => {
  const matches = families(contrast);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'formulaic-framing');
  assert.match(matches[0].detail, /2 repeated contrast constructions/);
  assert.equal(matches[0].spans.length, 2);
  for (const span of matches[0].spans) assert.match(contrast.slice(span.start, span.end), /not.*but/);
  assert.equal(families(contrast.split('. ')[0] + '. ' + ordinary).length, 0);
  assert.equal(families('“' + contrast + '” ' + ordinary).length, 0);
  assert.equal(families('`' + contrast + '` ' + ordinary).length, 0);
  assert.equal(families('- ' + contrast.replace('. Our', '.\n- Our')).some(f => f.id === 'formulaic-framing'), false);
  assert.equal(families(moderate + ' ' + contrast).filter(f => f.id === 'formulaic-framing').length, 1);
});

test('paired contrasts preserve curly apostrophe offsets and require repeated constructions', () => {
  const text = 'It isn’t a magical shortcut to success. It is a careful process that we need to repeat each week. This isn’t a race to ship everything today. This is a chance to check whether the changes solve the actual problem for the people using them.';
  const framing = families(text).find(f => f.id === 'formulaic-framing');
  assert.ok(framing);
  assert.match(framing.detail, /2 repeated contrast constructions/);
  assert.match(text.slice(framing.spans[0].start, framing.spans[0].end), /^It isn’t/);
});

test('assistant artifacts require specific role/citation syntax and ignore quoted or code examples', () => {
  for (const artifact of ['<|im_start|>assistant', '<|start_header_id|>assistant<|end_header_id|>', '<|start|>assistant<|message|>', '\uE200cite\uE202turn0search0\uE201']) {
    const text = ordinary + ' ' + artifact;
    const reference = families(text).find(f => f.id === 'self-disclosure');
    assert.ok(reference, artifact);
    assert.equal(text.slice(reference.spans[0].start, reference.spans[0].end), artifact);
    assert.equal(families(ordinary + ' “' + artifact + '”').length, 0);
    assert.equal(families(ordinary + ' `' + artifact + '`').length, 0);
  }
  for (const suffix of ['ChatGPT', 'assistant', '**Heading**', '[1]', '\uE200cite\uE201', '\u200b\u00a0']) {
    assert.equal(families(ordinary + ' ' + suffix).length, 0, suffix);
  }
  assert.equal(families('As an AI, I can help with your question. ' + ordinary + ' <|im_start|>assistant')
    .filter(f => f.id === 'self-disclosure').length, 1);
});

for (const distribution of ['source', 'combined', 'targeted']) {
  const load = html => (distribution === 'source' ? loadDom : loadGeneratedDom)('x', html, 'https://x.com/home', {distribution}).window;

  test(distribution + ': zero/unassessed stays hidden, moderate/high stamps carry exact counts and post dimensions', () => {
    const window = load(tweet('none', ordinary) + tweet('unknown', 'No puedo asistir a la reunión de mañana.') + tweet('moderate', moderate) + tweet('high', high));
    const badges = [...window.document.querySelectorAll('.ai-heuristic-badge')];
    assert.equal(badges.length, 2);
    assert.deepEqual(badges.map(b => b.dataset.cueTone), ['moderate', 'high']);
    assert.deepEqual(badges.map(b => b.textContent), ['AI Detected', 'AI Detected']);
    assert.match(badges[0].getAttribute('aria-label'), /1 of 6 cue families/);
    assert.match(badges[1].getAttribute('aria-label'), /3 of 6 cue families/);
    assert.equal(badges[0].style.getPropertyValue('--aih-post-line-height'), '27px');
    assert.equal(badges[0].style.getPropertyValue('--aih-post-font-size'), '18px');
    assert.ok(window.__controller.getAnalysis(window.document.getElementById('none')));
  });

  test(distribution + ': hover grows without stealing focus, panel crossing stays open, click pins, Escape restores focus', async () => {
    const window = load(tweet('one', moderate)), document = window.document;
    const badge = document.querySelector('.ai-heuristic-badge');
    pointer(window, badge, 'pointerenter');
    let panel = document.querySelector('.ai-heuristic-popover');
    assert.equal(panel.dataset.entry, 'stamp');
    assert.equal(document.activeElement, document.body);
    pointer(window, badge, 'pointerleave');
    pointer(window, panel, 'pointerenter');
    await wait(240);
    assert.ok(panel.isConnected);
    pointer(window, panel, 'pointerleave');
    await until(() => !panel.isConnected);
    pointer(window, badge, 'pointerenter');
    badge.click();
    panel = document.querySelector('.ai-heuristic-popover');
    pointer(window, badge, 'pointerleave');
    await wait(240);
    assert.ok(panel.isConnected);
    assert.equal(document.activeElement, panel.querySelector('.ai-heuristic-popover__close'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
    assert.equal(document.querySelector('.ai-heuristic-popover'), null);
    assert.equal(document.activeElement, badge);
    pointer(window, badge, 'pointerenter', 'touch');
    assert.equal(document.querySelector('.ai-heuristic-popover'), null);
    badge.click();
    assert.ok(document.querySelector('.ai-heuristic-popover'), 'touch/keyboard activation opens details');
    badge.click();
    assert.equal(document.querySelector('.ai-heuristic-popover'), null);
  });

  test(distribution + ': edits remove a stale stamp and its hover panel, and later matches restore it', async () => {
    const window = load(tweet('one', moderate)), document = window.document;
    const post = document.getElementById('one');
    const body = post.querySelector('[data-testid="tweetText"]');
    pointer(window, post.querySelector('.ai-heuristic-badge'), 'pointerenter');
    body.textContent = ordinary;
    await until(() => !post.querySelector('.ai-heuristic-badge'));
    assert.equal(document.querySelector('.ai-heuristic-popover'), null);
    body.textContent = high;
    await until(() => post.querySelector('.ai-heuristic-badge'));
    assert.equal(post.querySelector('.ai-heuristic-badge').dataset.cueTone, 'high');
    pointer(window, post.querySelector('.ai-heuristic-badge'), 'pointerenter');
    pointer(window, post.querySelector('.ai-heuristic-badge'), 'pointerleave');
    window.__controller.stop();
    await wait(240);
    assert.equal(document.querySelector('.ai-heuristic-popover'), null);
    assert.equal(document.querySelector('.ai-heuristic-badge'), null);
  });

  test(distribution + ': identical text in a replaced text host refreshes stamp typography', () => {
    const window = load(tweet('one', moderate)), document = window.document;
    const post = document.getElementById('one');
    const oldHost = post.querySelector('[data-testid="tweetText"]');
    const newHost = oldHost.cloneNode(true);
    newHost.style.lineHeight = '32px';
    oldHost.replaceWith(newHost);
    window.__controller.scanNow();
    assert.equal(post.querySelector('.ai-heuristic-badge').style.getPropertyValue('--aih-post-line-height'), '32px');
    newHost.style.lineHeight = '36px';
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(post.querySelector('.ai-heuristic-badge').style.getPropertyValue('--aih-post-line-height'), '36px');
  });
}
