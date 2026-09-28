import assert from 'node:assert/strict';
import test, { afterEach, describe } from 'node:test';
import { loadDom, loadGeneratedDom, loadFixture, closeDoms } from './helpers.mjs';

afterEach(closeDoms);
const fixture=loadFixture('facebook.html');
const pageKey='ai-heuristic:facebook:settings:v2';
const managerKey=pageKey+'@https://www.facebook.com';
async function until(predicate) {
  const deadline=Date.now()+2500;
  while(!predicate() && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(predicate(),'expected settings update');
}
function toggle(window,label) {
  window.document.querySelector('.ai-heuristic-launcher').click();
  [...window.document.querySelectorAll('.ai-heuristic-popover label')].find(n=>n.textContent===label).querySelector('input').click();
}
const plain=value=>JSON.parse(JSON.stringify(value));

for(const distribution of ['source','combined','targeted']) describe(distribution+' manager settings',()=>{
  function load(manager,setup=()=>{},origin='https://www.facebook.com') {
    const options={distribution,runtimeOptions:{settingsStorage:'manager',enabledByDefault:false},setup(w){w.GM=manager;setup(w);}};
    return (distribution==='source'?loadDom:loadGeneratedDom)('facebook',fixture,origin+'/',options).window;
  }

  test('waits for authoritative preferences before starting analysis',async()=>{
    let resolveRead,readKey;
    const window=load({getValue(key){readKey=key;return new Promise(resolve=>{resolveRead=resolve;});},setValue:async()=>{}},w=>w.localStorage.setItem(pageKey,'{"enabled":true}'));
    assert.equal(readKey,managerKey);
    assert.equal(window.__controller.getStatus().running,false);
    assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
    assert.equal(window.document.querySelector('.ai-heuristic-launcher').disabled,true);
    resolveRead({enabled:false,analyzeComments:false});
    await until(()=>!window.document.querySelector('.ai-heuristic-launcher').disabled);
    assert.equal(window.__controller.getSettings().enabled,false);
    assert.equal(window.__controller.getSettings().analyzeComments,false);
    assert.equal(window.document.querySelector('.ai-heuristic-badge'),null);
  });

  test('imports local preferences and survives page-storage deletion and reload',async()=>{
    const values=new Map();
    const manager={getValue:async key=>values.get(key),setValue:async(key,value)=>{values.set(key,plain(value));}};
    const window=load(manager,w=>w.localStorage.setItem(pageKey,'{"enabled":true}'));
    await until(()=>values.has(managerKey) && window.document.querySelectorAll('.ai-heuristic-badge').length===6);
    toggle(window,'Analyze comments and replies');
    await until(()=>values.get(managerKey).analyzeComments===false);
    window.localStorage.removeItem(pageKey);
    window.__controller.stop();
    const fresh=load(manager);
    await until(()=>fresh.document.querySelector('#post-text .ai-heuristic-badge'));
    assert.equal(fresh.__controller.getSettings().enabled,true);
    assert.equal(fresh.__controller.getSettings().analyzeComments,false);
    assert.equal(fresh.document.querySelector('#comment-one .ai-heuristic-badge'),null);
    const alias=load(manager,()=>{},'https://facebook.com');
    await until(()=>!alias.document.querySelector('.ai-heuristic-launcher').disabled);
    assert.equal(alias.__controller.getSettings().enabled,false,'origins must remain independent');
    assert.equal(alias.document.querySelector('.ai-heuristic-badge'),null);
  });

  test('serializes rapid writes and preserves the last checkbox choices',async()=>{
    const writes=[],releases=[];
    const window=load({getValue:async()=>({enabled:true}),setValue(key,value){writes.push({key,value:plain(value)});return new Promise(resolve=>releases.push(resolve));}});
    await until(()=>window.document.querySelector('.ai-heuristic-badge'));
    toggle(window,'Analyze comments and replies');
    await until(()=>writes.length===1);
    toggle(window,'Hide short or unassessed samples');
    assert.equal(writes.length,1);
    releases[0]();
    await until(()=>writes.length===2);
    assert.equal(writes[1].key,managerKey);
    assert.equal(writes[1].value.analyzeComments,false);
    assert.equal(writes[1].value.hideInsufficient,true);
    releases[1]();
  });

  test('storage errors preserve usable tab settings and disclose persistence limits',async()=>{
    const window=load({getValue:async()=>{throw new Error('denied');},setValue:async()=>{throw new Error('denied');}},w=>{
      Object.defineProperty(w,'localStorage',{get(){throw new Error('page storage denied');}});
    });
    await until(()=>!window.document.querySelector('.ai-heuristic-launcher').disabled);
    window.document.querySelector('.ai-heuristic-launcher').click();
    assert.match(window.document.querySelector('.ai-heuristic-popover').textContent,/Saved settings are unavailable/);
    window.document.querySelector('[aria-label="Close settings"]').click();
    toggle(window,'Enable style cues on this site');
    await until(()=>window.document.querySelector('.ai-heuristic-badge'));
    window.document.querySelector('.ai-heuristic-launcher').click();
    assert.match(window.document.querySelector('.ai-heuristic-popover').textContent,/Settings could not be saved/);
    assert.equal(window.__controller.getSettings().enabled,true);
  });

  test('a late preference read cannot revive a stopped runtime',async()=>{
    let resolveRead,writes=0;
    const window=load({getValue:()=>new Promise(resolve=>{resolveRead=resolve;}),setValue:async()=>{writes++;}});
    window.__controller.stop();
    resolveRead({enabled:true});
    await new Promise(resolve=>setTimeout(resolve,40));
    assert.equal(window.document.querySelector('[data-ai-heuristic-ui]'),null);
    assert.equal(writes,0);
  });
});
