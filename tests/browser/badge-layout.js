async (page) => {
  const sources = __BADGE_SOURCES__, output = __BADGE_OUTPUT__;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const ordinary = 'I fixed the back gate after work on Tuesday. The hinge still squeaks, but the latch finally closes and the dog cannot nose it open anymore.';
  const samples = [
    ['zero', ordinary, 280],
    ['one', 'Here are the key takeaways from this week. In conclusion, we need to check the new release with the support team before we ship it to everyone.', 280],
    ['short', 'I agree with your point. That is helpful!', 140],
    ['uncertain', 'No puedo asistir a la reunión de mañana.', 140],
    ['unsupported', 'Сегодня была хорошая погода. Мы пошли гулять в парк.', 80],
    ['flex', ordinary, 210]
  ];
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'body{margin:0;padding:20px;font:16px/1.5 system-ui;background:#f4f6f8;color:#172033}h1{font-size:24px;margin:0 0 18px}' +
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:16px;max-width:1100px;margin:auto}' +
    'article{padding:16px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;min-width:0}.host{max-width:100%}' +
    '.feed-shared-inline-show-more-text{margin-bottom:8px}h2{font-size:14px;margin:0 0 12px}' +
    '.host button{height:22px;max-height:22px;min-width:250px;white-space:nowrap;text-indent:8px}' +
    '.host button span{white-space:nowrap}#flex .host{display:flex;flex-direction:column}' +
    '@media(prefers-color-scheme:dark){body{background:#111722;color:#f2f5fa}article{background:#202735;border-color:#586378}}' +
    '</style><h1>AI Score · Synthetic layout checks</h1><main>' + samples.map(([id,text,width]) =>
      '<article data-urn="urn:li:activity:'+id+'" id="'+id+'"><h2>'+id+' · '+width+'px container</h2><div class="host" style="width:'+width+'px"><div class="feed-shared-inline-show-more-text">'+text+'</div></div></article>').join('') + '</main>';
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html,headers:{'content-security-policy':"script-src 'none'; object-src 'none'"}}) : route.abort());
  const cdp = await page.context().newCDPSession(page);
  const load = async source => {
    await page.goto('https://www.linkedin.com/feed/');
    const {frameTree} = await cdp.send('Page.getFrameTree');
    const {executionContextId} = await cdp.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'badge-layout'});
    const result = await cdp.send('Runtime.evaluate',{contextId:executionContextId,expression:source,returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    // Force only this synthetic fixture through the runtime's existing test hook.
    await cdp.send('Runtime.evaluate',{contextId:executionContextId,expression:'window.__session.getController().scanNow()'});
    await page.locator('.ai-heuristic-badge').first().waitFor();
  };
  const measure = () => page.locator('.ai-heuristic-badge').evaluateAll(nodes => nodes.map(b => {
    const r=b.getBoundingClientRect(),p=b.parentElement.getBoundingClientRect();
    return {id:b.closest('article').id,text:b.textContent,width:r.width,height:r.height,parentWidth:p.width,
      overflow:r.left<p.left-1 || r.right>p.right+1 || b.scrollWidth>b.clientWidth+1 || b.scrollHeight>b.clientHeight+1,
      childOverflow:[...b.children].some(c=>{const q=c.getBoundingClientRect();return q.left<r.left-1||q.right>r.right+1||q.top<r.top-1||q.bottom>r.bottom+1;}),
      bars:b.querySelectorAll('.ai-heuristic-meter__segment').length,filled:b.querySelectorAll('[data-filled="true"]').length};
  }));
  await page.setViewportSize({width:1280,height:1000});
  await page.emulateMedia({colorScheme:'light',forcedColors:'none',reducedMotion:'reduce'});
  await load(sources.baseline);
  const baseline=await measure();
  assert(baseline.some(b=>b.overflow||b.childOverflow),'fixture must reproduce old overflow');
  await load(sources.current);
  const results=[];
  for(const spec of [
    {name:'desktop',width:1280,height:1000,colorScheme:'light',font:12},
    {name:'narrow-dark',width:390,height:844,colorScheme:'dark',font:12},
    {name:'large-text',width:390,height:844,colorScheme:'light',font:24}
  ]) {
    await page.setViewportSize({width:spec.width,height:spec.height});
    await page.emulateMedia({colorScheme:spec.colorScheme,forcedColors:'none',reducedMotion:'reduce'});
    await page.locator('.ai-heuristic-badge').evaluateAll((nodes,size)=>nodes.forEach(n=>n.style.fontSize=size+'px'),spec.font);
    const badges=await measure();
    assert(badges.length===6,'missing badge state');
    assert(badges.every(b=>!b.overflow&&!b.childOverflow),'overflow: '+JSON.stringify({spec,badges}));
    assert(badges.every(b=>!/\/100|%/.test(b.text)),'percentage-like score remains');
    assert(badges.find(b=>b.id==='one').filled===1 && badges.find(b=>b.id==='one').bars===6,'count/bar agreement');
    assert(badges.find(b=>b.id==='uncertain').bars===0,'unassessed meter');
    results.push({spec,badges});
    await page.screenshot({path:output+'/badge-'+spec.name+'.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  const badge=page.locator('#one .ai-heuristic-badge');
  await badge.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await badge.focus();await page.keyboard.press('Enter');
  await page.locator('.ai-heuristic-popover').waitFor();
  assert((await page.locator('.ai-heuristic-popover').innerText()).includes('Authorship probability is unavailable'),'probability explanation');
  const bounds=await page.locator('.ai-heuristic-popover').boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844,'panel overflow');
  await page.keyboard.press('Escape');
  assert(await badge.evaluate(n=>document.activeElement===n),'Escape focus restoration');
  await page.emulateMedia({forcedColors:'active'});
  const colors=await badge.locator('.ai-heuristic-meter__segment').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
  assert(colors[0]!==colors[5],'forced-color meter contrast');
  assert(await badge.evaluate(n=>getComputedStyle(n).transitionDuration)==='0s','reduced motion');
  assert(errors.length===0,'page errors: '+errors.join('; '));
  return {browser:page.context().browser().version(),network:'All navigation fulfilled with synthetic HTML; other requests aborted.',baseline,results,keyboard:true,forcedColors:true,reducedMotion:true,panelFits:true,errors};
}
