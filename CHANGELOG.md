# Changelog

All notable changes are documented here.

## 0.7.0 - 2026-10-02

- Add an experimental, opt-in YouTube adapter and a generated YouTube-only script. The combined installation adds only `www.youtube.com` to its host permissions; existing targeted scripts keep their scopes and update identities.
- Analyze creator descriptions, independently owned comments/replies, and recognized channel Posts/permalinks. Preserve authored formatting, quotation/code exclusions, and the compact **AI Score** badge with six bars. Exclude titles, recommendations, transcripts, credits, editors, live chat, Shorts, polls, and media analysis. Empty hidden poll placeholders on ordinary Posts are supported.
- Clear badges and details when YouTube starts navigating, resume on its navigation-finish event, and require the watch container's video ID to match the URL. The shared runtime owns and releases the optional event listeners.
- Keep YouTube settings in origin-local storage, disabled by default. Preserve shared detector rules, diagnostic models, sample/language states, and deferred diagnostics; no YouTube diagnostic model or authorship-probability claim is added.
- Add source/combined/targeted regressions, isolated-browser CSP/coexistence checks, and bounded comment workloads. Record actual Safari/Userscripts coverage and remaining verification gaps in [YouTube validation](docs/youtube-validation.md).

## 0.6.2 - 2026-09-28

- Simplify assessed badges to **AI Score** and the six bars, removing the redundant numeric cue-count label. Keep the exact count in details and accessible names, and preserve short-sample and unassessed language states.
- Preserve detection rules, extraction, settings, and installation permissions.

## 0.6.1 - 2026-09-28

- Keep **AI Score** and six bars, but display the explicit **N/6 cues** count instead of the 0–100 conversion that made every single-family match appear as 17. Explain that a probability is unavailable and zero cues does not establish human authorship.
- Bound badges by their parent width, allow their height and labels to wrap, reset conflicting host-button sizing, and reduce secondary text. Preserve sample/language states, keyboard access, dark mode, and forced colors.
- Audit the detector against the project's local papers and primary research sources; correct overstated research notes. Add reproducible synthetic probes showing phrase-variant misses, list-marker sensitivity, and the AI-job-title false match. These are documented limitations, not an authorship benchmark.
- Preserve the detector, weights, thresholds, extraction, and site settings. Proposed detection changes require evaluation rather than tuning to an unlabeled feed. See [research grounding](docs/research-grounding.md).

## 0.6.0 - 2026-09-27

- Add an experimental Facebook adapter to the combined script and generate an optional Facebook-only distribution. Support explicit desktop post text markers and permalink-identified comments/replies in fixture-tested feed, profile/permalink, and post-dialog structures.
- Add exactly `www.facebook.com` and `facebook.com` to combined metadata. Facebook starts disabled on each origin; enable it through the persistent settings launcher. Existing targeted distributions keep their previous host scopes and identities.
- Preserve independent author ownership, shared/quoted content boundaries, sample/language states, AI Score bars, and lazy diagnostics. Skip ambiguous layouts, messaging/composers, Groups routes, Marketplace, and unsupported media surfaces. No Facebook diagnostic model or accuracy claim is introduced.
- Follow candidate ancestors to the actual owning post after nested-marker edits and badge removal, without rescanning the page. Add an optional quote-boundary selector to the shared content reader and an experimental-support notice.
- Keep Facebook preferences in local userscript-manager storage, scoped by platform and origin, after live testing found that page-storage preferences disappeared. Combined/Facebook bundles request only `GM.getValue` and `GM.setValue`; existing sites retain their storage behavior. Serialize writes, import surviving page preferences, and wait for saved choices before analyzing.
- Fix details-panel heading contrast against Facebook's global dark-theme styles.
- Add source/combined/targeted regressions and reproducible isolated-browser, coexistence, and scroll/edit workloads. Live Safari checks cover feed, profile/Page, permalink/dialog, comments/replies, expansion, settings, reload, and back navigation; see [Facebook validation and remaining gaps](docs/facebook-validation.md).

## 0.5.1 - 2026-09-26

- Restore the **AI Score** badge label and six-bar meter, with a readable 0–100 heuristic score derived from the matched pattern-family count. Explain the calculation and distinguish it from authorship probability. Preserve short-sample warnings, a separate unassessed state, keyboard behavior, and high-contrast support.
- Fix missing LinkedIn feed badges when visible cards sit inside zero-size `display: contents` wrappers. Observe the actual cards and keep one independent analysis per post.
- Add source and generated-bundle regressions for wrapped LinkedIn feeds, score/bar agreement, and unassessed text. Record native Safari/Userscripts checks in [Safari validation](docs/safari-validation.md).

## 0.5.0 - 2026-09-26

- Make one combined userscript the default for LinkedIn, X/Twitter, and Reddit. Preserve optional targeted files, their update identities, and existing host scopes.
- Generate dispatch, self-contained bundles, metadata companions, and coverage documentation from a validated registry and one product version.
- Add a documented adapter contract, contributor template, and executable fourth-site extension example. Facebook, Threads, and Bluesky remain separate future adapters.
- Preserve origin-local settings and add per-site enable/disable with an always-available settings launcher. Exclude messaging routes and editable composers.
- Coordinate compatible installations across DOM execution contexts; newest version wins, with combined winning ties. Detect legacy v0.4 installations and provide manual migration guidance.
- Handle navigation, root replacement, recycled posts, failed candidates, and complete teardown without duplicating analysis observers or leaving stale badges.
- Preserve v0.4 cue results on baseline fixtures. Add generated combined/targeted regression matrices, isolated Chromium/CSP checks, and a repeatable feed/edit/scroll workload.
- Record migration/rollback steps and local deployment backups. Safari/Userscripts execution, automatic updates, and live platform checks were not performed; native Safari verification was waived by the user. See [consolidation validation](docs/consolidation-validation.md).

## 0.4.0 - 2026-09-25

- Preserve paragraph, line-break, and list boundaries; exclude quotations, code, and identified quoted posts. Share one sentence parser across cue checks and diagnostic features.
- Restrict self-reference descriptors to explicit model wording, require combinations of framing phrases, and show exact highlighted excerpts for matched patterns.
- Detect real multiword openings and contiguous phrase repetition, normalize punctuation/repetition by text length, and avoid counting list rhythm or repeated openings again as other prose cues.
- Replace the traffic-light meter with **Style cues: N matched**, visible short-sample status, and a separate neutral **Not assessed** state for uncertain/unsupported language. Remove diagnostic sensitivity controls from ordinary settings.
- Queue nearby posts in small batches, process affected content on mutation, cache duplicate analyses, and defer legacy diagnostics until requested.
- Add browser regressions and a synthetic list ablation. These validate observable behavior, not authorship accuracy; no trained model or accuracy claim is introduced.

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
