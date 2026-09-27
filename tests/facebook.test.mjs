import assert from 'node:assert/strict';
import test, { afterEach, describe } from 'node:test';
import { loadDom, loadGeneratedDom, loadFixture, closeDoms, bundleSource, evaluateBundle } from './helpers.mjs';

afterEach(closeDoms);
const fixture = loadFixture('facebook.html');
const key = 'ai-heuristic:facebook:settings:v2';
const sample = 'I fixed the door after work yesterday. The new handle turns smoothly and the latch stays shut when the wind blows.';
const article = (id = 'post', text = sample) => `<div role="article" id="${id}"><h3>Example</h3><div data-ad-preview="message">${text}</div></div>`;
const reply = (id, text = sample) => `<div role="article" aria-label="Comment by Example" id="${id}"><a href="/reader"><span dir="auto">Example Reader</span></a><div dir="auto">${text}</div><a href="/example/posts/123?comment_id=${id}">1h</a></div>`;
const wrap = html => '<!doctype html><main>' + html + '</main>';
const plain = value => JSON.parse(JSON.stringify(value));
async function until(predicate) {
  const deadline = Date.now() + 2500;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
  assert.ok(predicate(), 'expected Facebook runtime update');
}
function setCheck(window, labelText, value) {
  window.document.querySelector('.ai-heuristic-launcher').click();
  const input = [...window.document.querySelectorAll('.ai-heuristic-popover label')]
    .find(label => label.textContent === labelText).querySelector('input');
  if (input.checked !== value) input.click();
}

