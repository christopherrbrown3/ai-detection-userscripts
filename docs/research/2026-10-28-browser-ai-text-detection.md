# Additional ways to detect AI-generated text in a Safari userscript

Research conducted **28–29 October 2026**; repository/provider availability snapshots were checked on 28 October unless otherwise stated. Project baseline: **ai-detection-userscripts 0.8.0**, commit `98a1573de009b5fb27cda074ae719a6390236365`.

This is a research report, not an implementation or an accuracy evaluation. No detector was installed, trained, benchmarked, or deployed. Recommendations below are priorities for investigation, not claims that a technique will work on this project's feeds.

**Hard requirement, clarified during research: the detector must run inside a Safari userscript.** A separate extension implementation, native application, localhost service, or remote detection API does not satisfy that requirement. The recommended shortlist also preserves the current project's self-contained, no-text-upload design. Methods outside this boundary remain in the literature map for completeness and are explicitly excluded from the practical shortlist.

Companion: [annotated source catalogue and review notes](2026-10-28-source-catalogue.md).

Quick navigation: [Safari shortlist](#12-prioritized-research-agenda-under-the-safari-requirement) · [execution constraints](#9-the-actual-safari-userscript-boundary) · [method comparison](#3-browser-feasibility-map) · [implementations](#8-implementations-model-weights-and-reusable-components) · [datasets](#10-datasets-and-what-each-can-establish).

## 1. Findings that change the options

There are substantially more possibilities than phrase lists, punctuation, and sentence-length regularity. The most useful directions for this project are:

1. **Learned lexical and grammatical fingerprints.** Train compact classifiers on character, word, function-word, and part-of-speech patterns. These can retain local, inexpensive inference while learning relationships that an equal cue count cannot represent. The strongest starting points are the [GenAIDetect fingerprint study](https://aclanthology.org/2025.genaidetect-1.6/) and the [ALTA lightweight ensemble](https://aclanthology.org/2024.alta-1.19/).
2. **Corpus-seeded compression.** [ZipPy](https://github.com/thinkst/zippy) supplies an unusually concrete precedent: a compression detector and browser extension with JavaScript worker code. Its value is a different signal family and small implementation, not established accuracy on contemporary social posts.
3. **Compact learned models exported into JavaScript.** Offline training can produce linear coefficients, naive-Bayes tables, or small trees embedded in the existing `.user.js`. This avoids needing a neural runtime. Browser neural examples such as [Draftlight's worker](https://github.com/cannotkenpute/ai-text-detector/blob/main/app/model.worker.ts) are informative but are **not verified Safari-userscript solutions**.
4. **Model-probability fingerprints.** GLTR, DetectGPT, Fast-DetectGPT, Binoculars, and related methods offer richer evidence, at substantially greater inference cost. Some small-model variants are worth investigating; the standard two-7B-model Binoculars configuration is a poor fit for background feed scanning.
5. **Local provenance verification where available.** A compatible public watermark verifier or signed-text validator could operate locally. Provider-only detection APIs and private generation indexes are excluded from the userscript solution; they remain relevant background evidence.
6. **Mixed-authorship analysis and abstention.** A paragraph edited by an LLM is a different target from a wholly generated post. Identifying these distinctions and declining unsupported classifications may improve usefulness more than adding another surface cue.

The most consequential counterweight is recent web-specific evidence. In **PAWN++/WATTLE, October 2026**, strong results on an established benchmark did not carry over to realistic webpage rewrites. The authors report that none of eight evaluated systems detected more than **12% of frontier-model rewrites at a 1% false-positive rate**. This is one study, not a universal upper bound, but it directly challenges the assumption that high benchmark scores imply useful browser performance. The full PDF could not be retrieved during this review; these findings come from the published abstract. [PAWN++ in the Wild](https://aclanthology.org/2026.wac-1.25/)

## 2. Scope, evidence, and the current project

### How the review was conducted

The search covered academic proceedings and preprints, official research repositories, model cards, browser runtime documentation, provenance specifications, and provider announcements. Searches included stylometry, n-grams, compression, perplexity, curvature, perturbation, contrastive learning, authorship attribution, mixed text, watermarking, retrieval, multilingual bias, adversarial robustness, calibration, and browser inference. References from surveys and existing project notes supplied additional leads; technical conclusions use primary sources.

The depth of review varies. Selected papers received method-level inspection; others were assessed from their primary abstract and publication record. Several READMEs and selected implementation files were read, but no repository received a complete code or security audit. The source catalogue records these boundaries. Publication status, access, and implementation availability are stated as observed on the research date. This is a broad structured review, not a claim that every paper or commercial detector has been enumerated.

### What already exists here

The current implementation and documentation were inspected directly: [detector](../../src/detector.js), [runtime](../../src/runtime.js), [default models](../../models/default-models.json), [training documentation](../../training/README.md), [existing research audit](../research-grounding.md), and [earlier research notes](../../whitepapers/web_research.md).

| Existing capability | What it means for additional research |
| --- | --- |
| Six cue families: model references, stock framing, repeated openings, list/punctuation structure, similar sentence lengths, repeated phrases | Expanding phrase coverage is an incremental heuristic change, not a new detection methodology. |
| Exact family count displayed through the AI Score bars | The count is neither an authorship probability nor an estimate of the fraction generated. |
| Optional stylometric logistic diagnostics, including lexical diversity, variation, repetition, and 128 hashed character n-gram buckets | The architecture can host a learned lightweight detector, but the shipped default is hand-tuned and explicitly uncalibrated. |
| Offline grouped training, held-out sigmoid calibration, and human false-positive thresholds | Useful infrastructure already exists. Explicit unseen-generator, chronological, and platform holdouts still need their own split design. |
| Quote/code exclusion, language eligibility, sample-length descriptions, preserved line breaks, bounded scanning/caching | These are existing safeguards. Old refusal/job-title and line-break observations should not be presented as newly discovered defects. |
| Self-contained Safari userscript; no runtime model download or text upload | Pure JavaScript features fit directly. Neural models require a deliberate architecture change. |

Several relevant papers are already in the project notes, including Fluoroscopy, StyleDecipher, Syntactic Templates, the lightweight ensemble, fingerprints, MultiSocial, and EvoBench. Their appearance here does not imply they are new discoveries. The additional work is the broader method map, concrete implementation inspection, newer evidence, provenance options, and a comparison of browser requirements.

### Four different questions

| Question | Appropriate evidence | What a positive result does not establish |
| --- | --- | --- |
| Does this resemble generated text? | A statistically validated content classifier | The actual author or production history |
| Which known model produced it? | Attribution among candidate models | That the true source belongs to the candidate set |
| Does it contain a particular watermark? | Matching detector configuration/key and statistical test | How much human work contributed, or who used the model |
| Is there a verifiable creation/editing record? | Signed, content-bound provenance or an authenticated source record | That the content is true or that the record is complete |

These outputs should remain separate. A copied model disclaimer is observable wording. A watermark test is a different kind of evidence. Neither is a valid reason to convert the present six-bar score into a percentage.

## 3. Browser feasibility map

The tiers below are engineering assessments for this project, not measured performance:

- **A — primary userscript candidates:** JavaScript features plus bundled weights, dictionaries, or small corpus statistics; no neural inference. Portability is an engineering judgment, not a completed Safari test.
- **B — conditional userscript research:** neural inference or larger assets. Requires proof inside the actual Safari Userscripts execution context and target sites; a normal webpage demo does not qualify.
- **C — excluded reference implementations:** heavy multi-model or native-helper pipelines. A substantially different compact implementation would need separate evaluation.
- **D — evidence availability constraint:** keys, signatures, APIs, or indexes. Local verification may qualify; external detection services and inaccessible private keys do not.

| Family / examples | Evidence required | Likely tier | Main limitation |
| --- | --- | --- | --- |
| Character/word n-gram classifier | Labeled training corpus; compact fitted weights | A | Learns topic and platform shortcuts unless controlled |
| Function-word, POS, Burrows' Delta ensemble | Reference distributions; POS tagger for POS features | A/B | Tagging and genre effects on short informal text |
| Seeded compression / ZipPy | Reference text or dictionaries and compressor | A | Seed, length, topic, and compressor sensitivity |
| LLMDet probability dictionaries | Offline model-derived n-gram probability tables | A/B | Coverage and table size; model/version dependence |
| RoBERTa, ModernBERT, ALBERT classifiers | Tokenizer, encoder weights, classification head | B | Training-distribution dependence; download and memory |
| Fluoroscopy / representation features | Encoder activations plus trained head | B | Hidden-state export and pooling parity |
| GLTR / likelihood / rank | Causal LM scoring of supplied text | B/C | Proxy mismatch; low perplexity is not exclusive to AI |
| DetectLLM | Log likelihood/rank, sometimes perturbations | B/C | Full scoring access and additional passes |
| Fast-DetectGPT | Conditional token distributions | B/C | Still requires model inference |
| Binoculars | Two compatible causal LMs | C in reference configuration | Two model footprints; thresholds tied to configuration |
| DetectGPT | Scoring model plus repeated perturbations | C | Repeated inference and perturbation quality |
| DNA-GPT | Regenerated continuations | C/D | Access to a suitable generator and multiple samples |
| StyleDecipher / GECScore | Rewriting or correction plus comparison | C/D | Editing style, language, cost, and scorer dependence |
| TOCSIN | Token-deletion variants and semantic scoring | B/C | Semantic scoring is itself model-dependent |
| PAWN / PAWN++ | Frozen LM outputs and learned aggregation | B/C | Small head does not imply a small complete system |
| Contrastive/retrieval classifier | Encoder and labeled reference embeddings | B/C | Similarity to a training example is not provenance |
| Intrinsic-dimension methods | Token embeddings and geometric estimation | B/C | Evidence length and computation |
| Change-point / mixed-text models | Contextual token/sentence scores and sequence model | B/C | Unreliable very short segments; changing topics confound |
| Statistical watermark verification | Correct tokenizer, key/configuration, sufficient text | A/B/D | Unmarked text and edited text may be undetectable |
| Signed text credentials | Manifest, signature, issuer trust, content binding | A/B/D | Limited availability; extraction can lose provenance |
| Generation-index retrieval | Access to authenticated stored generations | D | Index coverage and privacy constraints |
| Writing-process evidence | Opt-in author-side editing history | D / separate product | Unavailable to a passive reader; can be spoofed |

## 4. Compact methods and stylistic fingerprints

### 4.1 Learned character, word, and POS n-grams

The fingerprint study trains on distributions of short character sequences, words, and part-of-speech sequences. This is more expressive than searching a fixed list of phrases. Its transfer results support investigating learned style patterns, while weaker transfer between unrelated model families argues against treating a discovered fingerprint as permanent. [McGovern et al., GenAIDetect 2025](https://aclanthology.org/2025.genaidetect-1.6/)

**Project-specific experiment:** compare a regularized linear model, naive Bayes, and a small tree ensemble using the same frozen splits. Evaluate character features, word features, function words, and POS separately before combining them. Compare the existing 128-bucket hash with larger hashes or a pruned vocabulary; fewer collisions may help, but that is an untested hypothesis. Include an ablation that masks names, URLs, numbers, and topic-bearing nouns. A substantial collapse after masking would suggest topic shortcuts.

Character features offer simple browser extraction and can capture spelling, punctuation, and affixes. Word features are easier to explain but more exposed to topic leakage. POS patterns can abstract away vocabulary but require a real tagger; replacing nouns with guessed regex categories would not reproduce the published method.

### 4.2 Classical stylometric ensembles

The ALTA 2024 system combines complementary lightweight models using word frequencies, stylometry, POS, readability, and information-theoretic features. It achieved 0.855 accuracy on its held-out hybrid sentence task. That is evidence for a candidate architecture in that task, not a LinkedIn accuracy estimate. [Thomas, Hoang, and Mitchell](https://aclanthology.org/2024.alta-1.19/)

Useful feature families to evaluate include function-word frequencies, contractions, pronoun distributions, punctuation transitions, lexical diversity at several window lengths, sentence-length distributions, and standardized reference-word frequencies such as Burrows' Delta. Many are correlated. An ensemble should learn their joint behavior, rather than count each as independent confirmation.

**New experiment:** condition reference distributions on platform, length, and genre, then test whether the residual style features improve low-false-positive recall. Compare against a simpler pooled classifier to check whether the additional conditioning genuinely generalizes.

### 4.3 Syntactic templates and discourse structure

Syntactic-template research measures repeated grammatical patterns and style inherited from pretraining. Crucially, the authors explicitly distinguish characterization from reliable AI detection. Repeated openings in this userscript do not implement their POS-template measurements. [Shaib et al., EMNLP 2024](https://aclanthology.org/2024.emnlp-main.368/)

Possible experiments include POS-sequence diversity, clause-pattern repetition, transitions between discourse functions, parallel paragraph structure, and repeated argument outlines. These need annotated or model-derived structure and human controls such as speeches, instructions, marketing templates, and accessibility-oriented plain language. A polished three-part argument or a repeated grammatical pattern should remain a feature candidate, not a verdict.

### 4.4 Compression and minimum-description-length ideas

ZipPy compares compressibility relative to a corpus-derived prelude. Its repository includes JavaScript compiled from Nim, an LZMA worker, and an extension that processes page paragraphs. Selected source inspection confirms local compression and a heuristic mapping of scores to opacity; it does not establish calibrated authorship confidence. [ZipPy repository](https://github.com/thinkst/zippy), [worker](https://github.com/thinkst/zippy/blob/main/inch/scripts/nch-worker.js), [detector code](https://github.com/thinkst/zippy/blob/main/inch/scripts/nlzmadetect.js)

**Research extension:** compare normalized incremental compression against both matched human and generated reference corpora:

`feature(x) = [C(H || x) - C(H)] / bytes(x) - [C(A || x) - C(A)] / bytes(x)`

Here `C` is compressed byte length, `H` a human reference, and `A` an AI reference. This is a proposed comparative feature, not a reproduced ZipPy formula or a validated detector. Seed order, dictionary windows, delimiters, encoding, and compressor headers need controls. Rotate seeds and hold out topics to avoid simply recognizing shared vocabulary. Compare against TF-IDF: compression is only worthwhile if it adds useful information at an acceptable cost.

Raw gzip size, repeated letters, or word-frequency entropy alone are not neural perplexity. Very short strings are especially vulnerable to fixed compressor overhead.

### 4.5 Probability dictionaries without the full model

LLMDet performs offline construction of n-gram probability dictionaries, uses them to estimate proxy perplexity, and trains a classifier on those estimates. Detection does not require running each source LLM. This creates an intermediate option between pure stylometry and full neural scoring. [LLMDet paper](https://arxiv.org/abs/2305.15004), [official implementation](https://github.com/TrustedLLM/LLMDet)

A browser port would need compatible tokenization, compact tables, coverage statistics, and explicit behavior for unknown contexts. Its reference model list is older; updating tables is part of the research cost. Table-derived proxy perplexity must not be described as the actual likelihood of a modern closed model. Candidate-model probabilities also do not solve open-set attribution.

### 4.6 Fine-grained model fingerprints

An October 20, 2026 preprint examines model identity across families, distillation, and LoRA adaptations, with progressively reduced surface cues, paraphrasing, and language changes. It finds recoverable signals at several resolutions, with evidence volume and model similarity affecting attribution. This is recent preliminary evidence, not proof that every model can be identified from a short post. [Every Model Leaves a Trace](https://arxiv.org/abs/2610.28434)

For browser research, compare lexical, grammatical, and embedding fingerprints, and permit **unknown source**. A classifier forced to choose among five models will always name one even when the input is human or produced by a sixth. Testing that rejection behavior matters more than adding more confident-looking model labels.

### 4.7 Aggregate vocabulary shifts

Excess-vocabulary analysis detects changes in large populations of writing over time. Kobak and colleagues study biomedical abstracts and estimate aggregate LLM involvement from shifts in style-word frequencies. This is useful for corpus monitoring, but assigning the population estimate to individual articles would be an ecological error. [Science Advances study / author preprint](https://arxiv.org/abs/2406.07016)

A separately scoped research tool could compare large, permissioned samples from a stable source over time, with controls for changing topics and editorial style. This does not justify an individual browser badge triggered by a word such as “delve.”

### 4.8 Additional lightweight precedents

**NEULIF** trains a CNN or random forest on stylometric/readability features. Its revised preprint reports approximately 25 MB and 10.6 MB model artifacts respectively, evaluated on a Kaggle human/AI corpus. Those are author-reported serialized model sizes, not Safari memory measurements. A tree model is a plausible JavaScript export target, but its feature pipeline, pruning, and low-FPR transfer require examination before adoption. The primary abstract was reviewed; model code and a browser port were not established. [A Lightweight Approach to Detection of AI-Generated Texts Using Stylometric Features](https://arxiv.org/abs/2511.21744)

**AIDetection** describes a JavaScript browser application based on syntactic artifacts, citations, and acknowledgments. It is a useful example of how inexpensive cues can be exposed to readers, but the abstract does not establish calibrated reliability. The paper record says source code is available upon request, so it should not be treated as an immediately reusable open-source library. Its heuristic category largely overlaps this project's existing approach. [AIDetection, 2025 preprint](https://arxiv.org/abs/2503.16503)

### 4.9 Active model fingerprinting is not passive text detection

Some strong fingerprinting results answer a different question. **LLMmap** actively sends selected queries to an LLM application and identifies models from their responses. Its reported model-identification results do not imply the ability to identify the source of arbitrary text already published in a feed. The method requires access to the model/application being probed. [LLMmap, USENIX Security 2025](https://www.usenix.org/conference/usenixsecurity25/presentation/pasquini)

Similarly, **Scalable Fingerprinting of Large Language Models** embeds fingerprints into a model for later ownership verification through API access. This is neither a naturally occurring writing-style signature nor a universal watermark in every generated passage. These methods belong in the literature map but are excluded from the passive Safari-userscript shortlist. [NeurIPS 2025 paper](https://papers.nips.cc/paper_files/paper/2025/hash/b5ee4715ef8e96176ef3ccbe229b6ab9-Abstract-Conference.html)

## 5. Neural, probability, and perturbation methods

These methods are included to make the research comprehensive. **None is established here as working inside the target Safari userscript.** Their ideas may inform offline training or a much smaller exported detector even when the reference implementation is unsuitable.

### 5.1 Token probability and rank

For a causal language model, a useful basic quantity is the mean negative log probability of the observed tokens given their preceding context. Exponentiating it produces perplexity. Token rank, full-distribution entropy, and variation across positions are related but distinct measurements. Sentence-length variation and character entropy are not substitutes for these quantities.

| Method | Mechanism and evidence | Implication for this userscript |
| --- | --- | --- |
| [GLTR, ACL 2019](https://aclanthology.org/P19-3019/) | Visualizes token likelihood/rank statistics to assist human inspection. Its user study concerns its own experimental conditions and older generators. | A useful explanation design if genuine model scores are available. Coloring guessed “AI words” would not reproduce GLTR. |
| [DetectLLM, 2023](https://arxiv.org/abs/2306.05540) | Likelihood–log-rank ratio (LRR) and normalized perturbed log-rank (NPR). NPR needs additional perturbed samples. | LRR is simpler than repeated-generation methods, but still needs model scoring and vocabulary ranks. |
| [DetectGPT, ICML 2023](https://arxiv.org/abs/2301.11305) | Compares original likelihood with likelihoods of perturbed versions, using a probability-curvature hypothesis. | A scoring model plus perturbation generation is too costly for the present scanning path. Useful as an offline comparator. |
| [Fast-DetectGPT, ICLR 2024](https://arxiv.org/abs/2310.05130) | Conditional probability curvature avoids the original method's costly text-perturbation loop. | “Fast” is relative to DetectGPT, not proof of Safari feed suitability. Requires the needed token distributions. |
| [Binoculars, ICML 2024](https://arxiv.org/abs/2401.12070) | Compares observed-text surprise with cross-entropy between two related models. | Reference configuration uses Falcon-7B and Falcon-7B-Instruct; exclude from the practical userscript shortlist. |
| [Ghostbuster, NAACL 2024](https://aclanthology.org/2024.naacl-long.95/) | Searches combinations of probability-derived features from weaker models and fits a classifier. | Does not need access to the generating model, but still needs weaker-model inference. An offline feature-selection precedent. |
| [Glimpse, 2024](https://arxiv.org/abs/2412.11506) | Approximates fuller token distributions from restricted API log probabilities. | A remote API solution fails the local-execution requirement. Relevant only as background on partial scoring access. |
| [Smaller Language Models Are Better Zero-shot Detectors, EACL 2024](https://aclanthology.org/2024.eacl-short.25/) | Examines cases where smaller proxy models outperform larger ones. | Supports testing small proxies rather than assuming bigger is better. It does not establish acceptable userscript cost or current-post accuracy. |

Selected [Binoculars source](https://github.com/ahans30/Binoculars/blob/main/binoculars/metrics.py) shows that its function named `perplexity` returns mean token cross-entropy without exponentiating; the detector divides that by its two-model cross-entropy statistic. A port must reproduce the actual score definition, masking, tokenizer, precision, and threshold calibration. Replacing it with a ratio of arbitrary perplexity tools would be a different detector. [Detector implementation](https://github.com/ahans30/Binoculars/blob/main/binoculars/detector.py)

For every probability method, verify that a runtime can score **supplied text**, not merely generate a continuation and return probabilities for its own output. Full-vocabulary logits, observed-token likelihoods, and top-k probabilities are different API capabilities. A browser chat demo alone establishes none of those detection prerequisites.

### 5.2 Perturbation, rewriting, and alignment signatures

| Method | What it tests | Main limitation for this task |
| --- | --- | --- |
| [DNA-GPT, ICLR 2024](https://arxiv.org/abs/2305.17359) | Regenerates continuations from a truncated prefix and compares them with the original continuation, using overlap or probability information. | Repeated generation; sensitivity to the selected model, context, and sampling. |
| [StyleDecipher, 2025 preprint](https://arxiv.org/abs/2510.12608) | Compares original and model-rewritten text through overlap/edit-distance and embedding-based style features. | Requires actual rewriting and embeddings. Within-post repetition is a different measurement. |
| [GECScore, COLING 2025](https://arxiv.org/abs/2405.04286) | Uses changes under grammatical correction as a detection signal. | Correct human prose, edited writing, informal style, and language background need explicit controls. A grammar checker is not an authorship oracle. |
| [TOCSIN, 2024](https://arxiv.org/abs/2409.16914) | Uses sensitivity of semantic cohesion to random token deletion as an auxiliary signal. | Semantic comparison requires a model; token deletion counts alone are not a replication. |
| [ReMoDetect, NeurIPS 2024](https://hyunseoklee-ai.github.io/ReMoDetect/) | Uses reward-model preferences and training with generated and partially rewritten text to detect aligned-model outputs. | Heavy model dependence and alignment-specific assumptions. Potential offline teacher, not a present userscript implementation. |
| [RADAR, 2023](https://arxiv.org/abs/2307.03838) | Adversarial training with a paraphraser and detector to improve robustness. | A training strategy rather than a free runtime feature. Robustness remains bounded by the tested attacks and generators. |

**Possible transfer into a small script:** train a compact student on multiple richer teachers' scores, along with real provenance labels. Ship only the student. This is a research hypothesis: the student may lose exactly the semantic information that made the teachers useful, or inherit their biases. It must beat the same student trained on labels alone on untouched generators and realistic rewrites.

### 5.3 Supervised encoders and representation geometry

| Approach | What it contributes | Qualification |
| --- | --- | --- |
| Fine-tuned RoBERTa / DeBERTa / ModernBERT | Learns distributed textual features rather than a hand-written cue list. Public weight candidates are inventoried below. | Classification scores need deployment calibration. Export support and Safari userscript execution must be demonstrated separately. |
| [Text Fluoroscopy, EMNLP 2024](https://aclanthology.org/2024.emnlp-main.885/) | Uses intermediate encoder-layer representations for detection. | Requires the encoder and selected internal activations; not evidence that simple visible style cues are sufficient. |
| [PAWN, 2025](https://arxiv.org/abs/2501.03940) | Learns position-sensitive aggregation of frozen-model information. | A small trainable head leaves the backbone inference cost intact. |
| [PAWN++, WAC 2026](https://aclanthology.org/2026.wac-1.25/) | Learns which likelihood signals from two frozen models are useful. | Its web-rewrite evaluation is especially relevant; a compact head does not make it a compact complete userscript. |
| [AIDER, COLING 2025](https://aclanthology.org/2025.coling-main.625/) | Disentangles topic information through contrastive/augmentation-based training. | Useful for testing topic leakage. The learned representation still requires its encoder. |
| [DeTeCtive, 2024](https://arxiv.org/abs/2410.20964) | Contrastive writing-style representations and retrieval against a labeled datastore. | Adding reference embeddings is not the same as having an authenticated index of generated outputs. |
| [WhosAI, 2024](https://arxiv.org/abs/2407.09364) | Contrastive embeddings for detection and model attribution. | Candidate-source attribution is not open-world proof; news-domain evidence does not establish social-post behavior. |
| [ExaGPT, 2025 preprint; revised for ACL Findings 2026](https://arxiv.org/abs/2502.11336) | Uses example-based evidence from similar human/generated spans. | Explanations should distinguish retrieved similarity from verified origin. |
| [Intrinsic Dimension / PHD, NeurIPS 2023](https://arxiv.org/abs/2306.04723) | Measures geometry of contextual token embeddings using persistent-homology ideas. | Needs embeddings and enough text; unsuitable to assume reliable on short comments. |
| [Human Texts Are Outliers, NeurIPS 2025](https://arxiv.org/abs/2510.08602) | Studies one-class detection centered on the generated-text distribution. | Motivates open-set approaches; an outlier can also be an unfamiliar generator, language, or topic. |
| [Meridian, NLP4PI 2026](https://aclanthology.org/2026.nlp4pi-1.27/) | Combines DistilGPT2 and a character LSTM in a two-dimensional perplexity architecture. | Interesting small-model alternative, but its 1,590-text evaluation is not broad browser validation. |

The main research lesson is that **how a model is trained may matter as much as its architecture**: matched topics, adversarial examples, multiple generators, held-out families, and open-set rejection can be investigated with compact classifiers too. They do not guarantee success, and a larger backbone does not fix mislabeled or leaking data.

## 6. Mixed authorship, local changes, and human review

Binary detection compresses several different workflows into one label: human drafting followed by polishing, model drafting followed by substantial revision, autocomplete, translation, and fully generated content. [Beyond Binary, WWW 2025](https://arxiv.org/abs/2410.14259) explicitly studies different roles and levels of LLM involvement. It does not provide a universal conversion from a detector score to “percent AI.”

[SeqXGPT, EMNLP 2023](https://aclanthology.org/2023.emnlp-main.73/) models sequences of probability information for sentence-level detection. [SemEval-2024 Task 8](https://aclanthology.org/2024.semeval-1.279/) includes human-to-machine boundary detection. [DAMASHA, Findings EACL 2026](https://aclanthology.org/2026.findings-eacl.326/) examines mixed and adversarial text with interpretable span-oriented evidence. These methods motivate evaluating localization, but they do not validate running an arbitrary document classifier on every individual sentence.

**Userscript-compatible experiment:** a small sequence model or smoothed change-point calculation over compact style features could fit in JavaScript. Require enough context on both sides of a boundary, preserve quoted and code spans, and evaluate at document level as well as span level. Topic changes, quotations, lists, multiple human authors, and abrupt platform truncation are necessary negative controls. “Style changes here” is the defensible direct observation; AI involvement is a separate inference.

Do not take the maximum of dozens of window scores and compare it with a whole-document threshold. That changes the false-positive rate. Do not average sentence probabilities into an estimated fraction authored by AI without a separately validated mixture model.

Human review can add information. A 2025 study found strong performance by frequent LLM users on a particular set of 300 English nonfiction articles, especially when combining judgments. That is encouraging for inspection tools, but does not establish the same result for short feeds, every reader, or future generators. [Russell, Karpinska, and Iyyer](https://arxiv.org/abs/2501.15654)

An explanation interface should expose measurements and uncertainty. Highlighting a matched phrase explains a phrase rule. Highlighting tokens with large model contributions explains that model's behavior. Neither explains the actual historical process that produced the text.

## 7. Watermarks, signed provenance, and contextual evidence

### 7.1 Statistical watermarking

Unlike post-hoc classification, watermarking intentionally changes generation so that a verifier can test for a pattern. Detection can be cheap even when generation was expensive. Availability of a reference implementation does not provide the private keys used by commercial providers.

| Scheme | Main idea | Local Safari-userscript relevance |
| --- | --- | --- |
| [Kirchenbauer et al., ICML 2023](https://proceedings.mlr.press/v202/kirchenbauer23a.html) | Keyed token preferences create a detectable statistical bias. | Potentially compact verifier when the exact tokenizer, key, and scheme are available. Short/constrained text limits power. |
| [SynthID-Text, Nature 2024](https://www.nature.com/articles/s41586-024-08025-4) | Statistical sampling scheme with efficient verification and evaluated generation quality. | Detection can avoid running the generator. Must match the generation configuration. |
| [Distortion-free watermarks, 2023](https://arxiv.org/abs/2307.15593) | Keyed randomness and alignment-based tests while preserving a generation distribution under stated conditions. | A different verifier family; robustness claims are conditional, not immunity to arbitrary editing. |
| [SemStamp, NAACL 2024](https://aclanthology.org/2024.naacl-long.226/) | Watermarks sentence-level semantic regions through sampling. | Requires semantic representations and matching configuration, increasing browser cost. |
| [SIR, 2023](https://arxiv.org/abs/2310.06356) | Uses semantic invariance to improve watermark robustness. | Useful research on paraphrase resistance; not a general unkeyed detector. |
| [REMARK-LLM, USENIX Security 2024](https://arxiv.org/abs/2310.12362) | Learned embedding and recovery of watermark messages. | Additional neural components; not automatically a lightweight JavaScript verifier. |
| [Waterfall, EMNLP 2024](https://arxiv.org/abs/2407.04411) | Post-hoc watermarking through rewriting. | Human-origin text can acquire a watermark through processing; watermark presence does not mean wholly machine-authored. |
| [Publicly verifiable watermark research](https://arxiv.org/abs/2307.16230) | Studies verification without sharing a secret embedding key, with cryptographic protections. | Especially relevant to eventual client verification, but not evidence of support across existing models. |
| [Undetectable Watermarks, COLT 2024](https://proceedings.mlr.press/v247/christ24a/christ24a.pdf) | Cryptographic theory of signals hidden from parties lacking the necessary secret. | “Undetectable” to outsiders does not mean undetectable by an authorized verifier. |

The current [SynthID reference repository](https://github.com/google-deepmind/synthid-text) includes frequentist and Bayesian detection paths. The documented configuration includes keys and tokenizer/context-related parameters. It explicitly distinguishes a reference implementation from a production system. A demo key will not detect arbitrary Gemini or Claude output. [MarkLLM](https://github.com/THU-BPM/MarkLLM) is useful for comparing watermark algorithms offline, not a universal browser verification service.

### 7.2 Provider status on the research date

| Provider | Verified public statement | Consequence here |
| --- | --- | --- |
| OpenAI | The October 5, 2026 announcement describes textGrain, opt-in watermarking for selected API models, a phased eligible EU ChatGPT/Codex rollout, and detector applications initially limited to approved researchers and expert organizations. Open sourcing is described as planned. [Announcement](https://openai.com/index/eu-text-provenance/) | Do not claim a public local detector exists or that every OpenAI output is marked. This is not an available general Safari-userscript backend. |
| Anthropic | Its August 14, 2026 explanation describes SynthID-based statistical text watermarking and a detection API in private preview for eligible organizations. It says the watermark adds no hidden characters. [Provider explanation](https://www.anthropic.com/news/claude-text-watermark) | Restricted API access and private configuration exclude generic local verification today. Model processing does not establish sole authorship. |
| Google | Official material supplies the SynthID research implementation and explains deployment/configuration choices. [Developer guide](https://ai.google.dev/responsible/docs/safeguards/synthid?hl=en) | Open algorithm code is useful; access to a compatible verifier for a particular provider's output is a separate question. |

These are provider statements about their systems, not independent performance replications or a legal analysis. Positive statistical detection still needs an appropriate null model; missing marks do not imply human authorship. Scanning many keys and overlapping windows requires adjustment for multiple testing.

### 7.3 C2PA can apply to unstructured text

The reviewed **C2PA 2.3** specification defines an unstructured-text manifest wrapper encoded with Unicode variation selectors. Validation includes parsing, content binding, signatures, and issuer trust; finding unusual Unicode characters is insufficient. Its text-hash rules use specified normalization and exclusions. [Specification, §9.2.4 and Appendix A.7](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification)

**Userscript research opportunity:** preserve a raw-text branch before ordinary cue normalization, detect supported manifest structure, and invoke a compatible local validator. Report verified provenance separately from statistical style. No actual supported-site credentials or Safari-compatible text validator were demonstrated in this review. Normalization, copied fragments, and DOM reconstruction may prevent verification. An absent or invalid credential is not evidence of AI authorship.

### 7.4 Retrieval and browser-visible artifacts

Retrieval against a known generation store can survive some paraphrasing better than passive classification. The relevant research assumes access to a substantial store of model outputs. An arbitrary web search is not equivalent, and a nearest-neighbor stylistic match is not an authenticated match. A private store or remote search service is outside the required local userscript solution. [Krishna et al., NeurIPS 2023](https://arxiv.org/abs/2303.13408)

Observable self-disclosure, retained chat citation syntax, copied role delimiters, and renderer artifacts can be recorded as **workflow clues**. Humans can quote or recreate them; platforms can transform them; models can omit them. A CSS class or an unsigned `data-ai` attribute is a claim by the page, not a trustworthy origin certificate. Page extraction should not merge replies, author names, menus, and article text into one supposedly authored sample.

### 7.5 Writing-process signals are a separate problem

Keystroke timing, paste events, revision history, and editor interaction are generally unavailable when reading an already-published post. Author-side collection would require a different product and appropriate consent. A recent preprint also questions the security of keystroke-based authorship detection under simulated typing and related attacks. [On the Insecurity of Keystroke-Based AI Authorship Detection, 2026](https://arxiv.org/abs/2601.17280)

The current task should not expand into keyboard monitoring or author profiling. Reading a webpage cannot recover a trustworthy composition history that was never attached to it.

## 8. Implementations, model weights, and reusable components

Repository status was checked on 2026-10-28. A recent push is not evidence of maintenance quality or accuracy. Licenses below describe the inspected code or model card, not every dependency or training dataset. **Publicly readable code, open-source code, and redistributable weights are separate properties.** “Unspecified” means this review did not establish the license; it does not mean unrestricted use.

### 8.1 Most relevant to a Safari userscript

| Resource | Inspected evidence | License / status | Practical conclusion |
| --- | --- | --- | --- |
| [ZipPy](https://github.com/thinkst/zippy) | README, extension directory, worker, selected detector source | MIT; last push 2025-02-27; not archived | Reuse the compression idea/core after review. Its Chrome extension shell is not a Safari userscript. |
| [winkNLP](https://winkjs.org/wink-nlp/) | Official browser documentation | MIT library; verify selected model terms separately | Browser-capable tokenization/POS component. Bundle locally; measure incremental value before adding its model. |
| [LLMDet](https://github.com/TrustedLLM/LLMDet) | README and repository metadata | MIT; last push 2024-05-27 | Offline probability dictionaries are interesting, but table size and tokenizer parity determine userscript practicality. |
| [AI Bouncer](https://github.com/krstp/ai-bouncer) | README and metadata | PolyForm Noncommercial 1.0.0 in README; last push 2026-10-24 | Inspect as an example of length-conditioned surface scoring. It is source-available with restrictions, not an unrestricted dependency. |
| [fastText language identification](https://fasttext.cc/docs/en/language-identification.html) | Official model documentation | Model CC-BY-SA 3.0; compressed model listed as 917 kB | Language routing reference, not an AI detector. The `.ftz` model needs a compatible evaluator; it is not drop-in JavaScript. |
| Existing `training/` and `models/` | Local code and documentation | Already part of this project | Most direct path: train and validate compact features offline, then export parameters. |

AI Bouncer's README describes six grouped signals and length-conditioned Gaussian likelihood calculations. The statistical form does not establish calibrated probabilities: estimated densities, dependence between groups, priors, and sample representativeness still matter. Its claims are implementation-author claims, not independent validation. This is a useful caution against replacing an honest cue count with an unjustified sigmoid percentage.

### 8.2 Browser-neural precedents: conditional, not qualified solutions

| Resource | What was verified | License / distinction | Safari userscript disposition |
| --- | --- | --- | --- |
| [Draftlight](https://github.com/cannotkenpute/ai-text-detector) | Worker loads `onnx-community/modernbert-ai-detection-raid-mage-ONNX`, requests int8/WASM, enables remote model loading and browser cache, and processes passages sequentially | MIT application; last push 2026-09-01 | Concrete browser code, but not a tested Safari userscript. Its model-loading design differs from this project. |
| [ModernBERT ONNX weights](https://huggingface.co/onnx-community/modernbert-ai-detection-raid-mage-ONNX) | Model card identifies an automatic ONNX conversion and MAGE/RAID training | Apache-2.0 model-card declaration | Candidate for a separate compatibility experiment, not evidence of export parity or feed accuracy. |
| [Fakespot RoBERTa-base detector](https://huggingface.co/fakespot-ai/roberta-base-ai-text-detection-v1) | Model card and prescribed preprocessing | Apache-2.0 model-card declaration | Open weights are available. Preserve preprocessing and validate a browser export; its score is not a fraction of generated text. |
| [Desklib detector](https://huggingface.co/desklib/ai-text-detector-v1.01) | Model card with a custom DeBERTa-based classifier | MIT model-card declaration; repository metadata did not establish a separate code license | Larger model with custom pooling/head; not a ready lightweight userscript. |
| [SuperAnnotate detector](https://huggingface.co/SuperAnnotate/ai-detector) | Model card; [serving repository](https://github.com/superannotateai/generated_text_detector) metadata | Model uses custom SAIPL terms; serving code Apache-2.0 | Do not infer weight redistribution permission from the serving code license. |
| [Deckard](https://github.com/sgoedecke/deckard) | README describes extension plus local native inference | MIT repository; last push 2026-10-19 | **Excluded:** native helper architecture fails the user's requirement, despite local privacy. |

Draftlight's source comment reports a ModernBERT WebGPU graph issue on some Metal drivers and selects WASM. That is a useful implementation warning, not a verified finding about all Safari versions. It reinforces the need to test the exact exported graph and backend.

### 8.3 Reference research implementations

| Repository | Role | License/status established in this review |
| --- | --- | --- |
| [Fast-DetectGPT](https://github.com/baoguangsheng/fast-detect-gpt) | Probability-curvature reference; README includes updated model-pair experiments | MIT; last push 2026-02-07 |
| [Binoculars](https://github.com/ahans30/Binoculars) | Two-model scorer; selected score and threshold code inspected | BSD-3-Clause; last push 2024-05-14 |
| [SynthID-Text](https://github.com/google-deepmind/synthid-text) | Watermark generation/detection reference | Apache-2.0 code; other materials have separate terms; last push 2026-10-26 |
| [lm-watermarking](https://github.com/jwkirchenbauer/lm-watermarking) | Token watermark implementation | Apache-2.0; last push 2025-09-17 |
| [MarkLLM](https://github.com/THU-BPM/MarkLLM) | Watermark research/evaluation toolkit | Apache-2.0; last push 2026-09-05 |
| [MGTBench](https://github.com/xinleihe/MGTBench) | Common implementations of likelihood, rank, perturbation, and classifier baselines | MIT; last push 2025-01-24 |
| [DetectRL](https://github.com/NLP2CT/DetectRL) | Realistic-condition evaluation | License unspecified in retrieved metadata; last push 2024-12-10 |
| [MultiSocial](https://github.com/kinit-sk/multisocial) | Social-text benchmark construction/evaluation | Code GPL-3.0; data have separate restricted access; last push 2025-09-23 |
| [DeTeCtive](https://github.com/heyongxin233/DeTeCtive) | Contrastive representation and retrieval reference | License unspecified in retrieved metadata; last push 2025-11-09 |
| [StyleDecipher](https://github.com/SiyuanLi00/StyleDecipher) | Rewrite-comparison reference | License unspecified in retrieved metadata; last push 2025-10-23 |

Additional author-linked implementations are listed in the source catalogue. None of the Python/PyTorch research repositories should be described as usable inside a userscript without a port, asset plan, and parity validation.

## 9. The actual Safari userscript boundary

### 9.1 What can be recommended now

The strongest fit is **offline learning, local JavaScript inference**. The runtime can compute sparse n-grams and numeric features, multiply by bundled coefficients, traverse small decision trees, or use bundled probability tables. These operations need no server, API credential, GPU, native helper, or new extension. Training can use Python or heavier models without introducing those dependencies into the installed userscript.

The current artifact uses `@inject-into content`, `document-idle`, and only `GM.getValue` / `GM.setValue` grants. It is a single generated script with no runtime loader. Its current supported baseline is Safari 16.4+ on macOS. This review recommends retaining that boundary for the primary shortlist.

The [Userscripts release-4 documentation](https://github.com/quoid/userscripts/blob/release/4.x.x/README.md) distinguishes content/page injection and limits GM APIs to the content context. It documents `@require` for remotely obtained JavaScript/CSS saved locally and a granted `GM.xmlHttpRequest` API. Neither implies a general-purpose model-asset packaging system. Its FAQ warns about CSP interaction. A future implementation must use the APIs of the deployed manager version rather than assume Tampermonkey, Chrome-extension, or development-branch behavior.

Practical implications for candidate design:

- Bundle code and parameters at build time into the existing script; do not require runtime `eval`, dynamic imports, or a CDN for a compact model.
- Preserve the existing viewport queue and bounded cache. A short batch budget does not prevent one expensive classifier call from blocking the page.
- Cache by model/version, settings, platform, and extracted text. A stale score after a post changes is a correctness error.
- Do not assume access to extension background pages, native messaging, arbitrary packaged extension files, or a cross-site shared model cache merely because the script runs through an extension.
- A worker can be an optimization only after verifying creation and messaging in the actual content world under the sites' policies. Maintain a bounded main-thread fallback for lightweight methods.
- Keep raw extracted text separate from normalized feature text if investigating signed provenance. DOM extraction changes can alter the meaning of every classifier's input.

### 9.2 WASM and WebGPU: possible technologies, unproven delivery

[Transformers.js](https://huggingface.co/docs/transformers.js/custom_usage) can use ONNX models locally. Its defaults can fetch model/runtime assets; disabling remote loading and controlling local paths is an explicit deployment choice. A model download differs from a text upload, but both change the current no-runtime-dependency design. A single `.user.js` file does not magically contain the weights, tokenizer, WASM binaries, and worker code.

[ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) provides browser execution backends, but graph/operator compatibility must be checked. Its performance documentation notes that WASM multithreading depends on cross-origin isolation. A userscript cannot assume the host site provides the necessary isolation. Start any experiment with a single-thread-compatible path and inspect actual availability. [Performance guidance](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html)

Safari 26.0 introduced WebGPU, according to [WebKit's Safari 26.2 retrospective](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/). That does not give Safari 16.4 WebGPU support. Runtime support tables may lag engine releases; neither a table entry nor `navigator.gpu` alone proves that a particular model graph runs inside a userscript. [WebLLM](https://webllm.mlc.ai/docs/) is useful browser-inference background, but is not evidence of a working detector or arbitrary-text scoring API for this task.

Approximate **weight-only arithmetic**, not downloaded sizes or measured RAM:

| Example | Raw weight estimate |
| --- | --- |
| 16,384 float32 linear coefficients | 64 KiB, excluding vocabulary and metadata |
| 125 million parameters at 8 bits each | 125 MB |
| 1 billion parameters at 4 bits each | 500 MB |
| Two 7-billion-parameter models at 4 bits each | 7 GB combined |

Tokenizers, activation tensors, graph state, quantization metadata, decoding buffers, and duplicated tab contexts add costs. Text-embedding a binary as base64 expands its encoded representation by roughly one third before parser/runtime overhead. These estimates explain why compact exported models lead the shortlist even though more elaborate browser inference is technically conceivable.

Before classifying any neural candidate as userscript-compatible, a separate experiment would need to establish: asset loading under site policies; exact tokenizer/logit parity; cold/warm latency; per-tab memory; multiple-tab behavior; cancellation and SPA cleanup; offline cache behavior; no text transmission; and successful operation in native Safari with the actual Userscripts manager. **This research task did not run that experiment.**

## 10. Datasets and what each can establish

Data choice is likely the largest determinant of whether a compact method succeeds. A broad essay benchmark cannot stand in for short, conversational, professional, or heavily formatted feed text.

| Dataset / benchmark | Useful coverage | Important boundary |
| --- | --- | --- |
| [MultiSocial, ACL 2025](https://aclanthology.org/2025.acl-long.36/) | 472,097 texts, 22 languages, five social platforms, seven generators | Platforms are Twitter, Telegram, Gab, Discord, and WhatsApp—not LinkedIn or Reddit. Generated examples involve paraphrasing. |
| [RAID, ACL 2024](https://aclanthology.org/2024.acl-long.674/) | Original paper reports over six million generations, 11 models, eight domains, 11 attacks, four decoding strategies | Broad robustness coverage; corpus versions can differ from the original paper's counts. Avoid training/test overlap when using models already trained on RAID. |
| [MAGE, ACL 2024](https://aclanthology.org/2024.acl-long.3/) | Multiple domains and generators; out-of-distribution evaluation | Useful generalization benchmark, not target-site validation. |
| [M4, EACL 2024](https://aclanthology.org/2024.eacl-long.83/) | Multilingual, multi-domain, multi-generator detection | Unseen domains/models remain difficult; language matching matters. |
| [MULTITuDE, 2023](https://arxiv.org/abs/2310.13606) | 74,081 texts, 11 languages, eight models | Useful multilingual stress test; short code-switched posts are a separate problem. |
| [HC3, 2023](https://arxiv.org/abs/2301.07597) | Human/ChatGPT answers to matched questions in English and Chinese | Early-generation QA comparison; strong performance can reflect dated generator or answer-style artifacts. |
| [DetectRL, 2024](https://arxiv.org/abs/2410.23746) | Prompts, revisions, errors, length, and writing conditions intended to be closer to actual use | Simulated transformations still need comparison with genuinely edited posts. |
| [EvoBench, ACL Findings 2025](https://aclanthology.org/2025.findings-acl.754/) | Seven model families and 29 versions; evolving generators | Directly relevant to model drift and updating fingerprints. |
| [Beemo, NAACL 2025](https://arxiv.org/abs/2411.04032) | Human, machine, expert-edited, and model-edited text | Mixed source/model terms; do not assume the whole dataset is MIT because some artifacts are. |
| [PADBen, 2025](https://arxiv.org/abs/2511.00416) | Paraphrase-attack taxonomy and iterative transformations | Useful for separating human paraphrases from transformed machine text. |
| [RealDet / conformal detection, ACL 2025](https://aclanthology.org/2025.acl-long.601/) | Realistic detection and false-positive control | Distributional assumptions and calibration population determine the meaning of a guarantee. |
| [WATTLE, WAC 2026](https://aclanthology.org/2026.wac-1.25/) | 41,300 paired webpage/original-and-transformation examples | Particularly relevant to browser reading; detailed availability/methods not verified beyond the published abstract here. |
| [SemEval-2024 Task 8](https://aclanthology.org/2024.semeval-1.279/) | Binary detection, source attribution, and human-to-machine boundaries | These are distinct tasks with distinct metrics. |
| [Beyond Binary](https://arxiv.org/abs/2410.14259) and [DAMASHA](https://aclanthology.org/2026.findings-eacl.326/) | Roles of assistance and mixed/adversarial text | Useful for avoiding a misleading binary training target. |
| [PAN 2026](https://pan.webis.de/clef26/pan26-web/) | Shared tasks covering generative detection, watermarking, style changes, and generated plagiarism | Useful source of reproducible systems and task definitions; the overview is not an independently verified ranking. |

The [MultiSocial data record](https://zenodo.org/records/13846152) is restricted, specifies research access conditions and no re-sharing, and acknowledges possible human-label errors. The code license does not override the data terms. The [HC3 card](https://huggingface.co/datasets/Hello-SimpleAI/HC3) also retains stricter underlying-source licenses where applicable. No restricted data were downloaded or requested during this task.

For this project, the missing decisive evidence is a **permissioned, provenance-tracked target-platform dataset**, especially LinkedIn. Include professional announcements and marketing written by humans, ordinary short replies, templates, non-native English, quotations, translation, model polishing, personalized outputs, multiple model versions, and actual human revision. Do not assign labels by looking at the detector's score or by intuition about whether a post “sounds AI.”

## 11. Reliability, theory, and evaluation design

### 11.1 What theory allows—and what it does not

If two production processes yield the same observed text, that observation alone cannot reveal which process occurred. More generally, statistical distinguishability is limited by how much the human and generated distributions differ. Sadasivan and colleagues analyze these limits and practical evasion/spoofing. [Can AI-Generated Text Be Reliably Detected?](https://arxiv.org/abs/2303.11156)

Complementary work argues that when distributions remain different, sufficiently much text or enough samples can make detection possible under its assumptions. [On the Possibilities of AI-Generated Text Detection, ICML 2024](https://proceedings.mlr.press/v235/chakraborty24a.html)

These results are compatible: detection may be useful in a defined setting without being reliable for every short post. They do not establish that all detection is impossible, or that more computation can recover nonexistent evidence. A watermark or signed record introduces additional evidence beyond unconstrained surface text.

### 11.2 Failure cases that must be measured

| Failure mode | Evidence / reason | Evaluation response |
| --- | --- | --- |
| New generators and fine-tuning | [Fine-tuned social-media generation study](https://aclanthology.org/2025.findings-acl.695/) and EvoBench | Hold out entire generator families and versions, not just rows. |
| Personalized style imitation | [When Personalization Tricks Detectors, ACL 2026](https://aclanthology.org/2026.acl-long.1998/) | Test personalized writing separately; familiar features can reverse direction. |
| Readability and stylistic shortcuts | [Exploring the Limitations, COLING 2025](https://aclanthology.org/2025.coling-main.288/) | Match readability/genre and test edited human controls. |
| Practical low-FPR collapse | [Practical Examination, NAACL Findings 2025](https://aclanthology.org/2025.findings-naacl.271/) | Report recall at the intended FPR, not AUROC alone. |
| Non-native-language bias | [Liang et al., Patterns 2023](https://doi.org/10.1016/j.patter.2023.100779) finds substantial problems in its evaluated tools/data | Measure contemporary tools on appropriate language-background slices; do not universalize an old bias percentage. |
| Bias is conditional, not inevitable | [Jiang et al., Computers & Education 2024](https://doi.org/10.1016/j.compedu.2024.105070) reports a contrasting result in its controlled essay setting | Evaluate the actual classifier and population. Abstract/intro reviewed; full paper access was limited. |
| LLM judging its own output | [I Know Myself Better, but Not Really Greatly, 2025](https://arxiv.org/abs/2502.12743) examines weak self/cross detection and explanation issues | Asking a chatbot “was this AI?” is not a calibrated substitute. |
| Short or mixed text | Few independent observations; changing styles and editing | Learn length-dependent abstention and report coverage. |
| Page contamination | Navigation text, replies, hidden duplicates, translations, excerpts | Evaluate extraction and detection together; preserve ownership boundaries. |

### 11.3 A research protocol for the compact shortlist

1. **Define labels by production process.** Retain human-only, generated, human-edited machine draft, machine-edited human draft, translated, and uncertain provenance. State which labels each experiment predicts.
2. **Freeze source groups before feature selection.** Originals, rewrites, continuations, prompt variants, duplicate quotations, and near duplicates belong in the same group. Where possible, separate authors and source templates too.
3. **Create explicit holdouts.** Use distinct platform, date, model-family, model-version, and editing holdouts. A random grouped split does not establish all these conditions.
4. **Compare simple baselines on identical data.** Current cue count, current structured features, word n-grams, character n-grams, combined linear model, compression, and any grammatical addition. Include trivial length/platform baselines to reveal shortcuts.
5. **Separate training, calibration, and untouched testing.** Tune neither thresholds nor feature sets on the final test set. Keep a separate realistic-rewrite stress set.
6. **Measure incremental value.** Remove each feature family, match model capacity, and repeat across held-out generators. A larger model that only recognizes the same errors is not automatically useful.
7. **Report operating metrics.** Recall at 1% and 0.1% human FPR; precision under stated prevalence assumptions; PR-AUC; reliability/Brier error where probabilities are claimed; abstention rate; worst relevant slice; source-group confidence intervals.
8. **Evaluate the complete decision procedure.** Include extraction, truncation, window aggregation, language routing, thresholds, and any cheap/expensive cascade. Evaluate recall lost at an early gate as well as final accuracy.
9. **Measure actual Safari cost later.** Cold parsing/startup, peak memory, per-post latency, scroll responsiveness, cancellation, multiple tabs, and supported-site behavior. No numbers are supplied here because no prototype was run.

### 11.4 Why a small FPR still needs careful interpretation

Illustrative arithmetic, **not measured detector performance**:

`precision = sensitivity × prevalence / [sensitivity × prevalence + FPR × (1 − prevalence)]`

At 80% sensitivity and 1% FPR:

| Actual generated-text prevalence | Expected precision under those assumptions |
| --- | --- |
| 1% | 44.7% |
| 10% | 89.9% |
| 50% | 98.8% |

A class-balanced benchmark therefore does not determine how trustworthy a flag will be in a user's feed. Also, with 100 independent human posts and 1% FPR per post, the probability of at least one false flag is about **63.4%**. Real posts are correlated, so that example is illustrative rather than a feed estimate.

If zero false positives are observed among `n` independent human examples, the approximate one-sided 95% upper bound is `3/n` (exact binomial form: `1 − 0.05^(1/n)`). Roughly 300, 3,000, and 30,000 clean examples are needed even to support upper bounds near 1%, 0.1%, and 0.01%, respectively. Correlated examples reduce effective evidence; each important subgroup needs support too.

Conformal calibration can make false-positive control more principled under exchangeability, but it does not automatically protect against changed platform/language distributions or repeated unadjusted window tests. The [ACL 2025 conformal study](https://aclanthology.org/2025.acl-long.601/) is relevant research; merely setting a threshold from human scores is not a claim to reproduce its method.

## 12. Prioritized research agenda under the Safari requirement

### Primary shortlist

| Priority | Candidate | Why it is a good fit | What would falsify its usefulness |
| --- | --- | --- | --- |
| 1 | **Learned character + word + existing style features** with a regularized linear classifier | Reuses offline training/export; cheap inference with bundled coefficients; interpretable feature contributions | No meaningful low-FPR gain on new generators and matched human posts, or gains disappear after removing topic leakage |
| 2 | **Dual-reference seeded compression** | Distinct signal; pure-JavaScript implementation precedent; no neural weights | Gains depend on seed/topic overlap, collapse on short posts, or add no value beyond n-grams |
| 3 | **Function-word / POS / lightweight stylometry ensemble** | Tests grammatical structure beyond phrase rules; compact models can be bundled | Tagger/bundle cost exceeds the incremental detection value, or genre controls erase gains |
| 4 | **Length/platform-aware calibration and abstention** | Fits existing model keys and small metadata; makes the resulting signal more usable | Apparent improvement comes only from refusing nearly all difficult cases; report coverage to expose this |
| 5 | **Small change-point model over local style features** | Potentially identifies mixed passages without large encoders | Topic changes and quotations cause high false alarms; boundaries are unstable under harmless formatting |
| 6 | **Compressed n-gram probability tables inspired by LLMDet** | Moves some model information into an offline-built compact artifact | Coverage is poor, tables grow too large, or modern-generator transfer is absent |

The first three are the strongest candidates for additional detection signal. The fourth improves decision quality. The fifth addresses a different target. The sixth is a higher-risk compression of a more expensive method.

### Other ideas worth controlled experiments

These are **engineering hypotheses proposed by this review**, not established findings:

| Idea | Experiment | Critical control |
| --- | --- | --- |
| Topic-reduced fingerprints | Compare full-text features with function-word/POS and content-masked versions | Match topics and authors; ensure masking itself does not introduce class artifacts |
| Multi-scale statistics | Combine local and whole-post diversity/repetition distributions | Compare with the same feature count at one scale; adjust window aggregation |
| Tiny offline teacher–student model | Distill richer model scores into a linear, tree, or small character model | Compare against labels-only training; hold out teacher-associated model families |
| Sparse fingerprint dictionary | Prune lexical/POS features; quantize coefficients; encode a trie or compact table | Measure score parity, collision/quantization error, and total script parse cost |
| Open-set rejection | Detect inputs unlike the calibrated training population | Unknown generator must not automatically become “human”; report rejected coverage |
| Dual extraction channels | Keep raw text for provenance and normalized text for style | Verify quotations/DOM changes and avoid presenting Unicode presence as provenance |
| Local ensemble disagreement | Show inconclusive when independently trained methods disagree | Check whether errors really differ; correlated methods add little evidence |
| Platform-conditioned reference corpora | Compare each post against an appropriate human and generated reference pool | Leave entire platforms/time periods out to measure transfer rather than memorize them |

### Conditional or excluded

- **Conditional only:** a quantized neural detector entirely inside the Safari userscript. It remains a possible future research experiment if asset loading and memory requirements are acceptable, but no inspected example establishes compatibility with this script's current Safari baseline and sites.
- **Conditional and coverage-limited:** local watermark or C2PA verification with usable public configuration and a compatible validator. This should produce a separate provenance result.
- **Excluded by the clarified requirement:** native helpers such as Deckard, localhost model servers, remote classifier APIs, provider-only watermark endpoints, and private generation-index services.
- **Low priority:** more buzzwords, raw punctuation “tells,” a generic low-perplexity cutoff, arbitrary weighted cue percentages, LLM self-judgment, or claims that invisible characters alone identify AI. These are easy to demonstrate and hard to justify as reliable additions.

## 13. Research conclusion

The best next research investment is **a trained, compact local classifier built from complementary lexical, grammatical, and compression features**, evaluated against provenance-tracked target-site text. This can preserve the Safari userscript delivery model. The existing offline export pipeline is a useful starting point, but there is no evidence yet that a particular additional feature set will achieve an acceptable tradeoff on the user's feeds.

The broader literature supplies many richer detectors, but their published scores, browser demos, and open weights do not by themselves meet the Safari-userscript requirement. Provider watermarking and signed provenance deserve a separate research track because they test different evidence and depend on availability.

This deliverable is limited to research documents. No runtime source, generated userscript, model weights, training behavior, installed Safari script, or remote repository was changed.
