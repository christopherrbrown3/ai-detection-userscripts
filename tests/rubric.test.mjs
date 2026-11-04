import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { closeDoms, loadDom, loadEngine } from './helpers.mjs';

afterEach(closeDoms);
const linkedin = loadEngine('linkedin');
const cues = (text, context = {}, sensitivity = 'strict') => linkedin.analyze(text, { kind: 'post', ...context }, { cueSensitivity: sensitivity }).cueAssessment;
const plain = (value) => JSON.parse(JSON.stringify(value));
const ids = (text, context) => cues(text, context).families.map((family) => family.id);
const filler = ' We repaired the gate after work yesterday. The latch still closes with a gentle push, and the dog stayed inside all evening.';

test('hand-written probes keep their documented stamps and families', () => {
  const { probes } = JSON.parse(fs.readFileSync(new URL('./fixtures/rubric-probes.json', import.meta.url), 'utf8'));
  assert.ok(probes.length >= 20);
  for (const probe of probes) {
    for (const [sensitivity, expected] of Object.entries(probe.stamps)) {
      const result = cues(probe.text, {}, sensitivity);
      assert.equal(result.stamp, expected, probe.id + ' / ' + sensitivity);
      if (sensitivity === 'strict') assert.deepEqual(plain(result.families.map((family) => family.id)), probe.families, probe.id);
    }
  }
  const human = probes.filter((probe) => probe.style === 'human-style');
  assert.equal(human.filter((probe) => probe.stamps.strict !== 'none').length, 1, 'only the documented weak-phrase probe stamps in strict');
  assert.ok(human.every((probe) => probe.stamps.balanced !== 'moderate' || probe.stamps.strict === 'moderate'), 'balanced adds only Possible AI stamps');
});

test('fixed points: definitive 3, moderate 1, supporting 0.5 only alongside another family', () => {
  const list = 'Here is what we checked this morning before opening the workshop:\n- The door opens cleanly\n- The light works again\n- The roof holds in the rain';
  const listOnly = cues(list);
  assert.deepEqual(plain(listOnly.families.map((family) => [family.id, family.tier])), [['structured-presentation', 'supporting']]);
  assert.equal(listOnly.points, 0);
  assert.equal(listOnly.stamp, 'none');
  const framed = cues('Key takeaways from this week. In conclusion, ' + list);
  assert.equal(framed.points, 1.5);
  assert.equal(framed.stamp, 'moderate');
  const definitive = cues('As an AI language model, I cannot browse the web.' + filler);
  assert.equal(definitive.points, 3);
  assert.equal(definitive.stamp, 'high');
});

test('structure-only evidence needs two families; high without an artifact needs word choice and structure', () => {
  const uniform = 'The team met early on Monday to plan the week. Everyone brought notes from the previous sprint review. We listed the tasks that still needed an owner. Then we matched each task with a person. The meeting ended a little before ten.';
  const single = cues(uniform);
  assert.ok(single.families.some((family) => family.id === 'sentence-uniformity'));
  assert.equal(single.families.filter((family) => family.tier !== 'supporting').length, 1);
  assert.equal(single.stamp, 'none');
  assert.equal(single.level, 'cue-weak');
  // Balanced shows it as Possible AI; sensitive lets one structure family stamp.
  assert.equal(cues(uniform, {}, 'balanced').stamp, 'low');
  assert.equal(cues(uniform, {}, 'balanced').level, 'cue-low');
  assert.equal(cues(uniform, {}, 'sensitive').stamp, 'moderate');
  // Three word-choice families reach 3 points but stay moderate without structure evidence.
  const wordy = 'In conclusion, it is important to remember that this vibrant, multifaceted tapestry serves as a testament to pivotal growth. ' +
    'Overall, the meticulous team plays a crucial role, highlighting how innovation thrives across the realm of modern work every single day.';
  const result = cues(wordy);
  const decisive = result.families.filter((family) => family.tier !== 'supporting');
  assert.ok(decisive.length >= 3, result.families.map((family) => family.id).join());
  assert.ok(decisive.every((family) => family.evidence === 'word-choice'));
  assert.ok(result.points >= 3);
  assert.equal(result.stamp, 'moderate');
});

