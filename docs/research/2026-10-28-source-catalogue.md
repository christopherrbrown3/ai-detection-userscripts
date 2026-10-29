# Source catalogue: AI-text detection in a Safari userscript

Reviewed 28–29 October 2026; repository/provider availability snapshots are dated 28 October. Read with the [research report](2026-10-28-browser-ai-text-detection.md), which contains the applicability assessment, evidence limits, and prioritized shortlist.

The report cites more than 100 distinct primary-source URLs across papers, repositories, model cards, specifications, and runtime documentation. That URL count is not a count of independent studies. This catalogue groups related resources rather than duplicating every file URL.

## Review-depth key

- **A:** primary abstract/publication record reviewed; method summary limited to information established there.
- **M:** selected method/result/limitation passages reviewed in full-text PDF or HTML. This is not a claim to have reproduced the study or audited every result.
- **R:** author/maintainer README or model card reviewed.
- **C:** selected implementation code read, without execution or a complete code audit.
- **D:** official technical documentation/specification/provider announcement reviewed.
- **G:** repository metadata checked; this alone says nothing about implementation correctness.

Publication year below is the cited publication or initial preprint year, not necessarily the latest revision. “Preprint” indicates that this review did not establish a peer-reviewed venue for the cited version. Repository licenses and activity snapshots are in report §8; data/weight terms must be checked separately.

## Compact features and fingerprints

