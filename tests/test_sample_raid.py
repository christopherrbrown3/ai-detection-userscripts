from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("sample_raid_reddit", ROOT / "scripts" / "sample_raid_reddit.py")
sampler = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sampler)

ID_A = "00000000-0000-4000-8000-000000000001"
ID_B = "00000000-0000-4000-8000-000000000002"


def row(uid: str, generation: str) -> str:
    return f'{uid},{uid},{uid},gpt4,greedy,no,none,reddit,Title,,"{generation}"'


class SampleRaidTests(unittest.TestCase):
    def test_window_drops_a_generation_clipped_by_the_window_end(self) -> None:
        window = "tail of an earlier row\n" + row(ID_A, "complete\nmultiline post") + "\n" + row(ID_B, "clipped\ngener")[:-1] + "\nmore"
        original = sampler.fetch
        sampler.fetch = lambda offset, length: window
        try:
            rows = sampler.rows_at(0)
        finally:
            sampler.fetch = original
        self.assertEqual([item[0] for item in rows], [ID_A])
        self.assertEqual(rows[0][10], "complete\nmultiline post")


if __name__ == "__main__":
    unittest.main()
