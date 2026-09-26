// Copy into src/platforms/<stable-id>.js and replace these synthetic selectors
// with selectors supported by sanitized fixtures. Register only verified hosts.
function createPlatformAdapter() {
  'use strict';
  const postSelector = '.site-post';
  const commentSelector = '.site-comment';
  const candidateSelector = postSelector + ', ' + commentSelector;
  const owned = (element, selector) => Array.from(element.querySelectorAll(selector))
    .find((node) => node.closest(candidateSelector) === element);

  return {
    id: 'example',
    name: 'Example',
    postSelector,
    commentSelector,
    observedAttributes: ['data-revision'],
    // Optional: return false on routes that the registry cannot express.
    supportsUrl(url) { return url.pathname !== '/unsupported'; },
    isTopLevel(element, kind) {
      // Nested replies may be independent candidates. Nested quoted posts are not.
      return kind === 'comment' || !element.parentElement?.closest(postSelector);
    },
    extractContent(element) {
      const body = owned(element, '.site-text');
      const host = owned(element, '.site-author');
      if (!body || !host) return null; // Skip unknown layouts; never scrape the full page.
      // Identify platform-specific quoted/reposted cards before reading text.
      // This helper already preserves lists/lines and excludes standard quotes,
      // code, controls, composers, and our own UI. Do not mutate the site's text.
      return { ...aiHeuristicReadContent(body), host };
    },
    placeBadge(element, badge, kind, content) {
      content.host.appendChild(badge);
    }
  };
}
