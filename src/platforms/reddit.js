function createPlatformAdapter() {
  'use strict';

  const postSelector = [
    'shreddit-post',
    'div[data-testid="post-container"]',
    'div.thing.link',
    'div.thing.self'
  ].join(', ');
  const commentSelector = [
    'shreddit-comment',
    'div[data-testid="comment"]',
    'div.comment'
  ].join(', ');
  const titleSelector = 'h1, h3, a.title, a[data-testid="post-title"], [slot="title"]';
  const bodySelector = [
    'div[data-click-id="text"]',
    'div[data-testid="post-content"] div[lang]',
    'div.usertext-body',
    '[slot="text"]',
    '[data-testid="post-body"]'
  ].join(', ');
  const commentTextSelector = [
    '[slot="comment"]',
    '[data-testid="comment-content"]',
    'div.usertext-body',
    'div.md'
  ].join(', ');

  function belongsTo(root, candidate, kind) {
    if (kind === 'post') {
      if (candidate.closest(commentSelector)) return false;
      const nearestShreddit = candidate.closest('shreddit-post');
      if (root.matches('shreddit-post')) return nearestShreddit === root;
      const nearestContainer = candidate.closest('div[data-testid="post-container"], div.thing.link, div.thing.self');
      return !nearestContainer || nearestContainer === root;
    }
    if (root.matches('shreddit-comment')) return candidate.closest('shreddit-comment') === root;
    if (root.matches('div[data-testid="comment"]')) {
      const shredditOwner = candidate.closest('shreddit-comment');
      if (shredditOwner && shredditOwner.contains(root)) return true;
      return candidate.closest('div[data-testid="comment"]') === root;
    }
    return candidate.closest('div.comment') === root;
  }

  function bestOwnedText(root, selector, kind) {
    let best = { text: '', excluded: { quotes: 0, code: 0 } };
    root.querySelectorAll(selector).forEach((candidate) => {
      if (!belongsTo(root, candidate, kind)) return;
      if (candidate.closest('blockquote, pre, code')) return;
      const content = aiHeuristicReadContent(candidate);
      if (content.text.length > best.text.length || (!best.text && content.excluded.quotes + content.excluded.code)) best = content;
    });
    return best;
  }

  function postText(element) {
    const title = bestOwnedText(element, titleSelector, 'post');
    const body = bestOwnedText(element, bodySelector, 'post');
    if (title.text && body.text) {
      if (body.text.toLowerCase().includes(title.text.toLowerCase()) && title.text.length >= 20) return body;
      return {
        text: title.text + '\n' + body.text,
        excluded: { quotes: title.excluded.quotes + body.excluded.quotes, code: title.excluded.code + body.excluded.code }
      };
    }
    return body.text || body.excluded.quotes || body.excluded.code ? body : title;
  }

  return {
    id: 'reddit',
    name: 'Reddit',
    postSelector,
    commentSelector,
    isTopLevel(element, kind) {
      if (kind === 'post') {
        const parentPost = element.parentElement && element.parentElement.closest(postSelector);
        return !parentPost && !element.closest(commentSelector);
      }
      if (element.matches('div[data-testid="comment"]') && element.closest('shreddit-comment')) return false;
      return true;
    },
    extractContent(element, kind) {
      return kind === 'comment' ? bestOwnedText(element, commentTextSelector, 'comment') : postText(element);
    },
    placeBadge(element, badge, kind) {
      if (kind === 'comment') {
        const tagline = element.querySelector('p.tagline');
        if (tagline) {
          tagline.appendChild(badge);
          return;
        }
        const header = element.querySelector('[data-testid="comment_author_link"], [data-testid="comment-author-link"], header');
        if (header && header.parentElement) {
          header.parentElement.appendChild(badge);
          return;
        }
      }
      const oldTitle = element.querySelector('a.title');
      if (oldTitle && oldTitle.parentElement) {
        oldTitle.parentElement.insertBefore(badge, oldTitle.nextSibling);
        return;
      }
      const header = element.querySelector('[data-testid="post-author-link"], header, h1, h3');
      if (header && header.parentElement) {
        header.parentElement.appendChild(badge);
        return;
      }
      element.insertBefore(badge, element.firstChild);
    }
  };
}
