from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path
from typing import Any, Dict


def drop_punctuation(text: str) -> str:
    return re.sub(r"[,;:!?]", "", text)


def vary_case(text: str) -> str:
    words = text.split()
    return " ".join(word.lower() if index % 7 == 0 else word for index, word in enumerate(words))


def add_typo(text: str, rng: random.Random) -> str:
    words = text.split()
    candidates = [index for index, word in enumerate(words) if len(word) >= 7 and word.isalpha()]
    if not candidates:
        return text
    index = rng.choice(candidates)
    word = words[index]
    position = max(1, min(len(word) - 2, len(word) // 2))
    words[index] = word[:position] + word[position + 1] + word[position] + word[position + 2:]
    return " ".join(words)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create deterministic surface-attack variants while preserving source_id for leakage-safe splitting."
    )
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--seed", type=int, default=1337)
    args = parser.parse_args()
    rng = random.Random(args.seed)
    transforms = {
        "punctuation-drop": drop_punctuation,
        "case-variation": vary_case,
        "single-typo": lambda text: add_typo(text, rng),
    }
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(args.input, "r", encoding="utf-8") as source, destination.open("w", encoding="utf-8") as output:
        for index, line in enumerate(source):
            if not line.strip():
                continue
            row: Dict[str, Any] = json.loads(line)
            row.setdefault("source_id", row.get("pair_id") or f"row-{index}")
            output.write(json.dumps(row, ensure_ascii=False) + "\n")
            count += 1
            for attack, transform in transforms.items():
                augmented = dict(row)
                augmented["text"] = transform(str(row.get("text", "")))
                augmented["attack"] = attack
                output.write(json.dumps(augmented, ensure_ascii=False) + "\n")
                count += 1
    print(f"Wrote {count} original and augmented rows to {destination}")


if __name__ == "__main__":
    main()
