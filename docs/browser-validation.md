# Browser cue validation — 0.4.0

This release changes observable pattern matching and browser behavior. It does not introduce a trained authorship classifier. The examples below are synthetic correctness cases, not a representative human/AI corpus, and cannot estimate accuracy, recall, or false-positive rate.

## Regression comparison

The 0.3.0 comparison uses detector source at commit **1d91785**. Both versions were run on the same input, with the uncalibrated LinkedIn configuration. The full examples and expected current behavior are in **tests/browser-cues.test.mjs**.

| Synthetic case | 0.3.0 behavior | 0.4.0 behavior |
| --- | --- | --- |
| “I cannot attend the meeting tomorrow because my train is cancelled.” | Self-reference matched | No patterns; short sample |
| An article quoting “as an AI” | Self-reference matched | Quotation excluded; no patterns |
| Five “We inspect the…” list items | Rhythm, structure, and uniformity matched; diagnostic sentence count was 1 | Structure alone; 5 list items |
| “Dinner is ready. Bring your plate. Wash your hands.” | Rhetorical rhythm matched | No patterns; short sample |
| Spanish meeting/office example | Zero matched with a standard sample status | Not assessed; language uncertain |
| Five uneven unpunctuated lines | Uniformity matched; diagnostic sentence count was 1 | No patterns; shared parser counts 5 lines |

## List ablation

Run this reproducible, local experiment:

```bash
node scripts/evaluate_browser_cues.mjs
```

The script uses five seven-word list items. It compares the released detector with an otherwise identical copy in which list items are included in prose checks. With that safeguard removed, both **Repeated sentence openings** and **List and punctuation structure** match. With the released rules, only **List and punctuation structure** matches. Both variants count 35 words and 5 items. This isolates the overlapping-list behavior; it is not evidence of calibrated authorship detection.

The regression suite separately checks that counted multiword openings do not also trigger phrase repetition, that repeated phrases are contiguous in the original normalized source, and that highlighted spans point to the actual matched text.

## Browser and runtime checks

Local verification passed: 39 JavaScript tests, 6 Python tests, Python compilation, generated-bundle consistency, JavaScript syntax checks for all three bundles, and the list ablation.

- Automated DOM fixtures cover all three platform adapters, nested ownership, complete collapsed text, edits, quotation/code exclusion, line and list boundaries (including paragraph-wrapped items), and keyboard-accessible panels. Phrase matches cannot bridge excluded quotations or code.
- Runtime tests cover affected-post extraction, duplicate-content cache reuse, delayed offscreen work, edits before viewport entry, stale badge removal, externally removed badge restoration, and observer/timer cleanup.
- Diagnostic computation is checked to stay deferred until Technical details is expanded, then reused on subsequent expansion.
- Python/JavaScript parity includes abbreviations, decimal values, URLs, multiline text, quoted emoji, inline code, lists, and empty input.
- The generated X bundle was checked in a local Chromium fixture at desktop and narrow widths, including narrow dark mode. The panel and highlighted examples fit the viewport. This fixture does not substitute for live platform or Safari integration testing; Safari verification was explicitly skipped for the local deployment.

## Bias and false positives

Ordinary refusals and quoted model wording are no longer treated as direct self-reference, and lists no longer inflate prose cue counts. These are narrower definitions, not a measured reduction in an authorship false-positive rate. Human-authored lists, repeated slogans, technical repetition, deliberate parallelism, and formulaic professional prose can still match. Generated text can avoid every configured pattern.

The English eligibility check is a script/function-word heuristic. It can abstain on short English fragments and still accept some non-English or mixed-language material. Quote detection is also heuristic: quotation marks can surround an author's own wording, while unmarked copied text can remain in the sample. Site markup changes can defeat repost exclusions. These limits are why the interface reports style cues and distinguishes unassessed text from zero matched cues.

No held-out authorship benchmark was run for this release. A future classifier still requires the corpus, slice evaluation, calibration, and false-positive reporting described in **benchmarking.md**.
