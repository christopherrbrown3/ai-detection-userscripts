# Signal-only stamps — 0.9.0

Prepared locally on 2026-10-29 from the existing 0.8.0 project. This change uses the existing JavaScript rules and six signal families. It adds no production model, training step, inference library, external API, or runtime dependency.

## Behavior

- Zero matches and unassessed language: no badge. Analysis still runs and remains cached, so later edits can add or remove a stamp.
- One or two matched families: orange **AI Detected** stamp, moderate signal level.
- Three or more: red stamp, high signal level, with a double border as a second visual distinction.
- A family counts once regardless of the number of matching phrases. These levels describe rule matches, not authorship confidence.
- Stamp height follows the author text's computed line height. Normal line height is measured using the host font. Very narrow containers shrink the lettering while preserving the stamp's height and complete label. Replaced text hosts and viewport resizes refresh sizing.
- Hover opens details with a 180ms grow animation anchored toward the stamp. A 220ms leave delay allows moving into the panel. Hover does not steal focus; clicking, tapping, Enter, or Space pins the panel. Escape closes it and restores focus. Reduced motion removes the grow animation.
- The settings launcher remains available. Short-sample filtering remains optional; zero-match visibility is no longer a setting.

## Research ideas implemented

The [research report](research/2026-10-28-browser-ai-text-detection.md) surveys a much broader set of methods. Two bounded additions fit the current project without ML:

| Addition | Implementation and limits |
| --- | --- |
| Assistant output remnants | Specific assistant-role delimiters and serialized citation markers join the existing model-reference family. Ordinary model names, Markdown, whitespace, and arbitrary Unicode do not count. These strings can be reproduced by people; they are not authenticated provenance or a cryptographic watermark. |
| Repeated contrast constructions | At least two bounded contrast matches and 40 prose words add the existing framing family. Examples include repeated “not …, but …” and paired negative/positive constructions. A lone contrast is insufficient. Lists and quoted/code spans are excluded. |

Both use the existing English eligibility gate and preserve exact source offsets for highlighted examples. Multiple remnants or contrast/framing matches never create extra families. The cue analysis version is `browser-cues-v5`; diagnostic feature definitions, optional model weights, and Python feature extraction remain unchanged.

Perplexity, GLTR, DetectGPT, and model-distribution comparisons require access to model probabilities or inference resources. Watermark verification needs a known scheme and its required verifier information. Those are outside this rule-only change. No precision, recall, or authorship-accuracy improvement is claimed; the new rules need a labeled, representative corpus before such claims would be justified.

## Verification

- 185 JavaScript tests pass, including source, combined, and targeted distributions; 12 Python tests pass, including feature parity and the existing training-tool regressions.
- Generated-artifact consistency, Python compilation, whitespace checks, and Impeccable's manual detector pass.
- Chromium 156.0.8078.48: generated userscripts injected into isolated worlds under `script-src 'none'`, with synthetic navigation responses and all other requests blocked. [Results](stamp-browser-results.json).
- Playwright WebKit 26.5: the same rendering/interaction harness in a fresh context with CSP bypass, plus a touch-enabled mobile context. [Results](stamp-webkit-results.json). This checks WebKit behavior, not Safari's userscript extension injection.
- Both browsers pass desktop 1280×1000, dark/narrow 390×844, enlarged 24px post text, and an 80px nested container. Stamps match 24px/36px post line heights. Hover traversal, click/keyboard pinning, Escape focus restoration, panel bounds, and reduced motion pass. WebKit tap open/close and Chromium forced colors pass. No page errors were recorded.
- Light/dark stamp foreground/background contrast ranges from 6.20:1 to 8.72:1. High signal also uses a double border. Screenshots were visually inspected; a host-style conflict in panel paragraph margins was corrected during review.
- The 120-post synthetic workload passes coexistence, cache reuse, edit rescoring, detached-node cleanup, and complete observer/timer teardown. Four initial analyses serve 120 posts containing four repeated text variants; one edit causes one additional analysis. Diagnostics stay deferred. [Results](stamp-workload-results.json). These timings are development-machine observations, not an accuracy benchmark or a Safari performance guarantee.

The original extraction fixtures and historical parity checks are retained. Lifecycle tests that need visible stamps now explicitly use signaled text; separate tests verify ordinary and unassessed text stays unbadged.

Native Safari with the Userscripts extension was checked on a signed-in LinkedIn feed on 2026-10-29. A fresh tab reported the combined distribution at version 0.9.0. An orange moderate stamp measured 20px against the post's computed 20.000401px line height; its details showed one matched family, and Escape closed the panel and restored stamp focus. The stamp and details were visually inspected. Native verification covered this live LinkedIn path; the broader platform, hover, high-signal, and zero-match cases use the synthetic checks above. Live feed content and screenshots are not included in these artifacts.

The previous installed script and Userscripts manifest were backed up before replacing the combined script. The installed bytes match the tested 131,346-byte artifact, SHA-256 `0249a5970873fa6199d53aad3f2e45d75f5246740ae3765305d019868240c7fb`. The manager manifest was unchanged. Tabs opened before installation need a refresh to load 0.9.0.

## Reproduce

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/build_userscripts.py --check
python3 scripts/prepare_badge_validation.py
python3 scripts/prepare_browser_validation.py
```

The Python suite requires `training/requirements.txt` in a test environment. Run each emitted async `(page)` function with a Playwright runner. The badge harness supports Chromium and WebKit; for WebKit create the context with `bypassCSP: true`. The workload harness uses Chromium CDP. Both use only synthetic fixtures. Screenshots and prepared runners go to ignored `output/playwright/`; the README preview is a synthetic render of the current UI.