test('short samples stamp only on definitive artifacts', () => {
  assert.equal(cues('In conclusion, here are the key takeaways for today.').stamp, 'none');
  assert.equal(cues('In conclusion, here are the key takeaways for today.', {}, 'balanced').stamp, 'low');
  assert.equal(cues('In conclusion, here are the key takeaways for today.', {}, 'sensitive').stamp, 'moderate');
  const short = cues('As an AI language model, I cannot do that.');
  assert.equal(short.coverage.level, 'short');
  assert.equal(short.stamp, 'high');
});

test('assistant leftovers: openers, delivery lines, sign-offs and Title Case placeholders', () => {
  for (const text of [
    'Sure! Here is a quick summary of the plan for the team.' + filler,
    "Here's a revised version of your post:\n\nWe shipped the new dashboard today." + filler,
    'We shipped the new dashboard today.' + filler + ' Feel free to customize it further to fit your voice.',
    'Congratulations to [Your Name] and the whole team on the launch.' + filler,
    'Join us on 2025-XX-XX at [Company Name] headquarters.' + filler
  ]) assert.ok(ids(text).includes('assistant-leftovers'), text);
  for (const text of [
    'Honestly my plan is [insert joke here] and then we go home.' + filler,
    'Read [Your Logical Fallacy Is](https://yourlogicalfallacyis.com) before you argue.' + filler,
    'Sure, the bus was late again, but we made it.' + filler,
    '“Feel free to customize it further,” the template said.' + filler
  ]) assert.ok(!ids(text).includes('assistant-leftovers'), text);
});

test('knowledge-cutoff and capability disclaimers count as self-disclosure', () => {
  assert.ok(ids('As of my last knowledge update, the company had not released a new version.' + filler).includes('self-disclosure'));
  assert.ok(ids("I don't have access to real-time information, so check the official site." + filler).includes('self-disclosure'));
  assert.ok(!ids('I do not have much experience with this camera yet.' + filler).includes('self-disclosure'));
});

test('markup artifacts: citation remnants and literal Markdown only where the site does not render it', () => {
  const pasted = 'Our quarterly results are in :contentReference[oaicite:2]{index=2} and they look solid.' + filler;
  assert.ok(ids(pasted).includes('markup-artifacts'));
  const markdown = '**Key Lessons From My First Year**\n\nBuilding a company is hard.' + filler;
  assert.ok(ids(markdown).includes('markup-artifacts'));
  assert.ok(!ids(markdown, { rendersMarkdown: true }).includes('markup-artifacts'));
  assert.ok(!ids('That was **so** good.' + filler).includes('markup-artifacts'), 'one inline emphasis is ordinary');
  assert.ok(ids('## What we learned\nBuilding a company is hard.' + filler).includes('markup-artifacts'));
  assert.ok(!ids('#AI #startups\nBuilding a company is hard.' + filler).includes('markup-artifacts'), 'hashtags are not headings');
});

test('AI referral links are read from hrefs, including redirect wrappers, and only for documented sources', () => {
  const text = 'This article on battery recycling is worth a read.' + filler;
  for (const href of [
    'https://example.com/story?utm_source=chatgpt.com',
    'https://l.facebook.com/l.php?u=' + encodeURIComponent('https://example.com/a?utm_source=openai') + '&h=AT0',
    'https://www.youtube.com/redirect?event=video_description&q=' + encodeURIComponent('https://example.com/?utm_source=copilot.com'),
    'https://example.com/?referrer=grok.com'
  ]) {
    const result = cues(text, { links: [href] });
    const family = result.families.find((candidate) => candidate.id === 'ai-referral-link');
    assert.ok(family, href);
    assert.equal(family.tier, 'moderate');
    assert.equal(result.stamp, 'moderate');
  }
  assert.ok(!ids(text, { links: ['https://example.com/?utm_source=newsletter', 'https://example.com/chatgpt.com'] }).includes('ai-referral-link'));
  assert.ok(ids('Source: https://example.com/a?utm_source=chatgpt.com' + filler).includes('ai-referral-link'));
});

test('digit-aware punctuation ignores clock times and numeric ranges', () => {
  const text = 'We met at 10:30 and stayed until 12:15. I lived there 2015–2019 and the place has not changed a bit. The pizza place on 5th is still open and still cash only.';
  assert.ok(!ids(text).includes('structured-presentation'));
});

