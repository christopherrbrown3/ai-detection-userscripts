from __future__ import annotations

import argparse
import json
import math
import os
import random
from collections import Counter
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit, train_test_split

try:
    from training.features import CHAR_HASH_DIM, Extracted, extract_features  # type: ignore
except ModuleNotFoundError:
    from features import CHAR_HASH_DIM, Extracted, extract_features  # type: ignore


FEATURE_ORDER = [
    "aiHedgePresent",
    "buzzPer100w",
    "templatePer100w",
    "discoursePer100w",
    "bigramRepeatRatio",
    "trigramRepeatRatio",
    "sentenceStarterRepeatRatio",
    "charTrigramRepeatRatio",
    "typeTokenRatio",
    "mattr25",
    "hapaxRatio",
    "sentenceLenCV",
    "avgSentenceLen",
    "wordLenCV",
    "paragraphLenCV",
    "contractionRatio",
    "firstPersonRatio",
    "secondPersonRatio",
    "shortSentenceRatio",
    "stopwordRatio",
    "listMarkerCount",
    "newlineRatio",
    "colonPer100w",
    "commaPer100w",
    "semicolonPer100w",
    "exclamationsPer100w",
    "questionsPer100w",
    "ellipsisPer100w",
    "quoteRatio",
    "parenRatio",
    "punctuationVariety",
    "emojiPresent",
    "topWordShare",
]

MODEL_SPECS = [
    ("linkedin", "post"),
    ("linkedin", "comment"),
    ("reddit", "post"),
    ("reddit", "comment"),
    ("x", "post"),
    ("x", "comment"),
]


def read_jsonl(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"Line {line_number} is not a JSON object.")
            rows.append(value)
    return rows


def normalize_kind(value: Any) -> str:
    normalized = str(value or "post").lower().strip()
    return "comment" if normalized in {"reply", "replies", "comment", "comments"} else "post"


def normalize_platform(value: Any) -> str:
    normalized = str(value or "").lower().strip()
    if normalized in {"twitter", "x", "x.com"}:
        return "x"
    if normalized in {"linkedin", "linkedin.com"}:
        return "linkedin"
    if normalized in {"reddit", "reddit.com", "old.reddit.com"}:
        return "reddit"
    return normalized or "unknown"


def normalize_authorship(row: Dict[str, Any], label_field: str) -> int:
    value = row.get("authorship", row.get(label_field))
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric = int(value)
        if numeric in {0, 1, 2}:
            return numeric
    normalized = str(value or "").lower().strip().replace("_", "-")
    if normalized in {"0", "human", "human-written", "hwt"}:
        return 0
    if normalized in {"1", "ai", "machine", "generated", "ai-generated", "mgt", "llm"}:
        return 1
    if normalized in {
        "2", "mixed", "hybrid", "assisted", "ai-assisted", "human-polished",
        "ai-polished", "human-edited", "coauthored", "co-authored",
    }:
        return 2
    raise ValueError(f"Unsupported label/authorship value: {value!r}")


def normalize_rows(rows: Sequence[Dict[str, Any]], label_field: str) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for index, row in enumerate(rows):
        copy = dict(row)
        copy["platform"] = normalize_platform(copy.get("platform"))
        copy["kind"] = normalize_kind(copy.get("kind"))
        copy["_target"] = normalize_authorship(copy, label_field)
        copy.setdefault("source_id", copy.get("pair_id") or copy.get("document_id") or f"row-{index}")
        copy.setdefault("authorship", {0: "human", 1: "ai", 2: "mixed"}[copy["_target"]])
        normalized.append(copy)
    return normalized


def subset_rows(rows: Sequence[Dict[str, Any]], *, platform: str, kind: str) -> List[Dict[str, Any]]:
    return [row for row in rows if row["platform"] == platform and row["kind"] == kind]


def build_matrix(
    rows: Sequence[Dict[str, Any]],
    *,
    text_field: str,
) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, float]]]:
    vectors: List[List[float]] = []
    labels: List[int] = []
    metrics: List[Dict[str, float]] = []
    for row in rows:
        text = str(row.get(text_field, "") or "")
        extracted: Extracted = extract_features(text, kind=str(row.get("kind", "post")))
        structured = [float(extracted.features.get(key, 0.0)) for key in FEATURE_ORDER]
        vectors.append(structured + [float(value) for value in extracted.char_ngrams])
        labels.append(int(row["_target"]))
        metrics.append(extracted.metrics)
    return (
        np.asarray(vectors, dtype=np.float64),
        np.asarray(labels, dtype=np.int64),
        metrics,
    )


