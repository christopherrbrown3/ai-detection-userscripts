import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { closeDoms, loadDom, loadGeneratedDom } from './helpers.mjs';

afterEach(closeDoms);
const text = 'Here are the key takeaways from this week. In conclusion, we should check the release before shipping it to the team.';
const cases = [
  ['linkedin', 'https://www.linkedin.com/feed/', `<div class="feed-shared-update-v2" id="post"><div class="update-components-actor__meta" id="header"><a href="/in/example">Author</a></div><div class="feed-shared-inline-show-more-text" id="body">${text}</div></div>`],
  ['x', 'https://x.com/home', `<article role="article" id="post"><div data-testid="User-Name" id="header"><a href="/example">Author</a></div><div data-testid="tweetText" id="body">${text}</div></article>`],
  ['reddit', 'https://www.reddit.com/', `<shreddit-post id="post"><h1 slot="title" id="header"><a href="/r/example/comments/123">Headline</a></h1><div slot="text" id="body">${text}</div></shreddit-post>`],
  ['facebook', 'https://www.facebook.com/', `<div role="article" id="post"><h3 id="header"><a href="/example">Author</a></h3><div data-ad-preview="message" id="body">${text}</div></div>`],
  ['youtube', 'https://www.youtube.com/@example/posts', `<ytd-browse><ytd-backstage-post-renderer id="post"><h3 id="header"><a href="/@example">Author</a></h3><yt-formatted-string id="content-text"><span id="body">${text}</span></yt-formatted-string></ytd-backstage-post-renderer></ytd-browse>`]
];

for (const distribution of ['source', 'combined', 'targeted']) {
  const load = (platform, html, url) => (distribution === 'source' ? loadDom : loadGeneratedDom)(platform, '<!doctype html><main>' + html + '</main>', url, {
    distribution,
    setup(window) { window.localStorage.setItem(`ai-heuristic:${platform}:settings:v2`, JSON.stringify({enabled:true})); }
  }).window;

  test(distribution + ': stamps precede post text beside titles or authors without nesting interactive controls', () => {
    for (const [platform, url, html] of cases) {
      const window = load(platform, html, url), document = window.document;
      const header = document.getElementById('header'), body = document.getElementById('body');
      const badge = header.querySelector('.ai-heuristic-badge');
      assert.ok(badge, platform + ': stamp belongs to the header');
      assert.ok(badge.compareDocumentPosition(body) & 4, platform + ': stamp comes before the text');
      assert.equal(badge.closest('a, [role="link"]'), null, platform + ': stamp does not activate the author link');
      const sourceText = window.__controller.getAnalysis(document.getElementById('post')).sourceText;
      window.__controller.scanNow();
      assert.equal(window.__controller.getAnalysis(document.getElementById('post')).sourceText, sourceText);
      assert.equal(document.querySelectorAll('.ai-heuristic-badge').length, 1, platform + ': rescans do not duplicate stamps');
    }
  });

  test(distribution + ': modern LinkedIn author grid and late headers keep the existing analysis and one stamp', () => {
    const window = load('linkedin', `<div data-testid="mainFeed"><div id="post"><div data-testid="expandable-text-box" id="body">${text}</div></div></div>`, 'https://www.linkedin.com/feed/');
    const document = window.document, post = document.getElementById('post'), body = document.getElementById('body');
    const badge = post.querySelector('.ai-heuristic-badge'), analysis = window.__controller.getAnalysis(post);
    assert.equal(badge.nextElementSibling, body, 'missing header falls back above the text');
    post.insertAdjacentHTML('afterbegin', '<div id="context">Followed by <a href="/in/follower"><strong>Someone else</strong></a></div><div id="header" style="display:grid"><a href="/in/example"><div><p>Author</p><p>Connection degree</p></div></a></div>');
    window.__controller.scanNow();
    assert.equal(badge.parentElement.id, 'header');
    assert.equal(badge.style.gridArea, '1 / 2');
    assert.equal(window.__controller.getAnalysis(post), analysis, 'moving the badge does not analyze the post again');
    assert.equal(post.querySelectorAll('.ai-heuristic-badge').length, 1);
    document.getElementById('context').remove();
    document.getElementById('header').remove();
    window.__controller.scanNow();
    assert.equal(post.querySelector('.ai-heuristic-badge').nextElementSibling, body, 'removed headers restore the above-text fallback');
  });

  test(distribution + ': nested replies and quoted cards cannot supply the parent post header', () => {
    const window = load('linkedin', `<div class="feed-shared-update-v2" id="post"><div class="update-components-mini-update-v2"><a href="/in/quoted">Quoted Author</a></div><li class="comments-comment-item"><a class="comments-comment-entity__author" href="/in/reply">Reply Author</a></li><div class="feed-shared-inline-show-more-text" id="body">${text}</div></div>`, 'https://www.linkedin.com/feed/');
    const badge = window.document.querySelector('.ai-heuristic-badge');
    assert.equal(badge.nextElementSibling.id, 'body');
    assert.equal(badge.closest('.update-components-mini-update-v2, .comments-comment-item'), null);
  });
}
