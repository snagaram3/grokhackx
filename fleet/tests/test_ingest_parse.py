"""Parse ADK tool envelopes into receipts. No live HTTP or Gemini."""

from __future__ import annotations

import os
import sys
import unittest
from types import SimpleNamespace

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from tools.ingest_parse import (  # noqa: E402
    function_responses_from_event,
    posts_from_response,
    unwrap_tool_response,
)


class UnwrapTests(unittest.TestCase):
    def test_unwraps_result_wrapper_with_at_most_two_keys(self):
        posts = [{"title": "Camry", "url": "https://hn.test/1"}]
        self.assertEqual(unwrap_tool_response({"result": posts}), posts)
        self.assertEqual(unwrap_tool_response({"result": posts, "id": "call-1"}), posts)

    def test_keeps_rich_dicts_and_non_dicts(self):
        rich = {"result": [], "posts": [{"title": "keep"}], "count": 1}
        self.assertEqual(unwrap_tool_response(rich), rich)
        self.assertEqual(unwrap_tool_response([{"title": "Camry"}]), [{"title": "Camry"}])
        self.assertIsNone(unwrap_tool_response(None))


class PostsFromResponseTests(unittest.TestCase):
    def test_reads_posts_key_and_drops_non_objects(self):
        out = posts_from_response(
            {
                "posts": [
                    {"title": "Camry hybrid", "url": "https://hn.test/camry"},
                    "not-a-post",
                    12,
                    {"title": "Camry recall", "url": "https://nhtsa.test/1"},
                ]
            }
        )
        self.assertEqual([p["title"] for p in out], ["Camry hybrid", "Camry recall"])

    def test_unwraps_then_parses_json_string_list(self):
        raw = '[{"title": "Camry", "url": "https://hn.test/1"}]'
        out = posts_from_response({"result": raw})
        self.assertEqual(out[0]["url"], "https://hn.test/1")

    def test_invalid_json_and_empty_envelopes_stay_empty(self):
        self.assertEqual(posts_from_response("{not json"), [])
        self.assertEqual(posts_from_response({"posts": {"title": "Camry"}}), [])
        self.assertEqual(posts_from_response(None), [])
        self.assertEqual(posts_from_response("[]"), [])


class FunctionResponsesFromEventTests(unittest.TestCase):
    def test_reads_getter_and_content_parts_without_inventing_names(self):
        getter_fr = SimpleNamespace(name="collect_hn", response={"posts": [{"title": "HN"}]})
        part_fr = SimpleNamespace(name="collect_public_apis", response={"posts": [{"title": "NHTSA"}]})
        event = SimpleNamespace(
            get_function_responses=lambda: [getter_fr],
            content=SimpleNamespace(parts=[SimpleNamespace(function_response=part_fr)]),
        )
        names = [name for name, _ in function_responses_from_event(event)]
        self.assertEqual(names, ["collect_hn", "collect_public_apis"])

    def test_blank_name_and_missing_parts_do_not_crash(self):
        event = SimpleNamespace(
            get_function_responses=lambda: [SimpleNamespace(name=None, response=None)],
            content=None,
        )
        out = function_responses_from_event(event)
        self.assertEqual(out, [("", None)])
        self.assertEqual(function_responses_from_event(SimpleNamespace()), [])


if __name__ == "__main__":
    unittest.main()
