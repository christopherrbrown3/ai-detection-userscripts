async (page) => {
  const sources = __YOUTUBE_SOURCES__, fixture = __YOUTUBE_FIXTURE__, output = __YOUTUBE_OUTPUT__;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settingsKey = 'ai-heuristic:youtube:settings:v2';
  const managerMock = ''; // YouTube uses origin-local settings even in the combined bundle.
  const styles='<meta name="viewport" content="width=device-width, initial-scale=1"><style>'+
    'body{margin:0;padding:24px;background:#fff;color:#172033;font:15px/1.5 system-ui}ytd-app{display:block;max-width:720px;margin:auto}'+
    'ytd-watch-metadata,ytd-comment-view-model,ytd-comment-renderer,ytd-backstage-post-renderer{display:block;margin:12px 0;padding:16px;border:1px solid #ddd;border-radius:8px}'+
    'ytd-expander,ytd-text-inline-expander{display:block}ytd-live-chat-frame,ytd-transcript-renderer,ytd-compact-video-renderer,ytd-commentbox{display:none}'+
    '[hidden]{display:none}button{color:inherit}'+
    '@media(prefers-color-scheme:dark){body{background:#0f0f0f;color:#f1f1f1}}'+
    '</style>';
  let html=fixture.replace('</head>',styles+'</head>');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'content-security-policy':"script-src 'none'; object-src 'none'"},body:html}) : route.abort());
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
    await page.goto('https://www.youtube.com/watch?v=video000001');
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
  await evaluate(await world('youtube-ui'),managerMock+sources.combined);
  assert(await page.locator('.ai-heuristic-badge').count()===0,'YouTube must start off');
  await page.locator('.ai-heuristic-launcher').click();
  assert((await page.locator('.ai-heuristic-popover').innerText()).includes('YouTube support is experimental'),'missing experimental notice');
  // Settings apply and dismiss the panel, so verify the resulting badge instead
  // of waiting for the now-detached checkbox to remain checked.
  await page.getByLabel('Enable style cues on this site',{exact:true}).click();
  await page.locator('#description-owner .ai-heuristic-badge').waitFor();
  await scrollFeed();
  assert(await page.locator('.ai-heuristic-badge').count()===4,'fixture ownership/badge count');
  assert(await page.locator('#chat .ai-heuristic-badge, #cached .ai-heuristic-badge, #unknown-comment .ai-heuristic-badge, [contenteditable] .ai-heuristic-badge').count()===0,'unsafe/ambiguous owner');
  await page.locator('#description-owner .ai-heuristic-badge').focus();
  await page.keyboard.press('Enter');
  await page.locator('.ai-heuristic-popover').waitFor();
  await page.screenshot({path:output+'/youtube-desktop.png'});
  await page.keyboard.press('Escape');
  assert(await page.locator('#description-owner .ai-heuristic-badge').evaluate(n=>document.activeElement===n),'Escape focus');
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:'dark',forcedColors:'none',reducedMotion:'reduce'});
  await openAnalysis('#description-owner .ai-heuristic-badge');
  const bounds=await page.locator('.ai-heuristic-popover').boundingBox();
  assert(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=390 && bounds.y+bounds.height<=844,'narrow panel overflow');
  assert(await page.locator('.ai-heuristic-popover h3').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).color===getComputedStyle(n.closest('.ai-heuristic-popover')).color)),'site styles override dark panel headings');
  await page.screenshot({path:output+'/youtube-narrow-dark.png'});
  await page.keyboard.press('Escape');
  await page.emulateMedia({forcedColors:'active'});
  const colors=await page.locator('#comment-one .ai-heuristic-meter__segment').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  assert(colors[0]!==colors[5],'forced colors hide filled bars');
  assert(await page.locator('#description-owner .ai-heuristic-badge').evaluate(n=>getComputedStyle(n).transitionDuration)==='0s','reduced motion');
  await page.screenshot({path:output+'/youtube-forced-colors.png'});

  const monitor = `window.__resources={mo:new Set(),io:new Set(),interval:new Set()};
    for(const [name,key] of [['MutationObserver','mo'],['IntersectionObserver','io']]){const Native=window[name];window[name]=class extends Native{observe(...a){__resources[key].add(this);return super.observe(...a);}disconnect(){__resources[key].delete(this);return super.disconnect();}};}
    __resources.navigation=new Set();
    const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
    document.addEventListener=(type,fn,...args)=>{if(type.startsWith('yt-navigate-'))__resources.navigation.add(fn);return add(type,fn,...args);};
    document.removeEventListener=(type,fn,...args)=>{__resources.navigation.delete(fn);return remove(type,fn,...args);};
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
      const id=await world('youtube-guard-'+i);contexts.push(id);
      await evaluate(id,managerMock+monitor+sources[order[i]]);
      await page.waitForTimeout(150);
    }
    const active=[];for(const id of contexts)active.push(await evaluate(id,counts));
    assert(active.reduce((n,r)=>n+r.mo,0)===2 && active.reduce((n,r)=>n+r.io,0)===1 && active.reduce((n,r)=>n+r.interval,0)===1 && active.reduce((n,r)=>n+r.navigation,0)===2,'duplicate resources');
    await page.evaluate(()=>document.querySelector('meta[data-ai-style-owner]').dispatchEvent(new Event('ai-style-retire')));
    const stopped=[];for(const id of contexts)stopped.push(await evaluate(id,counts));
    assert(stopped.every(r=>Object.values(r).every(n=>n===0)),'coexistence cleanup');
    coexistence.push({order,active,stopped});
  }
  // Exercise YouTube's document events in the same isolated world used by the manager.
  await load(true);
  await evaluate(await world('youtube-navigation'),sources.combined);
  await page.locator('#description-owner .ai-heuristic-badge').waitFor();
  await openAnalysis('#description-owner .ai-heuristic-badge');
  await page.evaluate(()=>document.dispatchEvent(new Event('yt-navigate-start')));
  assert(await page.locator('.ai-heuristic-badge,.ai-heuristic-popover').count()===0,'stale navigation UI');
  await page.evaluate(()=>{
    history.pushState({},'', '/watch?v=video000003');
    document.querySelector('ytd-watch-flexy').setAttribute('video-id','video000003');
    document.querySelector('#description-body').textContent='I checked the garden gate after work yesterday. The replacement latch closes with a gentle push and the hinge is still secure.';
  });
  await page.waitForTimeout(1100);
  assert(await page.locator('.ai-heuristic-badge').count()===0,'navigation started analyzing before finish');
  await page.evaluate(()=>document.dispatchEvent(new Event('yt-navigate-finish')));
  await page.locator('#description-owner .ai-heuristic-badge').waitFor();
  await page.evaluate(()=>{
    document.dispatchEvent(new Event('yt-navigate-start'));
    history.pushState({},'', '/shorts/video000004');
    document.dispatchEvent(new Event('yt-navigate-finish'));
  });
  assert(await page.locator('.ai-heuristic-badge').count()===0,'unsupported route badge');
  await page.evaluate(()=>{
    document.dispatchEvent(new Event('yt-navigate-start'));
    history.pushState({},'', '/@example/posts');
    document.querySelector('ytd-page-manager').innerHTML='<ytd-browse><ytd-backstage-post-renderer id="channel-post"><yt-formatted-string id="content-text">I checked the garden gate after work yesterday. The new latch closes with a gentle push and the hinge is still secure.</yt-formatted-string><ytd-backstage-poll-renderer hidden></ytd-backstage-poll-renderer></ytd-backstage-post-renderer><ytd-backstage-post-renderer id="channel-poll"><yt-formatted-string id="content-text">Which repair would you try first?</yt-formatted-string><ytd-backstage-poll-renderer>Option A Option B</ytd-backstage-poll-renderer></ytd-backstage-post-renderer></ytd-browse>';
    document.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await page.locator('#channel-post .ai-heuristic-badge').waitFor();
  assert(await page.locator('.ai-heuristic-badge').count()===1,'channel Posts route ownership');

  const sample='I checked the garden gate after work yesterday. The new latch closes with a gentle push and the hinge is still secure.';
  html='<!doctype html><head>'+styles+'</head><ytd-app><ytd-watch-flexy video-id="video000001"><ytd-comments>'+
    Array.from({length:80},(_,i)=>'<ytd-comment-view-model id="post-'+i+'" style="min-height:130px;box-sizing:border-box"><ytd-expander><yt-attributed-string id="content-text">'+sample+' Revision '+(i%4)+'.</yt-attributed-string></ytd-expander></ytd-comment-view-model>').join('')+'</ytd-comments></ytd-watch-flexy></ytd-app>';
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
    const id=await world('youtube-workload');
    await evaluate(id,managerMock+monitor+'window.__stats={begin:performance.now(),firstBadgeMs:null,extractions:0,analyses:0,diagnostics:0,flushMs:[]};'+instrument(sources[distribution]));
    await page.locator('#post-0 .ai-heuristic-badge').waitFor();
    const startup=await evaluate(id,'({badges:document.querySelectorAll(".ai-heuristic-badge").length,analyses:__stats.analyses})');
    await scrollFeed();
    assert(await page.locator('.ai-heuristic-badge').count()===80,'missed YouTube cards');
    const before=await evaluate(id,'__stats.analyses');
    assert(before===4,'duplicate content not cached');
    await page.locator('#post-0 #content-text').evaluate(n=>n.append(' I checked the screws again today.'));
    await page.waitForTimeout(120);
    assert(await evaluate(id,'__stats.analyses')===before,'offscreen edit analyzed eagerly');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForTimeout(250);
    assert(await evaluate(id,'__stats.analyses')===before+1,'nested YouTube edit missed');
    await page.evaluate(()=>[...document.querySelectorAll('ytd-comment-view-model')].slice(0,40).forEach(n=>n.remove()));
    await page.waitForTimeout(160);
    const stats=await evaluate(id,'({stats:__stats,runtime:__controller.getRuntimeStats()})');
    assert(stats.runtime.detachedTracked===0 && stats.runtime.cache<=128,'YouTube detached/cache retention');
    assert(stats.stats.diagnostics===0,'eager diagnostics');
    await evaluate(id,'__controller.stop()');
    const stopped=await evaluate(id,counts);
    assert(Object.values(stopped).every(n=>n===0),'YouTube teardown leak');
    workloads.push({distribution,startup,firstBadgeMs:stats.stats.firstBadgeMs,extractions:stats.stats.extractions,analyses:stats.stats.analyses,diagnostics:stats.stats.diagnostics,
      flushTotalMs:stats.stats.flushMs.reduce((a,b)=>a+b,0),flushMaxMs:Math.max(...stats.stats.flushMs),runtime:stats.runtime,stopped});
  }
  assert(errors.length===0,'browser errors: '+errors.join('; '));
  await cdp.detach();
  return {browser:page.context().browser().version(),syntheticOnly:true,isolatedWorld:true,csp:"script-src 'none'",navigation:true,ui:{badges:4,narrowBounds:bounds,keyboard:true,dark:true,forcedColors:true,reducedMotion:true},coexistence,workloads};
}
