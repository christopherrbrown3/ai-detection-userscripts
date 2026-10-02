function createPlatformAdapter() {
  'use strict';

  const descriptionSelector = 'ytd-watch-metadata';
  const postSelector = 'ytd-backstage-post-renderer';
  const commentSelector = 'ytd-comment-view-model, ytd-comment-renderer';
  const ownerSelector = descriptionSelector + ', ' + postSelector + ', ' + commentSelector;
  const excludedContext = '[hidden], [aria-hidden="true"], [contenteditable]:not([contenteditable="false"]), ' +
    'form, [role="textbox"], #translated-content, ytd-commentbox, ytd-backstage-post-dialog-renderer, ' +
    'ytd-reel-video-renderer, ytd-shorts, ytd-live-chat-frame, yt-live-chat-renderer, ' +
    'ytd-transcript-renderer, ytd-transcript-search-panel-renderer, ytd-video-description-transcript-section-renderer, ' +
    'ytd-metadata-row-container-renderer, ytd-rich-metadata-row-renderer, ytd-video-description-infocards-section-renderer, ' +
    'ytd-compact-video-renderer, ytd-video-renderer, ytd-rich-grid-media, ytd-miniplayer';
  const textSelector = 'yt-attributed-string#content-text, yt-formatted-string#content-text';

  function route(url) {
    if (url.pathname === '/watch' && /^[\w-]+$/.test(url.searchParams.get('v') || '')) return 'watch';
    if (/^\/post\/[\w-]+\/?$/.test(url.pathname)) return 'post';
    if (/^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)\/(?:posts|community)\/?$/.test(url.pathname)) return 'posts';
    return null;
  }

  function allowed(element) {
    const page = route(new URL(location.href));
    if (!page || element.closest(excludedContext)) return false;
    const quote = element.parentElement?.closest(postSelector);
    if (quote && (element.matches(postSelector) || quote.parentElement?.closest(postSelector))) return false;
    if (element.closest('blockquote, q')) return false;
    if (page === 'watch') {
      const watch = element.closest('ytd-watch-flexy');
      // YouTube retains the old page during client-side navigation. Never
      // assign its text to a different video while the new page is loading.
      return Boolean(watch && watch.getAttribute('video-id') === new URL(location.href).searchParams.get('v'));
    }
    return Boolean(element.closest('ytd-browse'));
  }

  function ownedNodes(element, selector) {
    return [...element.querySelectorAll(selector)].filter(node => node.closest(ownerSelector) === element);
  }

  function descriptionBody(element) {
    if (route(new URL(location.href)) !== 'watch') return null;
    const expanders = ownedNodes(element, 'ytd-text-inline-expander#description-inline-expander');
    if (expanders.length !== 1) return null;
    const expander = expanders[0];
    // Prefer the full author body if it is already rendered, even when the
    // expander clips it. Do not read extra-content slots (credits/transcripts).
    const full = [...expander.querySelectorAll('#expanded yt-attributed-string')]
      .filter(node => node.closest('ytd-text-inline-expander') === expander && node.textContent.trim());
    const snippet = [...expander.querySelectorAll('yt-attributed-string#attributed-snippet-text')]
      .filter(node => node.closest('ytd-text-inline-expander') === expander && node.textContent.trim());
    const bodies = full.length ? full : snippet;
    return bodies.length === 1 ? { body: bodies[0], host: expander } : null;
  }

  function bodyFor(element, kind) {
    if (!allowed(element)) return null;
    if (element.matches(descriptionSelector)) return kind === 'post' ? descriptionBody(element) : null;
    if (element.matches(postSelector)) {
      if (!['post', 'posts'].includes(route(new URL(location.href)))) return null;
      if (ownedNodes(element, 'ytd-backstage-poll-renderer, ytd-poll-renderer').length) return null;
    } else if (!element.matches(commentSelector) || !element.closest('ytd-comments')) return null;
    const bodies = ownedNodes(element, textSelector).filter(body => !body.closest(excludedContext));
    if (bodies.length !== 1) return null;
    const body = bodies[0], expander = body.closest('ytd-expander, ytd-text-inline-expander');
    return { body, host: expander && element.contains(expander) ? expander : body };
  }

  function readBody(body) {
    const copy = body.cloneNode(true);
    copy.style.whiteSpace = window.getComputedStyle(body).whiteSpace;
    // Author rich text is inline HTML. Unknown custom widgets, translated
    // panels, hidden helper labels and controls must not become prose.
    copy.querySelectorAll(excludedContext).forEach(node => node.remove());
    copy.querySelectorAll('*').forEach(node => {
      if (node.localName.includes('-') && !['yt-attributed-string', 'yt-formatted-string'].includes(node.localName)) node.remove();
    });
    return aiHeuristicReadContent(copy);
  }

  return {
    id: 'youtube',
    name: 'YouTube',
    postSelector: descriptionSelector + ', ' + postSelector,
    commentSelector,
    observedAttributes: ['id', 'hidden', 'aria-hidden', 'video-id', 'contenteditable'],
    navigationEvents: { start: 'yt-navigate-start', finish: 'yt-navigate-finish' },
    supportsUrl(url) { return Boolean(route(url)); },
    isTopLevel(element, kind) { return Boolean(bodyFor(element, kind)); },
    extractContent(element, kind) {
      const owned = bodyFor(element, kind);
      if (!owned) return null;
      const content = readBody(owned.body);
      if (element.matches(postSelector)) {
        content.excluded.quotes += [...element.querySelectorAll(postSelector)]
          .filter(quote => quote.parentElement?.closest(postSelector) === element).length;
      }
      return { ...content, host: owned.host };
    },
    placeBadge(element, badge, kind, content) {
      if (!content.host || !element.contains(content.host)) throw new Error('Missing YouTube text host');
      content.host.insertAdjacentElement('afterend', badge);
    }
  };
}
