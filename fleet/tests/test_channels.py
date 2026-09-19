"""Fleet ingest channel gates and vehicle parse. No live HTTP."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.modules.setdefault("httpx", MagicMock())

from tools.hn_channel import collect_hn  # noqa: E402
from tools.public_apis import _vehicle, collect_public_apis  # noqa: E402


class VehicleParseTests(unittest.TestCase):
    def test_camry_and_civic_map_to_make_model(self) -> None:
        self.assertEqual(_vehicle("Camry"), ("toyota", "camry", "2024"))
        self.assertEqual(_vehicle("2023 Honda Civic"), ("honda", "civic", "2023"))
        self.assertEqual(_vehicle("F-150"), ("ford", "f-150", "2024"))
        self.assertEqual(_vehicle("f150"), ("ford", "f-150", "2024"))

    def test_camera_is_not_camry_and_blank_is_none(self) -> None:
        self.assertIsNone(_vehicle("camera sensor"))
        self.assertIsNone(_vehicle("   "))
        self.assertIsNone(_vehicle(""))


class ChannelGateTests(unittest.TestCase):
    def test_collect_hn_disabled_skips_network(self) -> None:
        with patch("tools.hn_channel.is_enabled", return_value=False):
            out = collect_hn("Camry")
        self.assertEqual(out["status"], "disabled")
        self.assertEqual(out["count"], 0)
        self.assertEqual(out["posts"], [])
        self.assertEqual(out["phrase"], "Camry")

    def test_collect_hn_rejects_short_phrase(self) -> None:
        with patch("tools.hn_channel.is_enabled", return_value=True):
            out = collect_hn("x")
        self.assertEqual(out["status"], "error")
        self.assertEqual(out["posts"], [])
        self.assertEqual(out["error"], "phrase too short")

    def test_collect_public_apis_disabled_skips_network(self) -> None:
        with patch("tools.public_apis.is_enabled", return_value=False):
            out = collect_public_apis("Camry")
        self.assertEqual(out["status"], "disabled")
        self.assertEqual(out["count"], 0)
        self.assertEqual(out["posts"], [])

    def test_collect_public_apis_rejects_short_phrase(self) -> None:
        with patch("tools.public_apis.is_enabled", return_value=True):
            out = collect_public_apis(" ")
        self.assertEqual(out["status"], "error")
        self.assertEqual(out["posts"], [])
        self.assertEqual(out["error"], "phrase too short")


if __name__ == "__main__":
    unittest.main()
