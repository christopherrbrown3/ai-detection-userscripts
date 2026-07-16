from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable

import pandas as pd


def read_rows(path: Path) -> Iterable[Dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix in {".jsonl", ".ndjson"}:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    yield json.loads(line)
        return
    if suffix == ".json":
        value = json.loads(path.read_text(encoding="utf-8"))
        rows = value if isinstance(value, list) else value.get("data", [])
        yield from rows
        return
    if suffix in {".parquet", ".pq"}:
        frame = pd.read_parquet(path)
    else:
        frame = pd.read_csv(path)
    yield from frame.to_dict(orient="records")


def first_present(row: Dict[str, Any], requested: str, fallbacks: list[str], default: Any = None) -> Any:
    for key in [requested, *fallbacks]:
        if key and key in row and not pd.isna(row[key]):
            return row[key]
    return default


def normalize_authorship(value: Any) -> str:
    normalized = str(value).lower().strip().replace("_", "-")
    if normalized in {"0", "human", "human-written", "hwt", "real"}:
        return "human"
    if normalized in {"2", "mixed", "hybrid", "assisted", "ai-assisted", "human-edited", "human-polished"}:
        return "mixed"
    if normalized in {"1", "ai", "machine", "generated", "ai-generated", "mgt", "fake", "llm"}:
        return "ai"
    raise ValueError(f"Cannot normalize authorship value {value!r}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize MultiSocial or another tabular benchmark into the training JSONL schema."
    )
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--text-field", default="text")
    parser.add_argument("--label-field", default="label")
    parser.add_argument("--platform-field", default="platform")
    parser.add_argument("--kind-field", default="kind")
    parser.add_argument("--source-id-field", default="source_id")
    parser.add_argument("--generator-field", default="generator")
    parser.add_argument("--language-field", default="language")
    parser.add_argument("--attack-field", default="attack")
    parser.add_argument("--platform", help="Override platform for every row (e.g. x, reddit, linkedin).")
    parser.add_argument("--kind", help="Override kind for every row (post or comment).")
    args = parser.parse_args()

    source = Path(args.input)
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with destination.open("w", encoding="utf-8") as handle:
        for index, row in enumerate(read_rows(source)):
            text = first_present(row, args.text_field, ["content", "body", "message", "tweet"])
            label = first_present(row, args.label_field, ["authorship", "class", "target", "is_generated"])
            if not text or label is None:
                continue
            normalized = {
                "text": str(text),
                "authorship": normalize_authorship(label),
                "platform": args.platform or str(first_present(row, args.platform_field, ["source", "network"], "unknown")),
                "kind": args.kind or str(first_present(row, args.kind_field, ["type"], "post")),
                "source_id": str(first_present(row, args.source_id_field, ["pair_id", "document_id", "id"], f"row-{index}")),
                "generator": str(first_present(row, args.generator_field, ["multi_label", "model", "llm"], "unknown")),
                "language": str(first_present(row, args.language_field, ["lang"], "unknown")),
                "attack": str(first_present(row, args.attack_field, ["perturbation", "rewrite"], "none")),
            }
            handle.write(json.dumps(normalized, ensure_ascii=False) + "\n")
            written += 1
    print(f"Wrote {written} rows to {destination}")


if __name__ == "__main__":
    main()
