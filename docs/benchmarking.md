# Benchmarking and release protocol

Accuracy means controlling harmful false positives under realistic distribution shift—not maximizing a single random-split F1 score.

## Data sources

Use data with explicit provenance and redistribution rights. Recommended starting points include:

- [MultiSocial](https://aclanthology.org/2025.acl-long.36/) for multilingual, multi-generator social-media text and X/Twitter platform experiments
- [DAMASHA/MAS](https://aclanthology.org/2026.findings-eacl.326/) for mixed-authorship segmentation, adversarial changes, and Reddit-domain material
- [EvoBench](https://aclanthology.org/2025.findings-acl.754/) to test evolving model families
- a separately curated, consented LinkedIn corpus matched by post/comment type, length, topic, and time period

Do not combine unrelated human and AI corpora without matching topic, prompt, length, and platform. That teaches dataset artifacts instead of authorship signals.

MultiSocial's Zenodo files are restricted to approved research use. Request access and follow its terms; never commit or redistribute the corpus from this repository.

## Required split design

Use three disjoint splits:

1. **Training** — fits structured and hashed character n-gram weights.
2. **Calibration** — fits the sigmoid mapping and chooses the strong cutoff from human scores only.
3. **Test** — remains untouched until the model and threshold are frozen.

Every original, continuation, paraphrase, edit, translation, and attack derived from the same source must share `source_id`. The trainer keeps those groups together and reports overlap counts.

## Required test matrix

Report precision, recall, F1, ROC-AUC, average precision, Brier score, expected calibration error, and especially false-positive rate for:

| Dimension | Required slices |
| --- | --- |
| Platform | LinkedIn, X, Reddit, old Reddit where available |
| Kind | Post, comment/reply |
| Length | 0–19, 20–49, 50–119, 120+ words |
| Authorship | Human, fully generated, human-polished, AI-polished, mixed/hybrid |
| Generator | Every trained generator and at least two unseen families |
| Evolution | Older and newer versions from the same family; fine-tuned and personalized output |
| Attack | None, paraphrase, punctuation, typo, case, invisible characters, character substitutions |
| Language/style | English, non-English, mixed script, ELL, dialect, easy-to-read/formulaic human prose |

For mixed text, report score distributions and segment/boundary metrics rather than forcing a binary “correct” label.

## False-positive threshold

`training/train.py --target-fpr 0.01` selects the strong cutoff from held-out human calibration scores. The report includes `minimum_resolvable_fpr`; if that value exceeds the requested target, collect more human calibration data rather than claiming a bound the sample cannot support.

The moderate threshold is an exploratory UI threshold. It must never be described as proof or used for enforcement.

## Release criteria

A release model should satisfy all of the following:

- zero `source_id` overlap across splits
- a large enough held-out human set to resolve the target FPR
- no material FPR regression in any supported platform/kind/length slice
- explicit documentation of failed or underpowered slices
- improved unseen-generator results over the previous model
- parity, unit, DOM, generated-file, and syntax checks passing in CI

Until those conditions are met, keep `models/default-models.json` marked `"calibrated": false` and do not publish accuracy percentages.
