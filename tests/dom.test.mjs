import assert from 'node:assert/strict';
import test, { describe, afterEach } from 'node:test';

import { loadDom as loadSourceDom, loadGeneratedDom, loadFixture, closeDoms } from './helpers.mjs';

afterEach(closeDoms);

for (const distribution of ['source', 'combined', 'targeted']) describe(distribution + ' layouts', () => {
  const loadDom = (platform, html, url, options = {}) => distribution === 'source'
    ? loadSourceDom(platform, html, url, options)
    : loadGeneratedDom(platform, html, url, { ...options, distribution });

test('LinkedIn observes real cards inside display-contents feed wrappers', async () => {
  let io;
  const { window } = loadDom('linkedin', loadFixture('linkedin-wrapped-feed.html'), 'https://www.linkedin.com/feed/foryou/', {
    autoScan: false,
    setup(window) {
      window.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; this.observed = new Set(); io = this; }
        observe(element) { this.observed.add(element); }
        unobserve(element) { this.observed.delete(element); }
        disconnect() { this.observed.clear(); }
      };
    }
  });
  const { document, __controller } = window;
  const cards = [...document.querySelectorAll('[role="listitem"]')];
  assert.deepEqual([...io.observed].map(node => node.id), cards.map(node => node.id));
  assert.equal(document.querySelector('.ai-heuristic-badge'), null);
  io.callback(cards.map(target => ({ target, isIntersecting: true })));
  const deadline = Date.now() + 2000;
  while (document.querySelectorAll('.ai-heuristic-badge').length !== 2 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(document.querySelectorAll('.ai-heuristic-badge').length, 2);
  for (const card of cards) {
    assert.equal(card.querySelectorAll('.ai-heuristic-badge').length, 1);
    assert.ok(__controller.getAnalysis(card).sourceText);
  }
  assert.equal(__controller.getAnalysis(document.getElementById('feed-wrapper-one')), undefined);
});

test('LinkedIn scores the post and nested comment independently', () => {
  const dom = loadDom('linkedin', loadFixture('linkedin.html'), 'https://www.linkedin.com/feed/');
  const { document, __controller } = dom.window;
  const post = document.querySelector('#post-1');
  const comment = document.querySelector('#comment-1');
  assert.equal(document.querySelectorAll('.ai-heuristic-badge').length, 2);
  assert.ok(__controller.getAnalysis(post).metrics.wordCount > __controller.getAnalysis(comment).metrics.wordCount);
  assert.ok(__controller.getAnalysis(post).metrics.wordCount < 80, 'comment text must not leak into the post');
  dom.window.close();
});

test('LinkedIn supports the current mainFeed DOM', () => {
  const html = `<!doctype html><html><body><main><div data-testid="mainFeed">
    <div id="modern-post"><div data-testid="expandable-text-box">
      Here are the practical details from this week's rollout. We tested the workflow with three teams,
      fixed the confusing handoff, and documented the exception that surprised everyone.
    </div></div><div aria-label="loading"></div>
  </div></main></body></html>`;
  const dom = loadDom('linkedin', html, 'https://www.linkedin.com/feed/');
  const { document, __controller } = dom.window;
  const post = document.querySelector('#modern-post');
  const badge = post.querySelector('.ai-heuristic-badge');
  const text = post.querySelector('[data-testid="expandable-text-box"]');
  assert.ok(badge);
  assert.equal(badge.previousElementSibling, text, 'badge should sit inside the post directly after its text');
  assert.ok(__controller.getAnalysis(post).metrics.wordCount > 20);
  dom.window.close();
});

test('LinkedIn supports profile recent-activity posts', () => {
  const html = `<!doctype html><html><body><main>
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:123" id="activity-post">
      <div class="update-components-actor__meta">Example Author</div>
      <div class="feed-shared-inline-show-more-text">
        Here are the results from our latest rollout. We tested the workflow with several teams,
        corrected two confusing steps, and documented the edge cases that appeared in production.
      </div>
      <div class="social-details-social-counts">42 reactions</div>
    </div>
  </main></body></html>`;
  const dom = loadDom('linkedin', html, 'https://www.linkedin.com/in/example/recent-activity/all/');
  const { document, __controller } = dom.window;
  const post = document.querySelector('#activity-post');
  const badge = post.querySelector('.ai-heuristic-badge');
  assert.ok(badge);
  assert.equal(badge.previousElementSibling, post.querySelector('.feed-shared-inline-show-more-text'));
  assert.ok(__controller.getAnalysis(post).metrics.wordCount > 20);
  dom.window.close();
});

test('LinkedIn falls back safely when activity commentary classes are generated', () => {
  const html = `<!doctype html><html><body><main>
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:456" id="generated-post">
      <div class="update-components-actor__container"><span>Example Author and profile metadata</span></div>
      <div class="generated-a"><div class="generated-b">
        We shipped the revised workflow after testing it with four teams. The concrete feedback exposed
        two confusing labels, one missing exception, and a handoff that needed a real owner.
        <button>see more</button>
      </div></div>
      <div class="social-details-social-counts"><button>42 reactions</button></div>
      <div class="feed-shared-social-action-bar"><button>Like</button><button>Comment</button></div>
    </div>
  </main></body></html>`;
  const dom = loadDom('linkedin', html, 'https://www.linkedin.com/in/example/recent-activity/all/');
  const { document, __controller } = dom.window;
  const post = document.querySelector('#generated-post');
  const badge = post.querySelector('.ai-heuristic-badge');
  assert.ok(badge);
  assert.equal(badge.previousElementSibling, post.querySelector('.generated-a'));
  assert.ok(__controller.getAnalysis(post).metrics.wordCount > 20);
  assert.ok(__controller.getAnalysis(post).metrics.wordCount < 45, 'actor and engagement text must stay excluded');
  dom.window.close();
});

test('LinkedIn analyzes identical full text before and after visual expansion', () => {
  const fullText = `We completed the migration after testing every stage with the support and operations teams.
    The first review uncovered a confusing ownership rule, while the second exposed an undocumented retry path.
    Those details are visually clipped until expansion, but remain available in the page for assistive technology.`;
  const collapsed = `<!doctype html><html><body><main><div data-testid="mainFeed">
    <div id="clamped-post"><div data-testid="expandable-text-box" style="display:-webkit-box;-webkit-line-clamp:2">
      ${fullText}<button aria-label="see more">…more</button>
    </div></div>
  </div></main></body></html>`;
  const expanded = `<!doctype html><html><body><main><div data-testid="mainFeed">
    <div id="expanded-post"><div data-testid="expandable-text-box">
      ${fullText}<button aria-label="see less">see less</button>
    </div></div>
  </div></main></body></html>`;
  const collapsedDom = loadDom('linkedin', collapsed, 'https://www.linkedin.com/feed/');
  const expandedDom = loadDom('linkedin', expanded, 'https://www.linkedin.com/feed/');
  const collapsedMetrics = collapsedDom.window.__controller.getAnalysis(
    collapsedDom.window.document.querySelector('#clamped-post')
  ).metrics;
  const expandedMetrics = expandedDom.window.__controller.getAnalysis(
    expandedDom.window.document.querySelector('#expanded-post')
  ).metrics;
  assert.equal(collapsedMetrics.wordCount, expandedMetrics.wordCount);
  assert.ok(collapsedMetrics.wordCount > 35, 'the visually hidden continuation must be analyzed');
  collapsedDom.window.close();
  expandedDom.window.close();
});

test('LinkedIn supports direct post permalinks without feed-card classes', () => {
  const html = `<!doctype html><html><body><main>
    <div role="listitem" id="permalink-post">
      <div class="generated-actor">Example Author</div>
      <div data-display-contents="true"><p><span data-testid="expandable-text-box">
        Two years apart, the measurements produced the same result. The underlying telemetry showed that
        the later attempt used a completely different path, with stronger performance in one section and
        an unchanged habit in another. That contrast made the tied result more informative than a simple record.
      </span></p></div>
      <div><button>Like</button><button>Comment</button></div>
    </div>
  </main></body></html>`;
  const dom = loadDom(
    'linkedin',
    html,
    'https://www.linkedin.com/feed/update/urn:li:activity:7483177564560142337/'
  );
  const { document, __controller } = dom.window;
  const post = document.querySelector('#permalink-post');
  const badge = post.querySelector('.ai-heuristic-badge');
  assert.ok(badge);
  assert.ok(post.contains(badge), 'badge must remain inside the permalink post');
  assert.ok(__controller.getAnalysis(post).metrics.wordCount > 35);
  dom.window.close();
});

test('Reddit excludes nested replies from the parent comment text', () => {
  const dom = loadDom('reddit', loadFixture('reddit.html'), 'https://www.reddit.com/r/testing/comments/abc/example/');
  const { document, __controller } = dom.window;
  const parent = document.querySelector('#comment-parent');
  const child = document.querySelector('#comment-child');
  assert.equal(document.querySelectorAll('.ai-heuristic-badge').length, 3);
  assert.ok(__controller.getAnalysis(parent).metrics.wordCount < 35);
  assert.ok(__controller.getAnalysis(child).metrics.wordCount < 30);
  dom.window.close();
});

test('X rescans edited or expanded text without duplicating the badge', () => {
  const dom = loadDom('x', loadFixture('x.html'), 'https://x.com/home');
  const { document, __controller } = dom.window;
  const article = document.querySelector('#tweet-1');
  const before = __controller.getAnalysis(article).metrics.wordCount;
  document.querySelector('[data-testid="tweetText"]').textContent += ' Added context now makes this post longer and materially changes the text being analyzed.';
  __controller.scanNow();
  const after = __controller.getAnalysis(article).metrics.wordCount;
  assert.ok(after > before);
  assert.equal(article.querySelectorAll('.ai-heuristic-badge').length, 1);
  dom.window.close();
});

test('badges open a keyboard-accessible dialog with settings', () => {
  const dom = loadDom('x', loadFixture('x.html'), 'https://x.com/home');
  const { document, __controller } = dom.window;
  const article = document.querySelector('#tweet-1');
  const badge = document.querySelector('.ai-heuristic-badge');
  const analysis = __controller.getAnalysis(article);
  assert.match(badge.textContent, /AI Score: 0\/6 cues/);
  assert.doesNotMatch(badge.textContent, /\/100|%/);
  assert.match(badge.getAttribute('aria-label'), /0 of 6 cue families matched.*Authorship probability unavailable/);
  assert.match(badge.title, /zero cues does not mean human-written/);
  badge.click();
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(badge.getAttribute('aria-expanded'), 'true');
  assert.equal(dialog.querySelector('select[aria-label="Detector sensitivity"]'), null);
  assert.match(dialog.textContent, /matched/i);
  assert.match(dialog.textContent, /do not establish authorship/i);
  assert.match(dialog.textContent, /not the probability that AI wrote this text/i);
  assert.match(dialog.textContent, /Observed patterns/i);
  assert.doesNotMatch(dialog.textContent, /Local style segments/i);
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(badge.getAttribute('aria-expanded'), 'false');
  dom.window.close();
});

test('AI Score and six bars agree with the cue evidence and distinguish unassessed text', () => {
  const html = `<!doctype html><body>
    <article role="article" id="scored"><div data-testid="tweetText">
      Here are the key takeaways from this week. In conclusion, we need to check the new release with the support team before we ship it to everyone.
    </div></article>
    <article role="article" id="unassessed"><div data-testid="tweetText">No puedo asistir a la reunión de mañana.</div></article>
  </body>`;
  const { window } = loadDom('x', html, 'https://x.com/home');
  const { document, __controller } = window;
  const post = document.getElementById('scored');
  const cues = __controller.getAnalysis(post).cueAssessment;
  assert.equal(cues.families.length, 1);
  const badge = post.querySelector('.ai-heuristic-badge');
  assert.match(badge.textContent, /AI Score: 1\/6 cues/);
  assert.match(badge.getAttribute('aria-label'), /1 of 6 cue families matched.*Authorship probability unavailable/);
  assert.equal(badge.querySelectorAll('.ai-heuristic-meter__segment').length, 6);
  assert.equal(badge.querySelectorAll('[data-filled="true"]').length, 1);
  badge.click();
  const dialog = document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /1\/6 cues.*1 of 6 pattern families matched/);
  assert.match(dialog.textContent, /not equally predictive or statistically independent/);
  assert.match(dialog.textContent, /no validated probability model is enabled for this display/);
  assert.doesNotMatch(dialog.textContent, /\/100|rounded to 0–100/);
  const unknown = document.querySelector('#unassessed .ai-heuristic-badge');
  assert.match(unknown.textContent, /AI Score: not assessed.*Language uncertain/);
  assert.doesNotMatch(unknown.textContent, /\/100/);
  assert.equal(unknown.querySelector('.ai-heuristic-meter'), null);
});

test('a settings launcher remains when badge filters are active', () => {
  const dom = loadDom('x', loadFixture('x.html'), 'https://x.com/home');
  const { document } = dom.window;
  document.querySelector('.ai-heuristic-badge').click();
  const checkboxes = document.querySelectorAll('.ai-heuristic-popover__settings input[type="checkbox"]');
  const hideLow = checkboxes[checkboxes.length - 1];
  hideLow.click();
  const launcher = document.querySelector('.ai-heuristic-launcher');
  assert.ok(launcher);
  assert.match(launcher.textContent, /settings/i);
  launcher.click();
  assert.match(document.querySelector('[role="dialog"] h2').textContent, /settings/i);
  dom.window.close();
});

});