def _stratify_values(rows: Sequence[Dict[str, Any]]) -> List[str] | None:
    values = [f"{row['_target']}:{row.get('kind', 'post')}" for row in rows]
    counts = Counter(values)
    return values if counts and min(counts.values()) >= 2 else None


def split_rows(
    rows: Sequence[Dict[str, Any]],
    *,
    seed: int,
    test_size: float,
    calibration_size: float,
    group_field: str,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    if test_size <= 0 or calibration_size <= 0 or test_size + calibration_size >= 0.8:
        raise ValueError("test-size and calibration-size must be positive and leave at least 20% for training.")
    row_list = list(rows)
    groups = [str(row.get(group_field, "")) for row in row_list]
    use_groups = bool(group_field) and len(set(groups)) >= 6 and len(set(groups)) < len(groups) and all(groups)

    if use_groups:
        outer = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
        train_cal_idx, test_idx = next(outer.split(row_list, groups=groups))
        train_cal = [row_list[index] for index in train_cal_idx]
        test = [row_list[index] for index in test_idx]
        train_cal_groups = [groups[index] for index in train_cal_idx]
        relative_calibration = calibration_size / (1.0 - test_size)
        inner = GroupShuffleSplit(n_splits=1, test_size=relative_calibration, random_state=seed + 1)
        train_idx, calibration_idx = next(inner.split(train_cal, groups=train_cal_groups))
        train = [train_cal[index] for index in train_idx]
        calibration = [train_cal[index] for index in calibration_idx]
        method = "group-shuffle"
    else:
        train_cal, test = train_test_split(
            row_list,
            test_size=test_size,
            random_state=seed,
            shuffle=True,
            stratify=_stratify_values(row_list),
        )
        relative_calibration = calibration_size / (1.0 - test_size)
        train, calibration = train_test_split(
            train_cal,
            test_size=relative_calibration,
            random_state=seed + 1,
            shuffle=True,
            stratify=_stratify_values(train_cal),
        )
        method = "stratified-random"

    audit = {
        "method": method,
        "group_field": group_field if use_groups else None,
        "n_train": len(train),
        "n_calibration": len(calibration),
        "n_test": len(test),
    }
    if use_groups:
        group_sets = {
            "train": {str(row[group_field]) for row in train},
            "calibration": {str(row[group_field]) for row in calibration},
            "test": {str(row[group_field]) for row in test},
        }
        audit["group_overlap"] = {
            "train_calibration": len(group_sets["train"] & group_sets["calibration"]),
            "train_test": len(group_sets["train"] & group_sets["test"]),
            "calibration_test": len(group_sets["calibration"] & group_sets["test"]),
        }
    return train, calibration, test, audit


def fit_base_model(X: np.ndarray, y: np.ndarray, *, seed: int, class_weight: str | None) -> LogisticRegression:
    model = LogisticRegression(
        C=1.0,
        class_weight=class_weight,
        max_iter=2000,
        random_state=seed,
        solver="lbfgs",
    )
    model.fit(X, y)
    return model


def fit_sigmoid_calibration(logits: np.ndarray, y: np.ndarray, *, seed: int) -> Dict[str, float]:
    if len(logits) < 20 or len(set(y.tolist())) < 2:
        raise ValueError("Calibration requires at least 20 examples and both binary labels.")
    calibrator = LogisticRegression(C=1.0, max_iter=1000, random_state=seed, solver="lbfgs")
    calibrator.fit(logits.reshape(-1, 1), y)
    return {
        "slope": float(calibrator.coef_[0, 0]),
        "intercept": float(calibrator.intercept_[0]),
        "method": "held-out-sigmoid",
    }


def apply_calibration(logits: np.ndarray, calibration: Dict[str, float]) -> np.ndarray:
    values = float(calibration["slope"]) * logits + float(calibration["intercept"])
    values = np.clip(values, -20, 20)
    return 1.0 / (1.0 + np.exp(-values))


def conformal_human_threshold(scores: np.ndarray, y: np.ndarray, *, target_fpr: float) -> Dict[str, float | int | str]:
    if not 0 < target_fpr < 1:
        raise ValueError("target_fpr must be between 0 and 1.")
    human = np.sort(np.asarray(scores[y == 0], dtype=np.float64))
    if not len(human):
        raise ValueError("A human-authored calibration subset is required.")
    quantile_index = int(math.ceil((1.0 - target_fpr) * len(human))) - 1
    quantile_index = max(0, min(len(human) - 1, quantile_index))
    threshold = float(np.nextafter(human[quantile_index], math.inf))
    empirical_fpr = float(np.mean(human >= threshold))
    return {
        "strong": threshold,
        "target_fpr": float(target_fpr),
        "calibration_human_n": int(len(human)),
        "empirical_calibration_fpr": empirical_fpr,
        "minimum_resolvable_fpr": float(1.0 / (len(human) + 1)),
        "method": "held-out-human-quantile",
    }


def expected_calibration_error(scores: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0, 1, bins + 1)
    total = len(scores)
    if not total:
        return float("nan")
    result = 0.0
    for index in range(bins):
        lower, upper = edges[index], edges[index + 1]
        mask = (scores >= lower) & (scores < upper if index < bins - 1 else scores <= upper)
        if not np.any(mask):
            continue
        result += float(np.mean(mask)) * abs(float(np.mean(scores[mask])) - float(np.mean(y[mask])))
    return result


def binary_metrics(scores: np.ndarray, y: np.ndarray, *, threshold: float) -> Dict[str, Any]:
    binary_mask = y < 2
    scores = scores[binary_mask]
    y = y[binary_mask]
    if not len(y):
        return {"n": 0}
    predictions = (scores >= threshold).astype(np.int64)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y, predictions, average="binary", zero_division=0
    )
    false_positives = int(np.sum((predictions == 1) & (y == 0)))
    human_count = int(np.sum(y == 0))
    return {
        "n": int(len(y)),
        "n_human": human_count,
        "n_ai": int(np.sum(y == 1)),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "false_positive_rate": float(false_positives / human_count) if human_count else None,
        "roc_auc": float(roc_auc_score(y, scores)) if len(set(y.tolist())) > 1 else None,
        "average_precision": float(average_precision_score(y, scores)) if len(set(y.tolist())) > 1 else None,
        "brier": float(brier_score_loss(y, scores)),
        "expected_calibration_error": float(expected_calibration_error(scores, y)),
    }


