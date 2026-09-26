# Safari and badge validation — 0.5.1

Validated on 2026-09-26. This follow-up records native checks requested after the machine was unlocked, plus the restored AI Score interface. It supplements the historical [0.5.0 consolidation report](consolidation-validation.md); these checks concern functionality, not authorship accuracy.

## Release behavior

The badge displays **AI Score: N/100**, six bars, and a visible **Heuristic** label. Each matched pattern family fills one bar. The score is `round(100 × matched families / 6)`, so one match displays 17/100 and two display 33/100. The dialog explains that mapping and explicitly states that the score is not an authorship probability. The cue rules, extraction exclusions, lazy diagnostics, and site settings retain their previous behavior. Unassessed language receives no numeric score or meter; short samples remain visibly marked.

## Native Safari findings

Environment: Safari **27.0 (22625.1.29.11.27)**, Userscripts **4.8.6 (136)**, macOS **27.0 (26A428)**. Checks used the installed combined userscript and live site pages, rather than manually injecting code into Safari. Inspector probes read aggregate DOM structure and script-owned state only. No real post text or private account content is included in committed fixtures, screenshots, or this report.

The live LinkedIn feed initially displayed the settings launcher but no badges. Its current DOM nests visible `role=listitem` cards inside `display: contents` feed wrappers, whose viewport rectangles have zero height. The old adapter selected those wrappers and rejected the visible cards as nested posts, preventing viewport-triggered analysis. The adapter now observes the cards themselves. A synthetic regression first failed on the old behavior and then passed through source, combined, and targeted builds.

With the adapter fix installed, native Safari checks confirmed:

- Badges appeared on nearby LinkedIn feed posts; scrolling brought another post into analysis.
- Clicking a badge opened the analysis dialog with sample counts and explanations. Escape closed it and returned focus to the badge.
- Disabling analysis removed badges but retained the settings launcher. The disabled preference survived a reload. Re-enabling restored badges; the original settings were restored.
- The Userscripts popup showed the combined **AI-Style Cues (Local)** entry. The active scripts directory contained only that canonical userscript, and existing manager match mappings were retained.

After installing the complete badge update, Safari confirmed version **0.5.1**, the **AI Score** label, six segments per assessed badge, the heuristic explanation, and Escape/focus behavior on LinkedIn. Opening a comment composer left the editable area free of badges; that check did not establish comment-thread coverage. The live X home feed and logged-out current Reddit feed also displayed score badges and opened the matching explanation dialog. Old Reddit redirected to its login page, where the settings launcher remained available; its live posts could not be verified in that session.

## Automated and synthetic browser checks

- **91 JavaScript tests passed**, including source/combined/targeted regressions for the wrapped LinkedIn layout, score/bar agreement, accessible explanations, and unassessed language. Existing baseline cue and lifecycle checks passed unchanged.
- **12 Python tests passed**. Python compilation, generated-artifact consistency, and whitespace checks passed.
- The generated v0.5.1 combined artifact rendered in a Chromium isolated world under `script-src 'none'` on a synthetic X-shaped fixture. All fixture navigation was intercepted and other network requests blocked.
- Visual inspection covered 1280×900 light mode and 390×844 dark mode. The narrow dialog stayed inside the viewport. Escape returned focus to the badge. Reduced motion produced a zero-duration transition; forced colors kept filled bars visibly different from outlined empty bars.
- The scoped interface detector reported no findings. [The preview](preview.png) contains synthetic text and the current badge/dialog.

## Deployment and limits

Candidate installs were backed up before replacing the canonical userscript. The manager manifest and previous script bytes were preserved, and installed bytes were compared with the generated artifact. No site settings or permissions were reset.

Automatic manager updates, native rollback, manager-controlled coexistence, live comment threads, old Reddit posts, the complete navigation/layout matrix, other managers, and iOS remain unverified. The prior temporary-directory rollback rehearsal and automated coexistence tests remain useful evidence, but do not establish those native behaviors. A real authorship probability still requires representative labeled data, held-out calibration, and validation across the intended platforms and writing conditions.
