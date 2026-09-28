/**
 * @typedef {Object} AIContent
 * @property {string} text Author-owned text with structural boundaries.
 * @property {{quotes: number, code: number}} excluded Removed DOM sections.
 * @property {Element|null} [host] Optional badge placement hint.
 *
 * @typedef {Object} AIPlatformAdapter
 * @property {string} id Stable registry/storage/model identity.
 * @property {string} name Display name.
 * @property {string} postSelector
 * @property {string} commentSelector
 * @property {(element: Element) => ('post'|'comment')} [kindForElement]
 * @property {(element: Element, kind: string) => boolean} isTopLevel
 * @property {(element: Element, kind: string) => AIContent|null} extractContent
 * @property {(element: Element, badge: Element, kind: string, content: AIContent) => void} placeBadge
 * @property {string[]} [observedAttributes] Extra candidate-affecting attributes.
 * @property {(url: URL) => boolean} [supportsUrl] Additional route eligibility.
 * Factories must be side-effect-free. Scheduling, UI, storage and analysis belong
 * to the runtime. Null/empty extraction removes a previously attached badge.
 */

function aiHostMatches(hostname, pattern) {
  if (pattern.startsWith('*.')) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith('.' + base);
  }
  return hostname === pattern;
}

function validateAIAdapter(adapter, entry) {
  if (!adapter || adapter.id !== entry.id || typeof adapter.name !== 'string') throw new Error('Invalid adapter identity');
  for (const name of ['postSelector', 'commentSelector']) {
    if (typeof adapter[name] !== 'string' || !adapter[name].trim()) throw new Error('Missing candidate selector');
    document.createElement('div').querySelectorAll(adapter[name]);
  }
  for (const name of ['isTopLevel', 'extractContent', 'placeBadge']) {
    if (typeof adapter[name] !== 'function') throw new Error('Missing adapter method');
  }
  for (const name of ['kindForElement', 'supportsUrl']) {
    if (adapter[name] !== undefined && typeof adapter[name] !== 'function') throw new Error('Invalid optional adapter method');
  }
  if (adapter.observedAttributes !== undefined && (!Array.isArray(adapter.observedAttributes) ||
    adapter.observedAttributes.some((name) => typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)))) {
    throw new Error('Invalid observed attributes');
  }
  return adapter;
}

function bootAIHeuristic(registry, factories, models, release) {
  const url = new URL(location.href);
  if (url.protocol !== 'https:' || window.top !== window.self) return null;
  const matches = registry.filter((entry) => entry.status !== 'planned' && entry.hosts.some((host) => aiHostMatches(url.hostname, host)));
  if (matches.length !== 1) return null;
  const entry = matches[0];
  let controller = null;
  let marker = null;
  let stopped = false;
  let status = 'waiting';
  const instance = 'aih-' + Math.random().toString(36).slice(2);
  const selector = 'meta[data-ai-style-owner="' + entry.id + '"]';
  const hint = 'Multiple script installations were found. Keep the combined script enabled and disable the older site scripts in Userscripts, then refresh.';
  const supportNotice = entry.status === 'experimental' ? entry.name + ' support is experimental. Some posts or comments may be skipped.' : '';
  const notice = (duplicate) => [supportNotice, duplicate ? hint : ''].filter(Boolean).join(' ');

  function rank(version, distribution) {
    return version.split('.').map(Number).concat(distribution === 'combined' ? 1 : 0);
  }
  function compare(left, right) {
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return left[i] - right[i];
    }
    return 0;
  }
  function ping() { marker.setAttribute('data-ai-alive', '1'); }
  function duplicate() { if (controller) controller.setNotice(notice(true)); }
  function releaseOwnership() {
    if (!marker) return;
    marker.removeEventListener('ai-style-ping', ping);
    marker.removeEventListener('ai-style-retire', stop);
    marker.removeEventListener('ai-style-duplicate', duplicate);
    marker.remove();
    marker = null;
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    status = 'stopped';
    document.removeEventListener('DOMContentLoaded', launch);
    if (controller) controller.stop();
    releaseOwnership();
  }
  function launch() {
    if (stopped || !document.body) return;
    let adapter;
    try {
      adapter = validateAIAdapter(factories[entry.id](), entry);
    } catch (_) {
      status = 'failed';
      console.warn('[Style cues] Adapter could not start: ' + entry.id);
      return;
    }
    let coexistence = false;
    const prior = document.querySelector(selector);
    if (prior) {
      prior.removeAttribute('data-ai-alive');
      prior.dispatchEvent(new Event('ai-style-ping'));
      if (prior.getAttribute('data-ai-alive') === '1') {
        coexistence = prior.dataset.distribution !== release.distribution;
        const previousVersion = prior.dataset.version || '0.0.0';
        if (compare(rank(release.version, release.distribution), rank(previousVersion, prior.dataset.distribution)) <= 0) {
          if (coexistence) prior.dispatchEvent(new Event('ai-style-duplicate'));
          status = 'superseded';
          return;
        }
        prior.dispatchEvent(new Event('ai-style-retire'));
      }
      prior.remove();
    }
    marker = document.createElement('meta');
    marker.dataset.aiStyleOwner = entry.id;
    marker.dataset.aiHeuristicUi = '1';
    marker.dataset.instance = instance;
    marker.dataset.version = release.version;
    marker.dataset.distribution = release.distribution;
    marker.addEventListener('ai-style-ping', ping);
    marker.addEventListener('ai-style-retire', stop);
    marker.addEventListener('ai-style-duplicate', duplicate);
    // Keep ownership outside replaceable feed/body/head trees.
    document.documentElement.appendChild(marker);
    try {
      controller = startAIHeuristic(adapter, models, {
        instance,
        notice: notice(coexistence),
        enabledByDefault: entry.status !== 'experimental',
        settingsStorage: entry.settingsStorage,
        routeSupported(current) {
          return !entry.excludedPaths.some((path) => current.pathname === path || current.pathname.startsWith(path + '/')) &&
            (!adapter.supportsUrl || adapter.supportsUrl(current));
        },
        onStop() { status = 'stopped'; releaseOwnership(); }
      });
      status = 'active';
    } catch (_) {
      status = 'failed';
      releaseOwnership();
      console.warn('[Style cues] Runtime could not start: ' + entry.id);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', launch, { once: true });
  else launch();
  return { stop, getController: () => controller, getStatus: () => status };
}
