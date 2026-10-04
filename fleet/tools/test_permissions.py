"""Leftover fleet permission gates. Facts only — never invent enabled tools."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import permissions  # noqa: E402


class TestPermissionsMissingFile(unittest.TestCase):
    def test_missing_file_disables_every_tool(self) -> None:
        missing = Path("/tmp/does-not-exist-hawkxai-permissions.json")
        with patch.object(permissions, "PATH", missing):
            self.assertEqual(permissions.load_permissions(), {"tools": {}})
            self.assertEqual(permissions.enabled_tools(), {})
            self.assertFalse(permissions.is_enabled("collect_hn"))
            self.assertFalse(permissions.is_enabled("score_and_dedup"))

    def test_null_tools_map_is_treated_as_empty(self) -> None:
        with patch.object(permissions, "load_permissions", return_value={"tools": None}):
            self.assertEqual(permissions.enabled_tools(), {})
            self.assertFalse(permissions.is_enabled("collect_public_apis"))


if __name__ == "__main__":
    unittest.main()
