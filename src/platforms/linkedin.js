function createPlatformAdapter() {
  'use strict';

  const postSelector = [
    '[data-testid="mainFeed"] > div',
    '[role="listitem"]:has([data-testid="expandable-text-box"])',
    'div.feed-shared-update-v2',
    'article[data-urn*="urn:li:activity"]',
    'main article[data-id*="urn:li:activity"]'
  ].join(', ');
  const commentSelector = [
    'li.comments-comment-item',
    'div.comments-comment-item',
    'article.comments-comment-item',
    'div.comments-comments-list__comment-item',
    'div.comments-comment-entity',
    'li.update-components-comment',
    'div.update-components-comment'
  ].join(', ');
  const postTextSelector = [
    '[data-testid="expandable-text-box"]',
    'div.feed-shared-inline-show-more-text',
    'div.update-components-text-view',
    'div.update-components-update-v2__commentary',
    'div.update-components-text',
    'div.feed-shared-update-v2__description',
    'div.feed-shared-update-v2__commentary',
    '[data-test-id="main-feed-activity-card__commentary"]'
  ].join(', ');
  const commentTextSelector = [
    'span.comments-comment-item__main-content',
    'div.comments-comment-item__main-content',
    'div.comments-comment-entity__text',
    'span.comments-comment-entity__text',
    'span.update-components-comment__text',
    'div.update-components-comment__text'
  ].join(', ');

  function linkedinTextContent(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('button, [role="button"]').forEach((control) => {
      const label = `${control.textContent || ''} ${control.getAttribute('aria-label') || ''}`;
      if (/\bsee\s+(?:more|less)\b/i.test(label)) control.remove();
    });
    // textContent intentionally includes text hidden only by LinkedIn's visual
    // line clamp, so collapsed and expanded posts produce the same analysis.
    return aiHeuristicTextContent(clone);
  }

  function bestOwnedText(root, selector, kind) {
    let best = '';
    root.querySelectorAll(selector).forEach((candidate) => {
      if (kind === 'post' && candidate.closest(commentSelector)) return;
      if (kind === 'comment' && candidate.closest(commentSelector) !== root) return;
      const text = linkedinTextContent(candidate);
      if (text.length > best.length) best = text;
    });
    if (!best && kind === 'post') {
      const fallback = findPostTextHost(root);
      if (fallback) best = linkedinTextContent(fallback);
    }
    return best;
  }

  function findPostTextHost(root) {
    const direct = Array.from(root.querySelectorAll(postTextSelector))
      .filter((candidate) => !candidate.closest(commentSelector))
      .sort((left, right) => linkedinTextContent(right).length - linkedinTextContent(left).length)[0];
    if (direct) return direct;

    // LinkedIn periodically replaces semantic commentary classes with generated ones,
    // especially in profile activity and search views. Choose the largest text-focused
    // descendant while excluding actor, engagement, comment, and action containers.
    return Array.from(root.querySelectorAll('div, span'))
      .filter((candidate) => {
        if (candidate.closest(commentSelector)) return false;
        if (candidate.closest('.update-components-actor__container, .feed-shared-actor__container')) return false;
        if (candidate.closest('.social-details-social-counts, .feed-shared-social-action-bar')) return false;
        const text = linkedinTextContent(candidate);
        return text.length >= 40 && candidate.querySelectorAll('button, [role="button"]').length <= 1;
      })
      .sort((left, right) => linkedinTextContent(right).length - linkedinTextContent(left).length)[0] || null;
  }

  return {
    id: 'linkedin',
    name: 'LinkedIn',
    postSelector,
    commentSelector,
    isTopLevel(element, kind) {
      if (kind === 'comment') return true;
      const parentPost = element.parentElement && element.parentElement.closest(postSelector);
      return !parentPost && !element.closest(commentSelector);
    },
    extractText(element, kind) {
      return bestOwnedText(element, kind === 'comment' ? commentTextSelector : postTextSelector, kind);
    },
    placeBadge(element, badge, kind) {
      if (kind === 'comment') {
        const textHost = element.querySelector(commentTextSelector);
        if (textHost && textHost.parentElement) {
          textHost.parentElement.insertBefore(badge, textHost);
          return;
        }
      }
      const textHost = findPostTextHost(element);
      if (textHost && textHost.parentElement) {
        textHost.parentElement.insertBefore(badge, textHost.nextSibling);
        return;
      }
      element.insertBefore(badge, element.firstChild);
    }
  };
}
