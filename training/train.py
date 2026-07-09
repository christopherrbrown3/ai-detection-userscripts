from __future__ import annotations

import argparse
import json
import os
import random
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split

try:
    # Works when invoked as `python3 -m training.train` from repo root.
    from training.features import Extracted, extract_features  # type: ignore
except ModuleNotFoundError:
    # Works when invoked as `python3 training/train.py`.
    from features import Extracted, extract_features  # type: ignore


FEATURE_ORDER = [
    "aiHedgePresent",
    "buzzPer100w",
    "templatePer100w",
    "discoursePer100w",
    "bigramRepeatRatio",
    "trigramRepeatRatio",
    "sentenceStarterRepeatRatio",
    "typeTokenRatio",
    "hapaxRatio",
    "sentenceLenCV",
    "avgSentenceLen",
    "listMarkerCount",
    "colonPer100w",
    "commaPer100w",
    "exclamationsPer100w",
    "questionsPer100w",
    "emojiPresent",
    "topWordShare",
]


def read_jsonl(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def build_matrix(rows: List[Dict[str, Any]], *, text_field: str, label_field: str) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, float]]]:
    feats: List[List[float]] = []
    labels: List[int] = []
    metrics: List[Dict[str, float]] = []

    for r in rows:
        text = str(r.get(text_field, "") or "")
        label = int(r.get(label_field))
        kind = str(r.get("kind", "post"))
        extracted: Extracted = extract_features(text, kind=kind)
        feats.append([float(extracted.features.get(k, 0.0)) for k in FEATURE_ORDER])
        labels.append(label)
        metrics.append(extracted.metrics)

    return np.asarray(feats, dtype=np.float32), np.asarray(labels, dtype=np.int64), metrics


def fit_lr(X_train: np.ndarray, y_train: np.ndarray, *, seed: int) -> LogisticRegression:
    clf = LogisticRegression(
        C=1.0,
        class_weight=None,
        max_iter=1000,
        random_state=seed,
        n_jobs=None,
        solver="lbfgs",
    )
    clf.fit(X_train, y_train)
    return clf


def eval_model(clf: LogisticRegression, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
    proba = clf.predict_proba(X)[:, 1]
    pred = (proba >= 0.5).astype(np.int64)
    p, r, f1, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)
    auc = roc_auc_score(y, proba) if len(set(y.tolist())) > 1 else float("nan")
    return {
        "precision@0.5": float(p),
        "recall@0.5": float(r),
        "f1@0.5": float(f1),
        "roc_auc": float(auc),
    }


def choose_threshold_for_recall(proba: np.ndarray, y: np.ndarray, *, target_recall: float) -> float:
    # Pick the lowest threshold that meets recall >= target_recall.
    # This biases toward fewer false negatives.
    pairs = sorted(zip(proba.tolist(), y.tolist()), key=lambda x: x[0], reverse=True)
    tp = 0
    fn = int(sum(1 for _, yy in pairs if yy == 1))
    best = 0.5
    for score, yy in pairs:
        if yy == 1:
            tp += 1
            fn -= 1
        recall = tp / max(1, tp + fn)
        if recall >= target_recall:
            best = score
    return float(best)


def export_weights(clf: LogisticRegression) -> Dict[str, Any]:
    coef = clf.coef_.reshape(-1).tolist()
    weights = {k: float(v) for k, v in zip(FEATURE_ORDER, coef)}
    return {
        "intercept": float(clf.intercept_[0]),
        "weights": weights,
        "feature_order": FEATURE_ORDER,
    }


def normalize_kind(value: Any) -> str:
    v = str(value or "post").lower().strip()
    if v in ("reply", "replies", "comment", "comments"):
        return "comment"
    return "post"


def normalize_platform(value: Any) -> str:
    v = str(value or "").lower().strip()
    if v in ("twitter", "x", "x.com"):
        return "x"
    if v in ("linkedin", "linkedin.com"):
        return "linkedin"
    if v in ("reddit", "reddit.com", "old.reddit.com"):
        return "reddit"
    return v or "unknown"


