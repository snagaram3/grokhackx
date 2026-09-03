"""
Tests for Maturity Monitor Agent
"""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from maturity_monitor import (
    EndpointHealth,
    GateValidation,
    MaturityMonitor,
    MaturityScore,
)


class TestEndpointHealth(unittest.TestCase):
    """Test EndpointHealth dataclass."""
    
    def test_healthy_endpoint(self):
        """Test healthy endpoint representation."""
        health = EndpointHealth(
            url="https://hawkxai.com/api/fleet",
            status="healthy",
            response_time_ms=234,
            response_data={"configured": True}
        )
        
        self.assertEqual(health.status, "healthy")
        self.assertEqual(health.response_time_ms, 234)
        self.assertTrue(health.response_data["configured"])
        self.assertIsNone(health.error)
    
    def test_error_endpoint(self):
        """Test error endpoint representation."""
        health = EndpointHealth(
            url="https://hawkxai.com/api/trends",
            status="timeout",
            response_time_ms=10043,
            error="Request timed out"
        )
        
        self.assertEqual(health.status, "timeout")
        self.assertIsNotNone(health.error)


class TestGateValidation(unittest.TestCase):
    """Test GateValidation dataclass."""
    
    def test_passing_gate(self):
        """Test passing gate."""
        gate = GateValidation(
            gate_name="Footprint works end-to-end",
            status="pass",
            evidence="FLEET_URL configured and responding"
        )
        
        self.assertEqual(gate.status, "pass")
        self.assertIsNone(gate.blocker_priority)
    
    def test_failing_gate_with_blocker(self):
        """Test failing gate with P0 blocker."""
        gate = GateValidation(
            gate_name="Footprint works end-to-end",
            status="fail",
            evidence="FLEET_URL not configured",
            blocker_priority="P0"
        )
        
        self.assertEqual(gate.status, "fail")
        self.assertEqual(gate.blocker_priority, "P0")


class TestMaturityScore(unittest.TestCase):
    """Test MaturityScore dataclass."""
    
    def test_perfect_score(self):
        """Test perfect score."""
        score = MaturityScore(
            dimension="Footprint reliability",
            score=5,
            max_score=5,
            evidence="All systems operational",
            status_emoji="✅"
        )
        
        self.assertEqual(score.score, score.max_score)
        self.assertEqual(score.status_emoji, "✅")
    
    def test_failing_score(self):
        """Test failing score."""
        score = MaturityScore(
            dimension="Footprint reliability",
            score=0,
            max_score=5,
            evidence="FLEET_URL not configured",
            status_emoji="❌"
        )
        
        self.assertEqual(score.score, 0)
        self.assertEqual(score.status_emoji, "❌")


