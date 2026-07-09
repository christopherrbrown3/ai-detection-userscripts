from __future__ import annotations

import argparse
import json
from typing import Any, Dict


def js_obj(obj: Any, indent: int = 2) -> str:
    return json.dumps(obj, indent=indent, sort_keys=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("weights_json", help="Path to training output weights.json")
    ap.add_argument("--model", default="", help='Model key, e.g. "linkedin:post", "x:comment", or "default"')
    ap.add_argument("--var", default="MODEL", help="JS const base name (e.g. MODEL_POST)")
    args = ap.parse_args()

    with open(args.weights_json, "r", encoding="utf-8") as f:
        data: Dict[str, Any] = json.load(f)

    models = data.get("models")
    if not isinstance(models, dict) or not models:
        raise SystemExit("weights.json does not contain a 'models' object.")

    key = args.model or ("default" if "default" in models else sorted(models.keys())[0])
    if key not in models:
        raise SystemExit(f"Model '{key}' not found. Available: {', '.join(sorted(models.keys()))}")

    model = models[key]
    js_model = {
        "intercept": float(model["intercept"]),
        "weights": {k: float(v) for k, v in model["weights"].items()},
    }
    print(f"// Exported from {args.weights_json} ({key})")
    print(f"const {args.var} = {js_obj(js_model, indent=2)};")


if __name__ == "__main__":
    main()

