# Facebook scope and validation — 0.6.0

Implemented on 2026-09-27 for [issue #5](https://github.com/christopherrbrown3/ai-detection-userscripts/issues/5). Facebook is **experimental and off by default**. Verification includes synthetic layouts/workloads and the generated combined script in authenticated desktop Safari after the user unlocked the Mac. Issue #5 remains open for the outstanding live checks below.

## Enable and scope

Update the combined userscript, refresh Facebook, then open **Style cues off · Settings** and enable **Enable style cues on this site**. Settings remain local to that origin. The optional `facebook-ai-heuristic.userscripts.user.js` uses the same adapter/runtime and also starts disabled. Keep one intended installation; compatible duplicates coordinate ownership.

Facebook preferences use local userscript-manager storage (`GM.getValue`/`GM.setValue`), keyed by platform and origin. In this Safari session, the page-storage key disappeared even after a successful direct write. The manager-backed fix survived a real reload. It imports surviving page preferences, waits for asynchronous reads, and serializes changes. Managers without these APIs show a persistence notice and fall back to page/tab settings. Userscripts scopes manager values by installed filename; switching Facebook distributions may require enabling the destination script again. No post text is stored.

The combined script adds exactly `https://www.facebook.com/*` and `https://facebook.com/*`. Existing LinkedIn, X/Twitter, and Reddit targeted files keep their identities and host permissions. Facebook mobile and `web.facebook.com` aliases, Messenger hosts, and other new platforms are not included. Safari website access is separate from the script's opt-in checkbox.

| Surface | Implemented boundary | Evidence |
| --- | --- | --- |
| Desktop feed/profile/Page post text | Explicit `data-ad-preview="message"`, `data-ad-comet-preview="message"`, or `data-ad-rendering-role="story_message"` anchors; semantic article/feed-card ownership | Synthetic source, combined, targeted, and Chromium fixtures |
| Direct post/permalink text | Same anchors on accepted profile, Page-post, `permalink.php`, or `story.php` routes; bounded message fallback without a card | Synthetic route and extraction cases |
| Post dialogs | Published-message anchors inside a dialog, with independent recognized comments/replies | Synthetic fixture, dynamic insertion/removal, and browser rendering |
| Comments and replies | Labeled article with its own Facebook comment/reply permalink and owned `div[dir="auto"]` text | Synthetic English/localized-label and nested-reply fixtures |
| Shared/quoted posts | Exclude nested article/quote/link boundaries; preserve author commentary; skip multiple ambiguous unmarked bodies | Positive and negative ownership fixtures |
| Expanded/edited/recycled content | Read full owned text already in DOM; reanalyze user-driven DOM changes, recover removed badges, discard detached records | Mutation tests and real viewport workload on synthetic content |

Groups routes, messaging, Marketplace, Stories, Reels, video/photo surfaces, search, and other unrecognized routes are excluded. Forms, editable composers, chat pagelets, complementary/navigation regions, hidden nodes, and sidebar text are skipped. Media-only and unknown cards do not receive a score. The script does not click “See more,” open replies, scroll, or fetch additional content. Only text already rendered on a supported surface is eligible.

Selectors are provisional, not a claim about every current Facebook layout. Comment articles without a usable owned permalink/body, unlabeled articles, unfamiliar sharing layouts, mobile layouts, and localized or changed DOM structures may be skipped. A Facebook diagnostic model is unavailable; the shared cue rubric and **AI Score** heuristic mapping remain unchanged and do not express authorship probability.

## Implementation and regressions

The adapter is registered as `experimental`; the shared bootstrap displays that status in settings/details. All site-specific route, ownership, extraction, and placement logic lives in `src/platforms/facebook.js`. The reader accepts an optional descendant quote-boundary selector, preserving default behavior for existing adapters.

Facebook can nest several selector matches inside one owning card. The runtime previously stopped mutation handling at the nearest rejected match, missing the actual owner after edits or badge removal. It now checks matching ancestors until reaching the accepted owner. This stays confined to the changed node's ancestry and newly added subtrees; it does not scan the whole document on mutation.

All **138 JavaScript tests and 12 Python tests pass**, alongside generated-artifact consistency, syntax, and whitespace checks. The generated combined and targeted bundles preserve the existing v0.4 extraction/cue baseline for LinkedIn, X/Twitter, and Reddit. New tests cover exact Facebook text/exclusion boundaries, comments/replies settings, missing models, language/sample states, quote counts, ambiguous cards, offscreen scheduling, zero-size wrappers, host/route exclusions (including dotted profile names), opt-in persistence, coexistence, and SPA navigation. Manager-storage tests cover import, deletion of page preferences, reload, origin separation, ordered writes, denied access, and teardown during a pending read.

## Native Safari evidence

Safari **27.0 (22625.1.29.11.27)** with Userscripts **4.8.6 (136)** ran the installed combined candidate on this Mac. Checks used the existing signed-in account and read-only navigation; no posts, reactions, replies, or messages were submitted. Private/account content and native screenshots are not committed.

- Facebook initially showed the off-state launcher; enabling it produced one badge beside recognized feed text. The six bars, score label, heuristic explanation, and missing Facebook diagnostic model were visible.
- User-driven expansion updated the same feed sample from 22 to 31 words. Page and personal-profile posts received independent badges, including distinct short/uncertain states.
- Opening a post dialog and navigating to its permalink retained author text ownership. Near-viewport scheduling deferred offscreen text until scrolled into view. Comments and a newly expanded reply received separate badges; a longer comment showed its own 47-word sample and `facebook:comment` diagnostic identity.
- The comment/reply setting removed and restored comment badges. Composer controls and surrounding navigation had no badges. Escape closed details and returned focus to the badge.
- A direct-permalink reload exposed lost page preferences. After the manager-storage fix, enabling Facebook survived reload and a separate profile navigation. Browser Back restored a scored permalink view.
- Facebook's global heading colors reduced contrast in the dark details panel. An explicit scoped heading color fixed it; the installed fix was visually checked. The browser fixture now reproduces that host-style collision.

These observations cover one English desktop account/layout. They do not establish compatibility with every Facebook layout or Safari version.

## Browser evidence

Chromium **153.0.8010.55** on this Mac ran the actual generated artifacts in isolated execution worlds under `script-src 'none'`. Navigation responses were replaced with synthetic fixtures and other network requests blocked; apparent Facebook/X addresses in the harness were not live site visits. Screenshots contain only invented examples.

- Facebook started disabled, then the settings checkbox enabled six independently owned fixture badges. Excluded drafts, quoted originals, and ambiguous cards remained unscored.
- Desktop 1280×900 light and 390×844 dark screenshots were inspected. The details panel stayed inside the narrow viewport; Escape returned focus. Forced colors distinguished filled/empty bars, reduced motion disabled transitions, and host heading styles could not override dark panel text. Manager APIs were mocked in this isolated harness; persistence was checked separately in the JavaScript matrix and native Userscripts.
- Both combined→targeted and targeted→combined injections in separate worlds retained exactly two mutation observers, one viewport observer, one route timer, and one runtime owner. Retiring the owner released all measured resources.

### Facebook scroll/edit workload

Each distribution processed 80 synthetic feed cards with four repeating texts, then an offscreen nested-body edit, return to the edited card, and removal of 40 cards. These are one-run observations with instrumentation overhead, not a speed comparison or long-session memory analysis.

| Measure | Combined | Facebook targeted |
| --- | ---: | ---: |
| Initial nearby badges | 11 | 11 |
| Badges after scrolling | 80 | 80 |
| Extractions including edit | 81 | 81 |
| Unique analyses before/after edit | 4 / 5 | 4 / 5 |
| Eager diagnostic runs | 0 | 0 |
| Time to first badge | 38.9 ms | 38.5 ms |
| Total measured flush time | 26.1 ms | 24.1 ms |
| Largest measured flush | 3.4 ms | 3.4 ms |
| Tracked detached cards after removal | 0 | 0 |
| Remaining measured resources after stop | 0 | 0 |

The existing 120-card X workload also passed against the v0.4 baseline: both processed 121 extractions, four cached texts plus one edited analysis, no eager diagnostics, and no tracked detached cards or resources after stop. The three v0.6 runs had maximum flushes of 2.0–2.8 ms. Compatible/legacy coexistence checks passed. Differences in UI and instrumentation make this a regression check, not evidence of a speed improvement.

Raw results: [Facebook](facebook-browser-results.json) and [existing-site workload](facebook-existing-sites-results.json). Reproduce with `python3 scripts/prepare_facebook_validation.py` and `python3 scripts/prepare_browser_validation.py`, then execute the generated async `(page)` functions using a Chromium Playwright runner (or MCP `browser_run_code_unsafe` with `filename`). Outputs/screenshots go to ignored `output/playwright/`.

## Provenance and remaining verification

Public source inspection informed the initial DOM anchors: [browser-harness Page anchors](https://github.com/browser-use/browser-harness/blob/main/agent-workspace/domain-skills/facebook/pages.md) lists post-message/article selectors; [this published extraction example](https://gist.github.com/kiemrong08/eec5a1bf9bf37a68170d8065f1e6a38a) also uses `story_message`; [this comment-expansion implementation](https://gist.github.com/pa7i3nt/fa5ab4108c9528bc8e18714bb2c8cb73) uses labeled comment articles and direction-marked text. These are starting points, not authoritative Facebook contracts or substitutes for live validation. No third-party collection, clicking, or scrolling code is shipped.

Keep issue #5 open until the remaining live acceptance checks are complete: shared/quoted-post commentary versus embedded-original ownership, excluded messaging/Groups/overlay variants, login/localization variants, and native manager-controlled coexistence and automatic updates. These boundaries have synthetic coverage, but the native run above did not exhaust them. Narrow widths, forced colors, and reduced motion were checked in Chromium rather than native Safari. File/manifest installation and rollback were rehearsed in a temporary directory; actual manager rollback remains untested. The local installation preserves the original script/manifest backup. Stable promotion requires a separate review of this evidence and any remaining layout gaps.
