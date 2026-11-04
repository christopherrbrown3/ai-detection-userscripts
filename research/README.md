# Research signals (not shipped)

These are the "measure before shipping" methods from the 0.10 accuracy review. Nothing here is bundled into a userscript or affects a stamp. They are training-free and written as browser-compatible JavaScript, so a later release can promote one after it is measured.

| File | What it is |
| --- | --- |
| `signals.mjs` | ZipPy compression delta, Biber-style grammatical rates (regex approximations), and slop-score word/trigram density |
| `data/zippy-ai-generated.txt` | ZipPy's unmodified AI-written seed corpus (MIT, Thinkst Applied Research) |
| `data/slop-words.json`, `data/slop-trigrams.json` | slop-score lists (MIT, Sam Paech), filtered to dictionary words |

Measure them on labeled JSONL:

```bash
node scripts/evaluate_rubric.mjs --input training/data/hc3-eli5.jsonl --research
```

Results and their limits are in [docs/accuracy-validation.md](../docs/accuracy-validation.md). ZipPy ranks HC3 text well (AUC 0.95) but much of that comes from length, and at its own zero cut-off it flags 21–31% of human answers. Promoting it would need a length-aware threshold, the ~85 KB seed in every bundle, and a synchronous deflate or asynchronous analysis for `CompressionStream`. Licenses: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