for (const distribution of ['source', 'combined', 'targeted']) describe(distribution + ' Facebook', () => {
  function load(html = fixture, path = '/', options = {}) {
    const setup = window => {
      window.localStorage.setItem(key, JSON.stringify({enabled:true, ...options.settings}));
      options.setup?.(window);
    };
    const args = ['facebook', html, 'https://www.facebook.com' + path, {...options, setup, distribution}];
    return (distribution === 'source' ? loadDom : loadGeneratedDom)(...args).window;
  }

  test('extracts only author-owned posts, comments, replies, and dialog text', () => {
    const window = load(), document = window.document;
    const expected = {
      'post-one': 'I repaired the garden gate after work yesterday.\n\nThe new latch closes with a gentle push, and the dog cannot open it anymore.',
      'comment-one': 'We used the same latch on our shed last month. It still works well after the heavy rain.',
      'reply-one': 'I checked the hinge this morning. The screws had loosened, so I tightened them before leaving.',
      'shared-post': 'Here are the key takeaways from this repair. In conclusion, we should check the latch before we replace the entire gate.',
      'dialog-post': 'We tested the replacement door before the shop opened.\n\nThe second inspection found no loose screws or damaged hinges.',
      'dialog-comment': 'I tried that repair last week. The handle now moves smoothly and the door stays closed.'
    };
    assert.equal(document.querySelectorAll('.ai-heuristic-badge').length, 6);
    for (const [id, text] of Object.entries(expected)) {
      const analysis = window.__controller.getAnalysis(document.getElementById(id));
      assert.equal(analysis.sourceText, text, id);
      assert.equal(analysis.kind, id.includes('comment') || id.includes('reply') ? 'comment' : 'post');
      assert.equal(analysis.platform, 'facebook');
      assert.equal(analysis.modelAvailable, false);
      assert.doesNotMatch(analysis.sourceText, /Private|Yesterday|See more|Example Reader|External preview/);
    }
    assert.deepEqual(plain(window.__controller.getAnalysis(document.getElementById('dialog-post')).excluded), {quotes:1,code:1});
    assert.equal(window.__controller.getAnalysis(document.getElementById('shared-post')).excluded.quotes, 1);
    assert.equal(window.__controller.getAnalysis(document.getElementById('shared-post')).cueAssessment.families[0].id, 'formulaic-framing');
    for (const id of ['quoted-post','ambiguous-post','media-only','unknown-post','composer-dialog','chat-dock','hidden-content']) {
      assert.equal(document.getElementById(id).querySelector('.ai-heuristic-badge'), null, id);
    }
    assert.equal(document.querySelector('aside .ai-heuristic-badge'), null);
    assert.equal(document.querySelector('[contenteditable] .ai-heuristic-badge'), null);
  });

  test('nested body edits and expansion update the actual card without manual rescans', async () => {
    const window = load(), document = window.document;
    const post = document.getElementById('post-one');
    const body = document.querySelector('#post-text [data-ad-rendering-role]');
    const before = window.__controller.getAnalysis(post).sourceText;
    body.append(' I added more detail after checking the repair again this afternoon.');
    await until(() => window.__controller.getAnalysis(post)?.sourceText !== before);
    assert.match(window.__controller.getAnalysis(post).sourceText, /I added more detail/);
    assert.equal(document.querySelectorAll('#post-text .ai-heuristic-badge').length, 1);
    document.querySelector('#post-text .ai-heuristic-badge').remove();
    await until(() => document.querySelector('#post-text .ai-heuristic-badge'));
    assert.equal(document.querySelectorAll('#post-text .ai-heuristic-badge').length, 1);
  });

  test('late replies and parent comment edits remain independent of the post', async () => {
    const window = load(), document = window.document;
    const post = document.getElementById('post-one');
    const initial = window.__controller.getAnalysis(post);
    document.getElementById('comment-one').insertAdjacentHTML('beforeend', reply('late-reply'));
    await until(() => document.querySelector('#late-reply .ai-heuristic-badge'));
    assert.equal(window.__controller.getAnalysis(post), initial);
    assert.doesNotMatch(window.__controller.getAnalysis(document.getElementById('comment-one')).sourceText, /new handle/);
    document.getElementById('comment-text').firstChild.nodeValue = sample;
    await until(() => window.__controller.getAnalysis(document.getElementById('comment-one'))?.sourceText === sample);
    assert.equal(window.__controller.getAnalysis(post), initial);
    setCheck(window, 'Analyze comments and replies', false);
    await until(() => !document.querySelector('#comment-one .ai-heuristic-badge') && document.querySelector('#post-text .ai-heuristic-badge'));
    assert.ok(document.querySelector('#post-text .ai-heuristic-badge'));
  });

  test('quotes inside the message are excluded without changing original DOM', () => {
    const html = wrap(article('outer', 'I checked the repair today. The new handle works well after the rain. ' +
      '<div role="article" id="embedded"><div data-ad-preview="message">As an AI language model, I provide a quoted original.</div>' + reply('quoted-reply') + '</div>'));
    const window = load(html), post = window.document.getElementById('outer');
    assert.equal(window.__controller.getAnalysis(post).sourceText, 'I checked the repair today. The new handle works well after the rain.');
    assert.equal(window.__controller.getAnalysis(post).excluded.quotes, 1);
    assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length, 1);
    assert.match(window.document.getElementById('embedded').textContent, /quoted original/);
  });

  test('recycled cards, ambiguous shared bodies, and removed dialogs release old results', async () => {
    const window = load(wrap(article())), document = window.document;
    const post = document.getElementById('post');
    post.querySelector('.ai-heuristic-badge').click();
    post.insertAdjacentHTML('beforeend', '<div data-ad-preview="message">A second author makes this card ambiguous. We must not keep its former result.</div>');
    await until(() => !post.querySelector('.ai-heuristic-badge'));
    assert.equal(document.querySelector('.ai-heuristic-popover'), null);
    assert.equal(window.__controller.getAnalysis(post), undefined);
    post.lastElementChild.remove();
    await until(() => post.querySelector('.ai-heuristic-badge'));
    post.innerHTML = '<h3>Different Author</h3><div data-ad-comet-preview="message">Here are the key takeaways from the rollout. In conclusion, we should check the release before shipping it to the team.</div>';
    await until(() => window.__controller.getAnalysis(post)?.sourceText.startsWith('Here are'));
    assert.equal(post.querySelectorAll('.ai-heuristic-badge').length, 1);
    post.querySelector('.ai-heuristic-badge').click();
    post.remove();
    await until(() => !document.querySelector('.ai-heuristic-popover'));
    assert.equal(window.__controller.getAnalysis(post), undefined);
    const dialog = document.createElement('div'); dialog.setAttribute('role','dialog'); dialog.innerHTML=article('reopened');
    document.body.append(dialog);
    await until(() => dialog.querySelector('.ai-heuristic-badge'));
    dialog.remove();
    await until(() => window.__controller.getAnalysis(dialog.firstElementChild) === undefined);
  });

  test('short and unsupported text retain honest score states and missing-model diagnostics', async () => {
    const window = load(wrap(article('short','I agree with your point.') + article('unknown','これは日本語で書かれた文章です。別の文章もあります。')));
    const short = window.document.querySelector('#short .ai-heuristic-badge');
    assert.match(short.textContent, /AI Score: 0\/100.*Short sample/);
    assert.equal(short.querySelectorAll('.ai-heuristic-meter__segment').length, 6);
    const unknown = window.document.querySelector('#unknown .ai-heuristic-badge');
    assert.match(unknown.textContent, /not assessed.*Unsupported language/);
    assert.equal(unknown.querySelector('.ai-heuristic-meter'), null);
    short.click();
    const details=window.document.querySelector('details'); details.open=true;
    await until(() => window.document.querySelector('.ai-heuristic-popover__technical').textContent);
    assert.match(details.textContent,/Diagnostic model: unavailable for this platform/);
    window.document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(window.document.activeElement,short);
  });

  test('selects visible text instead of zero-size wrappers for viewport processing', async () => {
    const observed = new Set(); let callback;
    const window = load(wrap('<div role="feed"><div data-pagelet="FeedUnit_0" style="display:contents"><div data-ad-preview="message" id="visible-text">'+sample+'</div></div></div>'), '/', {
      autoScan:false, setup(w) { w.IntersectionObserver=class {constructor(cb){callback=cb;}observe(node){observed.add(node);}unobserve(node){observed.delete(node);}disconnect(){observed.clear();}}; }
    });
    assert.deepEqual([...observed].map(node=>node.id),['visible-text']);
    assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
    callback([...observed].map(target=>({target,isIntersecting:true})));
    await until(()=>window.document.querySelector('#visible-text .ai-heuristic-badge'));
  });

  test('private routes and unknown layouts fail closed', () => {
    for (const path of ['/messages/t/1','/groups/123','/marketplace/','/stories/1','/watch/','/example/videos/1','/photo.php?fbid=1','/settings','/search/posts','/dialog.php','/unknown.php','/?v=123']) {
      const window=load(fixture,path);
      assert.equal(window.document.querySelector('.ai-heuristic-badge'),null,path);
      window.close();
    }
    const window=load(wrap(reply('fake').replace('/example/posts/123?comment_id=fake','https://facebook.com.evil.test/?comment_id=1')));
    assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
  });

  test('profile, Page-post, and permalink routes retain the same owned text', () => {
    for (const path of ['/example.profile','/example.page/posts','/example.page/posts/123',
      '/profile.php?id=42','/permalink.php?story_fbid=123&id=42','/story.php?story_fbid=123&id=42',
      '/people/Example-Person/42','/people/Example-Person/42/posts']) {
      const window=load(wrap(article()),path);
      assert.equal(window.__controller.getAnalysis(window.document.getElementById('post'))?.sourceText,sample,path);
      assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length,1,path);
      window.close();
    }
  });
});

