# AI Detection Userscripts

Safari Userscripts for lightweight, local-only heuristics that estimate whether posts or comments on LinkedIn, X/Twitter, and Reddit look AI-assisted.

The scripts do not call a server, download models, or use a CDN. They run client-side heuristics and show a plain-language badge with a technical tooltip explaining the top signals behind the verdict.

## Privacy

All analysis happens in the browser tab. The scripts do not transmit post text, account data, browsing activity, or feature vectors anywhere.

## Scripts

- `linkedin-ai-heuristic.userscripts.user.js` - LinkedIn feed posts and comments.
- `x-ai-heuristic.userscripts.user.js` - X/Twitter posts and replies.
- `reddit-ai-heuristic.userscripts.user.js` - Reddit posts and comments, including old Reddit.

## Install

1. Install the Userscripts extension for Safari.
2. Open Userscripts, then Manage, then Open Scripts Folder.
3. Copy the `.user.js` file you want into that folder.
4. Enable the script and refresh the target site.

## What The Badge Means

The badge uses plain labels such as:

- `Unlikely AI`
- `Possibly AI-assisted`
- `Likely AI-assisted`
- `Very likely AI`
- `Almost certain AI`

Hover or focus the badge to see the technical tooltip. It includes estimated AI likelihood, evidence level, top feature contributions, counter-signals, and raw text metrics.

## Detection Approach

The runtime detector is intentionally small and heuristic-only. It uses surface and stylometric signals such as:

- text length and sentence structure
- repetition and sentence starter reuse
- lexical diversity and hapax ratio
- discourse markers and generic templates
- punctuation and formatting patterns
- social-specific counter-signals like links, mentions, hashtags, numbers, and proper-noun-heavy text

The scripts are English-first and cap certainty on short or low-evidence text.

## Offline Training

The `training/` folder contains an optional Python pipeline for training logistic-regression weights from labeled JSONL data. The pipeline is offline only; generated weights can be pasted back into the userscripts as vendored constants.

See [training/README.md](training/README.md) for data format and commands.

## Research Notes

`whitepapers/web_research.md` summarizes relevant papers, benchmarks, and open-source projects. Local PDF copies of papers are intentionally ignored by Git; keep them in `whitepapers/` locally if needed.

## Limitations

This is a heuristic estimate, not proof. AI detection can be biased by writing style, language background, topic, editing, length, and platform conventions. Use the labels as a triage signal, not as an accusation.

## License

No open-source license has been added yet. Public visibility on GitHub does not grant reuse rights by itself.
