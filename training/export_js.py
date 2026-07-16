from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict


def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise SystemExit(f"{path} must contain a JSON object.")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a calibrated training model for the userscripts.")
    parser.add_argument("weights_json", help="Path to training output weights.json")
    parser.add_argument("--thresholds-json", help="Optional path to thresholds.json (thresholds are usually embedded).")
    parser.add_argument("--model", default="", help='Model key such as "linkedin:post" or "default".')
    parser.add_argument("--var", default="MODEL", help="JS constant name for stdout output.")
    parser.add_argument(
        "--models-file",
        help="Update this model bundle in place, e.g. models/default-models.json. Rebuild userscripts afterward.",
    )
    args = parser.parse_args()

    data = load_json(args.weights_json)
    models = data.get("models")
    if not isinstance(models, dict) or not models:
        raise SystemExit("weights.json does not contain a non-empty 'models' object.")
    key = args.model or ("default" if "default" in models else sorted(models)[0])
    if key not in models:
        raise SystemExit(f"Model {key!r} not found. Available: {', '.join(sorted(models))}")

    model = dict(models[key])
    if args.thresholds_json:
        threshold_data = load_json(args.thresholds_json)
        thresholds = threshold_data.get("models", {}).get(key)
        if thresholds:
            model["thresholds"] = thresholds
    if not model.get("calibration"):
        raise SystemExit("Refusing to export an uncalibrated model. Run the v2 training pipeline first.")
    if not model.get("thresholds"):
        raise SystemExit("Refusing to export a model without held-out thresholds.")

    print(f"// Exported from {args.weights_json} ({key})")
    print(f"const {args.var} = {json.dumps(model, indent=2, sort_keys=True)};")

    if args.models_file:
        path = Path(args.models_file)
        bundle = load_json(str(path)) if path.exists() else {"schema_version": 2, "metadata": {}, "models": {}}
        bundle.setdefault("metadata", {})
        bundle.setdefault("models", {})
        bundle["metadata"].update({
            "calibrated": True,
            "provenance": f"Offline-trained with held-out sigmoid calibration and human-score thresholding; source {Path(args.weights_json).name}.",
            "feature_set": "stylometry-v2-charhash128",
        })
        bundle["models"][key] = model
        path.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Updated {path}")


if __name__ == "__main__":
    main()
