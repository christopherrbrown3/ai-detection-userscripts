# Research grounding and accuracy audit

Reviewed 2026-09-28 following reports of LinkedIn scores clustering at 0 and 17 and badges overflowing. This audit distinguishes rule correctness, extraction correctness, and authorship accuracy. Only the first two can be checked with unlabeled browser examples. The 0.6.1 changes repair the display and document detection limitations; they do not change the detector or claim improved authorship accuracy.

## What changed, and why the numbers cluster

| Release | Active behavior |
| --- | --- |
| 0.3, `1d91785` | Six style families; broader framing/rhythm rules and weighted point fields. The family count was already distinct from the diagnostic logistic model. |
| 0.4, `52c54c3` | More conservative rules: phrase combinations, multiword openings, contiguous repetition, list/prose separation, quotation/code exclusion, language abstention, sample minima, and highlighted spans. Old point fields removed. No labeled accuracy benchmark. |
| 0.5 / 0.5.1 | Consolidation preserved the rules. The 0.5.1 UI converted the count to `round(100 * families / 6)`. |
| 0.6, `308ab617` | Facebook integration, settings persistence, and runtime fixes. Detector and model weights unchanged. |
| 0.6.1 | Explicit `AI Score: N/6 cues`, responsive badges, and this audit. Detector, model weights, and extraction unchanged. |

The old display had only seven possible numeric values: **0, 17, 33, 50, 67, 83, 100**. One family always yielded 17, whether it was a three-item list or explicit model wording. Repeated hits inside the same family did not increase the score. A zero meant no configured family met its threshold, not evidence of human authorship. Increasing or smoothing those numbers would not improve accuracy.

`models/default-models.json` marks its weights as hand-tuned and uncalibrated. The default browser path does not use them for the badge. Stylometric feature computation and its experimental logistic output run when Technical details is expanded. That model has not been validated as a replacement either.

Live Safari spot-check: one zero-match LinkedIn post supplied **90 words and five sentences** to the detector while the feed displayed a collapsed preview. This establishes that the sample was larger than the preview in that case; it does not prove extraction completeness across LinkedIn. No feed text or account data is stored in this audit.

## Research-to-implementation map

The four local PDFs were read, including methods rather than only their summaries. Additional primary papers linked from the existing research notes were checked. This is a focused review, not a replication of every referenced study.

