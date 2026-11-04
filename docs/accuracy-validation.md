# Accuracy validation — 0.10.0

On Reddit posts written by 2023–24 chat models, 0.10 marks **49% as AI Detected while marking 1.1% of human posts**. Release 0.9.1 marked 16.5% at 7.3%. A per-site **Stamp sensitivity** setting trades between the two: Balanced (default) also shows a muted **Possible AI** stamp, and Sensitive catches 79% of AI posts at a 17% human false-positive rate. Every rule, point value and cut-off is hand-written and runs inside the Safari userscript; nothing is trained.

Measured 2026-11-04 with `scripts/evaluate_rubric.mjs`. Aggregates: [accuracy-validation-results.json](accuracy-validation-results.json). No dataset text is committed.

## Data

| Set | Human rows | AI rows | Role |
| --- | --- | --- | --- |
| [RAID](https://huggingface.co/datasets/liamdugan/raid) Reddit, dev half | 153 Reddit posts | 380 posts by GPT-4, Llama-2-chat, Mistral-chat, MPT-chat | Chatbot-register phrases were mined here |
| RAID Reddit, test half | 179 | 417 | Held out; reported below |
| [HC3](https://huggingface.co/datasets/Hello-SimpleAI/HC3) `reddit_eli5` | 3,000 pre-ChatGPT Reddit answers | 3,000 ChatGPT answers (Dec 2022) | Earlier 0.10 cut-offs were chosen by hand here |
| HC3 `finance` | 2,000 human answers | 2,000 ChatGPT answers (Dec 2022) | Held out |

RAID (MIT) prompts chat models to "write the body of a Reddit post titled …" and keeps the real post as the human example; only unattacked rows are used. `scripts/sample_raid_reddit.py` reads 160 evenly spaced 380 KB windows of the 11.8 GB CSV and splits rows 50/50 by title. HC3 is CC BY-SA 4.0; `scripts/prepare_hc3.py` samples it. Its human text predates ChatGPT's public release on 30 Nov 2022.

## Results by sensitivity

"AI Detected" is the orange/red stamp. "Any stamp" adds the grey Possible AI stamp. Cells are human posts / AI posts.

| Profile | RAID Reddit (held out), AI Detected | RAID, any stamp | HC3 ELI5, any stamp | HC3 finance (held out), any stamp |
| --- | --- | --- | --- | --- |
| 0.9.1, for reference | 7.3% / 16.5% | same | 9.6% / 69.2% | 13.4% / 68.5% |
| Strict | 1.1% / 48.9% | same | 0.4% / 25.6% | 0.7% / 22.9% |
| **Balanced (default)** | 1.1% / 48.9% | 7.8% / 53.0% | 7.1% / 69.0% | 9.7% / 65.0% |
| Sensitive | 16.8% / 78.9% | 16.8% / 79.6% | 9.5% / 74.4% | 13.3% / 78.3% |

Wilson 95% intervals are in the results file. The RAID human sample is small: 1.1% is 2 of 179 posts, with an interval of 0.3–4.0%.

- **Strict** stamps only on the 0.10 rules: strong artifacts, or pattern families with at least 1 point, where rhythm and repetition alone need two families.
- **Balanced** keeps exactly those AI Detected stamps and adds **Possible AI** when some evidence matched but less than a moderate stamp needs. That is usually a single rhythm or repetition family, two formatting cues, or a pattern in a short sample.
- **Sensitive** lowers cut-offs. Weak framing phrases count fully, one chatbot-register phrase is enough, two LLM vocabulary words, one copula/-ing phrase, and plain "not X, but Y" counts fully. One rhythm or formatting family can stamp, short samples can stamp moderate, and the creator-post template counts as a pattern. A single register phrase such as "hey everyone" or "thanks in advance" accounts for most of its extra human flags.

## What made the difference

On RAID's Reddit posts the 0.9.1 rhythm and repetition rules do not discriminate at all:

| Family | Human, RAID test | AI, RAID test |
| --- | --- | --- |
| Similar sentence lengths | 4.2% | 4.3% |
| Repeated phrases | 2.4% | 2.3% |
| Repeated openings | 1.5% | 0.3% |
| **Chatbot social-post register (new)** | 0.6% | 40.8% |
| Unedited assistant output | 0.0% | 4.8% |

(The first three rows are measured on the whole RAID sample; the last two on the held-out half.)

Chat models writing a "Reddit post" reach for the same formulas: "Hey fellow Redditors", "Any advice would be greatly appreciated", "Thanks in advance", "Has anyone else experienced", "I've been struggling with … for a while now". The new family requires two distinct phrases from a 52-entry list, because people use several of them too. Another 4.8% of AI posts contain unedited assistant output such as "Sure, here's a possible Reddit post:".

On HC3 the rhythm and repetition rules did separate ChatGPT answers (each matched 2–5% of human answers and 10–50% of ChatGPT answers). They are why HC3 recall rises sharply when Possible AI or Sensitive is enabled.

## What this cannot show

- **LinkedIn, X, Facebook and YouTube.** No labeled corpus from these sites was available. The creator-post template (hook line, one-line paragraphs, bullets, an engagement prompt or hashtag block) and LinkedIn sign-off phrases are unmeasured. On RAID and HC3 the template never fired.
- **Current models.** RAID covers 2023–24 chat models and HC3 December 2022 ChatGPT. Neither shows the 2024 vocabulary surge (*delve*, *tapestry*), so recall for the vocabulary rule is unmeasured; each word appeared in at most 0.17% of human HC3 answers.
- **Edited or mixed text, and paraphrase attacks.** Only unattacked RAID rows were used.
- **Small human sample on RAID.** 179 held-out human posts cannot resolve false-positive rates much below 2%.

## Research methods measured, not shipped

`--research` scores the methods from the review marked "measure before shipping". They live in `research/` and are not bundled.

| Signal | Source | AUC, HC3 ELI5 | AUC, HC3 finance |
| --- | --- | --- | --- |
| ZipPy compression delta | [thinkst/zippy](https://github.com/thinkst/zippy), MIT | 0.954 | 0.952 |
| Agentless passives per 100 words | Reinhart et al. 2025, regex approximation | 0.657 | 0.585 |
| Nominalizations per 100 words | Reinhart et al. 2025, suffix approximation | 0.615 | 0.659 |
| Clause-initial -ing participles | Reinhart et al. 2025, regex approximation | 0.574 | 0.587 |
| slop-score word density | [slop-score](https://github.com/sam-paech/slop-score), MIT | 0.525 | 0.562 |
| slop-score trigram density | same | 0.506 | 0.528 |

ZipPy's score is largely a length effect. Within length buckets its AUC is 0.91–0.95 for 50+ words but 0.64–0.77 under 50 words, and at its own zero cut-off it flags 21–31% of human answers. It needs a length-aware threshold, the ~85 KB seed in every bundle, and synchronous deflate before it could stamp.

## Reproduce

```bash
python3 scripts/sample_raid_reddit.py --output-dir training/data
python3 scripts/prepare_hc3.py --input reddit_eli5.jsonl --output training/data/hc3-eli5.jsonl --per-class 3000
python3 scripts/prepare_hc3.py --input finance.jsonl --output training/data/hc3-finance.jsonl --per-class 2000 --seed 1337
node scripts/evaluate_rubric.mjs --input training/data/raid-reddit-test.jsonl --sensitivity balanced --baseline-ref 6c88973
```

`6c88973` is the last 0.9.1 commit. `training/data/` is git-ignored. Any JSONL in the [training schema](../training/README.md) works, including your own exported posts: text you published before 30 Nov 2022 is a human control set that needs no AI labels.
