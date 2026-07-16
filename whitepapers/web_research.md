# Web research notes (papers + OSS)

Last reviewed: 2026-07-16.

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
- **MultiSocial: Multilingual Benchmark of Machine-Generated Text Detection of Social-Media Texts** (ACL 2025, DOI `10.18653/v1/2025.acl-long.36`; dataset: `10.5281/zenodo.13846152`; repo: `kinit-sk/multisocial`).
  - 472,097 texts across 22 languages, 5 social platforms, and 7 generators.
  - Direct takeaway: platform selection during training matters. Use its X/Twitter data as an X baseline; do not treat it as a drop-in LinkedIn benchmark.
- **M4** (EACL 2024 long paper, ACL Anthology id `2024.eacl-long.83`, DOI `10.18653/v1/2024.eacl-long.83`): multi-generator / multi-domain / multi-lingual benchmark; highlights domain shift and generalization gaps.
- **MAGE: Machine-generated Text Detection in the Wild** (ACL 2024 long paper, ACL Anthology id `2024.acl-long.3`, DOI `10.18653/v1/2024.acl-long.3`; repo: `yafuly/MAGE`).
- **RAID: A Shared Benchmark for Robust Evaluation of Machine-Generated Text Detectors** (ACL 2024 long paper, ACL Anthology id `2024.acl-long.674`): robustness benchmark stressing adversarial, decoding, and unseen-generator shifts.
  - Takeaway for userscripts: detectors break under paraphrase/decoding shifts; prioritize features that are less sensitive to superficial edits and always cap certainty for short/low-evidence text.
- **EvoBench: Towards Real-world LLM-Generated Text Detection Benchmarking for Evolving Large Language Models** (Findings ACL 2025, DOI `10.18653/v1/2025.findings-acl.754`; repo: `happy-Moer/EvoBench`).
  - All 14 evaluated methods struggled as model families were updated, fine-tuned, or pruned. Release evaluation must hold out generators and versions—not only random examples.

## Social media, mixed authorship, and personalization
- **When Detection Fails: The Power of Fine-Tuned Models to Generate Human-Like Social Media Text** (Findings ACL 2025, DOI `10.18653/v1/2025.findings-acl.695`).
  - Detection dropped dramatically under the realistic condition that the attacker's fine-tuned generator was unavailable to detector developers.
- **DAMASHA: Detecting AI in Mixed Adversarial Texts via Segmentation with Human-interpretable Attribution** (Findings EACL 2026, DOI `10.18653/v1/2026.findings-eacl.326`).
  - Supports segment-level mixed-authorship UX and adversarial evaluation. Portable idea: score sufficiently long local segments and expose their disagreement rather than guessing “human-edited” from links or proper nouns.
- **When Personalization Tricks Detectors: The Feature-Inversion Trap in Machine-Generated Text Detection** (ACL 2026, DOI `10.18653/v1/2026.acl-long.1998`; repo: `mbzuai-nlp/Personalized_MGT_Detect`).
  - Features that separate general human/machine text can reverse direction for personalized generation. Portable requirement: include personalized and imitation-based holdouts before trusting a feature's coefficient.
- **Exploring the Limitations of Detecting Machine-Generated Text** (COLING 2025, ACL Anthology id `2025.coling-main.288`).
  - Detectors can degrade to random under style/complexity changes and particularly over-flag easy-to-read text. Report results by readability/style rather than only globally.

## False-positive control and calibration
- **Reliably Bounding False Positives: A Zero-Shot Machine-Generated Text Detection Framework via Multiscaled Conformal Prediction** (ACL 2025, DOI `10.18653/v1/2025.acl-long.601`).
  - Detection work often optimizes accuracy while underweighting societal harm from false positives. Portable requirement: reserve a human calibration set, choose the strong threshold from human scores, and state when sample size cannot resolve the requested FPR.
- **Identifying Bias in Machine-generated Text Detection** (ACL 2026, DOI `10.18653/v1/2026.acl-long.109`).
  - Evaluated 16 systems and found several cases where disadvantaged and ELL groups were disproportionately classified as machine-generated. Release reports must disaggregate relevant human slices and retain abstention.

## Lightweight fingerprints
- **Your Large Language Models Are Leaving Fingerprints** (GenAIDetect 2025, ACL Anthology id `2025.genaidetect-1.6`; arXiv `2405.14057`).
  - Character 3–5-grams, word 2–4-grams, and POS 2–4-grams can capture model-family fingerprints; character n-grams were especially strong in reported ablations.
  - Caveat: the study primarily used 300–500-word text and reports severe transfer drops to unrelated model families. This project implements optional hashed character 3–5-gram weights but abstains on short text and requires unseen-family testing.

## Explainable cue rubric review (2026-07-16 follow-up)
- **Simple models are all you need** (ALTA 2024, ACL Anthology id `2024.alta-1.19`) found that an ensemble of word-frequency, stylometric, readability, POS, and information-theoretic models reached 0.855 held-out accuracy on its shared task. Portable idea: combine independent evidence families instead of letting one continuous feature dominate.
- **Detection and Measurement of Syntactic Templates in Generated Text** (EMNLP 2024, DOI `10.18653/v1/2024.emnlp-main.368`) measures repeated POS templates, compression, template rate, and length-normalized templates per token. The authors explicitly do not claim that a template proves AI authorship. Portable approximation: expose repeated openings, short rhetorical runs, and repeated content phrasing as named cues, never proof.
- **MoSEs** (EMNLP 2025, DOI `10.18653/v1/2025.emnlp-main.294`) shows that text length, n-gram repetition, type-token ratio, probability moments, and semantic neighborhood affect the appropriate decision threshold. Portable idea: condition heuristic thresholds on text coverage instead of using one static cutoff for every post.
- **Show, Don't TELL** (arXiv `2605.27921`, 2026) argues that unexplained detector scores are poorly aligned with user needs and evaluates explanations for concreteness, falsifiability, coherence, plausibility, and grounding. Portable idea: show the exact cue family and observed trigger for every point.
- **Why AI-Generated Text Detection Fails** (arXiv `2603.23146`, 2026) finds that influential linguistic features change substantially across datasets and that length, formatting, and domain shift drive failures. Portable constraint: avoid presenting stable authorship probabilities from fixed surface features and preserve platform-specific evaluation requirements.
- **ExaGPT** (Findings ACL 2026, DOI `10.18653/v1/2026.findings-acl.380`) provides example-based span evidence. Not currently portable: it requires a labeled datastore and learned representations, which would add a large payload and new privacy/provenance obligations.
- **WaveDetect** (Findings ACL 2026, DOI `10.18653/v1/2026.findings-acl.424`) applies wavelets to token-probability signals. Not portable to a dependency-free userscript because it requires probability sequences from a language model.
- **NOTAI.AI** (arXiv `2603.05617`, 2026) combines Fast-DetectGPT curvature, ModernBERT, readability, stylometry, XGBoost, and SHAP. Its explanation-first ensemble is directionally useful, but its neural/curvature components require model inference and are not private in-tab heuristics.

Implemented from this review: independent weighted cue families, fixed length/sample classes, visible trigger-level explanations, no visible pseudo-probability, and explicit separation between exact cue count and sample size.

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