class TestMaturityMonitor(unittest.TestCase):
    """Test MaturityMonitor class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.monitor = MaturityMonitor(
            base_url="https://hawkxai.com",
            repo_path="."
        )
    
    def test_initialization(self):
        """Test monitor initialization."""
        self.assertEqual(self.monitor.base_url, "https://hawkxai.com")
        self.assertIsNotNone(self.monitor.repo_path)
    
    @patch("urllib.request.urlopen")
    def test_check_healthy_endpoint(self, mock_urlopen):
        """Test checking a healthy endpoint."""
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"configured": true, "ok": true}'
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        health = self.monitor.check_endpoint("/api/fleet", timeout=5)
        
        self.assertEqual(health.status, "healthy")
        self.assertIsNotNone(health.response_data)
        self.assertTrue(health.response_data.get("configured"))
    
    @patch("urllib.request.urlopen")
    def test_check_timeout_endpoint(self, mock_urlopen):
        """Test checking an endpoint that times out."""
        from urllib.error import URLError
        mock_urlopen.side_effect = URLError("timed out")
        
        health = self.monitor.check_endpoint("/api/trends", timeout=5)
        
        self.assertEqual(health.status, "timeout")
        self.assertIsNotNone(health.error)
    
    def test_validate_gates_with_unhealthy_fleet(self):
        """Test gate validation when fleet is unhealthy."""
        endpoint_health = {
            "/api/fleet": EndpointHealth(
                url="https://hawkxai.com/api/fleet",
                status="healthy",
                response_time_ms=234,
                response_data={"configured": False}
            ),
            "/api/trends": EndpointHealth(
                url="https://hawkxai.com/api/trends",
                status="timeout",
                response_time_ms=10043,
                error="Request timed out"
            )
        }
        
        gates = self.monitor.validate_soft_beta_gates(endpoint_health)
        
        # Should have 8 gates total
        self.assertEqual(len(gates), 8)
        
        # First gate should fail (fleet not configured)
        fleet_gate = gates[0]
        self.assertEqual(fleet_gate.status, "fail")
        self.assertEqual(fleet_gate.blocker_priority, "P0")
    
    def test_calculate_scorecard(self):
        """Test scorecard calculation."""
        endpoint_health = {
            "/api/fleet": EndpointHealth(
                url="https://hawkxai.com/api/fleet",
                status="healthy",
                response_time_ms=234,
                response_data={"configured": True}
            ),
            "/api/trends": EndpointHealth(
                url="https://hawkxai.com/api/trends",
                status="healthy",
                response_time_ms=456,
                response_data={"trends": []}
            )
        }
        
        gates = self.monitor.validate_soft_beta_gates(endpoint_health)
        scorecard = self.monitor.calculate_scorecard(endpoint_health, gates)
        
        # Should have 7 dimensions
        self.assertEqual(len(scorecard), 7)
        
        # All scores should be 0-5
        for score in scorecard:
            self.assertGreaterEqual(score.score, 0)
            self.assertLessEqual(score.score, score.max_score)
    
    def test_generate_report(self):
        """Test report generation."""
        from maturity_monitor import MaturityAssessment
        
        assessment = MaturityAssessment(
            timestamp="Monday, Sep 1, 2026, 1:00 PM UTC",
            stage_recommendation="HOLD — NOT READY FOR SOFT BETA",
            overall_maturity="Prototype",
            cmo_verdict="Core features non-functional",
            endpoint_health=[
                EndpointHealth(
                    url="https://hawkxai.com/api/fleet",
                    status="healthy",
                    response_time_ms=234,
                    response_data={"configured": False}
                )
            ],
            scorecard=[
                MaturityScore(
                    dimension="Footprint reliability",
                    score=0,
                    max_score=5,
                    evidence="FLEET_URL not configured",
                    status_emoji="❌"
                )
            ],
            gate_validations=[
                GateValidation(
                    gate_name="Footprint works end-to-end",
                    status="fail",
                    evidence="FLEET_URL not configured",
                    blocker_priority="P0"
                )
            ],
            p0_blockers=["FLEET_URL not configured"],
            p1_blockers=[],
            recent_commits_count=32,
            gtm_critical_work_count=4,
            next_check="Wednesday, Sep 3, 2026, 1:00 PM UTC"
        )
        
        report = self.monitor.generate_report(assessment)
        
        # Check report structure
        self.assertIn("# HawkxAI Maturity Monitor", report)
        self.assertIn("## SCORECARD", report)
        self.assertIn("## ENDPOINT HEALTH", report)
        self.assertIn("## HARD GATES", report)
        self.assertIn("## BLOCKERS", report)
        self.assertIn("P0", report)


class TestScanGitActivity(unittest.TestCase):
    """Test git activity scanning."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.monitor = MaturityMonitor(repo_path=".")
    
    @patch("subprocess.run")
    def test_scan_with_commits(self, mock_run):
        """Test scanning with actual commits."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="abc123 Add fleet deployment\ndef456 Fix signup form\nghi789 Update README\n"
        )
        
        total, gtm_critical = self.monitor.scan_git_activity(days=14)
        
        self.assertEqual(total, 3)
        self.assertEqual(gtm_critical, 2)  # "fleet" and "signup"
    
    @patch("subprocess.run")
    def test_scan_with_no_commits(self, mock_run):
        """Test scanning with no commits."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=""
        )
        
        total, gtm_critical = self.monitor.scan_git_activity(days=14)
        
        self.assertEqual(total, 0)
        self.assertEqual(gtm_critical, 0)


if __name__ == "__main__":
    unittest.main()
