# AI-Style Signal Userscripts

[![CI](https://github.com/christopherrbrown3/ai-detection-userscripts/actions/workflows/ci.yml/badge.svg)](https://github.com/christopherrbrown3/ai-detection-userscripts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4f46e5.svg)](LICENSE)

A privacy-first Safari userscript that shows observable writing-style cues on posts and comments on LinkedIn, X/Twitter, and Reddit, with experimental Facebook and YouTube support.

> [!IMPORTANT]
> This project analyzes surface writing patterns. It cannot prove who or what wrote a post. Short, edited, personalized, multilingual, and mixed-authorship text may be impossible to classify reliably. Never use a badge as the basis for an accusation or high-stakes decision.

![Style cue badge and highlighted explanations in the browser fixture](docs/preview.png)

## Install

1. Install [Userscripts for Safari](https://github.com/quoid/userscripts).
2. Open **[Install AI-Style Cues — all supported sites](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/ai-style-cues.userscripts.user.js)** in Safari.
3. Accept the Userscripts installation prompt and grant access to the supported sites you want to use.
4. If upgrading from the three site scripts, disable those scripts and refresh your tabs. Follow the [migration and rollback guide](docs/migration.md) to keep your settings and backups.

One self-contained script supports LinkedIn, X/Twitter, and Reddit, plus opt-in Facebook and YouTube desktop text analysis. Only the adapter for the current site runs. Instagram, Threads, and Bluesky are not yet supported. See the generated [supported-site and route matrix](docs/supported-sites.md).

**Facebook starts disabled.** On `www.facebook.com`, open **Style cues off · Settings** and turn on **Enable style cues on this site**. Version 0.6 adds `www.facebook.com` and `facebook.com` to the combined script's permissions; Safari may require website access before the launcher appears. Facebook is experimental: live Safari checks cover feed, profile/Page, permalink/dialog, comments/replies, and preference persistence, alongside synthetic regressions. Some layouts will be skipped. See [Facebook scope and validation](docs/facebook-validation.md).

**YouTube starts disabled.** On `www.youtube.com`, open **Style cues off · Settings** and turn on **Enable style cues on this site**. Version 0.7 adds only `www.youtube.com` to the combined script's permissions. It analyzes creator descriptions, comments/replies, and supported channel Posts text. Titles, transcripts, live chat, Shorts, polls, and media analysis are excluded. Some layouts are skipped; see [YouTube scope and validation](docs/youtube-validation.md).

Optional targeted installations retain their existing names, update URLs, and narrower host permissions:

| Site | Optional install | Coverage |
| --- | --- | --- |
| LinkedIn | [LinkedIn script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/linkedin-ai-heuristic.userscripts.user.js) | Feed, profile activity, direct post permalinks, and comments |
| X/Twitter | [X script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/x-ai-heuristic.userscripts.user.js) | Posts and replies |
| Reddit | [Reddit script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/reddit-ai-heuristic.userscripts.user.js) | Current Reddit, old Reddit, posts, and comments |
| Facebook | [Facebook script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/facebook-ai-heuristic.userscripts.user.js) | Experimental desktop published-text markers and permalink-identified comments/replies; opt-in |
| YouTube | [YouTube script](https://raw.githubusercontent.com/christopherrbrown3/ai-detection-userscripts/main/youtube-ai-heuristic.userscripts.user.js) | Experimental desktop descriptions, comments/replies, channel Posts and post permalinks; opt-in |

Manual installation: open Userscripts → Manage → Open Scripts Folder, copy the desired root-level `.user.js` file there, enable it, and refresh the target site. Keep only your intended installation enabled. Do not install the metadata-only `.meta.js` files.

### Compatibility

The target is the current [Userscripts](https://github.com/quoid/userscripts) extension on Safari 16.4+ for macOS. The scripts include fallbacks for older emoji/CSS support, but older Safari releases and iOS layouts are best-effort rather than part of the automated fixture matrix. Current automated layouts cover LinkedIn feed posts/comments, profile activity, direct post permalinks, collapsed/expanded post text, X posts/replies, current Reddit posts/comments, old Reddit posts/comments, synthetic Facebook desktop posts/dialogs/comments/replies, and YouTube descriptions/comments/channel Posts. Facebook mobile hosts, Groups routes, messaging, Stories, Reels, and Marketplace are excluded. YouTube mobile, Music, Studio, embedded players, Shorts, and live chat are excluded.

## What the badge means

Posts with matched patterns get a small **AI Detected** stamp. Its height matches the post's text line height. Posts with no matches, or text the English rules cannot assess, have **no badge**.

- **Orange / moderate:** 1–2 of the six pattern families match.
- **Red / high:** 3–6 families match. A double border also distinguishes high signal levels without relying only on color.
- **Hover:** details grow out from the stamp, showing the matched families and highlighted passages. Moving into the panel keeps it open.
- **Click, tap, Enter, or Space:** keep details open for reading and interaction. Escape closes them and returns focus. Reduced-motion settings disable the grow animation.

The level counts matched pattern families, not the probability that AI wrote the post. These families are not equally predictive or statistically independent. Human writing can match them; AI writing can match none. The details explain this and show the exact count, sample length, and exclusions. **Short sample** is reported in details and the accessible name for fewer than 20 words or 2 sentences/list items. The original post is never highlighted or rewritten.

The six families are model references or recognizable assistant artifacts, stock framing phrases, repeated sentence openings, list and punctuation structure, similar sentence lengths, and repeated phrases. Multiple matches in a family count once. Lists are excluded from the three prose rhythm/repetition checks and from the new contrast-construction check; counted openings are excluded from phrase repetition.

The **Style cue settings** button remains available when every badge is hidden. Settings are stored locally for the current site/origin:

- enable or disable analysis on this site
- comments/replies on or off
- hide signals in short samples

Zero-match and unassessed posts always stay unbadged. Older saved settings remain readable; the old zero-match visibility preference no longer changes this behavior. See the [0.9 stamp validation report](docs/stamp-validation.md) for verification and limits.

## Privacy

All extraction and analysis happen inside the browser tab. The scripts:

- do not send post text, account data, browsing activity, scores, or feature vectors anywhere
- do not load a model, CDN asset, analytics SDK, or remote JavaScript dependency
- store only user settings locally, separated by site/origin; Facebook uses userscript-manager storage so the page cannot erase its preferences

See [SECURITY.md](SECURITY.md) for the privacy boundary and reporting guidance.

## Detection approach

The browser preserves paragraph, line-break, and list boundaries while extracting the author's text. It excludes quotation blocks, quoted reposts where identified by the site adapter, code, and inline quotation/code spans. One deterministic sentence parser supplies both the cue checks and diagnostic metrics, including handling of common abbreviations, decimals, and URLs.

The default rules look for exact, inspectable patterns:

- explicit model-reference wording, excluding ordinary refusals and AI job titles; specific assistant-role delimiters and leaked citation markup
- combinations of stock framing phrases, including common contemporary variants; repeated contrast constructions require at least two matches and 40 prose words
- repeated multiword sentence openings, including longer repeated openings that begin with function words
- bullet, arrow, checkmark, and numbered lists or punctuation clusters, with punctuation density adjusted for text length
- similar prose sentence lengths with minimum sample requirements
- contiguous repeated 3–5-word phrases, with overlapping spans counted once and repetition measured relative to prose length

Unicode is normalized and invisible formatting characters are removed before analysis. The language check uses script and English function-word evidence; it is a conservative eligibility heuristic, not a language classifier.

Posts approaching the viewport are queued in small batches. Edits re-extract the affected post, unchanged text reuses its analysis, and a bounded cache shares results for duplicate content. Legacy stylometry, character n-gram hashing, and model output are deferred until **Technical details** is opened in the default uncalibrated release.

The root userscripts are generated from one registry, shared detector/runtime/bootstrap, and thin platform adapters. Messaging routes are excluded and editable composers are omitted from text extraction. The offline Python extractor mirrors the shared sentence and exclusion rules for diagnostic feature parity.

## Accuracy policy

The default installed behavior is an explicitly **heuristic cue rubric**, not a trained authorship classifier. For eligible text it returns an exact family count and shows contributing cues when any match. Unsupported or uncertain language is skipped, and zero-match posts have no badge. It makes no accuracy or probability claim. Human professional writing can contain these patterns, while generated or heavily edited text can avoid them.

Version 0.9 adds two rule-only checks from the [browser detection research](docs/research/2026-10-28-browser-ai-text-detection.md): recognizable assistant artifacts and repeated contrast constructions. No model training, inference runtime, new runtime dependency, or network service is needed. Diagnostic feature definitions and model weights are unchanged. The [stamp validation report](docs/stamp-validation.md) records the chosen rules and their limits.

Version 0.8 recognizes more combinations of framing, repeated openings, and list markers, and avoids treating examples such as “AI engineer” as a model self-reference. These rules will match more human writing too; a broader match is not evidence that detection accuracy has improved. See the [sensitivity validation](docs/sensitivity-validation.md) for the before-and-after probes and their limits.

The legacy experimental model output remains available only in Technical details for development comparison. A future trained model may replace the rubric only after a suitable distributable corpus and held-out report are published.

Versions 0.5.1–0.6.0 converted the count to 0–100, making one family always appear as **17**. Version 0.6.1 removes that misleading precision without changing the detector. See the [research grounding and accuracy audit](docs/research-grounding.md) for the version history, known misses/false matches, exact research-to-code gaps, and the evaluation required before changing the model. The [badge validation report](docs/badge-validation.md) records overflow regression checks and live Safari verification.

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

Tests cover feature parity between Python and JavaScript, cue spans, quotation/code exclusion, list overlap, scoring behavior, threshold selection, grouped splitting, nested DOM ownership, edited-content rescoring, cache reuse, viewport scheduling, and keyboard-accessible dialogs. See [v0.5 consolidation validation](docs/consolidation-validation.md) for generated-bundle parity, isolated-world coexistence, workload measurements, and verification limits. The [v0.4 cue validation](docs/browser-validation.md) records the earlier rule changes and list ablation. Architecture, the adapter contract, and a contributor template are documented in [adding sites](docs/adding-sites.md).

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
