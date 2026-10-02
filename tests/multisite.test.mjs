import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bundleSource, closeDoms, evaluateBundle, loadFixture, loadGeneratedDom, registry } from './helpers.mjs';

afterEach(closeDoms);
const wait = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, timeout = 2000) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) await wait(10);
  assert.ok(predicate(), 'expected runtime state did not arrive');
}
const text = 'I tested the gate after work yesterday. The hinge needs oil but the latch still closes with a gentle push.';
const tweet = (id = 'tweet-1') => '<article role="article" id="' + id + '"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + text + '</div></article>';
const plain = (value) => JSON.parse(JSON.stringify(value));
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
function setEnabled(window, value) {
  window.document.querySelector('.ai-heuristic-launcher').click();
  const label = [...window.document.querySelectorAll('label')].find((node) => node.textContent === 'Enable style cues on this site');
  const input = label.querySelector('input');
  if (input.checked !== value) input.click();
}
function monitor(window) {
  const observers = [];
  const Native = window.MutationObserver;
  window.MutationObserver = class extends Native {
    constructor(callback) { super(callback); observers.push(this); this.active = false; }
    observe(...args) { this.active = true; super.observe(...args); }
    disconnect() { this.active = false; super.disconnect(); }
  };
  const intervals = new Set();
  const set = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
  window.setInterval = (...args) => { const id = set(...args); intervals.add(id); return id; };
  window.clearInterval = (id) => { intervals.delete(id); clear(id); };
  return { active: () => observers.filter((o) => o.active).length, intervals };
}

const baseline = JSON.parse(readFileSync('tests/fixtures/baseline-v0.4.json', 'utf8'));
for (const distribution of ['combined', 'targeted']) {
  for (const [site, expected] of Object.entries(baseline.sites)) {
    test(distribution + '/' + site + ' preserves v0.4 extracted text and cue results', () => {
      const {window} = loadGeneratedDom(site, loadFixture(site + '.html'), expected.url, {distribution});
      for (const [id, value] of Object.entries(expected.posts)) {
        const a = window.__controller.getAnalysis(window.document.getElementById(id));
        assert.deepEqual(plain({sourceText:a.sourceText, excluded:a.excluded, cues:a.cueAssessment, metrics:a.metrics}), value);
      }
    });
  }
}

test('every declared host dispatches exactly one matching adapter', () => {
  for (const entry of registry().sites) for (const host of entry.hosts) {
    const hostname = host.replace('*.', 'news.');
    const path = entry.id === 'youtube' ? '/watch?v=video000001' : '/';
    const {window} = loadGeneratedDom(entry.id, loadFixture(entry.id + '.html'), 'https://' + hostname + path, {setup(w) {
      w.localStorage.setItem('ai-heuristic:' + entry.id + ':settings:v2', JSON.stringify({enabled:true}));
    }});
    assert.equal(window.__lastSession.getStatus(), 'active');
    assert.equal(window.document.querySelectorAll('meta[data-ai-style-owner]').length, 1);
    assert.equal(window.document.querySelector('meta[data-ai-style-owner]').dataset.aiStyleOwner, entry.id);
    assert.ok(window.document.querySelectorAll('.ai-heuristic-badge').length);
    window.close();
  }
});

test('unsupported and deceptive hosts start no factories, observers, settings, or UI', () => {
  for (const url of ['https://example.org/', 'https://x.com.example.org/', 'https://notlinkedin.com/', 'https://reddit.com.evil.test/', 'http://x.com/']) {
    let reads = 0, observations = 0;
    const {window} = loadGeneratedDom('x', tweet(), url, {setup(w) {
      Object.defineProperty(w, 'localStorage', {get() { reads += 1; throw new Error('unexpected storage'); }});
      w.MutationObserver = class { constructor() { observations += 1; } };
    }});
    assert.equal(window.__lastSession, null);
    assert.equal(reads, 0);
    assert.equal(observations, 0);
    assert.equal(window.document.querySelector('[data-ai-heuristic-ui]'), null);
    window.close();
  }
});

