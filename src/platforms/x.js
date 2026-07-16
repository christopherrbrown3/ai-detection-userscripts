function createPlatformAdapter() {
  'use strict';

  const postSelector = 'article[role="article"]';
  const commentSelector = 'article[role="article"]';

  function isReply(element) {
    return Array.from(element.querySelectorAll('div[data-testid="socialContext"]'))
      .some((context) => /replying to/i.test(aiHeuristicTextContent(context)));
  }

  function tweetText(element) {
    let best = '';
    element.querySelectorAll('div[data-testid="tweetText"]').forEach((candidate) => {
      if (candidate.closest('article[role="article"]') !== element) return;
      const text = aiHeuristicTextContent(candidate);
      if (text.length > best.length) best = text;
    });
    return best;
  }

  return {
    id: 'x',
    name: 'X / Twitter',
    postSelector,
    commentSelector,
    kindForElement(element) {
      return isReply(element) ? 'comment' : 'post';
    },
    isTopLevel(element) {
      return !(element.parentElement && element.parentElement.closest(postSelector));
    },
    extractText(element) {
      return tweetText(element);
    },
    placeBadge(element, badge) {
      const header = element.querySelector('div[data-testid="User-Name"]');
      if (header) {
        header.appendChild(badge);
        return;
      }
      const text = element.querySelector('div[data-testid="tweetText"]');
      if (text && text.parentElement) {
        text.parentElement.insertBefore(badge, text);
        return;
      }
      element.insertBefore(badge, element.firstChild);
    }
  };
}