test('emoji and keycap bullets are list markers in JavaScript', () => {
  for (const marker of ['🚀', '💡', '👉', '1️⃣', '⭐']) {
    const text = 'Three lessons from this year:\n' + [1, 2, 3].map((n) => marker + ' Lesson number ' + n + ' about shipping small and often').join('\n');
    assert.ok(ids(text).includes('structured-presentation'), marker);
  }
});

test('framing counts inflections once, ignores human markers, and scales with length', () => {
  const buzz = cues('In conclusion, we are leveraging new tools and empowering every creator while we leverage our robust platform.' + filler);
  const framing = buzz.families.find((family) => family.id === 'formulaic-framing');
  assert.ok(framing);
  assert.match(framing.detail, /3 promotional terms/);
  assert.ok(!ids("TL;DR if you're on a budget, the older model is fine. Overall I'd say go for it." + filler).includes('formulaic-framing'));
  const long = 'In conclusion, it is important to check the hinge. ' + Array.from({ length: 50 }, (_, n) => 'We checked part number ' + n + ' today.').join(' ');
  const result = cues(long);
  assert.ok(!result.families.some((family) => family.id === 'formulaic-framing'), 'two phrases are not enough in a long post');
});

test('conditional abbreviations and contraction-heavy English parse as intended', () => {
  const parsed = linkedin.parseText('We met at 9 a.m. at Acme Inc. on Main St. and spent approx. 20 min. on item No. 5 today. It went fine. Then we left at 10 a.m. Lunch was next.');
  assert.deepEqual(plain(parsed.sentences.map((sentence) => sentence.text)), [
    'We met at 9 a.m. at Acme Inc. on Main St. and spent approx. 20 min. on item No. 5 today.',
    'It went fine.', 'Then we left at 10 a.m.', 'Lunch was next.'
  ]);
  const punchy = cues("Success isn't luck. It's consistency. Leadership isn't control. It's trust. Growth isn't speed. It's direction. Remember that.");
  assert.equal(punchy.assessed, true);
});

test('runtime passes author-owned link hrefs, not quoted ones, and caches by link', async () => {
  const body = 'This article on battery recycling is worth a read. We repaired the gate after work yesterday and the latch still closes with a gentle push.';
  const html = '<!doctype html><body>' +
    '<article role="article" id="linked"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + body +
    ' <a href="https://example.com/story?utm_source=chatgpt.com">example.com/story</a></div></article>' +
    '<article role="article" id="plain"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + body +
    ' <a href="https://example.com/story?utm_source=newsletter">example.com/story</a></div></article>' +
    '<article role="article" id="quoted"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + body +
    ' <blockquote><a href="https://example.com/story?utm_source=chatgpt.com">quoted link</a></blockquote></div></article></body>';
  const { window } = loadDom('x', html, 'https://x.com/home');
  const analysis = (id) => window.__controller.getAnalysis(window.document.getElementById(id));
  assert.ok(analysis('linked').cueAssessment.families.some((family) => family.id === 'ai-referral-link'));
  assert.ok(window.document.querySelector('#linked .ai-heuristic-badge'));
  assert.ok(!analysis('plain').cueAssessment.families.some((family) => family.id === 'ai-referral-link'));
  assert.equal(window.document.querySelector('#plain .ai-heuristic-badge'), null);
  assert.ok(!analysis('quoted').cueAssessment.families.some((family) => family.id === 'ai-referral-link'));
});

test('adapter contract validates the optional rendersMarkdown flag', () => {
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(new URL('../src/bootstrap.js', import.meta.url), 'utf8') + '\nwindow.validate=validateAIAdapter;');
  const adapter = { id: 'example', name: 'Example', postSelector: 'article', commentSelector: 'aside', isTopLevel() {}, extractContent() {}, placeBadge() {} };
  assert.doesNotThrow(() => dom.window.validate({ ...adapter, rendersMarkdown: true }, { id: 'example' }));
  assert.throws(() => dom.window.validate({ ...adapter, rendersMarkdown: 'yes' }, { id: 'example' }));
  dom.window.close();
});