| Source | Status / depth | Research use |
| --- | --- | --- |
| [Your Large Language Models are Leaving Fingerprints](https://aclanthology.org/2025.genaidetect-1.6/) | GenAIDetect 2025; M | Learned lexical/grammatical fingerprints and transfer limits |
| [Simple models are all you need](https://aclanthology.org/2024.alta-1.19/) | ALTA 2024; M | Lightweight ensemble precedent |
| [Detection and Measurement of Syntactic Templates in Generated Text](https://aclanthology.org/2024.emnlp-main.368/) | EMNLP 2024; M | Structural characterization; explicit detection-claim boundary |
| [ZipPy](https://github.com/thinkst/zippy) | Maintainer implementation; R/C/G | Seeded compression, browser worker, score mapping |
| [LLMDet](https://arxiv.org/abs/2305.15004), [implementation](https://github.com/TrustedLLM/LLMDet) | EMNLP Findings 2023; A/R/G | Offline model-derived probability tables |
| [Every Model Leaves a Trace: Multi-Resolution LLM Fingerprinting](https://arxiv.org/abs/2610.28434) | Preprint, 20 October 2026; M | Attribution at several model/signal resolutions |
| [Delving into LLM-assisted writing in biomedical publications through excess vocabulary](https://arxiv.org/abs/2406.07016) | Science Advances 2025; A | Population-level lexical change, not individual attribution |
| [NEULIF: A Lightweight Approach to Detection of AI-Generated Texts Using Stylometric Features](https://arxiv.org/abs/2511.21744) | 2025 preprint, revised January 2026; A; checked 29 October | Compact CNN/random-forest precedent; no browser implementation verified |
| [AIDetection](https://arxiv.org/abs/2503.16503) | 2025 preprint; A; checked 29 October | Browser heuristics; source listed as available upon request |
| [LLMmap](https://www.usenix.org/conference/usenixsecurity25/presentation/pasquini) | USENIX Security 2025; A; checked 29 October | Active query fingerprinting, excluded from passive reading |
| [Scalable Fingerprinting of Large Language Models](https://papers.nips.cc/paper_files/paper/2025/hash/b5ee4715ef8e96176ef3ccbe229b6ab9-Abstract-Conference.html) | NeurIPS 2025; A; checked 29 October | Embedded model-ownership fingerprints |

## Model scoring, perturbation, and representation methods

| Source | Status / depth | Research use |
| --- | --- | --- |
| [GLTR](https://aclanthology.org/P19-3019/) | ACL demonstrations 2019; A | Token-statistic visualization |
| [DetectGPT](https://arxiv.org/abs/2301.11305) | ICML 2023; A | Perturbation-based probability curvature |
| [Fast-DetectGPT](https://arxiv.org/abs/2310.05130), [repository](https://github.com/baoguangsheng/fast-detect-gpt) | ICLR 2024; A/R/G | Conditional curvature and model requirements |
| [DetectLLM](https://arxiv.org/abs/2306.05540), [repository](https://github.com/mbzuai-nlp/DetectLLM) | 2023; A | Likelihood/rank and perturbation alternatives |
| [Binoculars](https://arxiv.org/abs/2401.12070), [repository](https://github.com/ahans30/Binoculars) | ICML 2024; A/R/C/G | Two-model statistic; actual formula and thresholds |
| [Ghostbuster](https://aclanthology.org/2024.naacl-long.95/), [repository](https://github.com/vivek3141/ghostbuster) | NAACL 2024; A | Learned combinations of weaker-model features |
| [DNA-GPT](https://arxiv.org/abs/2305.17359), [repository](https://github.com/Xianjun-Yang/DNA-GPT) | ICLR 2024; A | Regeneration-based evidence |
| [Glimpse](https://arxiv.org/abs/2412.11506), [repository](https://github.com/baoguangsheng/glimpse) | 2024 preprint record; A | Partial probability access |
| [Smaller Language Models are Better Zero-shot Machine-Generated Text Detectors](https://aclanthology.org/2024.eacl-short.25/) | EACL 2024; A | Small proxy model motivation |
| [StyleDecipher](https://arxiv.org/abs/2510.12608), [repository](https://github.com/SiyuanLi00/StyleDecipher) | 2025 preprint; A/G; existing project method notes also consulted | Rewrite/embedding comparison, distinct from repetition |
| [GECScore](https://arxiv.org/abs/2405.04286), [repository](https://github.com/junchaoIU/GECScore) | COLING 2025; A | Correction-induced differences |
| [TOCSIN](https://arxiv.org/abs/2409.16914), [repository](https://github.com/Shixuan-Ma/TOCSIN) | 2024 preprint record; A | Semantic-cohesion sensitivity |
| [ReMoDetect](https://hyunseoklee-ai.github.io/ReMoDetect/), [paper](https://openreview.net/pdf?id=pW9Jwim918) | NeurIPS 2024; M | Reward-model detection and training |
| [RADAR](https://arxiv.org/abs/2307.03838) | 2023 paper record; A | Adversarial paraphrase training |
| [Text Fluoroscopy](https://aclanthology.org/2024.emnlp-main.885/) | EMNLP 2024; A; existing project method notes also consulted | Intermediate-layer features; publication page links software/data |
| [PAWN](https://arxiv.org/abs/2501.03940) | 2025 preprint record, v3 reviewed; A | Learned weighting of token/model evidence |
| [PAWN++ in the Wild](https://aclanthology.org/2026.wac-1.25/) | WAC, October 2026; A | Web-rewrite evaluation; full PDF retrieval unsuccessful |
| [AIDER](https://aclanthology.org/2025.coling-main.625/) | COLING 2025; A | Topic-disentangled training |
| [DeTeCtive](https://arxiv.org/abs/2410.20964), [repository](https://github.com/heyongxin233/DeTeCtive) | 2024 preprint record; A/G | Contrastive representations and example retrieval |
| [WhosAI](https://arxiv.org/abs/2407.09364) | ECAI 2024; A | Contrastive attribution |
| [ExaGPT](https://arxiv.org/abs/2502.11336) | 2025 preprint; 2026 revision marked ACL Findings camera-ready; A | Similar-span explanations |
| [Intrinsic-dimension / PHD detector](https://arxiv.org/abs/2306.04723) | NeurIPS 2023; A and selected PDF passages | Embedding geometry; evidence-length requirements |
| [Human Texts Are Outliers](https://arxiv.org/abs/2510.08602) | NeurIPS 2025; A | One-class/open-world framing |
| [Meridian](https://aclanthology.org/2026.nlp4pi-1.27/) | NLP4PI, October 2026; A | Two complementary perplexity references |

## Mixed writing, provenance, and theory

| Source | Status / depth | Research use |
| --- | --- | --- |
| [Beyond Binary](https://arxiv.org/abs/2410.14259) | WWW 2025; A and author repository material | Different roles of AI assistance |
| [SeqXGPT](https://aclanthology.org/2023.emnlp-main.73/) | EMNLP 2023; A | Sequence-aware sentence detection |
| [DAMASHA](https://aclanthology.org/2026.findings-eacl.326/) | EACL Findings 2026; A | Mixed/adversarial span-oriented detection |
| [Frequent ChatGPT writers as human detectors](https://arxiv.org/abs/2501.15654) | ACL 2025; A | Human review under a particular study design |
| [A Watermark for Large Language Models](https://proceedings.mlr.press/v202/kirchenbauer23a.html), [implementation](https://github.com/jwkirchenbauer/lm-watermarking) | ICML 2023; A/G | Keyed statistical watermarking |
| [SynthID-Text](https://www.nature.com/articles/s41586-024-08025-4), [reference code](https://github.com/google-deepmind/synthid-text) | Nature 2024; A/R/G | Efficient verification and configuration dependence |
| [Robust Distortion-free Watermarks](https://arxiv.org/abs/2307.15593) | 2023 paper record; A | Keyed randomness/alignment family |
| [SemStamp](https://aclanthology.org/2024.naacl-long.226/) | NAACL 2024; A | Semantic watermarking |
| [SIR](https://arxiv.org/abs/2310.06356) | 2023 paper record; A | Semantic-invariant watermark design |
| [REMARK-LLM](https://arxiv.org/abs/2310.12362) | USENIX Security 2024; A | Learned watermark messages |
| [Waterfall](https://arxiv.org/abs/2407.04411), [repository](https://github.com/aoi3142/Waterfall) | EMNLP 2024; A | Post-hoc watermarking |
| [An Unforgeable Publicly Verifiable Watermark for Large Language Models](https://arxiv.org/abs/2307.16230) | Research paper record; A | Public verification as a design goal |
| [Undetectable Watermarks for Language Models](https://proceedings.mlr.press/v247/christ24a/christ24a.pdf) | COLT 2024; selected paper passages | Cryptographic detection assumptions |
| [MarkLLM](https://github.com/THU-BPM/MarkLLM) | Research toolkit; R/G | Offline watermark comparisons |
| [OpenAI textGrain announcement](https://openai.com/index/eu-text-provenance/) | 5 October 2026; D | Provider deployment/access claims |
| [Anthropic text watermark explanation](https://www.anthropic.com/news/claude-text-watermark) | 14 August 2026; D | Provider mechanism and private-preview access |
| [Google SynthID developer guide](https://ai.google.dev/responsible/docs/safeguards/synthid?hl=en) | Official documentation; D | Key/configuration and deployment distinctions |
| [C2PA specification 2.3](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification) | Specification; D, particularly §9.2.4 and Appendix A.7 | Signed unstructured-text representation and binding |
| [Paraphrasing evades detectors, retrieval defense](https://arxiv.org/abs/2303.13408) | NeurIPS 2023; A | Known-generation stores versus passive classification |
| [Keystroke-based detection insecurity](https://arxiv.org/abs/2601.17280) | 2026 preprint; A | Limits of process-based attribution |
| [Can AI-Generated Text Be Reliably Detected?](https://arxiv.org/abs/2303.11156) | Initial 2023 preprint, later TMLR version; A | Distributional limitations and attack evidence |
| [On the Possibilities of AI-Generated Text Detection](https://proceedings.mlr.press/v235/chakraborty24a.html) | ICML 2024; A | Sample/sequence length and distinguishability |

## Evaluation, generalization, and bias

| Source | Status / depth | Research use |
| --- | --- | --- |
| [MultiSocial](https://aclanthology.org/2025.acl-long.36/), [code](https://github.com/kinit-sk/multisocial), [data record](https://zenodo.org/records/13846152) | ACL 2025; A/R/G/D | Social platforms, languages, access restrictions |
| [RAID](https://aclanthology.org/2024.acl-long.674/) | ACL 2024; A | Generators, decoding, attacks |
| [MAGE](https://aclanthology.org/2024.acl-long.3/) | ACL 2024; A | Domain/generator transfer |
| [M4](https://aclanthology.org/2024.eacl-long.83/) | EACL 2024; A | Multilingual/multi-domain detection |
| [MULTITuDE](https://arxiv.org/abs/2310.13606) | 2023 paper; A | Multilingual benchmark |
| [HC3](https://arxiv.org/abs/2301.07597), [dataset card](https://huggingface.co/datasets/Hello-SimpleAI/HC3) | 2023; A/R | Matched QA and inherited license constraints |
| [DetectRL](https://arxiv.org/abs/2410.23746), [repository](https://github.com/NLP2CT/DetectRL) | 2024; A/G | Realistic conditions and transformations |
| [EvoBench](https://aclanthology.org/2025.findings-acl.754/) | ACL Findings 2025; A | Model evolution |
| [Beemo](https://arxiv.org/abs/2411.04032), [repository](https://github.com/Toloka/beemo) | NAACL 2025; A/R | Human/expert/model editing and mixed terms |
| [PADBen](https://arxiv.org/abs/2511.00416) | 2025 preprint record; A | Paraphrase evaluation |
| [RealDet and multiscaled conformal detection](https://aclanthology.org/2025.acl-long.601/) | ACL 2025; A | False-positive control |
| [SemEval-2024 Task 8](https://aclanthology.org/2024.semeval-1.279/), [repository](https://github.com/mbzuai-nlp/SemEval2024-task8) | SemEval 2024; A/R | Binary, attribution, and boundary tasks |
| [PAN 2026 overview](https://pan.webis.de/clef26/pan26-web/) | Official shared-task overview; D | Reproducible text-forensics tasks |
| [MGTBench](https://github.com/xinleihe/MGTBench) | CCS 2024 reference framework; R/G | Common detector baselines |
| [When Detection Fails: Fine-tuned Social Media Text](https://aclanthology.org/2025.findings-acl.695/) | ACL Findings 2025; A | Fine-tuned unseen generators |
| [When Personalization Tricks Detectors](https://aclanthology.org/2026.acl-long.1998/) | ACL 2026; A | Style imitation and feature inversion |
| [Practical Examination of AI-Generated Text Detectors](https://aclanthology.org/2025.findings-naacl.271/) | NAACL Findings 2025; A | Operational robustness and low-FPR behavior |
| [Exploring the Limitations of Detecting Machine-Generated Text](https://aclanthology.org/2025.coling-main.288/) | COLING 2025; A | Style/readability shortcuts |
| [GPT detectors are biased against non-native English writers](https://doi.org/10.1016/j.patter.2023.100779) | Patterns 2023; primary paper/abstract | Bias in the evaluated tools and samples |
| [Detecting ChatGPT-generated essays: Is there bias against non-native English writers?](https://doi.org/10.1016/j.compedu.2024.105070) | Computers & Education 2024; abstract/intro only | Contrasting controlled-essay evidence; full access limited |
| [I Know Myself Better, but Not Really Greatly](https://arxiv.org/abs/2502.12743) | 2025 preprint record; A | LLM self/cross judgment and explanations |
| [LLM-generated text detection survey](https://aclanthology.org/2025.cl-1.8/) | Computational Linguistics 2025; survey sections | Search taxonomy/background, not validation of project rules |

## Browser implementations and infrastructure

| Resource | Depth | What was established |
| --- | --- | --- |
| [Safari Userscripts release-4 documentation](https://github.com/quoid/userscripts/blob/release/4.x.x/README.md) | D | Injection context, grants, remote-resource behavior, CSP caveats |
| [winkNLP browser documentation](https://winkjs.org/wink-nlp/) | D | JavaScript/POS component with browser use |
| [fastText language identification](https://fasttext.cc/docs/en/language-identification.html) | D | Language-model size and separate model license |
| [Draftlight](https://github.com/cannotkenpute/ai-text-detector), [worker](https://github.com/cannotkenpute/ai-text-detector/blob/main/app/model.worker.ts) | R/C/G | Actual int8/WASM pipeline invocation; no Safari-userscript test |
| [ModernBERT ONNX conversion](https://huggingface.co/onnx-community/modernbert-ai-detection-raid-mage-ONNX) | R | Weight format, source model, training-dataset declarations |
| [Fakespot RoBERTa-base](https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1) | R | Weights, preprocessing, model-card terms |
| [Desklib detector](https://huggingface.co/desklib/ai-text-detector-v1.01) | R | Custom classifier architecture and model-card terms |
| [SuperAnnotate model](https://huggingface.co/SuperAnnotate/ai-detector), [service](https://github.com/superannotateai/generated_text_detector) | R/G | Different model and service-code licenses |
| [Deckard](https://github.com/sgoedecke/deckard) | R/G | Native helper requirement; excluded from solution |
| [AI Bouncer](https://github.com/krstp/ai-bouncer) | R/G | Surface-feature implementation claims and restrictive license |
| [Transformers.js custom usage](https://huggingface.co/docs/transformers.js/custom_usage) | D | Asset/runtime configuration |
| [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html), [performance guide](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html) | D | Backend and cross-origin-isolation constraints |
| [WebKit Safari 26.2 release article](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) | D | Safari 26 WebGPU chronology; not target-script validation |
| [WebLLM](https://webllm.mlc.ai/docs/) | D | Browser-generation runtime background |

## Evidence not established by this review

No paper result was independently reproduced. No listed neural model or third-party extension was run in Safari. No throughput, memory, precision, recall, or battery estimate in the report should be read as a project measurement. Raw weight-size and probability examples are explicitly labeled calculations.

The PAWN++ full PDF was unavailable to the browser tool; the published abstract supports the figures used. Some repository metadata did not identify a license. Provider access announcements do not establish access for this account. Public watermark code does not reveal private provider configurations. Documentation for a library's browser support does not establish compatibility inside the Safari Userscripts manager.

Searches also encountered commercial marketing, secondary paper summaries, derivative tutorials, and unverified detector demos. These were not used to substantiate accuracy claims. No service account was created, restricted dataset requested, detector installed, or page text uploaded for classification.
