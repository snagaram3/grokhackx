"""Per-request ingest buffer. Facts only — never invents receipts."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.buffer import add_posts, get_posts, get_tools, reset, set_posts, stamp  # noqa: E402


class TestIngestBuffer(unittest.TestCase):
    def setUp(self) -> None:
        reset()

    def test_reset_starts_empty(self) -> None:
        add_posts([{"title": "Camry", "url": "https://nhtsa.test/camry"}], "collect_hn")
        reset()
        self.assertEqual(get_posts(), [])
        self.assertEqual(get_tools(), [])

    def test_add_posts_keeps_order_and_records_tools_even_when_empty(self) -> None:
        add_posts(
            [
                {"title": "Camry hybrid", "url": "https://hn.test/1"},
                {"title": "Camry recall", "url": "https://nhtsa.test/camry"},
            ],
            "collect_hn",
        )
        add_posts([], "score_and_dedup")
        add_posts([{"title": "Camry wiki", "url": "https://en.wikipedia.org/wiki/Camry"}], "collect_public_apis")
        add_posts([], "score_and_dedup")

        posts = get_posts()
        self.assertEqual([p["title"] for p in posts], ["Camry hybrid", "Camry recall", "Camry wiki"])
        self.assertEqual(get_tools(), ["collect_hn", "score_and_dedup", "collect_public_apis"])

    def test_set_posts_replaces_the_buffer_without_touching_tools(self) -> None:
        add_posts([{"title": "old", "url": "https://old.test/1"}], "collect_hn")
        set_posts([{"title": "Camry", "url": "https://nhtsa.test/camry"}])
        self.assertEqual(get_posts()[0]["title"], "Camry")
        self.assertEqual(get_tools(), ["collect_hn"])

    def test_stamp_fills_missing_lineage_and_keeps_existing_tool(self) -> None:
        fresh = stamp({"title": "Camry", "url": "https://hn.test/1"}, "collect_hn")
        self.assertEqual(fresh["tool"], "collect_hn")
        self.assertTrue(fresh["collectedAt"])

        kept = stamp(
            {
                "title": "Camry",
                "url": "https://hn.test/1",
                "tool": "collect_public_apis",
                "collectedAt": "2026-08-26T12:00:00+00:00",
            },
            "collect_hn",
        )
        self.assertEqual(kept["tool"], "collect_public_apis")
        self.assertEqual(kept["collectedAt"], "2026-08-26T12:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
