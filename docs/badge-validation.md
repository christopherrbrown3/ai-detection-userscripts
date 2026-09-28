# Cue count and badge validation — 0.6.1

Validated on 2026-09-28. This release changes presentation, not detection rules or authorship accuracy.

## Automated verification

- 138 JavaScript tests and 12 Python tests passed. Existing source/combined/targeted extraction, cue, settings, ownership, and lifecycle regressions remain in place.
- Generated artifacts, Python compilation, JavaScript syntax, and whitespace checks passed. GitHub CI also passed the implementation and audit commits.
- `src/detector.js`, `models/default-models.json`, and all site adapters are byte-identical to 0.6.0. Detector SHA-256: `69b3d13c762081ff3aede3786314a918e500710574ad103e9c775c10fc5a5e65`.
- The research probe inputs, outputs, and their limits are documented in [research grounding](research-grounding.md). They are not an accuracy benchmark.

## Layout regression

Reproduce the isolated browser check by preparing `output/playwright/validate-badges.js` with:

```sh
python3 scripts/prepare_badge_validation.py
```

Run that generated function using the Playwright browser harness. It embeds current and 0.6.0 artifacts, intercepts navigation with synthetic LinkedIn-shaped HTML, blocks other requests, and injects the scripts into isolated worlds under `script-src 'none'`. No real LinkedIn posts are used.

[Raw results](badge-layout-results.json), Chromium 153.0.8010.55:

| Check | Result |
| --- | --- |
| Old 0.6.0, host CSS forcing button width/height and no wrapping | 4 of 6 badge cases overflowed |
| New 0.6.1, desktop 1280×1000 | All 6 cases fit |
| New 0.6.1, narrow dark 390×844 | All 6 cases fit |
| New 0.6.1, 24px badge text instead of 12px | All 6 cases fit, height grows as needed |
| Containers | 80px, 140px, 210px flex column, and 280px |
| States | Zero, one family, short sample, uncertain language, unsupported language |
| Keyboard | Enter opens details; Escape restores badge focus |
| Panel | Fits narrow viewport and explains unavailable probability |
| Accessibility preferences | Filled bars remain distinct in forced colors; reduced motion disables the hover transition |

Desktop and narrow-dark screenshots were inspected. Host `white-space: nowrap` on descendant spans exposed an additional conflict during testing; scoped text/coverage selectors fixed it. Fixture UTF-8 decoding was corrected before the recorded run. These adverse styles reproduce the sizing failure class, not a captured copy of LinkedIn's current CSS.

## Local installation

The committed combined script was installed with a backup of the previous script and manager manifest. Its host matches, grants, identity/update URLs, and settings were preserved. Installed script SHA-256: `d78e89eb1ceb21e9595f154b35d53836eb44195e04c1f769e7a5911f88020330`.

A fresh native Safari tab confirmed LinkedIn badges with **0/6** and **2/6** cue counts and accessible names stating that authorship probability is unavailable. A live details panel showed the exact family count, sample metrics (184 words and ten sentences in the checked post), and the new explanation; Escape restored badge focus. The compact badge was visually checked beneath a collapsed LinkedIn post without overflow. Already open tabs retain their running script until a full page load. Synthetic narrow/large-text/forced-color checks above are separate from native confirmation; they do not establish every live site layout or manager behavior.

Facebook issue #5 remains open for its previously recorded acceptance gaps. No real feed text, account data, or native screenshots are committed.
