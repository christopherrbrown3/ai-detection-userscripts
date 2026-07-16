import assert from 'node:assert/strict';
import test from 'node:test';

import { loadDom, loadFixture } from './helpers.mjs';

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
  const badgeMeter = badge.querySelector('.ai-heuristic-meter');
  assert.match(badge.textContent, /AI Score/);
  assert.equal(badgeMeter.querySelectorAll('.ai-heuristic-meter__segment').length, 6);
  assert.equal(
    badgeMeter.querySelectorAll('.ai-heuristic-meter__segment[data-filled="true"]').length,
    analysis.cueAssessment.families.length
  );
  badge.click();
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(badge.getAttribute('aria-expanded'), 'true');
  assert.equal(dialog.querySelector('select[aria-label="Detector sensitivity"]'), null);
  assert.match(dialog.textContent, /configured cue families matched/i);
  assert.match(dialog.textContent, /describes observable style, not authorship/i);
  assert.match(dialog.textContent, /Cues found/i);
  assert.doesNotMatch(dialog.textContent, /Local style segments/i);
  const dialogMeter = dialog.querySelector('[role="meter"]');
  assert.equal(dialogMeter.getAttribute('aria-valuenow'), String(analysis.cueAssessment.families.length));
  assert.equal(dialogMeter.getAttribute('aria-valuemax'), '6');
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(badge.getAttribute('aria-expanded'), 'false');
  dom.window.close();
});

test('cue meter uses green, yellow, and red status bands', () => {
  function render(text, id) {
    const html = `<!doctype html><html><body><main><div data-testid="mainFeed">
      <div id="${id}"><div data-testid="expandable-text-box">${text}</div></div>
    </div></main></body></html>`;
    return loadDom('linkedin', html, 'https://www.linkedin.com/feed/');
  }

  const clearDom = render(
    'I fixed the back gate after work on Tuesday. The hinge still squeaks, but the latch finally closes and the dog cannot nose it open anymore.',
    'clear-post'
  );
  const cautionDom = render(
    'Here are the key takeaways from the rollout. Moreover, the revised process gives the team a clearer handoff and a practical checklist for the next release.',
    'caution-post'
  );
  const alertDom = render(
    `As an AI language model, here are the key takeaways:
    First, build a robust framework. First, build a robust framework. First, build a robust framework.
    Result: robust — scalable. Outcome: clear — repeatable.
    Moreover, the lesson is clear. In conclusion, the lesson is clear.`,
    'alert-post'
  );

  assert.equal(clearDom.window.document.querySelector('.ai-heuristic-meter').dataset.tone, 'clear');
  assert.equal(cautionDom.window.document.querySelector('.ai-heuristic-meter').dataset.tone, 'caution');
  const alertMeter = alertDom.window.document.querySelector('.ai-heuristic-meter');
  assert.equal(alertMeter.dataset.tone, 'alert');
  assert.ok(alertMeter.querySelectorAll('[data-filled="true"]').length >= 4);

  clearDom.window.close();
  cautionDom.window.close();
  alertDom.window.close();
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
