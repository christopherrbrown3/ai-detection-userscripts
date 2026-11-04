# Third-party notices

This project is MIT-licensed. It includes or adapts the following third-party material.

## slop-score — contrast regexes and word lists

- Source: https://github.com/sam-paech/slop-score
- Used in: the first ten `CONTRAST_PATTERNS` in `src/detector.js` (ported from `js/regexes-stage1.js`, shipped in every userscript) and `research/data/slop-words.json` / `research/data/slop-trigrams.json` (filtered from `data/slop_list.json` and `data/slop_list_trigrams.json`; research only, not shipped).
- License: MIT (the repository's primary components; its `wordfreq` files are not used here).

```text
MIT License

Copyright (c) 2025 Sam Paech

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ZipPy — compression detector and seed corpus

- Source: https://github.com/thinkst/zippy
- Used in: `research/signals.mjs` (`clean_text` and the zlib engine's chunked prelude score) and `research/data/zippy-ai-generated.txt` (the unmodified `zippy/ai-generated.txt` seed). Research only; not shipped in any userscript.
- License: MIT.

```text
MIT License

Copyright (c) 2023 Thinkst Applied Research

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Data used for measurement only (not distributed)

- **HC3**, https://huggingface.co/datasets/Hello-SimpleAI/HC3, CC BY-SA 4.0. `scripts/prepare_hc3.py` converts files you download yourself. Only aggregate rates are committed, in `docs/accuracy-validation-results.json`.
- **dwyl/english-words** `words_alpha.txt`, https://github.com/dwyl/english-words, released into the public domain (Unlicense). Used once to filter invented names out of the slop-score lists; the word list itself is not included.

## Sources of rule ideas (no code or text copied)

- Wikipedia, [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) (WikiProject AI Cleanup): assistant leftovers, placeholders, citation markup, AI-referral link parameters, vocabulary, copula avoidance and negative parallelisms. Patterns were reimplemented as regexes.
- Kobak et al., [Delving into LLM-assisted writing in biomedical publications through excess vocabulary](https://arxiv.org/abs/2406.07016), Science Advances 11(27), 2025.
- Reinhart et al., [Do LLMs write like humans? Variation in grammatical and rhetorical styles](https://arxiv.org/html/2410.16107v2), PNAS, 2025.
