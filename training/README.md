# Offline training pipeline (optional)

The userscripts ship with **hand-tuned** linear weights so they work out of the box. This folder provides an **offline** pipeline to train and export calibrated logistic-regression weights from labeled datasets, then copy them back into the userscripts (vendored inline; no runtime downloads).

## What this pipeline does
- Extracts the same **scaled feature vector** used by the userscripts.
- Trains `sklearn.linear_model.LogisticRegression` models for:
  - LinkedIn post-like text
  - LinkedIn comment-like text
  - Reddit post-like text
  - Reddit comment-like text
  - X post-like text
  - X reply-like text
- Exports:
  - `weights.json` (intercept + per-feature weights)
  - `thresholds.json` (label cutoffs; tuned for higher recall)
  - `report.json` (basic metrics + length bucket breakdown)

## Requirements
- Python 3.10+
- `pip install -r training/requirements.txt`

## Data format
Input is JSON Lines (`.jsonl`) with (at minimum):
```json
{"text": "some content...", "label": 0}
{"text": "ai-ish content...", "label": 1}
```

- `label`: `0` = human-written, `1` = LLM-generated/LLM-assisted (your choice; be consistent).
- Optional fields: `platform` (`linkedin`/`reddit`/`x`) and `kind` (`post`/`comment`).

## Run
```bash
# Run from the repo root (either invocation works):
python3 training/train.py --input path/to/data.jsonl --output-dir training/out
# OR:
python3 -m training.train --input path/to/data.jsonl --output-dir training/out
```

Then use:
```bash
python3 training/export_js.py training/out/weights.json
```
…to print a JS snippet you can paste into:
- `linkedin-ai-heuristic.userscripts.user.js`
- `reddit-ai-heuristic.userscripts.user.js`
- `x-ai-heuristic.userscripts.user.js`

## Notes
- This repo does **not** include datasets. Use any labeled sources you have access to (public benchmarks or your own curated samples).
- For “higher accuracy” without false accusations, consider using a 3-way label strategy offline (human / mixed / AI) and exporting thresholds that map to the userscript’s “mixed signals” UX.
- By default, `train.py` requires at least 80 rows per model subset. Use `--min-total` to lower this for quick experiments.
