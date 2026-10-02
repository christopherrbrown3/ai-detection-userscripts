import assert from 'node:assert/strict';
import test, { afterEach, describe } from 'node:test';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { loadDom, loadGeneratedDom, loadFixture, closeDoms, bundleSource, evaluateBundle } from './helpers.mjs';

afterEach(closeDoms);
const fixture = loadFixture('youtube.html');
const key = 'ai-heuristic:youtube:settings:v2';
const watchPath = '/watch?v=video000001';
const sample = 'I fixed the door after work yesterday. The new handle turns smoothly and the latch stays shut when the wind blows.';
const comment = (id, text = sample) => `<ytd-comment-view-model id="${id}"><ytd-expander><yt-attributed-string id="content-text">${text}</yt-attributed-string></ytd-expander><button>Reply</button></ytd-comment-view-model>`;
const post = (id, text = sample, extra = '') => `<ytd-backstage-post-renderer id="${id}"><h3>Example Creator</h3><yt-formatted-string id="content-text">${text}</yt-formatted-string>${extra}</ytd-backstage-post-renderer>`;
const posts = html => '<!doctype html><ytd-app><ytd-browse>' + html + '</ytd-browse></ytd-app>';
const plain = value => JSON.parse(JSON.stringify(value));
async function until(predicate) {
  const deadline = Date.now() + 2500;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 15));
  assert.ok(predicate(), 'expected YouTube runtime update');
}
function setCheck(window, labelText, value) {
  window.document.querySelector('.ai-heuristic-launcher').click();
  const input = [...window.document.querySelectorAll('.ai-heuristic-popover label')]
    .find(label => label.textContent === labelText).querySelector('input');
  if (input.checked !== value) input.click();
}

