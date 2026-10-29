async (page) => {
  const sources = __BADGE_SOURCES__, output = __BADGE_OUTPUT__;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const ordinary = 'I fixed the gate after work yesterday. The hinge needs oil but the latch still closes with a gentle push.';
  const moderate = 'Here are the key takeaways from this week. In conclusion, we need to check the new release with the support team before we ship it to everyone.';
  const high = moderate + '\n- Check the first item\n- Check the second item\n- Check the third item\nAs an AI, I can help with your question.';
  const samples = [['none', ordinary, 280], ['moderate', moderate, 280], ['high', high, 280],
    ['short', 'As an AI, I can help with your question.', 140], ['uncertain', 'No puedo asistir a la reunión de mañana.', 140], ['flex', moderate, 210]];
  const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    'body{margin:0;padding:24px;font:16px/1.5 system-ui;background:#f4f6f8;color:#172033}h1{font-size:24px;margin:0 0 20px}' +
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:18px;max-width:1100px;margin:auto}' +
    'article{padding:18px;background:#fff;border-radius:10px;min-width:0}.host{max-width:100%}' +
    '.feed-shared-inline-show-more-text{white-space:pre-wrap;line-height:1.5}h2{font-size:14px;margin:0 0 12px;font-weight:600;color:#5c667a}' +
    '.host button{height:22px;max-height:22px;min-width:250px;white-space:nowrap;text-indent:8px}.host button span{white-space:nowrap}' +
    '#flex .host{display:flex;flex-direction:column}.ai-heuristic-popover p{font-size:20px;margin:30px;line-height:2}' +
    '@media(prefers-color-scheme:dark){body{background:#111722;color:#f2f5fa}article{background:#202735}h2{color:#b8c4d8}}' +
    '</style><h1>AI Detected · Synthetic layout checks</h1><main>' + samples.map(([id,text,width]) =>
      '<article data-urn="urn:li:activity:'+id+'" id="'+id+'">'+(id==='flex'?'<div>Followed by <a href="/in/someone-else"><strong>Another person</strong></a></div>':'')+'<h2'+(id==='flex'?' style="display:grid;grid-template-columns:minmax(0,1fr) max-content"':'')+'><a href="/in/example-'+id+'">'+(id==='flex'?'<div>Example '+id+'</div>':'Example '+id)+'</a></h2><div class="host" style="width:'+width+'px"><div class="feed-shared-inline-show-more-text">'+text+'</div></div></article>').join('') + '</main></html>';
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.unrouteAll({behavior:'wait'});
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html,headers:{'content-security-policy':"script-src 'none'; object-src 'none'"}}) : route.abort());
  const chromium = page.context().browser().browserType().name() === 'chromium';
  const cdp = chromium ? await page.context().newCDPSession(page) : null;
  const load = async source => {
    await page.goto('https://www.linkedin.com/feed/');
    if (cdp) {
      const {frameTree} = await cdp.send('Page.getFrameTree');
      const {executionContextId} = await cdp.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'stamp-layout'});
      const result = await cdp.send('Runtime.evaluate',{contextId:executionContextId,expression:source,returnByValue:true});
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      await cdp.send('Runtime.evaluate',{contextId:executionContextId,expression:'window.__session.getController().scanNow()'});
    } else {
      // A WebKit runner uses a fresh context with bypassCSP:true. This checks
      // rendering/interaction, not Safari userscript isolated-world injection.
      await page.evaluate(source);
      await page.evaluate(()=>window.__session.getController().scanNow());
    }
    await page.locator('.ai-heuristic-badge').first().waitFor();
  };
  const measure = () => page.locator('.ai-heuristic-badge').evaluateAll(nodes => nodes.map(b => {
    const r=b.getBoundingClientRect(),p=b.parentElement.getBoundingClientRect(),style=getComputedStyle(b);
    const post=b.closest('article').querySelector('.feed-shared-inline-show-more-text');
    const author=b.parentElement.querySelector('a')?.getBoundingClientRect();
    return {id:b.closest('article').id,text:b.textContent,tone:b.dataset.cueTone,width:r.width,height:r.height,lineHeight:parseFloat(getComputedStyle(post).lineHeight),parentWidth:p.width,
      header:b.parentElement.localName==='h2',beforeText:r.bottom<=post.getBoundingClientRect().top+1,insideLink:Boolean(b.closest('a')),
      gridArea:b.style.gridArea,
      besideAuthor:Boolean(author&&r.left>=author.right-1&&r.top<author.bottom&&r.bottom>author.top),
      color:style.color,background:style.backgroundColor,border:style.borderStyle,
      overflow:r.left<p.left-1 || r.right>p.right+1 || b.scrollWidth>b.clientWidth+1 || b.scrollHeight>b.clientHeight+1,
      childOverflow:[...b.children].some(c=>{const q=c.getBoundingClientRect();return q.left<r.left-1||q.right>r.right+1||q.top<r.top-1||q.bottom>r.bottom+1;})};
  }));
  await page.setViewportSize({width:1280,height:1000});
  await page.emulateMedia({colorScheme:'light',forcedColors:'none',reducedMotion:'reduce'});
  await load(sources.baseline);
  const before = await measure();
  assert(before.length===6,'0.8 baseline has unconditional badges');
  await load(sources.current);
  const results=[];
  for (const spec of [
    {name:'desktop',width:1280,height:1000,colorScheme:'light',font:16},
    {name:'narrow-dark',width:390,height:844,colorScheme:'dark',font:16},
    {name:'large-text',width:390,height:844,colorScheme:'light',font:24}
  ]) {
    await page.mouse.move(0,0);
    await page.setViewportSize({width:spec.width,height:spec.height});
    await page.emulateMedia({colorScheme:spec.colorScheme,forcedColors:'none',reducedMotion:'reduce'});
    await page.locator('.feed-shared-inline-show-more-text').evaluateAll((nodes,size)=>nodes.forEach(n=>n.style.fontSize=size+'px'),spec.font);
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    const badges=await measure();
    assert(badges.length===4,'only matched samples get stamps');
    assert(badges.every(b=>!b.overflow&&!b.childOverflow),'overflow: '+JSON.stringify({spec,badges}));
    assert(badges.every(b=>b.text==='AI Detected'),'stamp label');
    assert(badges.every(b=>b.header&&b.beforeText&&b.besideAuthor&&!b.insideLink),'stamp must be beside the author above the post text: '+JSON.stringify(badges));
    assert(badges.find(b=>b.id==='flex').gridArea==='1 / 2','one-item author grids use the same row');
    assert(badges.every(b=>Math.abs(b.height-b.lineHeight)<1),'stamp height must match post line height: '+JSON.stringify(badges));
    assert(badges.find(b=>b.id==='high').tone==='high' && badges.find(b=>b.id==='moderate').tone==='moderate','levels');
    assert(badges.find(b=>b.id==='high').border==='double','high has a non-color cue');
    results.push({spec,badges});
    await page.screenshot({path:output+'/stamp-'+spec.name+'.png',fullPage:true});
  }
  await page.locator('#moderate h2').evaluate(n=>n.style.width='80px');
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  const compressed = (await measure()).find(b=>b.id==='moderate');
  assert(!compressed.overflow&&!compressed.childOverflow&&compressed.height===compressed.lineHeight,'80px nested reply stamp');
  await page.locator('#moderate h2').evaluate(n=>n.style.width='');
  await page.setViewportSize({width:1280,height:1000});
  await page.emulateMedia({colorScheme:'light',reducedMotion:'no-preference'});
  await page.locator('.feed-shared-inline-show-more-text').evaluateAll(nodes=>nodes.forEach(n=>n.style.fontSize='16px'));
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  const badge=page.locator('#moderate .ai-heuristic-badge');
  await badge.scrollIntoViewIfNeeded();
  await badge.hover();
  const panel=page.locator('.ai-heuristic-popover');
  await panel.waitFor();
  const motion=await panel.evaluate(n=>({name:getComputedStyle(n).animationName,duration:getComputedStyle(n).animationDuration,origin:getComputedStyle(n).transformOrigin}));
  assert(motion.name==='aih-stamp-grow'&&motion.duration==='0.18s','grow animation');
  assert(await page.evaluate(()=>document.activeElement===document.body),'hover must not move keyboard focus');
  await panel.hover();
  await page.waitForTimeout(260);
  assert(await panel.count()===1,'panel remains open while hovered');
  await page.screenshot({path:output+'/stamp-hover.png',fullPage:false});
  await page.mouse.move(0,0);
  await panel.waitFor({state:'detached'});
  await badge.focus();await page.keyboard.press('Enter');
  await panel.waitFor();
  assert((await panel.innerText()).includes('not proof of AI authorship'),'evidence explanation');
  await page.mouse.move(0,0);await page.waitForTimeout(260);
  assert(await panel.count()===1,'activation pins details');
  await page.keyboard.press('Escape');
  assert(await badge.evaluate(n=>document.activeElement===n),'Escape focus restoration');
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await badge.scrollIntoViewIfNeeded();await badge.focus();await page.keyboard.press('Enter');
  const bounds=await panel.boundingBox();
  assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844,'panel overflow');
  assert(await panel.evaluate(n=>getComputedStyle(n).animationName)==='none','reduced motion removes grow');
  await page.keyboard.press('Escape');
  if (chromium) {
    await page.emulateMedia({forcedColors:'active'});
    assert(await page.locator('#high .ai-heuristic-badge').evaluate(n=>getComputedStyle(n).borderStyle)==='double','forced-color severity cue');
  }
  if (!chromium) {
    const touchContext = await page.context().browser().newContext({bypassCSP:true,hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
    try {
      const touchPage = await touchContext.newPage();
      touchPage.on('pageerror', e=>errors.push(e.message));
      await touchPage.route('**/*', route=>route.request().isNavigationRequest()
        ? route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}) : route.abort());
      await touchPage.goto('https://www.linkedin.com/feed/');
      await touchPage.evaluate(sources.current);
      await touchPage.evaluate(()=>window.__session.getController().scanNow());
      await touchPage.locator('#moderate .ai-heuristic-badge').tap();
      await touchPage.locator('.ai-heuristic-popover').waitFor();
      await touchPage.locator('[aria-label="Close analysis"]').tap();
      assert(await touchPage.locator('.ai-heuristic-popover').count()===0,'touch closes details');
    } finally { await touchContext.close(); }
  }
  assert(errors.length===0,'page errors: '+errors.join('; '));
  return {browser:page.context().browser().version(),network:'Synthetic HTML; other requests blocked.',injection:chromium?'Isolated world under script-src none':'Page world; runner bypasses CSP',before,results,compressed,motion,hover:true,keyboard:true,touch:!chromium,forcedColors:chromium,reducedMotion:true,panelFits:true,errors};
}
