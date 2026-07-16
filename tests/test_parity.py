from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

from training.features import extract_features


ROOT = Path(__file__).resolve().parents[1]


class FeatureParityTests(unittest.TestCase):
    def test_python_and_javascript_extractors_match(self) -> None:
        rows = [
            {
                "kind": "post",
                "text": "Here are three notes:\n- I tried Tuesday's build.\n- It worked twice.\n- Revision 42 failed… why?",
            },
            {
                "kind": "comment",
                "text": "Let’s dive in—then stop. I don't love templates, but this one is useful! https://example.com #testing",
            },
            {
                "kind": "post",
                "text": "A café test with emoji 🙂, full-width digits １２３, zero-width\u200btext, and repeated repeated words.",
            },
        ]
        completed = subprocess.run(
            ["node", str(ROOT / "tests" / "js_features.mjs")],
            input=json.dumps(rows),
            text=True,
            capture_output=True,
            check=True,
            cwd=ROOT,
        )
        javascript = json.loads(completed.stdout)
        for row, js_value in zip(rows, javascript):
            python = extract_features(row["text"], kind=row["kind"])
            self.assertEqual(set(python.features), set(js_value["features"]))
            for key, value in python.features.items():
                self.assertAlmostEqual(value, js_value["features"][key], places=10, msg=key)
            self.assertEqual(len(python.char_ngrams), len(js_value["charNgrams"]))
            for index, value in enumerate(python.char_ngrams):
                self.assertAlmostEqual(value, js_value["charNgrams"][index], places=10, msg=f"char[{index}]")
            for key in [
                "wordCount", "charCount", "sentenceCount", "avgSentenceLen", "mattr25",
                "sentenceLenCV", "bigramRepeatRatio", "charTrigramRepeatRatio",
            ]:
                self.assertAlmostEqual(python.metrics[key], js_value["metrics"][key], places=10, msg=key)


if __name__ == "__main__":
    unittest.main()
