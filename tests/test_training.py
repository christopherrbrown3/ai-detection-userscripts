from __future__ import annotations

import unittest
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

from training.features import extract_features, score_with_model
from training.train import (
    apply_calibration,
    conformal_human_threshold,
    fit_sigmoid_calibration,
    normalize_rows,
    split_rows,
)


class TrainingPipelineTests(unittest.TestCase):
    def test_human_quantile_threshold_does_not_collapse_to_the_lowest_score(self) -> None:
        scores = np.asarray([0.1, 0.2, 0.3, 0.4, 0.8, 0.9])
        labels = np.asarray([0, 0, 0, 0, 1, 1])
        result = conformal_human_threshold(scores, labels, target_fpr=0.25)
        self.assertGreater(result["strong"], 0.3)
        self.assertLessEqual(result["empirical_calibration_fpr"], result["target_fpr"])

    def test_group_split_keeps_derived_variants_together(self) -> None:
        rows = []
        for group in range(30):
            for variant in range(2):
                rows.append({
                    "text": f"sample {group} variant {variant}",
                    "label": group % 2,
                    "source_id": f"source-{group}",
                    "platform": "x",
                    "kind": "post",
                })
        normalized = normalize_rows(rows, "label")
        train, calibration, test, audit = split_rows(
            normalized,
            seed=3,
            test_size=0.2,
            calibration_size=0.2,
            group_field="source_id",
        )
        self.assertEqual(audit["method"], "group-shuffle")
        train_groups = {row["source_id"] for row in train}
        calibration_groups = {row["source_id"] for row in calibration}
        test_groups = {row["source_id"] for row in test}
        self.assertFalse(train_groups & calibration_groups)
        self.assertFalse(train_groups & test_groups)
        self.assertFalse(calibration_groups & test_groups)

    def test_mixed_authorship_is_preserved_as_a_third_evaluation_class(self) -> None:
        rows = normalize_rows([
            {"text": "human", "authorship": "human"},
            {"text": "machine", "authorship": "ai"},
            {"text": "hybrid", "authorship": "human-polished"},
        ], "label")
        self.assertEqual([row["_target"] for row in rows], [0, 1, 2])

    def test_held_out_sigmoid_calibration_exports_runtime_parameters(self) -> None:
        logits = np.asarray([-3, -2, -1, -0.5, -0.2, 0.1, 0.3, 0.7, 1, 2] * 3, dtype=float)
        labels = np.asarray([0, 0, 0, 0, 0, 1, 1, 1, 1, 1] * 3, dtype=int)
        calibration = fit_sigmoid_calibration(logits, labels, seed=1)
        scores = apply_calibration(logits, calibration)
        self.assertIn("slope", calibration)
        self.assertIn("intercept", calibration)
        self.assertTrue(np.all((scores >= 0) & (scores <= 1)))
        self.assertGreater(float(scores[-1]), float(scores[0]))

    def test_end_to_end_training_writes_calibrated_runtime_artifacts(self) -> None:
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as temporary:
            input_path = Path(temporary) / "samples.jsonl"
            output_dir = Path(temporary) / "out"
            with input_path.open("w", encoding="utf-8") as handle:
                for index in range(90):
                    human = {
                        "text": (
                            f"I tried repair number {index} after work and it was messier than expected. "
                            "The old screw slipped, so I borrowed a wrench and finished it the next morning."
                        ),
                        "authorship": "human",
                        "platform": "x",
                        "kind": "post",
                        "source_id": f"human-{index}",
                        "generator": "human",
                        "language": "en",
                        "attack": "none",
                    }
                    machine = {
                        "text": (
                            f"Here are the key takeaways for initiative {index}. Moreover, it is important to "
                            "leverage a robust strategic framework. In conclusion, these actionable steps unlock scalable outcomes."
                        ),
                        "authorship": "ai",
                        "platform": "x",
                        "kind": "post",
                        "source_id": f"ai-{index}",
                        "generator": "synthetic-test",
                        "language": "en",
                        "attack": "none",
                    }
                    handle.write(json.dumps(human) + "\n")
                    handle.write(json.dumps(machine) + "\n")
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "training.train",
                    "--input",
                    str(input_path),
                    "--output-dir",
                    str(output_dir),
                    "--min-total",
                    "100",
                    "--target-fpr",
                    "0.1",
                ],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            )
            weights = json.loads((output_dir / "weights.json").read_text(encoding="utf-8"))
            report = json.loads((output_dir / "report.json").read_text(encoding="utf-8"))
            model = weights["models"]["x:post"]
            self.assertEqual(len(model["charNgramWeights"]), 128)
            self.assertEqual(model["calibration"]["method"], "held-out-sigmoid")
            self.assertIn("strong", model["thresholds"])
            self.assertEqual(report["models"]["x:post"]["split"]["n_test"], 36)
            parity_text = "Here are the key takeaways. Moreover, a robust process can unlock scalable outcomes for every team."
            extracted = extract_features(parity_text, kind="post")
            _, python_signal = score_with_model(
                extracted.features,
                intercept=model["intercept"],
                weights=model["weights"],
                char_ngrams=extracted.char_ngrams,
                char_ngram_weights=model["charNgramWeights"],
                calibration=model["calibration"],
            )
            js_score = subprocess.run(
                ["node", str(root / "tests" / "js_score.mjs")],
                input=json.dumps({
                    "bundle": {"metadata": {}, "models": {"x:post": model}},
                    "platform": "x",
                    "kind": "post",
                    "text": parity_text,
                }),
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            )
            javascript_signal = json.loads(js_score.stdout)["signal"]
            self.assertAlmostEqual(python_signal, javascript_signal, places=10)
            bundle_path = Path(temporary) / "models.json"
            bundle_path.write_text(json.dumps({"schema_version": 2, "metadata": {}, "models": {}}), encoding="utf-8")
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "training.export_js",
                    str(output_dir / "weights.json"),
                    "--thresholds-json",
                    str(output_dir / "thresholds.json"),
                    "--model",
                    "x:post",
                    "--models-file",
                    str(bundle_path),
                ],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            )
            exported = json.loads(bundle_path.read_text(encoding="utf-8"))
            self.assertTrue(exported["metadata"]["calibrated"])
            self.assertIn("strong", exported["models"]["x:post"]["thresholds"])


if __name__ == "__main__":
    unittest.main()
