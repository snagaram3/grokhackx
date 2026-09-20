"""Rank existing ingest titles from mocked Gemini JSON. Never live HTTP."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.score import rank_posts


def _posts() -> list[dict[str, str]]:
    return [
        {"title": "Camry hybrid thread", "url": "https://hn.test/1"},
        {"title": "Unrelated kernel", "url": "https://hn.test/2"},
    ]


def _client(text: str | None = None, exc: Exception | None = None) -> MagicMock:
    client = MagicMock()
    if exc is not None:
        client.models.generate_content.side_effect = exc
    else:
        client.models.generate_content.return_value = MagicMock(text=text)
    return client


class RankPostsTests(unittest.TestCase):
    def test_empty_posts_skip_the_model(self) -> None:
        with patch("tools.score._client") as client:
            self.assertEqual(rank_posts("Camry", []), [])
            client.assert_not_called()

    def test_missing_client_keeps_the_buffer_order(self) -> None:
        posts = _posts()
        with patch("tools.score._client", return_value=None):
            self.assertEqual(rank_posts("Camry", posts), posts)

    def test_relevance_json_reorders_existing_titles(self) -> None:
        posts = _posts()
        with patch(
            "tools.score._client",
            return_value=_client('[{"i": 1, "relevance": 90}, {"i": 0, "relevance": 10}]'),
        ):
            ranked = rank_posts("Camry", posts)
        self.assertEqual([p["title"] for p in ranked], ["Unrelated kernel", "Camry hybrid thread"])
        self.assertEqual(ranked[0]["relevance"], 90)
        self.assertEqual(ranked[1]["relevance"], 10)

    def test_fenced_json_still_finds_the_array(self) -> None:
        posts = _posts()
        wrapped = 'Sure.\n```json\n[{"i": 0, "relevance": 70}]\n```'
        with patch("tools.score._client", return_value=_client(wrapped)):
            ranked = rank_posts("Camry", posts)
        self.assertEqual(ranked[0]["title"], "Camry hybrid thread")
        self.assertEqual(ranked[0]["relevance"], 70)
        self.assertEqual(ranked[1]["relevance"], 0)

    def test_no_array_stamps_relevance_zero_instead_of_dropping(self) -> None:
        posts = _posts()
        with patch("tools.score._client", return_value=_client("no json here")):
            ranked = rank_posts("Camry", posts)
        self.assertEqual([p["title"] for p in ranked], [p["title"] for p in posts])
        self.assertTrue(all(p["relevance"] == 0 for p in ranked))

    def test_model_exception_returns_original_posts(self) -> None:
        posts = _posts()
        with patch("tools.score._client", return_value=_client(exc=RuntimeError("timeout"))):
            ranked = rank_posts("Camry", posts)
        self.assertEqual(ranked, posts)
        self.assertTrue(all("relevance" not in p for p in ranked))


if __name__ == "__main__":
    unittest.main()