for (const distribution of ['source', 'combined', 'targeted']) describe(distribution + ' YouTube', () => {
  function load(html = fixture, path = watchPath, options = {}) {
    const setup = window => {
      window.localStorage.setItem(key, JSON.stringify({enabled:true, ...options.settings}));
      options.setup?.(window);
    };
    return (distribution === 'source' ? loadDom : loadGeneratedDom)('youtube', html,
      'https://www.youtube.com' + path, {...options, setup, distribution}).window;
  }

  test('description and each comment own exact text with no player, credits, title, or sibling contamination', () => {
    const window = load(), document = window.document;
    const expected = {
      'description-owner': 'I repaired the garden gate after work yesterday.\n\nThe new latch closes with a gentle push, and the dog cannot open it anymore.',
      'comment-one': 'Here are the key takeaways from this repair. In conclusion, we should check the latch before replacing the entire gate.',
      'reply-one': 'We used the same latch on our shed last month. It still works well after the heavy rain.',
      'legacy-comment': 'I checked the hinge this morning. The screws had loosened, so I tightened them before leaving.'
    };
    assert.equal(document.querySelectorAll('.ai-heuristic-badge').length,4);
    for (const [id,text] of Object.entries(expected)) {
      const element = document.getElementById(id), analysis = window.__controller.getAnalysis(element);
      assert.equal(analysis.sourceText,text,id);
      assert.equal(analysis.kind,id==='description-owner'?'post':'comment');
      assert.equal(analysis.platform,'youtube');
      assert.equal(analysis.modelAvailable,false);
      assert.ok(element.querySelector('.ai-heuristic-badge'));
    }
    assert.deepEqual(plain(window.__controller.getAnalysis(document.getElementById('description-owner')).excluded),{quotes:1,code:1});
    const cue = window.__controller.getAnalysis(document.getElementById('comment-one')).cueAssessment.families[0];
    assert.equal(cue.id,'formulaic-framing');
    assert.ok(cue.spans.every(span=>span.start>=0 && span.end<=expected['comment-one'].length));
    for(const id of ['draft','chat','transcript','cached','recommendation','unknown-comment','mini-comment']) assert.equal(document.getElementById(id).querySelector('.ai-heuristic-badge'),null,id);
    assert.equal(document.querySelector('#description-inline-expander .ai-heuristic-badge'),null,'badge must be outside clipped expander');
  });

  test('collapsed preview yields to newly rendered full text without automatically expanding', async () => {
    const window=load(fixture.replace(/<yt-attributed-string id="description-body">[\s\S]*?<\/yt-attributed-string>/,'<yt-attributed-string id="description-body"></yt-attributed-string>'));
    const owner=window.document.getElementById('description-owner');
    assert.equal(window.__controller.getAnalysis(owner).sourceText,'A shorter preview that must not be counted twice.');
    let clicked=false; window.document.getElementById('expand').addEventListener('click',()=>{clicked=true;});
    window.document.getElementById('description-body').textContent=sample;
    await until(()=>window.__controller.getAnalysis(owner)?.sourceText===sample);
    assert.equal(owner.querySelectorAll('.ai-heuristic-badge').length,1);
    assert.equal(clicked,false);
    window.document.getElementById('description-body').textContent='';
    window.document.getElementById('attributed-snippet-text').textContent='';
    await until(()=>!owner.querySelector('.ai-heuristic-badge'));
  });

  test('channel post text, quotes, comments and polls have separate boundaries', () => {
    const html=posts(post('post',sample,post('quoted','This original belongs to another writer.'))+
      '<ytd-comments>'+comment('post-comment')+'</ytd-comments>'+post('poll',sample,'<ytd-backstage-poll-renderer>Option A Option B 50%</ytd-backstage-poll-renderer>')+
      post('empty','','<img alt="Media-only post">')+post('ambiguous',sample,'<yt-attributed-string id="content-text">Another unmarked text owner.</yt-attributed-string>'));
    for(const path of ['/@example/posts','/@example/community','/channel/UCexample/posts','/c/example/community','/user/example/posts','/post/UgSynthetic']) {
      const window=load(html,path),document=window.document;
      assert.equal(document.querySelectorAll('.ai-heuristic-badge').length,2,path);
      assert.equal(window.__controller.getAnalysis(document.getElementById('post')).sourceText,sample);
      assert.equal(window.__controller.getAnalysis(document.getElementById('post')).excluded.quotes,1);
      assert.equal(window.__controller.getAnalysis(document.getElementById('post-comment')).kind,'comment');
      for(const id of ['quoted','poll','empty','ambiguous']) assert.equal(document.getElementById(id).querySelector('.ai-heuristic-badge'),null,id);
      window.close();
    }
  });

  test('late replies, edits, recycling and removal preserve independent samples', async () => {
    const window=load(),document=window.document,owner=document.getElementById('description-owner');
    const initial=window.__controller.getAnalysis(owner),parent=document.getElementById('comment-one');
    parent.insertAdjacentHTML('beforeend',comment('late-reply'));
    await until(()=>document.querySelector('#late-reply .ai-heuristic-badge'));
    assert.equal(window.__controller.getAnalysis(owner),initial);
    assert.doesNotMatch(window.__controller.getAnalysis(parent).sourceText,/new handle/);
    const reply=document.getElementById('reply-one');reply.querySelector('.ai-heuristic-badge').click();
    reply.querySelector('#content-text').textContent=sample;
    await until(()=>window.__controller.getAnalysis(reply)?.sourceText===sample);
    assert.equal(document.querySelector('.ai-heuristic-popover'),null);
    reply.querySelector('.ai-heuristic-badge').remove();
    await until(()=>reply.querySelector('.ai-heuristic-badge'));
    reply.remove(); await until(()=>window.__controller.getAnalysis(reply)===undefined);
    setCheck(window,'Analyze comments and replies',false);
    await until(()=>document.querySelectorAll('.ai-heuristic-badge').length===1);
    assert.ok(owner.querySelector('.ai-heuristic-badge'));
    setCheck(window,'Analyze comments and replies',true);
    await until(()=>document.querySelector('#late-reply .ai-heuristic-badge'));
  });

  test('navigation clears stale text before URL/DOM updates and releases all navigation listeners on stop', async () => {
    const listeners=new Map();
    const window=load(fixture,watchPath,{setup(w){
      const add=w.document.addEventListener.bind(w.document),remove=w.document.removeEventListener.bind(w.document);
      w.document.addEventListener=(type,fn,...args)=>{if(type.startsWith('yt-navigate-'))listeners.set(type,fn);return add(type,fn,...args);};
      w.document.removeEventListener=(type,fn,...args)=>{if(listeners.get(type)===fn)listeners.delete(type);return remove(type,fn,...args);};
    }}),document=window.document;
    document.querySelector('.ai-heuristic-badge').click();
    document.dispatchEvent(new window.Event('yt-navigate-start'));
    assert.equal(document.querySelector('.ai-heuristic-badge'),null);
    assert.equal(document.querySelector('.ai-heuristic-popover'),null);
    window.history.pushState({},'', '/watch?v=video000003');
    document.getElementById('description-body').textContent=sample;
    window.__controller.scanNow();
    assert.equal(document.querySelector('.ai-heuristic-badge'),null,'navigation is still pending');
    document.querySelector('ytd-watch-flexy').setAttribute('video-id','video000003');
    document.dispatchEvent(new window.Event('yt-navigate-finish'));
    await until(()=>document.querySelector('#description-owner .ai-heuristic-badge'));
    assert.equal(window.__controller.getAnalysis(document.getElementById('description-owner')).sourceText,sample);
    window.history.pushState({},'',watchPath);window.dispatchEvent(new window.PopStateEvent('popstate'));
    assert.equal(document.querySelector('.ai-heuristic-badge'),null,'mismatched video identity must fail closed');
    window.__controller.stop();assert.equal(listeners.size,0);
    document.dispatchEvent(new window.Event('yt-navigate-finish'));
    assert.equal(document.querySelector('.ai-heuristic-badge'),null);
  });

  test('unsupported routes and hidden/editor content fail closed', () => {
    for(const path of ['/','/results?search_query=example','/shorts/video000001','/live_chat?v=video000001','/embed/video000001','/@example','/@example/videos','/playlist?list=example','/watch','/post/','/feed/subscriptions']) {
      const window=load(fixture,path);assert.equal(window.document.querySelector('.ai-heuristic-badge'),null,path);window.close();
    }
    const window=load(fixture.replace('<ytd-watch-flexy video-id="video000001">','<ytd-watch-flexy video-id="oldvideo001">'));
    assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
  });

  test('sample states, compact bars, cue counts in details, and missing diagnostic model remain honest', async () => {
    const window=load(posts(post('short','I agree with your point.')+post('unknown','これは日本語で書かれた文章です。別の文章もあります。')),'/post/UgSynthetic');
    const badge=window.document.querySelector('#short .ai-heuristic-badge');
    assert.equal(badge.textContent,'AI ScoreShort sample');
    assert.equal(badge.querySelectorAll('.ai-heuristic-meter__segment').length,6);
    assert.match(badge.getAttribute('aria-label'),/0 of 6 cue families/);
    const unknown=window.document.querySelector('#unknown .ai-heuristic-badge');
    assert.match(unknown.textContent,/not assessed.*Unsupported language/);
    assert.equal(unknown.querySelector('.ai-heuristic-meter'),null);
    badge.click();const details=window.document.querySelector('details');details.open=true;
    await until(()=>details.textContent.includes('Diagnostic model: unavailable for this platform'));
    assert.match(window.document.querySelector('.ai-heuristic-popover').textContent,/0\/6 cues/);
  });
});

