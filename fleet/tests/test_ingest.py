"""Dedup and permission gates for fleet ingest. No live HTTP."""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from tools.permissions import enabled_tools, is_enabled  # noqa: E402
from tools.score import dedup_posts  # noqa: E402


class DedupPostsTests(unittest.TestCase):
    def test_url_case_and_trailing_slash_collapse(self):
        posts = [
            {"url": "https://News.Example/Camry/", "title": "First"},
            {"url": "https://news.example/camry", "title": "Second"},
        ]
        out = dedup_posts(posts)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["title"], "First")

    def test_title_whitespace_and_case_collapse(self):
        posts = [
            {"url": "https://a.test/1", "title": "Camry  Recall"},
            {"url": "https://a.test/2", "title": "camry recall"},
        ]
        out = dedup_posts(posts)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["url"], "https://a.test/1")

    def test_empty_url_does_not_collapse_distinct_titles(self):
        posts = [
            {"url": "", "title": "Camry"},
            {"url": "", "title": "Tesla"},
        ]
        self.assertEqual(len(dedup_posts(posts)), 2)

    def test_blank_title_still_dedupes_on_url(self):
        posts = [
            {"url": "https://nhtsa.test/camry", "title": ""},
            {"url": "https://nhtsa.test/camry/", "title": ""},
        ]
        self.assertEqual(len(dedup_posts(posts)), 1)


class PermissionTests(unittest.TestCase):
    def test_unknown_tool_is_disabled(self):
        self.assertFalse(is_enabled("not_a_real_tool"))
        enabled = enabled_tools()
        self.assertEqual(enabled.get("score_and_dedup"), True)
        self.assertEqual(enabled.get("collect_hn"), True)
        self.assertEqual(enabled.get("collect_public_apis"), True)


if __name__ == "__main__":
    unittest.main()
