# Header stamps — 0.9.1

Verified on 2026-10-29. Stamps now sit beside the post title or author, before the body text, across the LinkedIn, X, Reddit, Facebook, and YouTube adapters. A missing recognizable header falls back to a position above the text. Signal thresholds, colors, post line-height sizing, and hover details are unchanged.

## Placement and ownership

- The shared placement helper keeps the stamp outside author/title links and buttons. It inserts into the same header row without rewriting the site's text or wrapping its elements.
- Modern LinkedIn author links take priority over the earlier “followed by” or reaction context. One-item author grids place the stamp in the second column of the same row.
- Quoted cards and nested replies cannot provide a parent post's header. Comments retain their own author/header or above-text fallback.
- If a header appears after analysis, a rescan moves the existing stamp without rescoring the text. Replaced or removed headers recover placement. Repeated scans do not duplicate stamps or perform unnecessary placement writes.
- On very narrow headers, the stamp can wrap below the name while staying above the post text. Its label scales to fit the available width.

## Verification

- 194 JavaScript tests and 12 Python tests pass. Header cases run against source, combined, and targeted builds. The final LinkedIn selector adjustment also passed all 45 header/DOM regression cases.
- Generated-artifact consistency, JavaScript syntax, whitespace, and the Impeccable layout scan pass.
- [Chromium 156 results](header-stamp-browser-results.json) use isolated-world injection under `script-src 'none'`. [Playwright WebKit 26.5 results](header-stamp-webkit-results.json) use a fresh context with CSP bypass. Both use synthetic fixtures with other requests blocked.
- Desktop, narrow dark, and enlarged-text layouts put stamps beside author links, above the text, without nesting controls in links or overflowing the header. A grid header with an earlier “followed by” row selects the actual author. An 80px header preserves the complete stamp label and post line height.
- Hover growth, panel traversal, keyboard activation, Escape focus restoration, reduced motion, and panel bounds pass. WebKit touch open/close and Chromium forced colors pass. No page errors were recorded in the synthetic checks.
- The existing 120-post workload also passed cache reuse, edit rescoring, deferred diagnostics, detached-node cleanup, coexistence, and teardown after the shared placement change.

Native Safari with the Userscripts extension was verified on a signed-in LinkedIn feed. The final combined build reported version 0.9.1; its 20px stamp sat beside the actual post author in the author grid, below the separate “followed by” row and above the post text. Clicking opened details without navigating to the author profile, and Escape restored stamp focus. The final placement was visually inspected. Other native site layouts were not checked in this release.

The installed combined script matches the tested 134,562-byte artifact, SHA-256 `7a70fad08b40567c03f2f9cdd78304e7af3b9c805b70145502fa79137a663e86`. The previous 0.9.0 script and Userscripts manifest were backed up; the manifest remained unchanged. Refresh older tabs to load the update. Live feed content and screenshots are not included in the repository; the README preview is synthetic.

## Reproduce

Run `npm test`, the Python tests with `training/requirements.txt` installed, and `python3 scripts/build_userscripts.py --check`. Prepare the browser harness with `python3 scripts/prepare_badge_validation.py`; run the emitted async function in Chromium or a WebKit context with `bypassCSP: true`.