def _length_bucket(word_count: float) -> str:
    if word_count < 20:
        return "0-19"
    if word_count < 50:
        return "20-49"
    if word_count < 120:
        return "50-119"
    return "120+"


def slice_report(
    rows: Sequence[Dict[str, Any]],
    metrics: Sequence[Dict[str, float]],
    scores: np.ndarray,
    y: np.ndarray,
    *,
    threshold: float,
) -> Dict[str, Any]:
    dimensions = ["platform", "kind", "authorship", "generator", "attack", "language"]
    result: Dict[str, Any] = {}
    values_by_dimension: Dict[str, List[str]] = {
        dimension: [str(row.get(dimension, "unknown") or "unknown") for row in rows]
        for dimension in dimensions
    }
    values_by_dimension["length"] = [_length_bucket(metric["wordCount"]) for metric in metrics]
    for dimension, values in values_by_dimension.items():
        result[dimension] = {}
        for value in sorted(set(values)):
            mask = np.asarray([item == value for item in values], dtype=bool)
            sub_y = y[mask]
            sub_scores = scores[mask]
            result[dimension][value] = {}
            if np.any(sub_y < 2):
                result[dimension][value] = binary_metrics(sub_scores, sub_y, threshold=threshold)
            if np.any(sub_y == 2):
                mixed_scores = sub_scores[sub_y == 2]
                result[dimension][value]["mixed"] = {
                    "n": int(len(mixed_scores)),
                    "mean_signal": float(np.mean(mixed_scores)),
                    "median_signal": float(np.median(mixed_scores)),
                    "share_at_or_above_strong": float(np.mean(mixed_scores >= threshold)),
                }
    return result