test('chatbot register needs two distinct phrases except in the sensitive profile', () => {
  const two = 'Hey fellow Redditors! My sleep schedule has been a mess since the move and I keep waking up at three. Any advice would be greatly appreciated.';
  assert.ok(ids(two).includes('chatbot-register'));
  const one = 'My sleep schedule has been a mess since the move and I keep waking up at three in the morning. Thanks in advance.';
  assert.ok(!ids(one).includes('chatbot-register'));
  assert.ok(cues(one, {}, 'sensitive').families.some((family) => family.id === 'chatbot-register'));
});

test('creator-post template needs a closer, and only counts as a pattern when sensitive', () => {
  const { probes } = JSON.parse(fs.readFileSync(new URL('./fixtures/rubric-probes.json', import.meta.url), 'utf8'));
  const post = probes.find((probe) => probe.id === 'linkedin-creator-template').text;
  const tier = (sensitivity) => cues(post, {}, sensitivity).families.find((family) => family.id === 'engagement-template').tier;
  assert.equal(tier('strict'), 'supporting');
  assert.equal(tier('sensitive'), 'moderate');
  assert.match(cues(post).families.find((family) => family.id === 'engagement-template').detail, /engagement prompt, hashtag block/);
  const listOnly = 'Packing list for the trip\n\n- Tent and poles\n- Stove and fuel\n- Too many socks\n- A paperback for rainy days';
  assert.ok(!ids(listOnly, {}).includes('engagement-template'));
  // Each sentence on its own line still forms a contrast pivot.
  assert.ok(ids("Most people think leadership means having every answer.\n\nIt's not.\n\nIt's about asking better questions every single week with the team.\n\nThe best leaders don't create followers.\nThey create more leaders who grow on their own.").includes('contrast-framing'));
});

test('stamp sensitivity setting switches between strict, Possible AI and sensitive stamps', () => {
  const uniform = 'The team met early on Monday to plan the week. Everyone brought notes from the previous sprint review. We listed the tasks that still needed an owner. Then we matched each task with a person. The meeting ended a little before ten.';
  const html = '<!doctype html><body><article role="article" id="u"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + uniform + '</div></article></body>';
  const key = 'ai-heuristic:x:settings:v2';
  const badgeFor = (stored) => {
    const { window } = loadDom('x', html, 'https://x.com/home', { setup(w) { if (stored) w.localStorage.setItem(key, JSON.stringify(stored)); } });
    const badge = window.document.querySelector('#u .ai-heuristic-badge');
    const result = badge && { text: badge.textContent, tone: badge.dataset.cueTone, label: badge.getAttribute('aria-label') };
    window.close();
    return result;
  };
  const balanced = badgeFor(null);
  assert.equal(balanced.text, 'Possible AI');
  assert.equal(balanced.tone, 'low');
  assert.match(balanced.label, /^Possible AI: low signal level/);
  assert.equal(badgeFor({ cueSensitivity: 'strict' }), null);
  assert.equal(badgeFor({ cueSensitivity: 'sensitive' }).text, 'AI Detected');
  assert.equal(badgeFor({ cueSensitivity: 'nonsense', sensitivity: 'aggressive' }).text, 'Possible AI', 'invalid values fall back to balanced');

  const { window } = loadDom('x', html, 'https://x.com/home');
  window.document.querySelector('#u .ai-heuristic-badge').click();
  const select = window.document.querySelector('select[aria-label="Stamp sensitivity"]');
  assert.ok(select);
  assert.deepEqual(plain([...select.options].map((option) => option.value)), ['strict', 'balanced', 'sensitive']);
  assert.equal(select.value, 'balanced');
  select.value = 'strict';
  select.dispatchEvent(new window.Event('change'));
  assert.equal(JSON.parse(window.localStorage.getItem(key)).cueSensitivity, 'strict');
  window.__controller.scanNow();
  assert.equal(window.document.querySelector('#u .ai-heuristic-badge'), null);
});

test('overlapping list entries count as one phrase (PR #16 review)', () => {
  const help = 'My sleep schedule has been a mess since the move and I keep waking up at three in the morning, even on weekends. Any advice would be greatly appreciated.';
  const result = cues(help);
  assert.ok(!result.families.some((family) => family.id === 'chatbot-register'), 'one sentence cannot supply two distinct phrases');
  assert.equal(result.stamp, 'none');
  assert.ok(!ids('Feel free to share your thoughts on the new schedule, since the old one kept everyone up past midnight on weekdays.').includes('chatbot-register'));
});

