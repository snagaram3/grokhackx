"""score_and_dedup gates. No Gemini and no live HTTP."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.buffer import add_posts, get_posts, reset  # noqa: E402
from tools.score import score_and_dedup  # noqa: E402


class ScoreAndDedupTests(unittest.TestCase):
    def setUp(self) -> None:
        reset()
        self._env = {
            "GOOGLE_API_KEY": os.environ.get("GOOGLE_API_KEY"),
            "GEMINI_API_KEY": os.environ.get("GEMINI_API_KEY"),
            "GOOGLE_GENAI_USE_VERTEXAI": os.environ.get("GOOGLE_GENAI_USE_VERTEXAI"),
        }
        os.environ.pop("GOOGLE_API_KEY", None)
        os.environ.pop("GEMINI_API_KEY", None)
        os.environ.pop("GOOGLE_GENAI_USE_VERTEXAI", None)

    def tearDown(self) -> None:
        for key, value in self._env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        reset()

    def test_disabled_returns_buffer_without_ranking(self) -> None:
        add_posts([{"title": "Camry", "url": "https://nhtsa.test/camry"}], "collect_hn")
        with patch("tools.score.is_enabled", return_value=False):
            out = score_and_dedup("Camry", posts_json='[{"title":"ignored"}]')
        self.assertEqual(out["status"], "disabled")
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["posts"][0]["title"], "Camry")

    def test_invalid_json_falls_back_to_buffer_and_dedups(self) -> None:
        add_posts(
            [
                {"title": "Camry recall", "url": "https://News.Example/camry/"},
                {"title": "Camry recall", "url": "https://news.example/camry"},
            ],
            "collect_hn",
        )
        with patch("tools.score.is_enabled", return_value=True):
            out = score_and_dedup("Camry", posts_json="{not-json")
        self.assertEqual(out["status"], "success")
        self.assertEqual(out["count"], 1)
        self.assertEqual(get_posts()[0]["url"], "https://News.Example/camry/")

    def test_non_object_json_array_falls_back_to_buffer(self) -> None:
        add_posts([{"title": "Camry wiki", "url": "https://en.wikipedia.org/wiki/Camry"}], "collect_public_apis")
        with patch("tools.score.is_enabled", return_value=True):
            out = score_and_dedup("Camry", posts_json='["not-a-post"]')
        self.assertEqual(out["status"], "success")
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["posts"][0]["title"], "Camry wiki")


if __name__ == "__main__":
    unittest.main()
