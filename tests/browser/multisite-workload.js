async (page) => {
  const sources = __VALIDATION_SOURCES__;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const sample = 'I tested the gate after work yesterday. The hinge needs oil but the latch still closes with a gentle push.';
  const card = (i) => '<article role="article" id="post-' + i + '"><div data-testid="User-Name">Example</div><div data-testid="tweetText">' + sample + ' Revision ' + (i % 4) + '.</div></article>';
  const html = '<!doctype html><html lang="en"><head><style>body{margin:0}article{box-sizing:border-box;min-height:120px;padding:8px}</style></head><body>' + Array.from({length:120},(_,i)=>card(i)).join('') + '</body></html>';
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({status:200,contentType:'text/html',headers:{'content-security-policy':"script-src 'none'; object-src 'none'"},body:html}) : route.abort());
  await page.setViewportSize({width:1280,height:900});
  await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce',forcedColors:'none'});
  const cdp=await page.context().newCDPSession(page);
  const evaluate=async(contextId,expression)=>{
    const result=await cdp.send('Runtime.evaluate',{contextId,expression,returnByValue:true});
    if(result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  const world=async(name)=>{
    const {frameTree}=await cdp.send('Page.getFrameTree');
    return (await cdp.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:name})).executionContextId;
  };
  const monitor = `window.__resources={mo:new Set(),io:new Set(),interval:new Set()};
    for (const [name,key] of [['MutationObserver','mo'],['IntersectionObserver','io']]) {
      const Native=window[name];window[name]=class extends Native {
        observe(...args){window.__resources[key].add(this);return super.observe(...args);}
        disconnect(){window.__resources[key].delete(this);return super.disconnect();}
      };
    }
    const originalSet=window.setInterval.bind(window),originalClear=window.clearInterval.bind(window);
    window.setInterval=(...args)=>{const id=originalSet(...args);window.__resources.interval.add(id);return id;};
    window.clearInterval=(id)=>{window.__resources.interval.delete(id);return originalClear(id);};`;
  const counts = 'Object.fromEntries(Object.entries(window.__resources).map(([k,v])=>[k,v.size]))';
  const coexistence=[];
  for (const order of [['targeted','combined'],['combined','targeted'],['combined','combined']]) {
    await page.goto('https://x.com/home');
    const contexts=[];
    for (let i=0;i<order.length;i++) {
      const id=await world('guard-'+i);contexts.push(id);
      await evaluate(id,monitor+sources[order[i]]);
      await page.waitForTimeout(180);
    }
    const owners=await page.locator('meta[data-ai-style-owner]').count();
    const active=[];for(const id of contexts)active.push(await evaluate(id,counts));
    assert(owners===1,'duplicate ownership');
    assert(active.reduce((n,r)=>n+r.mo,0)===2,'duplicate mutation watchers');
    assert(active.reduce((n,r)=>n+r.io,0)===1,'duplicate viewport watchers');
    assert(active.reduce((n,r)=>n+r.interval,0)===1,'duplicate route timers');
    assert(await page.locator('meta[data-distribution="combined"]').count()===1,'combined must win tie');
    await page.evaluate(()=>document.querySelector('meta[data-ai-style-owner]').dispatchEvent(new Event('ai-style-retire')));
    const stopped=[];for(const id of contexts)stopped.push(await evaluate(id,counts));
    assert(stopped.every(r=>Object.values(r).every(n=>n===0)),'resources survived stop');
    coexistence.push({order,active,stopped});
  }
  const legacy=[];
  for(const order of [['baseline','combined'],['combined','baseline']]) {
    await page.goto('https://x.com/home');
    for(let i=0;i<order.length;i++) {
      await evaluate(await world('legacy-'+i),sources[order[i]]);
      await page.waitForTimeout(220);
    }
    const modernBadges=await page.locator('.ai-heuristic-badge[data-ai-style-instance]').count();
    const oldBadges=await page.locator('.ai-heuristic-badge:not([data-ai-style-instance])').count();
    await page.locator('.ai-heuristic-launcher').click();
    assert((await page.getByRole('dialog').innerText()).includes('Disable it in Userscripts'),'missing migration guidance');
    assert(modernBadges===0 && oldBadges>0,'legacy runtime was not isolated');
    legacy.push({order,modernBadges,oldBadges});
  }
  function instrument(source,kind) {
    const replace=(before,after)=>{assert(source.split(before).length===2,'instrumentation anchor changed: '+before);source=source.replace(before,after);};
    replace('function analyze(rawText, context, settings, options) {','function analyze(rawText, context, settings, options) { window.__stats.analyses++; if(options && options.diagnostics)window.__stats.diagnostics++;');
    replace('const content = adapter.extractContent(element, kind)', 'window.__stats.extractions++; const content = adapter.extractContent(element, kind)');
    replace('function createBadge(analysis) {','function createBadge(analysis) { if(window.__stats.firstBadgeMs===null)window.__stats.firstBadgeMs=performance.now()-window.__stats.begin;');
    const start=source.indexOf('  function flushQueue() {'),end=source.indexOf('  function scheduleQueue()',start);
    const fn=source.slice(start,end),last=fn.lastIndexOf('}');
    source=source.slice(0,start)+fn.replace('function flushQueue() {','function flushQueue() { const __begin=performance.now(); try {').slice(0,-(fn.length-last))+ '} finally {window.__stats.flushMs.push(performance.now()-__begin);} }\n\n'+source.slice(end);
    replace('    scanNow,','    getRuntimeStats: () => ({tracked:tracked.size,detachedTracked:[...tracked].filter(e=>!e.isConnected).length,cache:analysisCache.size,pending:pending.size}), scanNow,');
    if(kind==='baseline')replace('  startAIHeuristic(createPlatformAdapter(), AI_HEURISTIC_MODELS);','  window.__controller=startAIHeuristic(createPlatformAdapter(), AI_HEURISTIC_MODELS);');
    else replace('  bootAIHeuristic(', '  window.__session=bootAIHeuristic(');
    return source + (kind==='baseline'?'':'\nwindow.__controller=window.__session.getController();');
  }
  const workloads=[];
  for(let repeat=0;repeat<3;repeat++) for(const kind of repeat%2 ? ['combined','baseline'] : ['baseline','combined']) {
    await page.goto('https://x.com/home');
    const id=await world('workload');
    await evaluate(id,monitor+'window.__stats={begin:performance.now(),firstBadgeMs:null,extractions:0,analyses:0,diagnostics:0,flushMs:[]};'+instrument(sources[kind],kind));
    await page.waitForTimeout(220);
    const startup=await evaluate(id,'({badges:document.querySelectorAll(".ai-heuristic-badge").length,extractions:__stats.extractions,analyses:__stats.analyses})');
    for(let y=700;y<15000;y+=700){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(85);}
    const afterScroll=await evaluate(id,'({badges:document.querySelectorAll(".ai-heuristic-badge").length,extractions:__stats.extractions,analyses:__stats.analyses})');
    assert(afterScroll.badges===120,'not all cards processed');
    await page.locator('#post-0 [data-testid="tweetText"]').evaluate(el=>el.textContent+=' I changed the hinge today.');
    await page.waitForTimeout(100);
    const offscreen=await evaluate(id,'__stats.analyses');
    assert(offscreen===afterScroll.analyses,'offscreen edit ran prematurely');
    await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(220);
    const afterEdit=await evaluate(id,'__stats.analyses');
    assert(afterEdit===offscreen+1,'edit did not invalidate cached analysis');
    await page.evaluate(()=>[...document.querySelectorAll('article')].slice(0,60).forEach(el=>el.remove()));
    await page.waitForTimeout(150);
    const result=await evaluate(id,'({stats:__stats,runtime:__controller.getRuntimeStats()})');
    assert(result.runtime.detachedTracked===0,'detached nodes retained by tracked set');
    assert(result.runtime.cache<=128,'unbounded analysis cache');
    assert(result.stats.diagnostics===0,'diagnostics were eager');
    await evaluate(id,'__controller.stop()');
    const stopped=await evaluate(id,counts);
    assert(Object.values(stopped).every(n=>n===0),'workload resources survived stop');
    const times=result.stats.flushMs.sort((a,b)=>a-b);
    workloads.push({kind,repeat,startup,afterScroll,afterEdit,firstBadgeMs:result.stats.firstBadgeMs,flushTotalMs:times.reduce((a,b)=>a+b,0),flushMaxMs:times.at(-1),flushCount:times.length,extractions:result.stats.extractions,analyses:result.stats.analyses,diagnostics:result.stats.diagnostics,runtime:result.runtime,stopped});
  }
  await cdp.detach();
  return {browser:page.context().browser().version(),csp:"script-src 'none'",isolatedWorld:true,syntheticOnly:true,coexistence,legacy,workloads};
}
