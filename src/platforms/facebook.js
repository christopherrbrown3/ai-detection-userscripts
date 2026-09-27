function createPlatformAdapter() {
  'use strict';

  // Use published-text anchors, never generated classes or full-card text.
  const messageSelector = '[data-ad-preview="message"], [data-ad-comet-preview="message"], [data-ad-rendering-role="story_message"]';
  const articleSelector = '[role="article"]';
  const commentSelector = '[role="article"][aria-label]';
  const feedCardSelector = '[data-pagelet^="FeedUnit_"], [role="feed"] > div';
  const postSelector = articleSelector + ', ' + feedCardSelector + ', ' + messageSelector;
  const excludedContext = '[contenteditable]:not([contenteditable="false"]), [role="textbox"], form, aside, [role="complementary"], [role="navigation"], ' +
    '[aria-hidden="true"], [hidden], [data-pagelet*="Chat"], [data-pagelet*="Messenger"], ' +
    '[data-pagelet*="Stories"], [data-pagelet*="Reels"], [data-pagelet*="Composer"]';
  const quoteSelector = '[role="article"]';
  const reservedRoutes = new Set([
    'messages', 'messenger', 'groups', 'marketplace', 'stories', 'story', 'reel', 'reels',
    'watch', 'gaming', 'notifications', 'events', 'settings', 'privacy', 'business',
    'ads', 'adsmanager', 'login', 'checkpoint', 'photo', 'photo.php', 'photos',
    'video', 'video.php', 'videos', 'search', 'friends', 'memories', 'saved',
    'recover', 'help', 'dialog', 'share', 'share.php', 'live', 'accounts', 'policies'
  ]);

  function supportsUrl(url) {
    const parts = url.pathname.toLowerCase().split('/').filter(Boolean);
    if (reservedRoutes.has(parts[0]) || url.searchParams.has('v')) return false;
    if (!parts.length) return true;
    if (parts.length === 1) {
      if (parts[0].endsWith('.php')) return ['home.php', 'profile.php', 'permalink.php', 'story.php'].includes(parts[0]);
      return /^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(parts[0]);
    }
    if (parts[0] === 'posts') return parts.length === 2;
    if (parts[1] === 'posts') return parts.length <= 3;
    return parts[0] === 'people' && (parts.length === 3 || (parts.length === 4 && parts[3] === 'posts'));
  }

  function commentLink(link) {
    try {
      const url = new URL(link.getAttribute('href'), location.href);
      return url.protocol === 'https:' && ['www.facebook.com', 'facebook.com'].includes(url.hostname) &&
        supportsUrl(url) && Boolean(url.searchParams.get('comment_id') || url.searchParams.get('reply_comment_id'));
    } catch (_) { return false; }
  }

  function isComment(element) {
    if (!element.matches(commentSelector)) return false;
    // A post may contain comments/permalinks too; evidence must belong to this
    // article, not a descendant reply, and it must have no owned post message.
    if ([...element.querySelectorAll(messageSelector)].some(node => node.closest(articleSelector) === element)) return false;
    return [...element.querySelectorAll('a[href]')].some(link =>
      link.closest(articleSelector) === element && commentLink(link));
  }

  function allowedContext(element) {
    if (!supportsUrl(new URL(location.href)) || element.closest(excludedContext)) return false;
    const dialog = element.closest('[role="dialog"]');
    // Messaging and composer overlays can appear without a URL change. An
    // eligible post dialog must contain an explicit published-message anchor.
    if (dialog) return Boolean(dialog.querySelector(messageSelector)) && !dialog.closest(excludedContext);
    return Boolean(element.closest('main, [role="main"], [role="feed"]'));
  }

  function messageBodies(root) {
    const bodies = root.matches(messageSelector) ? [root] : [...root.querySelectorAll(messageSelector)];
    return bodies.filter(body => !body.parentElement?.closest(messageSelector));
  }

  function bodyIsOwned(element) {
    if (!allowedContext(element) || element.closest('blockquote, q, a, [role="link"], [role="button"]')) return false;
    const article = element.closest(articleSelector);
    if (article && (isComment(article) || article.parentElement?.closest(articleSelector))) return false;
    if (article) {
      const outer = article.parentElement?.closest(feedCardSelector);
      if (outer && messageBodies(outer).some(node =>
        !article.contains(node) && !node.closest(articleSelector) && !node.closest('blockquote, q, a, [role="link"]'))) return false;
    }
    return true;
  }

  function ownerFor(body) {
    const article = body.closest(articleSelector);
    const card = article || body.closest(feedCardSelector);
    // Some feed wrappers have no viewport box. The published text itself is a
    // bounded fallback, including on standalone permalinks without an article.
    return card && window.getComputedStyle(card).display !== 'contents' ? card : body;
  }

  function postBody(element) {
    const bodies = messageBodies(element);
    const owned = bodies.filter(body => ownerFor(body) === element && bodyIsOwned(body));
    // Multiple unmarked author bodies are ambiguous. Never choose the longest
    // one or merge commentary with an embedded original.
    return owned.length === 1 ? owned[0] : null;
  }

  function commentBodies(element) {
    return [...element.querySelectorAll('div[dir="auto"]')].filter(node => {
      if (node.closest(articleSelector) !== element || node.closest(excludedContext + ', a, [role="link"], [role="button"]')) return false;
      if (node.querySelector('h1, h2, h3, h4, time')) return false;
      return ![...node.querySelectorAll('a[href]')].some(commentLink);
    }).filter((node, index, all) => !all.some((parent, other) => other !== index && parent.contains(node)));
  }

  function commentIsOwned(element) {
    if (!allowedContext(element) || !isComment(element) || element.closest('blockquote, q, a, [role="link"]')) return false;
    let parent = element.parentElement?.closest(articleSelector);
    while (parent) {
      if (!isComment(parent) && parent.parentElement?.closest(articleSelector)) return false;
      parent = parent.parentElement?.closest(articleSelector);
    }
    return true;
  }

  return {
    id: 'facebook',
    name: 'Facebook',
    postSelector,
    commentSelector,
    observedAttributes: ['data-ad-preview', 'data-ad-comet-preview', 'data-ad-rendering-role', 'data-pagelet', 'aria-label', 'aria-hidden', 'hidden', 'dir', 'href', 'contenteditable'],
    supportsUrl,
    kindForElement(element) { return isComment(element) ? 'comment' : 'post'; },
    isTopLevel(element, kind) {
      return kind === 'post' ? Boolean(postBody(element)) : commentIsOwned(element);
    },
    extractContent(element, kind) {
      if (kind === 'post') {
        const body = postBody(element);
        if (!body) return null;
        const content = aiHeuristicReadContent(body, { quoteSelector });
        // Count identifiable shared originals outside the author's message,
        // without counting comments/replies or a quote's nested descendants.
        for (const quote of element.querySelectorAll(articleSelector)) {
          if (body.contains(quote) || !quote.querySelector(messageSelector) || isComment(quote)) continue;
          const parent = quote.parentElement?.closest(articleSelector);
          if (parent === (element.matches(articleSelector) ? element : null)) content.excluded.quotes += 1;
        }
        return { ...content, host: body };
      }
      const bodies = commentBodies(element);
      if (!bodies.length) return null;
      const excluded = { quotes: 0, code: 0 };
      const text = bodies.map(body => {
        const content = aiHeuristicReadContent(body, { quoteSelector });
        excluded.quotes += content.excluded.quotes;
        excluded.code += content.excluded.code;
        return content.text;
      }).filter(Boolean).join('\n');
      return { text, excluded, host: bodies[bodies.length - 1] };
    },
    placeBadge(element, badge, kind, content) {
      // Keep the badge beside the analyzed text; the shared reader excludes UI.
      content.host.appendChild(badge);
    }
  };
}
