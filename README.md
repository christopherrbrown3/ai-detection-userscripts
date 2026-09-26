# AI-Style Signal Userscripts

[![CI](https://github.com/christopherrbrown3/ai-detection-userscripts/actions/workflows/ci.yml/badge.svg)](https://github.com/christopherrbrown3/ai-detection-userscripts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg)](LICENSE)

Privacy-first Safari userscripts that show observable writing-style cues on posts and comments on LinkedIn, X/Twitter, and Reddit.

> [!IMPORTANT]
> This project analyzes surface writing patterns. It cannot prove who or what wrote a post. Short, edited, personalized, multilingual, and mixed-authorship text may be impossible to classify reliably. Never use a badge as the basis for an accusation or high-stakes decision.

![Style cue badge and highlighted explanations in the browser fixture](docs/preview.png)

## Install

1. Install [Userscripts for Safari](https://github.com/quoid/userscripts).
2. Open one of the raw script links below in Safari.
3. Accept the Userscripts installation prompt and grant access only to that script's site.

| Site | Install | Coverage |
| --- | --- | --- |
| LinkedIn | [Install LinkedIn script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/linkedin-ai-heuristic.userscripts.user.js) | Feed, profile activity, direct post permalinks, and comments |
| X/Twitter | [Install X script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/x-ai-heuristic.userscripts.user.js) | Posts and replies |
| Reddit | [Install Reddit script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/reddit-ai-heuristic.userscripts.user.js) | Current Reddit, old Reddit, posts, and comments |

Manual installation is also supported: open Userscripts → Manage → Open Scripts Folder, copy a root-level `.user.js` file there, enable it, and refresh the target site.

### Compatibility

The target is the current [Userscripts](https://github.com/quoid/userscripts) extension on Safari 16.4+ for macOS. The scripts include fallbacks for older emoji/CSS support, but older Safari releases and iOS layouts are best-effort rather than part of the automated fixture matrix. Current automated layouts cover LinkedIn feed posts/comments, profile activity, direct post permalinks, collapsed/expanded post text, X posts/replies, current Reddit posts/comments, and old Reddit posts/comments.

## What the badge means

The badge says **Style cues: N matched** and counts the configured pattern families found in the text. Open it to see their descriptions and highlighted examples from the analyzed text. The original post is never marked up or changed.

- **0 matched** means the rules ran and found no configured patterns. It does not establish human authorship.
- **Short sample** appears directly on the badge for fewer than 20 words or 2 sentences/list items. Matches in these samples may be incidental.
- **Not assessed** appears with **Language uncertain** or **Unsupported language** when there is too little evidence to apply the English rules. This is different from zero matches.

Short, unassessed, and zero-match badges use neutral colors. Other matches use one accent color without a traffic-light severity scale. Screen readers announce the exact count and sample status. The panel also reports word and sentence counts and classifies longer samples as standard or long (at least 80 words and 4 sentences/list items).

The six families are explicit model references, stock framing phrases, repeated sentence openings, list and punctuation structure, similar sentence lengths, and repeated phrases. Descriptions report observable patterns, not rhetorical intent or authorship. Lists are excluded from the three prose-based rhythm/repetition checks; counted openings are excluded from phrase repetition. These safeguards reduce overlapping matches without claiming that the families are statistically independent.

Settings are stored locally for the current site:

- comments/replies on or off
- hiding short or unassessed samples
- hiding assessed posts with no cues

## Privacy

All extraction and analysis happen inside the browser tab. The scripts:

- do not send post text, account data, browsing activity, scores, or feature vectors anywhere
- do not load a model, CDN asset, analytics SDK, or remote JavaScript dependency
- use site-local browser storage only for user settings

See [SECURITY.md](SECURITY.md) for the privacy boundary and reporting guidance.

## Detection approach

The browser preserves paragraph, line-break, and list boundaries while extracting the author's text. It excludes quotation blocks, quoted reposts where identified by the site adapter, code, and inline quotation/code spans. One deterministic sentence parser supplies both the cue checks and diagnostic metrics, including handling of common abbreviations, decimals, and URLs.

The default rules look for exact, inspectable patterns:

- explicit model-reference wording, excluding ordinary refusals such as “I cannot”
- combinations of stock framing phrases instead of a single everyday phrase
- repeated multiword sentence openings
- lists or punctuation clusters, with punctuation density adjusted for text length
- similar prose sentence lengths with minimum sample requirements
- contiguous repeated 3–5-word phrases, with overlapping spans counted once and repetition measured relative to prose length

Unicode is normalized and invisible formatting characters are removed before analysis. The language check uses script and English function-word evidence; it is a conservative eligibility heuristic, not a language classifier.

Posts approaching the viewport are queued in small batches. Edits re-extract the affected post, unchanged text reuses its analysis, and a bounded cache shares results for duplicate content. Legacy stylometry, character n-gram hashing, and model output are deferred until **Technical details** is opened in the default uncalibrated release.

The root userscripts are generated from a shared detector and runtime plus thin platform adapters. The offline Python extractor mirrors the shared sentence and exclusion rules for diagnostic feature parity.

## Accuracy policy

The default installed behavior is an explicitly **heuristic cue rubric**, not a trained authorship classifier. For eligible text it returns an exact family count and shows every contributing cue; otherwise it explicitly reports that the text was not assessed. It makes no accuracy or probability claim. Human professional writing can contain these patterns, while generated or heavily edited text can avoid them.

The legacy experimental model output remains available only in Technical details for development comparison. A future trained model may replace the rubric only after a suitable distributable corpus and held-out report are published.

The offline pipeline enforces:

1. leakage-aware training, calibration, and test splits
2. held-out sigmoid calibration
3. a strong threshold derived only from held-out human scores at a requested false-positive target
4. separate reports by platform, content type, length, language, generator, attack, and authorship class
5. mixed-authorship evaluation without forcing mixed text into a binary training label

The full evaluation protocol and required robustness matrix are in [docs/benchmarking.md](docs/benchmarking.md).

## Development

Requirements: Python 3.10+ and Node.js 20+.

```bash
python3 -m pip install -r training/requirements.txt
npm install
npm run build
npm test
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Edit files under `src/` and `models/default-models.json`, then regenerate the root release files:

```bash
python3 scripts/build_userscripts.py
python3 scripts/build_userscripts.py --check
```

Tests cover feature parity between Python and JavaScript, cue spans, quotation/code exclusion, list overlap, scoring behavior, threshold selection, grouped splitting, nested DOM ownership, edited-content rescoring, cache reuse, viewport scheduling, and keyboard-accessible dialogs. See [browser validation](docs/browser-validation.md) for the synthetic regression comparison, list ablation, and verification limits.

## Offline training

The pipeline accepts human, AI-generated, and mixed/hybrid JSONL records with optional platform, generator, language, attack, and source-group metadata. It can also normalize downloaded MultiSocial-style CSV, JSON, JSONL, or Parquet files.

See [training/README.md](training/README.md) for the schema, dataset preparation, adversarial augmentation, training, reporting, and safe model export workflow.

## Limitations

- Social posts are often shorter than reliable stylometry requires.
- A model trained on one platform or generator may fail on another.
- Paraphrasing, fine-tuning, personalization, human editing, and mixed authorship can reverse or erase useful signals.
- English-language learners, dialects, formulaic professional writing, and easy-to-read prose can be over-flagged by detectors.
- Site markup changes can temporarily break extraction; fixture tests cover known layouts but cannot guarantee future compatibility.

See [docs/troubleshooting.md](docs/troubleshooting.md) if badges are missing, duplicated, or misplaced.

## Research and license

[whitepapers/web_research.md](whitepapers/web_research.md) records the primary research behind the accuracy and UX decisions. Contributions should include evidence and an ablation or regression test for detection changes.

Released under the [MIT License](LICENSE).