test('unselected factories are never evaluated and invalid selected adapters fail cleanly', () => {
  const source = bundleSource('x').replace('"linkedin": function () {', '"linkedin": function () { throw new Error("must not start");');
  const {window} = loadGeneratedDom('x', tweet(), 'https://x.com/home', {source});
  assert.ok(window.__controller.getStatus().running);
  const warnings = [];
  const invalid = source.replace('"x": function () {', '"x": function () { return {};');
  const failed = loadGeneratedDom('x', tweet(), 'https://x.com/home', {source:invalid,setup(w){w.console.warn=(s)=>warnings.push(s);}});
  assert.equal(failed.window.__lastSession.getStatus(), 'failed');
  assert.equal(failed.window.document.querySelector('[data-ai-heuristic-ui]'), null);
  assert.equal(warnings.length, 1);
});

for (const order of [['combined', 'targeted'], ['targeted', 'combined'], ['combined', 'combined']]) {
  test('cooperative ownership avoids duplicate runtimes: ' + order.join(' then '), async () => {
    let resources;
    const {window} = loadGeneratedDom('x', tweet(), 'https://x.com/home', {distribution:order[0], setup(w){resources=monitor(w);}});
    const second = evaluateBundle(window, bundleSource('x', order[1]));
    second.getController()?.scanNow();
    await wait();
    assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length, 1);
    assert.equal(resources.active(), 2); // one minimal root watcher + one analysis watcher
    assert.equal(resources.intervals.size, 1);
    assert.equal(window.document.querySelector('meta[data-ai-style-owner]').dataset.distribution, 'combined');
    const current = window.__sessions.find((s) => s.getController()?.getStatus().running);
    assert.ok(current);
    current.stop();
    assert.equal(resources.active(), 0);
    assert.equal(resources.intervals.size, 0);
    assert.equal(window.document.querySelector('[data-ai-heuristic-ui]'), null);
    const restarted = evaluateBundle(window, bundleSource('x'));
    restarted.getController().scanNow();
    assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length, 1);
    assert.equal(resources.active(), 2);
  });
}

test('stale ownership is reclaimed and a newer targeted release wins over an older combined one', () => {
  const stale = '<meta data-ai-style-owner="x" data-version="0.1.0">';
  const {window} = loadGeneratedDom('x', stale + tweet(), 'https://x.com/home');
  const nextVersion = version.split('.').map((part, index) => Number(part) + (index === 2 ? 1 : 0)).join('.');
  const updated = bundleSource('x', 'targeted').replace('version:"' + version + '",distribution:', 'version:"' + nextVersion + '",distribution:');
  const next = evaluateBundle(window, updated);
  next.getController().scanNow();
  assert.equal(window.document.querySelectorAll('meta[data-ai-style-owner]').length, 1);
  assert.equal(window.document.querySelector('meta[data-ai-style-owner]').dataset.version, nextVersion);
  assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length, 1);
});

for (const order of ['before', 'after']) test('non-cooperating legacy UI ' + order + ' startup suspends new analysis with migration guidance', async () => {
  const legacy = '<style data-ai-heuristic-style="x" data-ai-heuristic-ui="1"></style><button class="ai-heuristic-badge" data-ai-platform="x" data-ai-heuristic-ui="1">Old badge</button>';
  const {window} = loadGeneratedDom('x', (order === 'before' ? legacy : '') + tweet(), 'https://x.com/home');
  if (order === 'after') window.document.body.insertAdjacentHTML('beforeend', legacy);
  await until(() => window.__controller.getStatus().legacyBlocked);
  assert.equal(window.__controller.getStatus().running, false);
  assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length, 1);
  assert.equal(window.document.querySelector('.ai-heuristic-badge').textContent, 'Old badge');
  window.document.querySelector('.ai-heuristic-launcher').click();
  assert.match(window.document.querySelector('[role="dialog"]').textContent, /Disable it in Userscripts/);
});

