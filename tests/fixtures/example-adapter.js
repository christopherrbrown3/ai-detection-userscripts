// Test-only extension example. This file is never in the production registry.
function createPlatformAdapter() {
  return {
    id: 'example', name: 'Example',
    postSelector: '.example-post', commentSelector: '.example-comment',
    observedAttributes: ['data-revision'],
    supportsUrl: (url) => url.pathname !== '/blocked',
    isTopLevel: () => true,
    extractContent(element) {
      if (element.dataset.failure === 'extract') throw new Error('Private post text must not be logged');
      if (element.dataset.empty) return null;
      return aiHeuristicReadContent(element.querySelector('.text'));
    },
    placeBadge(element, badge) {
      element.appendChild(badge);
      if (element.dataset.failure === 'place') throw new Error('Private post text must not be logged');
    }
  };
}
