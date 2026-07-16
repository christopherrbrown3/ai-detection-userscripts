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
    let best = '';
    root.querySelectorAll(selector).forEach((candidate) => {
      if (!belongsTo(root, candidate, kind)) return;
      const text = aiHeuristicTextContent(candidate);
      if (text.length > best.length) best = text;
    });
    return best;
  }

  function postText(element) {
    const title = bestOwnedText(element, titleSelector, 'post');
    const body = bestOwnedText(element, bodySelector, 'post');
    if (title && body) {
      if (body.toLowerCase().includes(title.toLowerCase()) && title.length >= 20) return body;
      return `${title}\n${body}`;
    }
    return title || body;
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
    extractText(element, kind) {
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