for(const distribution of ['combined','targeted']) {
  test(distribution+' YouTube opt-in, reload and comment settings stay local',async()=>{
    const window=loadGeneratedDom('youtube',fixture,'https://www.youtube.com'+watchPath,{distribution}).window;
    assert.equal(window.__controller.getStatus().running,false);
    window.document.querySelector('.ai-heuristic-launcher').click();
    assert.match(window.document.querySelector('.ai-heuristic-popover').textContent,/YouTube support is experimental/);
    setCheck(window,'Enable style cues on this site',true);
    await until(()=>window.document.querySelector('.ai-heuristic-badge'));
    setCheck(window,'Analyze comments and replies',false);
    const saved=window.localStorage.getItem(key);window.__lastSession.stop();
    const fresh=loadGeneratedDom('youtube',fixture,'https://www.youtube.com'+watchPath,{distribution,setup(w){w.localStorage.setItem(key,saved);}}).window;
    assert.equal(fresh.__controller.getSettings().enabled,true);
    assert.equal(fresh.__controller.getSettings().analyzeComments,false);
    assert.equal(fresh.document.querySelectorAll('.ai-heuristic-badge').length,1);
    setCheck(fresh,'Enable style cues on this site',false);
    assert.equal(fresh.document.querySelector('.ai-heuristic-badge'),null);
    assert.ok(fresh.document.querySelector('.ai-heuristic-launcher'));
  });
}

test('YouTube host dispatch is exact and coexistence keeps one owner',()=>{
  for(const host of ['youtube.com.evil.test','music.youtube.com','m.youtube.com','studio.youtube.com','youtu.be']) {
    const window=loadGeneratedDom('youtube',fixture,'https://'+host+watchPath).window;
    assert.equal(window.__controller,null,host);assert.equal(window.document.querySelector('.ai-heuristic-launcher'),null);
  }
  for(const order of [['combined','targeted'],['targeted','combined']]) {
    const window=loadGeneratedDom('youtube',fixture,'https://www.youtube.com'+watchPath,{distribution:order[0],setup(w){w.localStorage.setItem(key,'{"enabled":true}');}}).window;
    evaluateBundle(window,bundleSource('youtube',order[1]));
    const controller=window.__lastSession?.getController()||window.__controller;controller.scanNow();
    assert.equal(window.document.querySelectorAll('meta[data-ai-style-owner]').length,1);
    assert.equal(window.document.querySelectorAll('.ai-heuristic-badge').length,4);
    window.close();
  }
});

test('adapter contract rejects malformed navigation events before starting',()=>{
  const dom=new JSDOM('<!doctype html>',{runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync(new URL('../src/bootstrap.js',import.meta.url),'utf8')+'\nwindow.validate=validateAIAdapter;');
  const adapter={id:'example',name:'Example',postSelector:'article',commentSelector:'aside',isTopLevel(){},extractContent(){},placeBadge(){}};
  for(const navigationEvents of [null,{}, {start:'',finish:'done'},{start:'same',finish:'same'},{start:42,finish:'done'}]) assert.throws(()=>dom.window.validate({...adapter,navigationEvents},{id:'example'}));
  dom.window.close();
});