test('existing preferences survive per-site disable/re-enable and generated-build migration', async () => {
  const key = 'ai-heuristic:x:settings:v2';
  let resources;
  const {window} = loadGeneratedDom('x', tweet(), 'https://x.com/home', {setup(w){
    resources=monitor(w);
    w.localStorage.setItem(key, JSON.stringify({analyzeComments:false,hideLow:true,sensitivity:'conservative',customLegacyField:17}));
  }});
  assert.equal(window.document.querySelector('.ai-heuristic-badge'), null);
  setEnabled(window, false);
  assert.equal(window.__controller.getStatus().running, false);
  assert.equal(resources.active(), 1);
  setEnabled(window, true);
  assert.equal(window.__controller.getStatus().running, true);
  const saved = JSON.parse(window.localStorage.getItem(key));
  assert.equal(saved.customLegacyField, 17);
  assert.equal(saved.sensitivity, 'conservative');
  assert.equal(saved.hideLow, true);
  window.__lastSession.stop();
  const targeted = evaluateBundle(window, bundleSource('x','targeted'));
  assert.equal(targeted.getController().getSettings().analyzeComments, false);
  setEnabled(window, false);
  assert.equal(targeted.getController().getStatus().running, false);
});

test('malformed and denied storage are safe, and disabled state retains a launcher on empty pages', () => {
  for (const stored of ['null', '[]', '{bad', '{"enabled":"false","analyzeComments":0}']) {
    const {window} = loadGeneratedDom('x', tweet(), 'https://x.com/home', {setup(w){w.localStorage.setItem('ai-heuristic:x:settings:v2',stored);}});
    assert.equal(window.__controller.getSettings().enabled, true);
    window.close();
  }
  const {window} = loadGeneratedDom('x', '', 'https://x.com/home', {setup(w){
    Object.defineProperty(w,'localStorage',{get(){throw new Error('storage denied');}});
  }});
  setEnabled(window, false);
  assert.equal(window.__controller.getStatus().running,false);
  assert.ok(window.document.querySelector('.ai-heuristic-launcher'));
  setEnabled(window, true);
  assert.equal(window.__controller.getStatus().running,true);
});

test('route changes work without page-world history patches and stop analysis on messages', async () => {
  let original;
  const {window} = loadGeneratedDom('x', tweet(), 'https://x.com/messages', {setup(w){original=w.history.pushState;}});
  assert.equal(window.__controller.getStatus().running, false);
  assert.equal(window.document.querySelector('.ai-heuristic-badge'), null);
  window.history.pushState({}, '', '/home');
  await until(() => window.document.querySelector('.ai-heuristic-badge'));
  assert.equal(window.history.pushState, original);
  window.history.pushState({}, '', '/messages/123');
  window.document.querySelector('[data-testid="tweetText"]').textContent = text + ' Edited.';
  await until(() => !window.__controller.getStatus().running);
  assert.equal(window.document.querySelector('.ai-heuristic-badge'), null);
  window.history.pushState({}, '', '/home');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  await until(() => window.document.querySelector('.ai-heuristic-badge'));
});

test('body/head replacement and recycled candidates release stale state', async () => {
  let resources;
  const {window} = loadGeneratedDom('x', tweet(), 'https://x.com/home', {setup(w){resources=monitor(w);}});
  const old = window.document.querySelector('article');
  const body = window.document.createElement('body'); body.innerHTML = tweet('new');
  window.document.body.replaceWith(body);
  await until(() => window.document.querySelector('#new .ai-heuristic-badge'));
  assert.equal(window.__controller.getAnalysis(old), undefined);
  assert.equal(resources.active(), 2);
  const head = window.document.createElement('head'); window.document.head.replaceWith(head);
  await until(() => head.querySelector('style[data-ai-style-instance]'));
  window.document.getElementById('new').removeAttribute('role');
  await until(() => !window.document.querySelector('.ai-heuristic-badge'));
  window.document.getElementById('new').setAttribute('role','article');
  await until(() => window.document.querySelector('.ai-heuristic-badge'));
});

