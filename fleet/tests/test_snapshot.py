"""Snapshot object names. Never writes GCS or disk."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.snapshot import _slug  # noqa: E402


class SnapshotSlugTests(unittest.TestCase):
    def test_slug_folds_punctuation_and_case(self) -> None:
        self.assertEqual(_slug("Toyota Camry!!"), "toyota-camry")
        self.assertEqual(_slug("  F-150  "), "f-150")

    def test_empty_or_symbols_fall_back_to_phrase(self) -> None:
        self.assertEqual(_slug(""), "phrase")
        self.assertEqual(_slug("!!!"), "phrase")

    def test_slug_caps_at_eighty(self) -> None:
        long = "camry-" + ("x" * 100)
        self.assertEqual(len(_slug(long)), 80)
        self.assertTrue(_slug(long).startswith("camry-"))


if __name__ == "__main__":
    unittest.main()
