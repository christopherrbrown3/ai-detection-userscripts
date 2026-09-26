function createPlatformAdapter() {
  'use strict';

  const postSelector = 'article[role="article"]';
  const commentSelector = 'article[role="article"]';

  function isReply(element) {
    return Array.from(element.querySelectorAll('div[data-testid="socialContext"]'))
      .some((context) => /replying to/i.test(aiHeuristicTextContent(context)));
  }

  function tweetText(element) {
    let best = null;
    let quotes = 0;
    element.querySelectorAll('div[data-testid="tweetText"]').forEach((candidate) => {
      if (candidate.closest('article[role="article"]') !== element) return;
      const quote = candidate.closest('[data-testid="quoteTweet"], [data-testid="card.wrapper"], div[role="link"]');
      if (quote && element.contains(quote)) { quotes += 1; return; }
      if (!best) best = aiHeuristicReadContent(candidate);
    });
    best = best || { text: '', excluded: { quotes: 0, code: 0 } };
    best.excluded.quotes += quotes;
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
    extractContent(element) {
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
