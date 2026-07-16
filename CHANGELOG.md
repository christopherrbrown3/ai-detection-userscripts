# Changelog

All notable changes are documented here.

## 0.3.0 - 2026-07-16

### Accuracy and explainability

- Replaced the uncalibrated pseudo-score fallback with an explainable, weighted cue-family rubric that assesses every non-empty post.
- Replaced Few/Some/Several/Many bands with exact N/6 cue-family counts and fixed Short/Standard/Long sample classes.
- Replaced the visible N/6 text with an accessible six-segment meter: green at zero matches, yellow at one to three, and red at four or more.
- Added fixed sample-size classes, parallel-rhythm and structured-presentation cues, content-word repetition, and trigger-level explanations.
- Kept legacy model output diagnostic-only until a platform-matched model passes held-out calibration and robustness gates.
- Extended the research review through 2026 and documented which newer approaches are portable to a private userscript.

## 0.2.0 - 2026-07-16

### Accuracy

- Replaced probability-like and certainty language with an abstaining AI-style signal.
- Added length-conditioned lexical diversity, character-pattern, function-word, contraction, and variation features.
- Added optional hashed character 3–5-gram weights and local mixed-style segment analysis.
- Added Unicode normalization and removal of invisible formatting characters.
- Added leakage-aware train/calibration/test splits, held-out sigmoid calibration, human-only strong-threshold selection, and detailed slice reports.
- Fixed the previous recall-threshold bug and connected exported thresholds to the runtime model bundle.
- Unified Python and JavaScript feature definitions with parity tests.

### Usability and design

- Added click/tap analysis dialogs, keyboard support, settings, dark mode, reduced-motion support, and high-contrast styles.
- Defaulted sensitivity to balanced and added controls to hide low or insufficient signals.
- Added text-hash rescoring for edited, expanded, translated, and virtualized content.
- Hardened ownership of nested posts/comments with platform DOM fixtures.

### Project

- Added generated shared-source architecture, CI, MIT license, installation links, benchmark protocol, security/privacy guidance, and troubleshooting documentation.

## 0.1.0

- Initial LinkedIn, X/Twitter, and Reddit heuristic userscripts.
