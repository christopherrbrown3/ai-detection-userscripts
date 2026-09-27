async (page) => {
  const sources = __FACEBOOK_SOURCES__, fixture = __FACEBOOK_FIXTURE__, output = __FACEBOOK_OUTPUT__;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settingsKey = 'ai-heuristic:facebook:settings:v2';
  const managerMock = 'window.GM={getValue:async()=>null,setValue:async()=>{}};';
  let html = fixture.replace('<body>', '<head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' +
    'body{margin:0;padding:24px;background:#f0f2f5;color:#172033;font:15px/1.5 system-ui}main{max-width:720px;margin:auto}' +
    '[role=article], [data-pagelet^=FeedUnit_], [role=dialog]{background:white;padding:16px;margin-bottom:12px;border:1px solid #d6dce5;border-radius:8px}' +
    '[role=article] [role=article]{margin:12px 0 0;background:#f7f8fa}a{color:#245cb3}h3{margin:0 0 8px;color:#1c1e21}aside{display:none}' +
    '@media(prefers-color-scheme:dark){body{background:#111722;color:#f0f2f5}[role=article],[data-pagelet^=FeedUnit_],[role=dialog]{background:#1b2433;border-color:#4b5668}[role=article] [role=article]{background:#222c3c}a{color:#a9c9ff}}' +
    '</style></head><body>');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({status:200,contentType:'text/html',headers:{'content-security-policy':"script-src 'none'; object-src 'none'"},body:html}) : route.abort());
  await page.setViewportSize({width:1280,height:900});
  await page.emulateMedia({colorScheme:'light',forcedColors:'none',reducedMotion:'reduce'});
  const cdp = await page.context().newCDPSession(page);
  const evaluate = async (id, expression) => {
    const result = await cdp.send('Runtime.evaluate',{contextId:id,expression,returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const world = async name => {
    const {frameTree} = await cdp.send('Page.getFrameTree');
    return (await cdp.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:name})).executionContextId;
  };
  const load = async enabled => {
    await page.goto('https://www.facebook.com/');
    await page.evaluate(([key,enabled]) => localStorage.setItem(key,JSON.stringify({enabled})),[settingsKey,enabled]);
  };
  const scrollFeed = async () => {
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    for(let y=0;y<height;y+=650){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(110);}
  };
  const openAnalysis = async selector => {
    const badge=page.locator(selector);
    await badge.scrollIntoViewIfNeeded();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await badge.click();
    await page.locator('.ai-heuristic-popover').waitFor();
  };
  await load(false);
  await evaluate(await world('facebook-ui'),managerMock+sources.combined);
  assert(await page.locator('.ai-heuristic-badge').count()===0,'Facebook must start off');
  await page.locator('.ai-heuristic-launcher').click();
  assert((await page.locator('.ai-heuristic-popover').innerText()).includes('Facebook support is experimental'),'missing experimental notice');
  // Settings apply and dismiss the panel, so verify the resulting badge instead
  // of waiting for the now-detached checkbox to remain checked.
  await page.getByLabel('Enable style cues on this site',{exact:true}).click();
  await page.locator('#post-text .ai-heuristic-badge').waitFor();
  await scrollFeed();
  assert(await page.locator('.ai-heuristic-badge').count()===6,'fixture ownership/badge count');
  assert(await page.locator('#quoted-post .ai-heuristic-badge, #ambiguous-post .ai-heuristic-badge, [contenteditable] .ai-heuristic-badge').count()===0,'unsafe/ambiguous owner');
  await openAnalysis('#post-text .ai-heuristic-badge');
  await page.screenshot({path:output+'/facebook-desktop.png'});
  await page.keyboard.press('Escape');
  assert(await page.locator('#post-text .ai-heuristic-badge').evaluate(n=>document.activeElement===n),'Escape focus');
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:'dark',forcedColors:'none',reducedMotion:'reduce'});
  await openAnalysis('#post-text .ai-heuristic-badge');
  const bounds=await page.locator('.ai-heuristic-popover').boundingBox();
  assert(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=390 && bounds.y+bounds.height<=844,'narrow panel overflow');
  assert(await page.locator('.ai-heuristic-popover h3').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).color===getComputedStyle(n.closest('.ai-heuristic-popover')).color)),'site styles override dark panel headings');
  await page.screenshot({path:output+'/facebook-narrow-dark.png'});
  await page.keyboard.press('Escape');
  await page.emulateMedia({forcedColors:'active'});
  const colors=await page.locator('#shared-post .ai-heuristic-meter__segment').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  assert(colors[0]!==colors[5],'forced colors hide filled bars');
  assert(await page.locator('#post-text .ai-heuristic-badge').evaluate(n=>getComputedStyle(n).transitionDuration)==='0s','reduced motion');
  await page.screenshot({path:output+'/facebook-forced-colors.png'});

  const monitor = `window.__resources={mo:new Set(),io:new Set(),interval:new Set()};
    for(const [name,key] of [['MutationObserver','mo'],['IntersectionObserver','io']]){const Native=window[name];window[name]=class extends Native{observe(...a){__resources[key].add(this);return super.observe(...a);}disconnect(){__resources[key].delete(this);return super.disconnect();}};}
    const originalSet=setInterval.bind(window),originalClear=clearInterval.bind(window);
    window.setInterval=(...a)=>{const id=originalSet(...a);__resources.interval.add(id);return id;};window.clearInterval=id=>{__resources.interval.delete(id);return originalClear(id);};`;
  const counts='Object.fromEntries(Object.entries(__resources).map(([key,set])=>[key,set.size]))';
  await page.setViewportSize({width:1280,height:900});
  await page.emulateMedia({colorScheme:'light',forcedColors:'none',reducedMotion:'reduce'});
  const coexistence=[];
  for(const order of [['combined','targeted'],['targeted','combined']]) {
    await load(true);
    const contexts=[];
    for(let i=0;i<order.length;i++) {
      const id=await world('facebook-guard-'+i);contexts.push(id);
      await evaluate(id,managerMock+monitor+sources[order[i]]);
      await page.waitForTimeout(150);
    }
    const active=[];for(const id of contexts)active.push(await evaluate(id,counts));
    assert(active.reduce((n,r)=>n+r.mo,0)===2 && active.reduce((n,r)=>n+r.io,0)===1 && active.reduce((n,r)=>n+r.interval,0)===1,'duplicate resources');
    await page.evaluate(()=>document.querySelector('meta[data-ai-style-owner]').dispatchEvent(new Event('ai-style-retire')));
    const stopped=[];for(const id of contexts)stopped.push(await evaluate(id,counts));
    assert(stopped.every(r=>Object.values(r).every(n=>n===0)),'coexistence cleanup');
    coexistence.push({order,active,stopped});
  }
  const sample='I checked the garden gate after work yesterday. The new latch closes with a gentle push and the hinge is still secure.';
  html='<!doctype html><style>body{margin:0;font:15px system-ui}main{max-width:700px;margin:auto}[role=article]{min-height:130px;padding:12px;box-sizing:border-box}</style><main><div role="feed">'+
    Array.from({length:80},(_,i)=>'<div data-pagelet="FeedUnit_'+i+'" style="display:contents"><div role="article" id="post-'+i+'"><div data-ad-preview="message"><div data-ad-rendering-role="story_message">'+sample+' Revision '+(i%4)+'.</div></div></div></div>').join('')+'</div></main>';
  function instrument(source) {
    const replace=(from,to)=>{assert(source.split(from).length===2,'instrumentation anchor: '+from);source=source.replace(from,to);};
    replace('function analyze(rawText, context, settings, options) {','function analyze(rawText, context, settings, options) { __stats.analyses++; if(options?.diagnostics)__stats.diagnostics++;');
    replace('const content = adapter.extractContent(element, kind)','__stats.extractions++; const content = adapter.extractContent(element, kind)');
    replace('function createBadge(analysis) {','function createBadge(analysis) { if(__stats.firstBadgeMs===null)__stats.firstBadgeMs=performance.now()-__stats.begin;');
    const begin=source.indexOf('  function flushQueue() {'),end=source.indexOf('  function scheduleQueue()',begin);
    const fn=source.slice(begin,end),last=fn.lastIndexOf('}');
    source=source.slice(0,begin)+fn.replace('function flushQueue() {','function flushQueue() { const __begin=performance.now(); try {').slice(0,-(fn.length-last))+'} finally {__stats.flushMs.push(performance.now()-__begin);} }\n\n'+source.slice(end);
    replace('    scanNow,','    getRuntimeStats:()=>({tracked:tracked.size,detachedTracked:[...tracked].filter(e=>!e.isConnected).length,cache:analysisCache.size,pending:pending.size}), scanNow,');
    replace('  bootAIHeuristic(','  window.__session=bootAIHeuristic(');
    return source+'\nwindow.__controller=__session.getController();';
  }
  const workloads=[];
  for(const distribution of ['combined','targeted']) {
    await load(true);
    const id=await world('facebook-workload');
    await evaluate(id,managerMock+monitor+'window.__stats={begin:performance.now(),firstBadgeMs:null,extractions:0,analyses:0,diagnostics:0,flushMs:[]};'+instrument(sources[distribution]));
    await page.locator('#post-0 .ai-heuristic-badge').waitFor();
    const startup=await evaluate(id,'({badges:document.querySelectorAll(".ai-heuristic-badge").length,analyses:__stats.analyses})');
    await scrollFeed();
    assert(await page.locator('.ai-heuristic-badge').count()===80,'missed Facebook cards');
    const before=await evaluate(id,'__stats.analyses');
    assert(before===4,'duplicate content not cached');
    await page.locator('#post-0 [data-ad-rendering-role]').evaluate(n=>n.append(' I checked the screws again today.'));
    await page.waitForTimeout(120);
    assert(await evaluate(id,'__stats.analyses')===before,'offscreen edit analyzed eagerly');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(250);
    assert(await evaluate(id,'__stats.analyses')===before+1,'nested Facebook edit missed');
    await page.evaluate(()=>[...document.querySelectorAll('[data-pagelet]')].slice(0,40).forEach(n=>n.remove()));
    await page.waitForTimeout(160);
    const stats=await evaluate(id,'({stats:__stats,runtime:__controller.getRuntimeStats()})');
    assert(stats.runtime.detachedTracked===0 && stats.runtime.cache<=128,'Facebook detached/cache retention');
    assert(stats.stats.diagnostics===0,'eager diagnostics');
    await evaluate(id,'__controller.stop()');
    const stopped=await evaluate(id,counts);
    assert(Object.values(stopped).every(n=>n===0),'Facebook teardown leak');
    workloads.push({distribution,startup,firstBadgeMs:stats.stats.firstBadgeMs,extractions:stats.stats.extractions,analyses:stats.stats.analyses,diagnostics:stats.stats.diagnostics,
      flushTotalMs:stats.stats.flushMs.reduce((a,b)=>a+b,0),flushMaxMs:Math.max(...stats.stats.flushMs),runtime:stats.runtime,stopped});
  }
  assert(errors.length===0,'browser errors: '+errors.join('; '));
  await cdp.detach();
  return {browser:page.context().browser().version(),syntheticOnly:true,isolatedWorld:true,csp:"script-src 'none'",ui:{badges:6,narrowBounds:bounds,keyboard:true,dark:true,forcedColors:true,reducedMotion:true},coexistence,workloads};
}
