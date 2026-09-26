# Consolidation validation — 0.5.0

Validated on 2026-09-26 against v0.4.0 commit `52c54c3af6315f53550c1d25fa556e237a670afc`. Consolidation preserves the cue rules; this report measures functionality and browser work, not authorship accuracy.

Subsequent native Safari checks and the v0.5.1 badge update are recorded in [Safari validation](safari-validation.md). The limitations below describe the original v0.5.0 release at the time it was validated.

## Automated gates

- **85 JavaScript tests passed**, including existing detector/runtime tests, all known layout fixtures through source/combined/targeted builds, and generated-bundle baseline comparisons for extracted text, exclusions, cue families/spans, sample/language states, and metrics.
- **12 Python tests passed**, including feature/training/export parity and registry validation. Python compilation, generated-artifact consistency, all generated JavaScript syntax checks, and whitespace checks passed.
- Dispatch covers every registered alias and rejects unsupported/lookalike/HTTP hosts before storage or runtime initialization. Tests prove unselected factories do not execute and a fourth test-only adapter can be registered without editing the detector or bootstrap.
- Lifecycle tests cover startup failure cleanup, malformed cards, partial badge placement, route changes, root replacement, recycled roles/post/reply ownership, removed candidates, stop/restart, settings compatibility, storage failures, experimental opt-in, and editable-composer exclusion.
- Metadata tests lock existing targeted names, host scopes, update/download URLs and verify the combined union, one release version, metadata companions, and absence of remote runtime loaders.

The snapshot in `tests/fixtures/baseline-v0.4.json` records the baseline source commit and synthetic expected results. Source, generated bundles, and test-only adapter fixtures are kept separate so a source-only test cannot conceal a packaging regression.

## Browser checks

Environment: Apple M2, macOS 27.0 (26A428), Chromium 153.0.8010.55. All test pages contained synthetic text; Playwright intercepted navigation responses and blocked other network requests. The apparent `https://x.com/home` address was a fixture origin, not a visit to live X.

- The actual generated combined artifact rendered in a Chromium isolated execution world under `script-src 'none'`.
- Combined→targeted, targeted→combined, and combined→combined injections in **separate isolated worlds** left one ownership marker, two mutation observers (root + active feed), one viewport observer, and one URL timer in total. Retiring the owner released every measured observer/timer. Both legacy-v0.4 injection orders left the legacy runtime alone and suspended the new analysis with migration guidance.
- The details/settings interface was inspected at 1280×900 in light mode and 390×844 in dark mode. The narrow panel stayed within the viewport; Escape closed it and restored badge focus. Site disabling removed badges, retained the launcher, and re-enabling restored analysis. Forced colors retained visible borders; reduced motion removed transitions.
- `docs/preview.png` shows the combined interface. Local additional screenshots are in the ignored `output/playwright/` directory.

## Repeatable feed/edit/scroll workload

The harness uses 120 synthetic X-shaped cards with four repeating texts, real viewport intersection, a full scroll, one offscreen edit, return to the edited card, and removal of 60 cards. Three runs per distribution alternate ordering. Instrumentation counts extraction/analysis and flush timing, without changing cue inputs or results. Measurements include instrumentation overhead.

| Measure | v0.4 X targeted | v0.5 combined |
| --- | ---: | ---: |
| Initial nearby cards processed | 11 | 11 |
| Badges after scrolling | 120 | 120 |
| Total extractions after the edit | 121 | 121 |
| Analyses before / after the edit | 4 / 5 | 4 / 5 |
| Eager diagnostic analyses | 0 | 0 |
| Median time to first badge | 38.5 ms | 36.2 ms |
| Median cumulative flush time | 21.8 ms | 29.0 ms |
| Largest individual flush across runs | 2.2 ms | 3.0 ms |
| Tracked detached cards after removal | 0 | 0 |
| Cached results after workload | 5 | 5 |
| Measured observers/timers after stop | 0 | 0 |

The combined runtime spent about 7.2 ms more in flushes over this workload, with every measured flush below the eight-millisecond yielding target. That bounded overhead is accepted for the added validation/lifecycle checks. First-badge differences are too small and the sample too limited to support a speed claim. Detached-node checks inspect the runtime's strong candidate set, not a full browser heap-retention analysis. Live feeds, long sessions, other platforms, and Safari may behave differently.

Raw rounded results: [consolidation-browser-results.json](consolidation-browser-results.json). Reproduce with `python3 scripts/prepare_browser_validation.py`, then execute the generated `output/playwright/validate-multisite.js` async function with a Playwright runner's `page` (or Playwright MCP `browser_run_code_unsafe`, using `filename`). Chromium/CDP and the baseline Git commit must be available. The script fails if coexistence, workload counts, cleanup, or deferred diagnostics regress.

## Packaging and permissions

| Artifact | Bytes |
| --- | ---: |
| Combined v0.5 | 104,110 |
| LinkedIn targeted v0.5 | 95,120 |
| X targeted v0.5 | 91,871 |
| Reddit targeted v0.5 | 94,561 |
| X targeted v0.4 baseline | 79,022 |

The combined payload adds 12,239 bytes over the current X targeted build. Shared code occurs once, and only the current adapter runs. Its match permissions are exactly the union of the three previous scripts; targeted builds retain their previous scopes. Facebook, Threads, and Bluesky are absent. All builds retain `@grant none`, content injection, document-idle timing, and `@noframes`.

Installed versions were read from application metadata: Userscripts **4.8.6 (136)** and Safari **27.0 (22625.1.29.11.27)**. The matching [Userscripts 4.8.6 source](https://github.com/quoid/userscripts/blob/06900223459036d2a238d93ab1af4d9f26cadbc7/xcode/Ext-Safari/Functions.swift#L830) checks remote metadata versions and uses a separate download URL when present. Its native checks rebuild match records from local files; injection itself reads the manifest. This supports the chosen metadata format and local manifest migration, but is source inspection rather than an executed manager update test.

## Explicit verification limits

The user waived native Safari verification. Safari/Userscripts installation prompts, domain permissions, actual content-world execution, automatic updates, manager-controlled coexistence, and live-page behavior were **not tested**. No authenticated live-site inspection was performed. Other managers and iOS remain best-effort. Chromium fixtures do not establish Safari compatibility or future site-layout compatibility.

Local deployment must back up existing scripts/manifest, archive only verified unmodified legacy files, install the merged combined artifact, update the affected filename mappings while preserving unrelated manager state, and record hashes. A temporary-directory migration/rollback rehearsal passed: the original scripts and manager manifest were restored byte-for-byte. Real Safari rollback behavior remains unverified. Refresh existing tabs after installation so old running scripts are discarded. See [migration and rollback](migration.md).