for (const distribution of ['combined','targeted']) {
  test(distribution+' Facebook is opt-in and settings persist across distribution/reload', async () => {
    const {window}=loadGeneratedDom('facebook',fixture,'https://www.facebook.com/',{distribution});
    assert.equal(window.__controller.getStatus().running,false);
    assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
    window.document.querySelector('.ai-heuristic-launcher').click();
    assert.match(window.document.querySelector('.ai-heuristic-popover').textContent,/Facebook support is experimental/);
    setCheck(window,'Enable style cues on this site',true);
    await until(()=>window.document.querySelector('.ai-heuristic-badge'));
    setCheck(window,'Analyze comments and replies',false);
    const saved=window.localStorage.getItem(key);
    window.__lastSession.stop();
    const fresh=loadGeneratedDom('facebook',fixture,'https://www.facebook.com/',{distribution:distribution==='combined'?'targeted':'combined',setup(w){w.localStorage.setItem(key,saved);}}).window;
    assert.equal(fresh.__controller.getSettings().enabled,true);
    assert.equal(fresh.__controller.getSettings().analyzeComments,false);
    assert.ok(fresh.document.querySelector('#post-text .ai-heuristic-badge'));
    assert.equal(fresh.document.querySelector('#comment-one .ai-heuristic-badge'),null);
    setCheck(fresh,'Enable style cues on this site',false);
    assert.equal(fresh.document.querySelector('.ai-heuristic-badge'),null);
    assert.ok(fresh.document.querySelector('.ai-heuristic-launcher'));
  });
}

test('Facebook navigation resumes once and combined/targeted coexist without duplicate badges', async () => {
  const {window}=loadGeneratedDom('facebook',fixture,'https://www.facebook.com/',{setup(w){w.localStorage.setItem(key,'{"enabled":true}');}});
  evaluateBundle(window,bundleSource('facebook','targeted'));
  assert.equal(window.document.querySelectorAll('meta[data-ai-style-owner]').length,1);
  assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length,6);
  window.history.pushState({},'','/messages/t/123');
  await until(()=>!window.__controller.getStatus().running);
  assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
  window.history.pushState({},'','/example/posts/123');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  await until(()=>window.document.querySelectorAll('.ai-heuristic-badge').length===6);
  window.__controller.stop();
  assert.equal(window.document.querySelector('[data-ai-heuristic-ui]'),null);
});

test('Facebook scopes reject mobile, messaging, HTTP, and lookalike hosts before runtime startup', () => {
  for (const url of ['https://m.facebook.com/','https://web.facebook.com/','https://messenger.com/',
    'https://facebook.com.evil.test/','https://notfacebook.com/','http://www.facebook.com/']) {
    let reads=0;
    const {window}=loadGeneratedDom('facebook',fixture,url,{setup(w){
      Object.defineProperty(w,'localStorage',{get(){reads++;throw new Error('unexpected settings access');}});
    }});
    assert.equal(window.__lastSession,null,url);
    assert.equal(reads,0,url);
    assert.equal(window.document.querySelector('[data-ai-heuristic-ui]'),null,url);
    window.close();
  }
});
