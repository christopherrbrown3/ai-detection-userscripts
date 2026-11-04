"""Convert HC3 (Human ChatGPT Comparison Corpus) files into the rubric JSONL schema.

HC3 is CC BY-SA 4.0 (https://huggingface.co/datasets/Hello-SimpleAI/HC3). Download
the files yourself and keep the converted output out of version control. The
human Reddit answers are pre-ChatGPT ELI5 posts, so they double as a
human-only false-positive control set. The ChatGPT answers are December 2022
output with line breaks removed by the dataset; they understate list and
Markdown cues and do not represent current models.

    python3 scripts/prepare_hc3.py --input reddit_eli5.jsonl --output training/data/hc3-eli5.jsonl --per-class 3000
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re

CONTRACTION = re.compile(r" (n't|'s|'re|'ve|'ll|'d|'m)\b", re.I)
BEFORE_PUNCT = re.compile(r" ([,.!?;:%)\]}])")
AFTER_OPEN = re.compile(r"([(\[{]) ")
QUOTED = re.compile(r'" ([^"\n]*?) "')


def detokenize(text: str) -> str:
    """Undo the PTB-style spacing used by HC3's Reddit answers."""
    value = str(text or "").replace(" ", " ")
    value = CONTRACTION.sub(r"\1", value)
    value = QUOTED.sub(r'"\1"', value)
    value = BEFORE_PUNCT.sub(r"\1", value)
    value = AFTER_OPEN.sub(r"\1", value)
    value = re.sub(r"[ \t]+", " ", value)
    return value.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--input", required=True, action="append", help="HC3 JSONL file; repeatable")
    parser.add_argument("--output", required=True)
    parser.add_argument("--per-class", type=int, default=2000, help="Rows kept per authorship class and file")
    parser.add_argument("--seed", type=int, default=1337)
    args = parser.parse_args()

    rows = []
    for path in args.input:
        name = os.path.splitext(os.path.basename(path))[0]
        platform = "reddit" if "reddit" in name else "qa"
        human, generated = [], []
        with open(path, encoding="utf-8") as handle:
            for index, line in enumerate(handle):
                record = json.loads(line)
                source = f"hc3-{name}-{index}"
                for answer in record.get("human_answers") or []:
                    text = detokenize(answer)
                    if text:
                        human.append({"text": text, "authorship": "human", "generator": "human"})
                        human[-1].update(platform=platform, kind="comment", source_id=source, dataset=f"hc3/{name}")
                for answer in record.get("chatgpt_answers") or []:
                    text = str(answer or "").strip()
                    if text:
                        generated.append({"text": text, "authorship": "ai", "generator": "chatgpt-2022-12"})
                        generated[-1].update(platform=platform, kind="comment", source_id=source, dataset=f"hc3/{name}")
        rng = random.Random(args.seed)
        for group in (human, generated):
            rng.shuffle(group)
            rows.extend(group[:args.per_class])

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