def subset_rows(rows: List[Dict[str, Any]], *, platform: str, kind: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        rp = normalize_platform(r.get("platform"))
        rk = normalize_kind(r.get("kind"))
        if rp == platform and rk == kind:
            rr = dict(r)
            rr["platform"] = rp
            rr["kind"] = rk
            out.append(rr)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Path to JSONL with fields: text, label (and optional kind/platform).")
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--text-field", default="text")
    ap.add_argument("--label-field", default="label")
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--target-recall", type=float, default=0.85)
    ap.add_argument("--min-total", type=int, default=80, help="Minimum rows required to train a model subset.")
    args = ap.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    random.seed(args.seed)
    np.random.seed(args.seed)

    rows = read_jsonl(args.input)
    if not rows:
        raise SystemExit("No rows found in input.")

    # Train per-platform/per-kind models when metadata is available; otherwise train a default model.
    model_specs = [
        ("linkedin", "post"),
        ("linkedin", "comment"),
        ("reddit", "post"),
        ("reddit", "comment"),
        ("x", "post"),
        ("x", "comment"),
    ]

    all_rows_norm: List[Dict[str, Any]] = []
    for r in rows:
        rr = dict(r)
        rr["platform"] = normalize_platform(rr.get("platform"))
        rr["kind"] = normalize_kind(rr.get("kind"))
        all_rows_norm.append(rr)

    out_models: Dict[str, Any] = {"feature_order": FEATURE_ORDER, "models": {}}
    out_thresholds: Dict[str, Any] = {"target_recall": float(args.target_recall), "models": {}}
    out_report: Dict[str, Any] = {"seed": int(args.seed), "test_size": float(args.test_size), "models": {}}

    min_total = int(args.min_total)

    def train_one(name: str, subset: List[Dict[str, Any]]) -> None:
        if len(subset) < min_total:
            return
        y_vals = [int(r.get(args.label_field)) for r in subset]
        if len(set(y_vals)) < 2:
            return
        # Stratified splits require >=2 examples per class, and enough examples to distribute across train/test.
        counts: Dict[int, int] = {}
        for yy in y_vals:
            counts[yy] = counts.get(yy, 0) + 1
        if min(counts.values()) < 2:
            return

        try:
            train_rows, test_rows = train_test_split(
                subset,
                test_size=args.test_size,
                random_state=args.seed,
                shuffle=True,
                stratify=y_vals,
            )
        except ValueError:
            # If the stratified split is infeasible (e.g. very small subsets), fall back to non-stratified.
            train_rows, test_rows = train_test_split(
                subset,
                test_size=args.test_size,
                random_state=args.seed,
                shuffle=True,
                stratify=None,
            )
        # Ensure the training split still contains both labels.
        y_train_vals = [int(r.get(args.label_field)) for r in train_rows]
        if len(set(y_train_vals)) < 2:
            return
        X_train, y_train, _ = build_matrix(train_rows, text_field=args.text_field, label_field=args.label_field)
        X_test, y_test, metrics_test = build_matrix(test_rows, text_field=args.text_field, label_field=args.label_field)

        clf = fit_lr(X_train, y_train, seed=args.seed)
        proba_test = clf.predict_proba(X_test)[:, 1]
        thr = choose_threshold_for_recall(proba_test, y_test, target_recall=args.target_recall)

        # Length bucket breakdown.
        df = pd.DataFrame(metrics_test)
        df["p_ai"] = proba_test
        df["y"] = y_test
        buckets = [(0, 20), (20, 50), (50, 120), (120, 10_000)]
        bucket_report: Dict[str, Any] = {}
        for lo, hi in buckets:
            mask = (df["wordCount"] >= lo) & (df["wordCount"] < hi)
            sub = df[mask]
            if sub.empty:
                continue
            yb = sub["y"].to_numpy().astype(np.int64)
            pb = sub["p_ai"].to_numpy().astype(np.float32)
            predb = (pb >= thr).astype(np.int64)
            p, r, f1, _ = precision_recall_fscore_support(yb, predb, average="binary", zero_division=0)
            bucket_report[f"{lo}-{hi}"] = {"n": int(len(sub)), "precision": float(p), "recall": float(r), "f1": float(f1)}

        out_models["models"][name] = export_weights(clf)
        out_thresholds["models"][name] = {"binary_threshold": float(thr)}
        out_report["models"][name] = {
            "train": eval_model(clf, X_train, y_train),
            "test": eval_model(clf, X_test, y_test),
            "n_train": int(len(train_rows)),
            "n_test": int(len(test_rows)),
            "test_length_buckets@threshold": bucket_report,
        }

    for platform, kind in model_specs:
        subset = subset_rows(all_rows_norm, platform=platform, kind=kind)
        train_one(f"{platform}:{kind}", subset)

    # Fallback/default model trained on everything.
    train_one("default", all_rows_norm)

    if not out_models["models"]:
        raise SystemExit(
            f"No models trained. Need >= {min_total} rows (and both labels) per subset; "
            "either provide more data or lower --min-total."
        )

    with open(os.path.join(args.output_dir, "weights.json"), "w", encoding="utf-8") as f:
        json.dump(out_models, f, indent=2, sort_keys=True)
    with open(os.path.join(args.output_dir, "thresholds.json"), "w", encoding="utf-8") as f:
        json.dump(out_thresholds, f, indent=2, sort_keys=True)
    with open(os.path.join(args.output_dir, "report.json"), "w", encoding="utf-8") as f:
        json.dump(out_report, f, indent=2, sort_keys=True)

    print("Wrote:", os.path.join(args.output_dir, "weights.json"))
    print("Wrote:", os.path.join(args.output_dir, "thresholds.json"))
    print("Wrote:", os.path.join(args.output_dir, "report.json"))
    print("Models:", ", ".join(sorted(out_models["models"].keys())))


if __name__ == "__main__":
    main()
