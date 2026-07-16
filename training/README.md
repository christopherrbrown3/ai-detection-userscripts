# Offline training and calibration

The installed userscripts never download a model or transmit text. This directory trains compact logistic-regression models offline and exports their weights, character n-gram profile, calibration parameters, and false-positive-controlled thresholds into the self-contained scripts.

## Install

```bash
python3 -m pip install -r training/requirements.txt
```

## Recommended record schema

One JSON object per line:

```json
{
  "text": "The post or comment text",
  "authorship": "human",
  "platform": "reddit",
  "kind": "comment",
  "source_id": "original-document-1042",
  "generator": "human",
  "language": "en",
  "attack": "none"
}
```

Required:

- `text`
- `authorship` (`human`, `ai`, or `mixed`) or a `label` (`0`, `1`, or `2`)

Strongly recommended:

- `platform`: `linkedin`, `reddit`, or `x`
- `kind`: `post` or `comment` (`reply` is normalized to `comment`)
- `source_id`: shared by an original and every derived/paraphrased/attacked version; prevents split leakage
- `generator`, `language`, and `attack`: used for held-out slice reporting

Mixed, assisted, polished, and hybrid records are preserved as class `2` for evaluation. The binary base classifier trains only on human (`0`) and fully generated (`1`) records.

## Normalize a downloaded benchmark

`prepare_dataset.py` reads CSV, JSON, JSONL, or Parquet and maps common column names. Explicit mappings are available when a source uses different names.

```bash
python3 training/prepare_dataset.py \
  --input path/to/multisocial.parquet \
  --output training/data/multisocial.jsonl \
  --text-field text \
  --label-field label \
  --platform-field platform \
  --generator-field model \
  --language-field language
```

MultiSocial does not contain LinkedIn. Treat its X/Twitter data as an X baseline, use Reddit-oriented benchmark material only for Reddit, and curate matched LinkedIn samples rather than pretending cross-platform transfer is reliable.

The official MultiSocial files are access-restricted and limited to approved research use. Request access from its Zenodo record and do not commit or redistribute the data. The importer is intentionally local-only.

## Optional surface-attack augmentation

The deterministic augmenter adds punctuation-drop, case-variation, and single-typo variants. It preserves `source_id`, so grouped splitting keeps variants out of other splits.

```bash
python3 training/augment.py \
  --input training/data/multisocial.jsonl \
  --output training/data/multisocial-augmented.jsonl
```

This is not a substitute for testing paraphrases, human edits, personalized output, or unseen fine-tuned generators.

## Train, calibrate, and evaluate

```bash
python3 training/train.py \
  --input training/data/combined.jsonl \
  --output-dir training/out \
  --group-field source_id \
  --target-fpr 0.01
```

The default split is 60% training, 20% calibration, and 20% test. When repeated `source_id` values exist, entire groups remain in one split. Otherwise a stratified random split is used.

The binary classifier uses balanced class weights by default; held-out calibration and human-only threshold selection still determine the displayed score and strong cutoff. Use `--class-weight none` only for an intentional ablation.

Outputs:

- `weights.json`: structured weights, 128 hashed character 3–5-gram weights, and held-out sigmoid calibration
- `thresholds.json`: moderate/strong cutoffs and calibration-set false-positive diagnostics
- `report.json`: overall and slice metrics for the untouched test split

Models with fewer than 300 binary rows are skipped by default. Lower `--min-total` only for development—not for a release model.

## Export a validated model

Print a JavaScript constant:

```bash
python3 training/export_js.py training/out/weights.json \
  --thresholds-json training/out/thresholds.json \
  --model reddit:post \
  --var MODEL_REDDIT_POST
```

Update the shared model bundle and rebuild every userscript:

```bash
python3 training/export_js.py training/out/weights.json \
  --thresholds-json training/out/thresholds.json \
  --model reddit:post \
  --models-file models/default-models.json

python3 scripts/build_userscripts.py
```

The exporter refuses uncalibrated models and models without held-out thresholds.

## Release gate

Do not replace the experimental baseline until:

- source-group overlap is zero
- the requested FPR is resolvable with the number of held-out human samples
- test FPR and confidence intervals are acceptable on each platform and length bucket
- unseen-generator, paraphrase, mixed, personalized, and multilingual/ELL slices are documented
- JavaScript/Python parity and all DOM fixture tests pass

See [../docs/benchmarking.md](../docs/benchmarking.md) for the complete matrix.