const example = execFileSync('python3', ['tests/build_example.py'], {encoding:'utf8'});
const examplePost = (id, failure = '') => '<article class="example-post" id="' + id + '" data-failure="' + failure + '"><div class="text">' + text + '</div></article>';
test('an additional registered adapter runs without changing the dispatcher or detector and isolates malformed cards', async () => {
  const warnings=[];
  const {window} = loadGeneratedDom('example', examplePost('bad','extract')+examplePost('place','place')+examplePost('good'), 'https://example.test/feed', {source:example, setup(w){w.console.warn=(message)=>warnings.push(message);}});
  assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length,1);
  assert.ok(window.document.querySelector('#good .ai-heuristic-badge'));
  assert.equal(warnings.length,1);
  assert.doesNotMatch(warnings[0],/Private post text/);
  const analysis=window.__controller.getAnalysis(window.document.getElementById('good'));
  assert.equal(analysis.platform,'example');
  assert.equal(analysis.modelAvailable,false);
  window.document.getElementById('bad').dataset.failure='';
  window.document.getElementById('bad').dataset.revision='2';
  await until(()=>window.document.querySelector('#bad .ai-heuristic-badge'));
  window.document.getElementById('good').dataset.empty='true';
  window.document.getElementById('good').dataset.revision='2';
  await until(()=>!window.document.querySelector('#good .ai-heuristic-badge'));
  window.history.pushState({},'','/blocked');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assert.equal(window.__controller.getStatus().running,false);
});

test('experimental adapters start disabled until enabled on their site', () => {
  const source=execFileSync('python3',['tests/build_example.py','experimental'],{encoding:'utf8'});
  const {window}=loadGeneratedDom('example',examplePost('example'),'https://example.test/feed',{source});
  assert.equal(window.__controller.getStatus().running,false);
  setEnabled(window,true);
  window.__controller.scanNow();
  assert.ok(window.document.querySelector('.ai-heuristic-badge'));
});

test('startup exceptions release partial resources and ownership', () => {
  let resources;
  const warnings=[];
  const {window}=loadGeneratedDom('x',tweet(),'https://x.com/home',{setup(w){
    resources=monitor(w);
    w.console.warn=(message)=>warnings.push(message);
    w.IntersectionObserver=class { constructor(){throw new Error('Private post text must not be logged');} };
  }});
  assert.equal(window.__lastSession.getStatus(),'failed');
  assert.equal(resources.active(),0);
  assert.equal(resources.intervals.size,0);
  assert.equal(window.document.querySelector('[data-ai-heuristic-ui]'),null);
  assert.equal(window.document.querySelector('[data-ai-style-instance]'),null);
  assert.equal(warnings.length,1);
  assert.doesNotMatch(warnings[0],/Private post text/);
});

test('recycled posts becoming replies or nested quoted cards lose obsolete badges', async () => {
  const {window}=loadGeneratedDom('x',tweet('outer')+tweet('recycled'),'https://x.com/home',{setup(w){
    w.localStorage.setItem('ai-heuristic:x:settings:v2',JSON.stringify({analyzeComments:false}));
  }});
  const recycled=window.document.getElementById('recycled');
  recycled.insertAdjacentHTML('afterbegin','<div data-testid="socialContext">Replying to someone</div>');
  await until(()=>!recycled.querySelector('.ai-heuristic-badge'));
  recycled.querySelector('[data-testid="socialContext"]').remove();
  await until(()=>recycled.querySelector('.ai-heuristic-badge'));
  window.document.getElementById('outer').append(recycled);
  await until(()=>!recycled.querySelector('.ai-heuristic-badge'));
  assert.equal(window.__controller.getAnalysis(recycled),undefined);
  window.document.body.append(recycled);
  await until(()=>recycled.querySelector('.ai-heuristic-badge'));
});

test('author extraction omits editable composers and form fields', () => {
  const html=tweet().replace('</div></article>', '<div contenteditable="true">Private draft</div><textarea>Private textarea</textarea><input value="Private field"><div contenteditable="false">Published text.</div></div></article>');
  const {window}=loadGeneratedDom('x',html,'https://x.com/home');
  const analysis=window.__controller.getAnalysis(window.document.querySelector('article'));
  assert.doesNotMatch(analysis.sourceText,/Private/);
  assert.match(analysis.sourceText,/Published text/);
});
