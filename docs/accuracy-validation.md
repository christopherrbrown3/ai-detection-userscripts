# Accuracy validation — 0.10.0

Version 0.10 cut false stamps on pre-ChatGPT human answers from **9.6% to 0.4%** (Reddit ELI5) and from **13.4% to 0.7%** on a held-out finance Q&A set. ChatGPT recall on the same data fell from 69% to 23–26%. Every rule, weight and threshold is still hand-written; nothing is trained or fitted, and everything runs inside the Safari userscript.

Measured 2026-11-04 with `scripts/evaluate_rubric.mjs` on 10,000 HC3 answers. Aggregates: [accuracy-validation-results.json](accuracy-validation-results.json). Dataset text is not committed.

## Data and method

| Set | Human rows | AI rows | Role |
| --- | --- | --- | --- |
| HC3 `reddit_eli5` | 3,000 pre-ChatGPT Reddit answers | 3,000 ChatGPT answers (Dec 2022) | Rule cut-offs were chosen by hand while looking at this set |
| HC3 `finance` | 2,000 human finance answers | 2,000 ChatGPT answers (Dec 2022) | Held out: checked only after the rules were frozen |

[HC3](https://huggingface.co/datasets/Hello-SimpleAI/HC3) is CC BY-SA 4.0. `scripts/prepare_hc3.py` samples it deterministically and undoes the PTB-style spacing of the Reddit answers. The human text predates ChatGPT's public release on 30 Nov 2022, so it doubles as a false-positive control set.

The harness runs the shipped detector (and, with `--baseline-ref`, any earlier commit) and reports stamp rates, per-family hit rates and Wilson 95% intervals by label and length. "Stamped" means the badge would appear with default settings.

## Results

| Set | Release | Human stamped | ChatGPT stamped | Precision if 10% of posts are AI |
| --- | --- | --- | --- | --- |
| ELI5 (tuning) | 0.9.1 | 9.6% [8.6–10.7] | 69.2% [67.5–70.8] | 44% |
| ELI5 (tuning) | 0.10.0 | 0.4% [0.2–0.7] | 25.6% [24.1–27.2] | 88% |
| Finance (held out) | 0.9.1 | 13.4% [11.9–14.9] | 68.5% [66.5–70.5] | 36% |
| Finance (held out) | 0.10.0 | 0.7% [0.4–1.2] | 22.9% [21.1–24.7] | 78% |

Precision uses TPR·π / (TPR·π + FPR·(1 − π)) with π = 0.10, an assumed share of AI-written posts, not a measured one.

The recall drop is deliberate. In 0.9.1 one rhythm or repetition family was enough to stamp, and those families each matched 2–5% of human answers:

| Family (0.10 tier) | Human, ELI5 | ChatGPT, ELI5 | Human, finance | ChatGPT, finance |
| --- | --- | --- | --- | --- |
| Repeated phrases (moderate, needs a pair) | 4.5% | 48.0% | 5.2% | 50.9% |
| Similar sentence lengths (moderate, needs a pair) | 2.4% | 30.4% | 4.3% | 9.2% |
| Repeated openings (moderate, needs a pair) | 0.5% | 3.9% | 0.8% | 6.5% |
| Stock framing (moderate) | 0.0% | 9.4% | 0.1% | 15.0% |
| Contrast pivots (moderate) | 0.0% | 0.4% | 0.0% | 0.0% |
| Assistant leftovers (definitive) | 0.0% | 1.0% | 0.0% | 0.3% |
| Model reference / disclaimer (definitive) | 0.0% | 0.2% | 0.0% | 0.5% |

In 0.9.1 stock framing matched 3.1% of human finance answers; in 0.10 it matches 0.1%. Its likelihood ratio rose from 6.5 to 100. Moving `TL;DR`, "if you're", "furthermore" and similar phrases to the weak list or out of the rules accounts for most of that.

## What HC3 cannot show

- **Current models.** December 2022 ChatGPT predates the 2024 surge in words such as *delve* and *tapestry*, rarely uses "not X, but Y" pivots, and HC3 strips its line breaks, lists and Markdown. Recall for the vocabulary, contrast, list and Markdown rules is therefore unmeasured here. HC3 does show their false-positive side: each vocabulary word appeared in at most 0.17% of human answers.
- **Social posts.** These are Q&A answers, not LinkedIn, X or Facebook posts. Restating the question inflates repeated-phrase hits for ChatGPT.
- **Mixed and edited text.** HC3 has no human-edited or AI-polished rows.
- **Cut-off tuning.** Rule cut-offs were picked by hand on ELI5. The finance numbers are the honest held-out check.

## Research methods measured, not shipped

`scripts/evaluate_rubric.mjs --research` scores the methods from the review that were marked "measure before shipping". They live in `research/` and are not bundled into any userscript.

| Signal | Source | AUC, ELI5 | AUC, finance | Verdict |
| --- | --- | --- | --- | --- |
| ZipPy compression delta | [thinkst/zippy](https://github.com/thinkst/zippy) zlib engine and seed, MIT | 0.954 | 0.952 | Strong ranking, but see below |
| Agentless passives per 100 words | Reinhart et al. 2025, regex approximation | 0.657 | 0.585 | Weak |
| Nominalizations per 100 words | Reinhart et al. 2025, suffix approximation | 0.615 | 0.659 | Weak |
| Clause-initial -ing participles | Reinhart et al. 2025, regex approximation | 0.574 | 0.587 | Weak |
| slop-score word density | [slop-score](https://github.com/sam-paech/slop-score) lists, MIT, dictionary-filtered | 0.525 | 0.562 | Near chance on Q&A text |
| slop-score trigram density | same | 0.506 | 0.528 | Near chance |

ZipPy's score is partly a length effect: within length buckets its AUC is 0.91–0.95 for 50+ words but 0.64–0.77 under 50 words. At ZipPy's own zero cut-off it flags 21–31% of human answers, and 46–48% of those over 120 words. It needs a length-aware threshold before it could stamp anything. Its 2023 seed is also close in time to HC3's ChatGPT text, which may flatter it. Browser use would mean bundling the ~85 KB seed and a deflate implementation, or making analysis asynchronous for `CompressionStream`.

The Biber rates use regex stand-ins because a real tagger (compromise, ~250 KB minified) would roughly triple the userscript; that trade-off was not made for signals this weak.

## Reproduce

```bash
python3 scripts/prepare_hc3.py --input reddit_eli5.jsonl --output training/data/hc3-eli5.jsonl --per-class 3000
python3 scripts/prepare_hc3.py --input finance.jsonl --output training/data/hc3-finance.jsonl --per-class 2000
node scripts/evaluate_rubric.mjs --input training/data/hc3-eli5.jsonl --baseline-ref 6c88973 --research
```

`6c88973` is the last 0.9.1 commit. `training/data/` is git-ignored. Any JSONL in the [training schema](../training/README.md) works, including your own exported posts: text you published before 30 Nov 2022 is a human control set that needs no AI labels.
