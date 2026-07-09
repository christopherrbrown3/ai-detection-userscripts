# Web research notes (papers + OSS)

This file is a curated list of papers, benchmarks, and open-source repos relevant to LLM-generated text detection.

**Important constraint:** our Safari userscripts are **heuristics-only** (no model inference/logprobs), so many state-of-the-art methods are listed here as *reference only*.

## Local PDFs used during research (not committed)
- `whitepapers/2024.emnlp-main.885.pdf` — **Text Fluoroscopy** (EMNLP 2024).
  - Key takeaway: domain generalization improves when you focus on **intrinsic/stylistic** signals rather than semantic/topic cues.
  - Not directly portable: their core signal is computed by probing **internal LM layers** (not available client-side).
- `whitepapers/2510.12608v1.pdf` — **StyleDecipher** (2025).
  - Key takeaway: framing detection as **stylistic analysis** + explainability + robustness to paraphrasing and **hybrid human/AI** writing is directionally right for social posts.
  - Not directly portable: parts of the method depend on semantic embeddings and semantic-preserving rewriting models.
- `whitepapers/3696410.3714770.pdf` — **Beyond Binary / LLMDetect benchmark** (WWW 2025).
  - Key takeaway: binary “AI vs human” is often the wrong UX; better is “LLM role / involvement” and explicitly handling mixed authorship.
  - Portable for us: UX taxonomy + the idea of “mixed signals” / evidence quality (even if we don’t ship their ML).
- `whitepapers/llm_detection_report.pdf` — short state-of-the-art overview (2025-11-22).
  - Key takeaway: popular detectors lean on **perplexity/burstiness** (LM-scoring) and stylometry; for us, burstiness-like *proxies* (sentence-length CV, repetition, list structure) are feasible.

## Highly relevant to our userscripts (intrinsic / stylometry focus)
- **Text Fluoroscopy: Detecting LLM-Generated Text through Intrinsic Features** (EMNLP 2024, ACL Anthology id `2024.emnlp-main.885`, DOI `10.18653/v1/2024.emnlp-main.885`).
  - Takeaway for userscripts: intrinsic/stylistic signals generalize better than topic/semantic cues.
- **StyleDecipher: Robust and Explainable Detection of LLM-Generated Texts with Stylistic Analysis** (arXiv `2510.12608`, 2025-10-14; code: `SiyuanLi00/StyleDecipher`).
  - Takeaway for userscripts: stylistic indicators + explainability + mixed human/AI framing.
- **GLTR: Statistical Detection and Visualization of Generated Text** (ACL 2019 demo track, ACL Anthology id `P19-3019`; repo: `HendrikStrobelt/detecting-fake-text`).
  - Takeaway for userscripts: great UX patterns for “why” explanations, but the core GLTR method requires an LM to compute token ranks (not client-side here).

## Strong methods (but need LMs / logprobs → not client-side)
- **Binoculars** (arXiv `2401.12070`): contrast perplexities from two related LMs.
- **DetectGPT** (ICML 2023): probability curvature via perturbations; requires logprobs from an LM.
- **Fast-DetectGPT** (2023): efficiency improvements to DetectGPT; still requires LM scoring.
- **Ghostbuster: Detecting Text Ghostwritten by Large Language Models** (NAACL 2024, ACL Anthology id `2024.naacl-long.95`; repo: `vivek3141/ghostbuster`): runs documents through weaker LMs and trains a classifier; avoids needing the *target* model logprobs, but still needs LM inference (not usable in a userscript).

## Benchmarks / datasets for offline tuning
- **M4** (EACL 2024 long paper, ACL Anthology id `2024.eacl-long.83`, DOI `10.18653/v1/2024.eacl-long.83`): multi-generator / multi-domain / multi-lingual benchmark; highlights domain shift and generalization gaps.
- **MAGE: Machine-generated Text Detection in the Wild** (ACL 2024 long paper, ACL Anthology id `2024.acl-long.3`, DOI `10.18653/v1/2024.acl-long.3`; repo: `yafuly/MAGE`).
- **RAID: A Shared Benchmark for Robust Evaluation of Machine-Generated Text Detectors** (ACL 2024 long paper, ACL Anthology id `2024.acl-long.674`): robustness benchmark stressing adversarial, decoding, and unseen-generator shifts.
  - Takeaway for userscripts: detectors break under paraphrase/decoding shifts; prioritize features that are less sensitive to superficial edits and always cap certainty for short/low-evidence text.

## Robustness / fairness (important for UX + “certainty” caps)
- Liang et al., **GPT detectors are biased against non-native English writers** (Patterns 2023, DOI `10.1016/j.patter.2023.100779`; repo: `Weixin-Liang/ChatGPT-Detector-Bias`).
  - Takeaway for userscripts: “low-variability English” (ELL writing) can look “AI-ish”. This supports our choice to downgrade evidence for non-English/mixed-script text and to avoid punitive UX (“not proof”).
- Basu et al., **BAID: A Benchmark for Bias Assessment of AI Detectors** (arXiv `2512.11505`, submitted 2025-12-12).
  - Takeaway: bias can be systematic across dialect/formality/demographics; if we ever add evaluation, we should disaggregate metrics by subgroup/variety (not just global F1).

## Compression-based detection (proxy for perplexity, but needs care)
- **ZipPy** (repo: `thinkst/zippy`): classifies text using (seeded) compression ratio deltas (zlib/LZMA/Brotli) as a fast approximation of “novelty/perplexity”.
  - Potentially portable idea: use lightweight compressibility/entropy proxies as additional features.
  - Caveat: seeded-compression approaches require bundling a representative seed corpus (and can behave badly on short/structured/non-English text).

## Watermarking (not detection-by-style)
Watermarking only helps when the generator used a compatible watermark; it does not “detect AI” in general.
- Kirchenbauer et al. **A Watermark for Large Language Models** (arXiv `2301.10226`; official repo: `jwkirchenbauer/lm-watermarking`).
- Toolkits:
  - MarkLLM (EMNLP 2024 system demo; repo: `THU-BPM/MarkLLM`): multiple watermark algorithms and evaluation tooling in one place.
  - LM-Watermark (survey list of watermarking papers/repos).

## JS libraries that might help (optional; we currently don’t bundle them)
We currently do a lightweight English-ness heuristic in-script. If you want real language ID, these are candidates:
- `franc` (pure JS language ID; many languages; needs longer text for reliability).
- `cld3-asm` (WASM bindings for Google CLD3; better accuracy; adds a wasm payload).
- `wink-nlp` (full NLP pipeline; heavier; might be overkill for userscripts).
