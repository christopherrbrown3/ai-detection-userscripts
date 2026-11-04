"""Sample RAID's Reddit posts into the rubric JSONL schema without downloading 11.8 GB.

RAID (Dugan et al., ACL 2024; https://huggingface.co/datasets/liamdugan/raid, MIT)
stores train.csv sorted by domain. Reddit rows sit between roughly 61.5% and 78.5%
of the file. This script reads 160 evenly spaced 380 KB windows of that range with
HTTP range requests (about 60 MB), keeps unattacked posts by humans and by chat
models, and splits them 50/50 by title (source_id) into dev and test files.

    python3 scripts/sample_raid_reddit.py --output-dir training/data

Writes raid-reddit-dev.jsonl and raid-reddit-test.jsonl. Cue phrases were mined on
dev only; report test. Base (non-chat) generators are dropped: social posts come
from chat assistants.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import hashlib
import io
import json
import os
import re
import urllib.request

URL = "https://huggingface.co/datasets/liamdugan/raid/resolve/main/train.csv"
SIZE = 11779491051
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
ROW_START = re.compile(r"\n(" + UUID + r"),")
CHAT_MODELS = {"gpt4", "chatgpt", "llama-chat", "mistral-chat", "mpt-chat", "cohere-chat"}


def fetch(offset: int, length: int) -> str:
    request = urllib.request.Request(URL, headers={"Range": f"bytes={offset}-{offset + length - 1}"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read().decode("utf-8", "replace")


def rows_at(offset: int, length: int = 380_000) -> list[list[str]]:
    text = fetch(offset, length)
    start = ROW_START.search(text)
    if not start:
        return []
    body = text[start.start() + 1:]
    body = body[:body.rfind("\n")]
    rows = []
    try:
        for row in csv.reader(io.StringIO(body)):
            if len(row) >= 11 and re.fullmatch(UUID, row[0]):
                rows.append(row)
    except csv.Error:
        pass
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--windows", type=int, default=160)
    args = parser.parse_args()

    low, high = 0.615, 0.785
    offsets = [int(SIZE * (low + (high - low) * k / (args.windows - 1))) for k in range(args.windows)]
    seen: dict[str, list[str]] = {}
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for rows in pool.map(rows_at, offsets):
            for row in rows:
                if row[7] == "reddit":
                    seen[row[0]] = row

    # Columns: id, adv_source_id, source_id, model, decoding, repetition_penalty, attack, domain, title, prompt, generation
    splits: dict[str, list[dict]] = {"dev": [], "test": []}
    for row in seen.values():
        model, attack = row[3], row[6]
        if attack != "none" or (model != "human" and model not in CHAT_MODELS):
            continue
        split = "dev" if int(hashlib.md5(row[2].encode()).hexdigest(), 16) % 2 == 0 else "test"
        splits[split].append({
            "text": row[10], "authorship": "human" if model == "human" else "ai", "generator": model,
            "platform": "reddit", "kind": "post", "source_id": row[2], "dataset": "raid/reddit", "raid_id": row[0],
        })
    os.makedirs(args.output_dir, exist_ok=True)
    for split, rows in splits.items():
        rows.sort(key=lambda item: item["raid_id"])
        path = os.path.join(args.output_dir, f"raid-reddit-{split}.jsonl")
        with open(path, "w", encoding="utf-8") as handle:
            for item in rows:
                handle.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"Wrote {len(rows)} rows to {path}")


if __name__ == "__main__":
    main()