test('links whose anchor text sits inside inline quotation marks are ignored (PR #16 review)', () => {
  const href = 'https://example.com/story?utm_source=chatgpt.com';
  const quoted = 'My colleague wrote “see the report for details” and then we went back to repairing the gate after work yesterday evening.';
  assert.ok(!ids(quoted, { links: [{ href, text: 'the report' }] }).includes('ai-referral-link'));
  const plainText = 'See the report for details. We went back to repairing the gate after work yesterday evening with the old latch.';
  assert.ok(ids(plainText, { links: [{ href, text: 'the report' }] }).includes('ai-referral-link'));
  assert.ok(ids(plainText, { links: [href] }).includes('ai-referral-link'), 'plain href strings remain supported');
});

test('an href change on an existing link re-analyzes its post (PR #16 review)', async () => {
  const body = 'This article on battery recycling is worth a read. We repaired the gate after work yesterday and the latch still closes with a gentle push.';
  const html = '<!doctype html><body><article role="article" id="p"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + body +
    ' <a id="l" href="https://example.com/story?utm_source=newsletter">example.com/story</a></div></article></body>';
  const { window } = loadDom('x', html, 'https://x.com/home');
  assert.equal(window.document.querySelector('#p .ai-heuristic-badge'), null);
  window.document.getElementById('l').setAttribute('href', 'https://example.com/story?utm_source=chatgpt.com');
  const deadline = Date.now() + 2000;
  while (!window.document.querySelector('#p .ai-heuristic-badge') && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(window.document.querySelector('#p .ai-heuristic-badge'));
});

test('the details panel describes the active sensitivity profile (PR #16 review)', () => {
  const uniform = 'The team met early on Monday to plan the week. Everyone brought notes from the previous sprint review. We listed the tasks that still needed an owner. Then we matched each task with a person. The meeting ended a little before ten.';
  const html = '<!doctype html><body><article role="article" id="u"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + uniform + '</div></article></body>';
  for (const [sensitivity, expected, absent] of [
    ['sensitive', /In Sensitive mode cut-offs are lower/, /only alongside another pattern/],
    ['balanced', /only alongside another pattern.*Possible AI means/, /In Sensitive mode/]
  ]) {
    const { window } = loadDom('x', html, 'https://x.com/home', { setup(w) { w.localStorage.setItem('ai-heuristic:x:settings:v2', JSON.stringify({ cueSensitivity: sensitivity })); } });
    window.document.querySelector('#u .ai-heuristic-badge').click();
    const text = window.document.querySelector('.ai-heuristic-popover').textContent;
    assert.match(text, expected, sensitivity);
    assert.doesNotMatch(text, absent, sensitivity);
    window.close();
  }
});

test('evaluation harness honors --limit across inputs and each site\'s Markdown flag (PR #16 review)', async () => {
  const { execFileSync } = await import('node:child_process');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-'));
  const markdown = '**Weekend Repair Notes**\nWe fixed the gate after work yesterday and the latch still closes with a gentle push. The dog stayed inside all evening.';
  const row = (platform) => JSON.stringify({ text: markdown, authorship: 'human', platform, kind: 'post' });
  fs.writeFileSync(path.join(dir, 'a.jsonl'), [row('reddit'), row('reddit')].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'b.jsonl'), [row('linkedin'), row('linkedin')].join('\n') + '\n');
  const run = (...args) => {
    const out = path.join(dir, 'out.json');
    execFileSync('node', ['scripts/evaluate_rubric.mjs', ...args, '--sensitivity', 'strict', '--json', out], { stdio: 'pipe' });
    return JSON.parse(fs.readFileSync(out, 'utf8'));
  };
  assert.equal(run('--input', path.join(dir, 'a.jsonl'), '--input', path.join(dir, 'b.jsonl'), '--limit', '2').n, 2);
  const reddit = run('--input', path.join(dir, 'a.jsonl')).engines.current;
  assert.equal(reddit.families['markup-artifacts'], undefined, 'Reddit renders Markdown');
  const linkedinRun = run('--input', path.join(dir, 'b.jsonl')).engines.current;
  assert.equal(linkedinRun.families['markup-artifacts'].human.hits, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