| Source | What it actually supports | Relationship to this userscript |
| --- | --- | --- |
| [Text Fluoroscopy, EMNLP 2024](https://aclanthology.org/2024.emnlp-main.885/) — local PDF, §3–4 | Intermediate encoder-layer features and a trained classifier, evaluated for transfer. It also discusses weaknesses of overly simple linguistic features. | We do not implement its method. “Intrinsic” must not be treated as evidence that punctuation or phrase rules are validated. |
| [StyleDecipher, 2025](https://arxiv.org/abs/2510.12608) — local v1 PDF, §III | N-gram overlap/edit distance between original and model-rewritten text, plus embedding-based style stability and classification. | Our within-document repetition is a different measurement. We do not run the rewriting/embedding pipeline or inherit its reported performance. |
| [Beyond Binary, WWW 2025](https://doi.org/10.1145/3696410.3714770) — local PDF | Distinguishing different LLM roles and levels of involvement rather than collapsing all assistance into one binary label. | Supports preserving mixed/assisted labels in evaluation. It does not map cue counts to involvement or probability. |
| Local `llm_detection_report.pdf`, 2025-11-22 | A secondary overview attributed to Manus AI, discussing other sources. | Background only. It cannot validate coefficients or cutoffs. Sentence-length variation is not perplexity, nor a substitute for LM-scored burstiness. |
| [Syntactic Templates, EMNLP 2024](https://aclanthology.org/2024.emnlp-main.368/) | Measurement of syntactic/POS templates, diversity, and memorized style across tasks and models. | Motivates studying structural repetition. Our opening/string checks do not implement POS templates; their thresholds remain unvalidated. |
| [Simple models are all you need, ALTA 2024](https://aclanthology.org/2024.alta-1.19/) | Trained lightweight models combining word counts, stylometry, readability, POS, and entropy; evaluated on a held-out hybrid-text task. | A useful candidate architecture for local inference. It is not evidence for an equal-weight six-rule rubric or a LinkedIn accuracy claim. |
| [LLM Fingerprints, GenAIDetect 2025](https://aclanthology.org/2025.genaidetect-1.6/) | Learned n-gram/POS feature patterns; transfer is weaker across unrelated model families. | Supports evaluating character/word n-gram features. The optional 128-bucket char hash has no learned weights in the shipped default, and is not a replication. |
| [MultiSocial, ACL 2025](https://aclanthology.org/2025.acl-long.36/) | Social-text benchmarking where platform selection during training matters. | Test on platform-matched data; its results do not validate LinkedIn. Follow the dataset's access terms. |
| [EvoBench, ACL 2025](https://aclanthology.org/2025.findings-acl.754/) | Detection degrades across evolving model versions. | Hold out generators and time/version cohorts, not just random rows. |

## Exact status of the six families

All exact phrase lists, numerical cutoffs, and the equal count are **project heuristics**. No reviewed paper establishes their calibrated predictive value or statistical independence.

| Family | Current trigger, after exclusions/language eligibility | Evidence status / concern |
| --- | --- | --- |
| Model reference | A phrase such as `as an ai` | Direct wording only, not an authorship determination. The prefix also matches an AI job title: a known descriptor defect. |
| Stock framing | At least two distinct framing phrases, or one plus two promotional terms | Hand-built phrase lists. Contractions, omitted subjects, and newer wording can change matches. One common phrase is deliberately insufficient. |
| Repeated openings | At least three prose sentences; a multiword opening repeats at least twice in at least 30% of sentences | An observable repetition proxy, not POS-template measurement. Lists and all-stopword openings excluded. |
| Structure | Three list items, or a qualifying colon/dash cluster with minimum length and punctuation density | Formatting can be deliberate human style. Arrow/checkmark bullets are not recognized. |
| Similar sentence lengths | Five prose sentences, 40 prose words, coefficient of variation ≤0.28 | Not LM burstiness. Formulaic human writing can match; short posts cannot trigger it. |
| Repeated phrases | 40 prose words and ≥8% repeated contiguous 3–5-word phrases, with overlap/opening/list exclusions | A surface repetition proxy. Technical terms and deliberate repetition can match. |

Quotes, code, uncertain language, and minimum evidence requirements can further remove otherwise recognizable patterns. Relaxing those safeguards to increase the number of badges would trade misses for false matches without a known accuracy benefit.

## Reproducible behavior probes

Run:

```sh
node scripts/audit_cue_coverage.mjs --baseline-ref 1d91785
```

Inputs and questions are in `tests/fixtures/cue-audit.json`; [recorded results](cue-coverage-audit.json) include source hashes and the historical comparison. The examples are authored synthetic probes with **no human/AI ground-truth labels**. Their counts cannot estimate precision, recall, or a real feed's score distribution.

| Probe | Current result | Interpretation |
| --- | --- | --- |
| `Here are` alone versus `Here are the key takeaways` | 0 versus 1 family | Combination threshold explains some zeros. |
| `I'm excited to share` versus `Excited to share`, same two promotional terms | 1 versus 0 | Exact-phrase coverage gap. |
| Three `•` lines versus identical `→` lines | 1 versus 0 | List-marker inconsistency. |
| `As an AI engineer` versus `As an AI language model` | 1 versus 1 | Model-reference false match; direct wording is not enough. |
| Quoted model wording | 0 | Deliberate quotation safeguard; older rules counted it. |
| Short contrast constructions | 0 | Unimplemented syntax; subjective recognition is not a ground-truth label. |

## Prioritized improvements and acceptance gates

1. **Correct the display now.** Keep the requested name and bars, show the actual family count, state that probability is unavailable, and preserve short/unassessed states. Bound the component by its container and test adverse site CSS, narrow containers, enlarged text, dark mode, and keyboard focus. This is 0.6.1.
2. **Fix descriptor correctness in a separately measured change.** Disambiguate job titles from model self-reference; normalize explicitly supported list markers consistently across list/prose checks; evaluate equivalent phrase forms without adding a buzzword grab bag. Require positive, negative, quoted/code, and formatting-pair cases with exact evidence spans. Document changed counts. These tests establish descriptor behavior, not improved authorship recall.
3. **Build a representative labeled evaluation set before tuning.** Obtain permissioned/provenance-tracked LinkedIn post and comment samples, matching topics, lengths, dates, and languages. Include human professional/marketing prose, disclosed model output from multiple families, and human/AI edited mixtures. Do not label feed text by intuition or scrape private communications. Record source groups, generator/version, edits, platform, and license. Freeze a test set before feature selection.
4. **Evaluate lightweight candidates that can remain private in-browser.** Start with the existing structured-feature logistic pipeline; compare learned character/word n-grams and regularized combinations as supported by the lightweight studies. Ablate each feature group, compare against the current rubric and trivial baselines, measure payload and per-post latency. A POS/entropy ensemble is a candidate to benchmark, not an automatic new dependency. Keep model-dependent methods such as Fluoroscopy and StyleDecipher out of the dependency-free runtime unless requirements explicitly change.
5. **Separate training, calibration, and untouched test data.** Keep every original, rewrite, and continuation in the same source group. Hold out generators and versions explicitly. The existing grouped random split and slice reports do not themselves guarantee unseen-generator or chronological holdouts. Add a reproducible split manifest before making those claims. Measure FPR, recall, PR-AUC, calibration/Brier error, and confidence intervals by platform, kind, length, language/ELL, readability, and mixed authorship. Check the intended deployment prevalence before interpreting probability.
6. **Gate any probability release on evidence.** Publish dataset provenance/access constraints, feature definitions, split hashes, baselines, ablations, calibration curves, and failure slices. Ensure a human calibration set can resolve the chosen FPR; preserve abstention where support is inadequate. Numeric calibration parameters alone are not validation. Make the UI probability gate depend on an explicit reviewed model manifest rather than merely a finite slope/intercept. Train/export offline; ship self-contained parameters without uploading posts.

The present work deliberately does not lower thresholds, revive arbitrary legacy weights, or invent smoother scores. The accuracy investigation is complete enough to explain the observed behavior and define the next experiments; actual detection improvement remains unmeasured until those experiments have suitable data.
