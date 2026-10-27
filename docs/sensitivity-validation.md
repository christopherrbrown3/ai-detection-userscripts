# Sensitivity and layout validation — 0.8.0

The six-bar display still counts matched pattern families. This release expands which observable patterns can count; it does not estimate an authorship probability or establish that its predictions are more accurate.

## Before-and-after cue probes

Run `node scripts/audit_cue_coverage.mjs --baseline-ref 229f50d11f7733575f8f480d3bdb7369df29aa57`. The [recorded output](sensitivity-cue-audit.json) contains source hashes, inputs, and results for 19 synthetic probes. Relative to 0.7.0, five newly match a family: the subject-free announcement variant, contemporary framing, repeated function-word openings, an arrow list, and a checkmark list. The AI-engineer example no longer matches the model-reference family. Thirteen probes retain their prior family results, including the quoted wording, short text, and uncertain-language examples.

These examples were written to exercise specific rules and were not labeled by actual authorship. They cannot measure precision, recall, false-positive rate, or how frequently a live feed will change. In particular, human announcements, lists, rhetorical repetitions, and polished writing can match these rules, and generated or edited text can avoid them. A representative, permissioned and held-out evaluation is still needed to quantify the tradeoff; see [benchmarking](benchmarking.md).

The revised diagnostic feature set changes model-reference and list-marker extraction. The bundled hand-tuned weights are unchanged and uncalibrated. Previously trained weights must be retrained against the revised feature set; the exporter rejects older or unversioned training output.

## Verification

- The JavaScript suite exercises source and generated bundles, supported site fixtures, sample states, extraction boundaries, navigation, settings, and keyboard behavior. Python tests cover feature parity and the training/export path.
- A synthetic LinkedIn-shaped fixture ran the generated combined script in an isolated Chromium world under a restrictive CSP. Desktop, 390-pixel dark, and enlarged-text layouts fit their containers. Keyboard activation, Escape focus restoration, forced-color meter contrast, reduced motion, and panel bounds passed. The sticky panel header remained visible when scrolled. Desktop and narrow-dark screenshots were inspected.
- An isolated Chromium X-shaped workload processed 120 synthetic cards across three runs. Combined and targeted installations retained a single owner; edits invalidated cached analysis, removed cards left no detached tracked nodes, diagnostics remained deferred, and observers and timers stopped cleanly.
- These browser fixtures contain no live posts. They do not establish that every site or native browser layout is supported.
- On this Mac, Safari 27.0 and Userscripts 4.8.6 ran the installed combined build on a signed-in LinkedIn feed. The manager showed the active combined script; visible long and short-sample badges, the details panel, its pattern excerpts and settings, and Escape dismissal were checked. The prior script and manager manifest were backed up, the manifest was left unchanged, and installed bytes matched the tested bundle (SHA-256 `0b745ba548aab5c4d68b4a0bfbbb0edb785aec15814c1b1c136d8777a7cc8056`). No feed text or screenshots are retained in this report. Other live sites and native narrow/forced-color modes were not rechecked for this release.