def export_model(model: LogisticRegression, calibration: Dict[str, float]) -> Dict[str, Any]:
    coefficients = model.coef_.reshape(-1).tolist()
    structured = coefficients[:len(FEATURE_ORDER)]
    char_weights = coefficients[len(FEATURE_ORDER):len(FEATURE_ORDER) + CHAR_HASH_DIM]
    return {
        "intercept": float(model.intercept_[0]),
        "weights": {key: float(value) for key, value in zip(FEATURE_ORDER, structured)},
        "charNgramWeights": [float(value) for value in char_weights],
        "char_hash_dim": CHAR_HASH_DIM,
        "calibration": calibration,
        "feature_order": FEATURE_ORDER,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="JSONL with text, label/authorship, and optional metadata.")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--text-field", default="text")
    parser.add_argument("--label-field", default="label")
    parser.add_argument("--group-field", default="source_id", help="Keeps paired/derived documents in one split.")
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--calibration-size", type=float, default=0.2)
    parser.add_argument("--target-fpr", type=float, default=0.01)
    parser.add_argument("--min-total", type=int, default=300)
    parser.add_argument("--class-weight", choices=["none", "balanced"], default="balanced")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    random.seed(args.seed)
    np.random.seed(args.seed)
    rows = normalize_rows(read_jsonl(args.input), args.label_field)
    if not rows:
        raise SystemExit("No rows found in input.")

    output_models: Dict[str, Any] = {
        "schema_version": 2,
        "feature_order": FEATURE_ORDER,
        "char_hash_dim": CHAR_HASH_DIM,
        "models": {},
    }
    output_thresholds: Dict[str, Any] = {
        "target_fpr": float(args.target_fpr),
        "class_weight": args.class_weight,
        "models": {},
    }
    output_report: Dict[str, Any] = {
        "seed": int(args.seed),
        "test_size": float(args.test_size),
        "calibration_size": float(args.calibration_size),
        "target_fpr": float(args.target_fpr),
        "dataset": {
            "n": len(rows),
            "authorship": dict(Counter(str(row["authorship"]) for row in rows)),
            "platform": dict(Counter(str(row["platform"]) for row in rows)),
            "kind": dict(Counter(str(row["kind"]) for row in rows)),
        },
        "models": {},
        "skipped_models": {},
    }
    class_weight = None if args.class_weight == "none" else "balanced"

    def train_one(name: str, subset: Sequence[Dict[str, Any]]) -> None:
        binary_rows = [row for row in subset if int(row["_target"]) < 2]
        binary_counts = Counter(int(row["_target"]) for row in binary_rows)
        if len(binary_rows) < args.min_total or len(binary_counts) < 2 or min(binary_counts.values()) < 20:
            output_report["skipped_models"][name] = {
                "reason": "insufficient binary examples or class coverage",
                "n_total": len(subset),
                "binary_counts": dict(binary_counts),
            }
            return

        train_rows, calibration_rows, test_rows, split_audit = split_rows(
            subset,
            seed=args.seed,
            test_size=args.test_size,
            calibration_size=args.calibration_size,
            group_field=args.group_field,
        )
        train_binary = [row for row in train_rows if int(row["_target"]) < 2]
        calibration_binary = [row for row in calibration_rows if int(row["_target"]) < 2]
        if len({int(row["_target"]) for row in train_binary}) < 2 or len({int(row["_target"]) for row in calibration_binary}) < 2:
            output_report["skipped_models"][name] = {
                "reason": "train or calibration split lost a binary class",
                "split": split_audit,
            }
            return

        X_train, y_train, _ = build_matrix(train_binary, text_field=args.text_field)
        X_calibration, y_calibration, _ = build_matrix(calibration_binary, text_field=args.text_field)
        X_test, y_test, test_metrics = build_matrix(test_rows, text_field=args.text_field)
        model = fit_base_model(X_train, y_train, seed=args.seed, class_weight=class_weight)
        calibration = fit_sigmoid_calibration(model.decision_function(X_calibration), y_calibration, seed=args.seed)
        calibration_scores = apply_calibration(model.decision_function(X_calibration), calibration)
        threshold_info = conformal_human_threshold(
            calibration_scores,
            y_calibration,
            target_fpr=args.target_fpr,
        )
        strong_threshold = float(threshold_info["strong"])
        moderate_threshold = max(0.2, min(0.5, strong_threshold - 0.12))
        threshold_info["moderate"] = moderate_threshold

        test_scores = apply_calibration(model.decision_function(X_test), calibration)
        model_export = export_model(model, calibration)
        model_export["thresholds"] = dict(threshold_info)
        output_models["models"][name] = model_export
        output_thresholds["models"][name] = dict(threshold_info)
        output_report["models"][name] = {
            "split": split_audit,
            "calibration": {
                "n": int(len(y_calibration)),
                "metrics_at_strong": binary_metrics(calibration_scores, y_calibration, threshold=strong_threshold),
                **threshold_info,
            },
            "test": binary_metrics(test_scores, y_test, threshold=strong_threshold),
            "test_slices": slice_report(
                test_rows,
                test_metrics,
                test_scores,
                y_test,
                threshold=strong_threshold,
            ),
        }

    for platform, kind in MODEL_SPECS:
        train_one(f"{platform}:{kind}", subset_rows(rows, platform=platform, kind=kind))
    train_one("default", rows)

    if not output_models["models"]:
        raise SystemExit(
            f"No models trained. Provide at least {args.min_total} binary rows with both labels per target, "
            "or lower --min-total for a development-only run."
        )

    for filename, payload in [
        ("weights.json", output_models),
        ("thresholds.json", output_thresholds),
        ("report.json", output_report),
    ]:
        path = os.path.join(args.output_dir, filename)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True, allow_nan=False)
        print("Wrote:", path)
    print("Models:", ", ".join(sorted(output_models["models"])))


if __name__ == "__main__":
    main()
