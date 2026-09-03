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

    @patch("subprocess.run")
    def test_scan_git_nonzero_and_exception_are_zero(self, mock_run):
        """A failed git log must not invent commit counts."""
        mock_run.return_value = MagicMock(returncode=128, stdout="fatal: not a git repository\n")
        self.assertEqual(self.monitor.scan_git_activity(days=14), (0, 0))

        mock_run.side_effect = OSError("git missing")
        self.assertEqual(self.monitor.scan_git_activity(days=14), (0, 0))

    @patch("subprocess.run")
    def test_gtm_keywords_are_substrings_of_the_oneline(self, mock_run):
        """Keyword match is a lowercase substring, not a whole-word token."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=(
                "aaa Fix authorization header on collect\n"
                "bbb Polish Camry world map\n"
                "ccc Soft beta copy on homepage\n"
            ),
        )
        total, gtm_critical = self.monitor.scan_git_activity(days=14)
        self.assertEqual(total, 3)
        # "auth" inside authorization, "beta" inside "Soft beta"; Camry map is not GTM-critical.
        self.assertEqual(gtm_critical, 2)


def _health(path, status, data=None, error=None, ms=10):
    return EndpointHealth(
        url=f"https://hawkxai.com{path}",
        status=status,
        response_time_ms=ms,
        response_data=data,
        error=error,
    )


CONFIGURED_FLEET = _health("/api/fleet", "healthy", {"configured": True, "ok": True})
UNCONFIGURED_FLEET = _health("/api/fleet", "healthy", {"configured": False, "ok": False})
UNREACHABLE_FLEET = _health("/api/fleet", "error", error="HTTP 503")
HEALTHY_TRENDS = _health("/api/trends", "healthy", {"topics": []})
TIMEOUT_TRENDS = _health("/api/trends", "timeout", error="Request timed out")
ERROR_TRENDS = _health("/api/trends", "error", error="HTTP 500")


class TestSoftBetaGateEdges(unittest.TestCase):
    """Gate pass/fail is what drives the CMO stage line. Lock the edges."""

    def setUp(self):
        self.monitor = MaturityMonitor(repo_path=".")

    def _by_name(self, gates):
        return {g.gate_name: g for g in gates}

    def test_configured_fleet_and_healthy_trends_pass_the_three_automated_gates(self):
        gates = self.monitor.validate_soft_beta_gates({
            "/api/fleet": CONFIGURED_FLEET,
            "/api/trends": HEALTHY_TRENDS,
        })
        by = self._by_name(gates)
        self.assertEqual(by["Footprint works end-to-end on real phrase"].status, "pass")
        self.assertEqual(by["Fleet ingest healthy (no 503 failures)"].status, "pass")
        self.assertEqual(by["Homepage not broken on cold load"].status, "pass")
        # Demo + signup stay unknown P0 — they never become fail from this scan.
        self.assertEqual(by["One seeded 'wow' demo (30s stranger test)"].status, "unknown")
        self.assertEqual(by["One seeded 'wow' demo (30s stranger test)"].blocker_priority, "P0")
        self.assertEqual(by["Beta signup exists"].status, "unknown")
        self.assertEqual(by["Beta signup exists"].blocker_priority, "P0")
        self.assertEqual(sum(1 for g in gates if g.status == "fail"), 0)

    def test_configured_true_passes_ingest_without_probing_503(self):
        """Ingest 'no 503' is inferred from configured=true, not from an ingest POST."""
        gates = self.monitor.validate_soft_beta_gates({
            "/api/fleet": CONFIGURED_FLEET,
            "/api/trends": HEALTHY_TRENDS,
        })
        ingest = next(g for g in gates if g.gate_name.startswith("Fleet ingest"))
        self.assertEqual(ingest.status, "pass")
        self.assertIn("without errors", ingest.evidence)

    def test_missing_fleet_fails_footprint_and_ingest_as_p0(self):
        gates = self.monitor.validate_soft_beta_gates({
            "/api/trends": HEALTHY_TRENDS,
        })
        by = self._by_name(gates)
        self.assertEqual(by["Footprint works end-to-end on real phrase"].status, "fail")
        self.assertEqual(by["Footprint works end-to-end on real phrase"].blocker_priority, "P0")
        self.assertIn("unreachable", by["Footprint works end-to-end on real phrase"].evidence)
        self.assertEqual(by["Fleet ingest healthy (no 503 failures)"].status, "fail")
        self.assertEqual(by["Fleet ingest healthy (no 503 failures)"].blocker_priority, "P0")

    def test_trends_timeout_is_partial_homepage_not_fail(self):
        gates = self.monitor.validate_soft_beta_gates({
            "/api/fleet": CONFIGURED_FLEET,
            "/api/trends": TIMEOUT_TRENDS,
        })
        homepage = next(g for g in gates if g.gate_name.startswith("Homepage"))
        self.assertEqual(homepage.status, "partial")
        self.assertEqual(homepage.blocker_priority, "P0")
        self.assertEqual(sum(1 for g in gates if g.status == "fail"), 0)

    def test_trends_error_fails_homepage(self):
        gates = self.monitor.validate_soft_beta_gates({
            "/api/fleet": CONFIGURED_FLEET,
            "/api/trends": ERROR_TRENDS,
        })
        homepage = next(g for g in gates if g.gate_name.startswith("Homepage"))
        self.assertEqual(homepage.status, "fail")
        self.assertEqual(homepage.blocker_priority, "P0")
        self.assertIn("HTTP 500", homepage.evidence)


class TestScorecardThresholds(unittest.TestCase):
    """Scorecard bands are independent of live HTTP. Feed synthetic gates."""

    def setUp(self):
        self.monitor = MaturityMonitor(repo_path=".")

    def _gates(self, pass_n, fail_p0):
        gates = [
            GateValidation(gate_name=f"pass-{i}", status="pass", evidence="ok")
            for i in range(pass_n)
        ]
        gates += [
            GateValidation(
                gate_name=f"fail-{i}",
                status="fail",
                evidence="blocked",
                blocker_priority="P0",
            )
            for i in range(fail_p0)
        ]
        # Pad to 8 so time-to-value uses the same denominator as Soft Beta.
        while len(gates) < 8:
            gates.append(GateValidation(gate_name=f"unk-{len(gates)}", status="unknown", evidence="n/a"))
        return gates[:8]

    def _dim(self, scorecard, name):
        return next(s for s in scorecard if s.dimension == name)

    def test_time_to_value_bands_use_pass_ratio_not_unknown(self):
        health = {"/api/fleet": CONFIGURED_FLEET, "/api/trends": HEALTHY_TRENDS}
        high = self._dim(self.monitor.calculate_scorecard(health, self._gates(7, 0)), "Time-to-value for stranger")
        mid = self._dim(self.monitor.calculate_scorecard(health, self._gates(4, 0)), "Time-to-value for stranger")
        low = self._dim(self.monitor.calculate_scorecard(health, self._gates(3, 0)), "Time-to-value for stranger")
        self.assertEqual(high.score, 4)
        self.assertEqual(mid.score, 2)
        self.assertEqual(low.score, 1)

    def test_claim_truth_bands_count_failing_p0_only(self):
        health = {"/api/fleet": UNCONFIGURED_FLEET, "/api/trends": HEALTHY_TRENDS}
        none = self._dim(self.monitor.calculate_scorecard(health, self._gates(8, 0)), "Claim/truth alignment")
        two = self._dim(self.monitor.calculate_scorecard(health, self._gates(6, 2)), "Claim/truth alignment")
        three = self._dim(self.monitor.calculate_scorecard(health, self._gates(5, 3)), "Claim/truth alignment")
        self.assertEqual(none.score, 5)
        self.assertEqual(two.score, 3)
        self.assertEqual(three.score, 1)

    def test_healthy_scan_still_scores_time_to_value_poor(self):
        """Only 3 of 8 gates can pass today; unknown P0s keep the stranger score at 1."""
        gates = self.monitor.validate_soft_beta_gates({
            "/api/fleet": CONFIGURED_FLEET,
            "/api/trends": HEALTHY_TRENDS,
        })
        scorecard = self.monitor.calculate_scorecard(
            {"/api/fleet": CONFIGURED_FLEET, "/api/trends": HEALTHY_TRENDS},
            gates,
        )
        self.assertEqual(sum(1 for g in gates if g.status == "pass"), 3)
        self.assertEqual(self._dim(scorecard, "Time-to-value for stranger").score, 1)
        self.assertEqual(self._dim(scorecard, "Footprint reliability").score, 5)
        self.assertEqual(self._dim(scorecard, "Data depth / source honesty").score, 4)

    def test_trends_timeout_drops_source_honesty_not_to_zero(self):
        scorecard = self.monitor.calculate_scorecard(
            {"/api/fleet": CONFIGURED_FLEET, "/api/trends": TIMEOUT_TRENDS},
            self.monitor.validate_soft_beta_gates({
                "/api/fleet": CONFIGURED_FLEET,
                "/api/trends": TIMEOUT_TRENDS,
            }),
        )
        self.assertEqual(self._dim(scorecard, "Data depth / source honesty").score, 2)
        self.assertEqual(self._dim(scorecard, "Data depth / source honesty").status_emoji, "⚠️")


class TestRunScanStageAndBlockers(unittest.TestCase):
    """Stage copy is what the CMO reads. Mock HTTP so this stays deterministic."""

    def setUp(self):
        self.monitor = MaturityMonitor(repo_path=".")

    def _scan(self, fleet, trends, commits=(12, 2)):
        mapping = {"/api/fleet": fleet, "/api/trends": trends}

        def check(path, timeout=10):
            return mapping[path]

        with patch.object(self.monitor, "check_endpoint", side_effect=check), patch.object(
            self.monitor, "scan_git_activity", return_value=commits
        ):
            return self.monitor.run_scan()

    def test_ready_when_fleet_configured_even_if_unknown_p0_gates_remain(self):
        """Unknown demo/signup P0s do not count as fails, so the stage can say READY."""
        assessment = self._scan(CONFIGURED_FLEET, HEALTHY_TRENDS)
        self.assertEqual(assessment.stage_recommendation, "READY FOR SOFT BETA")
        self.assertEqual(assessment.overall_maturity, "Soft Beta ready")
        self.assertEqual(assessment.p0_blockers, [])
        self.assertEqual(assessment.p1_blockers, [])
        self.assertEqual(assessment.recent_commits_count, 12)
        self.assertEqual(assessment.gtm_critical_work_count, 2)

    def test_nearly_ready_when_only_homepage_fails(self):
        assessment = self._scan(CONFIGURED_FLEET, ERROR_TRENDS)
        self.assertEqual(assessment.stage_recommendation, "NEARLY READY — MINOR FIXES NEEDED")
        self.assertEqual(assessment.overall_maturity, "Soft Beta candidate")
        self.assertEqual(len(assessment.p0_blockers), 1)
        self.assertTrue(assessment.p0_blockers[0].startswith("Homepage not broken"))

    def test_caution_when_fleet_is_unconfigured(self):
        assessment = self._scan(UNCONFIGURED_FLEET, HEALTHY_TRENDS)
        self.assertEqual(assessment.stage_recommendation, "CAUTION — SOFT BETA READINESS AT RISK")
        self.assertEqual(assessment.overall_maturity, "Pre-beta")
        self.assertEqual(len(assessment.p0_blockers), 2)

    def test_hold_is_unreachable_with_current_automated_gates(self):
        """At most 3 gates can fail (footprint, ingest, homepage). HOLD needs 4."""
        assessment = self._scan(UNREACHABLE_FLEET, ERROR_TRENDS)
        fail_count = sum(1 for g in assessment.gate_validations if g.status == "fail")
        self.assertEqual(fail_count, 3)
        self.assertEqual(assessment.stage_recommendation, "CAUTION — SOFT BETA READINESS AT RISK")
        self.assertNotIn("HOLD", assessment.stage_recommendation)
        self.assertEqual(len(assessment.p0_blockers), 3)

    def test_unknown_and_partial_p0_never_enter_blocker_lists(self):
        assessment = self._scan(CONFIGURED_FLEET, TIMEOUT_TRENDS)
        # Homepage timeout is partial P0; demo/signup are unknown P0; repo link is partial P1.
        self.assertEqual(assessment.p0_blockers, [])
        self.assertEqual(assessment.p1_blockers, [])
        self.assertEqual(assessment.stage_recommendation, "READY FOR SOFT BETA")


class TestEndpointCheckErrors(unittest.TestCase):
    """Health status strings are what gates switch on. Cover the HTTP error classes."""

    def setUp(self):
        self.monitor = MaturityMonitor(base_url="https://hawkxai.com", repo_path=".")

    @patch("urllib.request.urlopen")
    def test_http_error_records_status_code(self, mock_urlopen):
        from io import BytesIO
        from urllib.error import HTTPError

        mock_urlopen.side_effect = HTTPError(
            "https://hawkxai.com/api/fleet",
            503,
            "Service Unavailable",
            hdrs=None,
            fp=BytesIO(),
        )
        health = self.monitor.check_endpoint("/api/fleet", timeout=5)
        self.assertEqual(health.status, "error")
        self.assertEqual(health.error, "HTTP 503")
        self.assertEqual(health.url, "https://hawkxai.com/api/fleet")

    @patch("urllib.request.urlopen")
    def test_url_error_without_timeout_is_error(self, mock_urlopen):
        from urllib.error import URLError

        mock_urlopen.side_effect = URLError("connection refused")
        health = self.monitor.check_endpoint("/api/trends", timeout=5)
        self.assertEqual(health.status, "error")
        self.assertIn("connection refused", health.error)

    @patch("urllib.request.urlopen")
    def test_non_json_body_is_healthy_with_no_payload(self, mock_urlopen):
        mock_response = MagicMock()
        mock_response.read.return_value = b"<html>ok</html>"
        mock_urlopen.return_value.__enter__.return_value = mock_response
        health = self.monitor.check_endpoint("/api/trends", timeout=5)
        self.assertEqual(health.status, "healthy")
        self.assertIsNone(health.response_data)

    @patch("urllib.request.urlopen")
    def test_unexpected_exception_is_error(self, mock_urlopen):
        mock_urlopen.side_effect = RuntimeError("ssl boom")
        health = self.monitor.check_endpoint("/api/fleet", timeout=5)
        self.assertEqual(health.status, "error")
        self.assertEqual(health.error, "ssl boom")


class TestReportAndCli(unittest.TestCase):
    """Report markdown is the artifact the CMO reads; CLI must not scan by default."""

    def setUp(self):
        self.monitor = MaturityMonitor(repo_path=".")

    def test_report_includes_compact_json_error_and_p1_blockers(self):
        from maturity_monitor import MaturityAssessment

        assessment = MaturityAssessment(
            timestamp="Wednesday, Sep 2, 2026, 10:00 AM UTC",
            stage_recommendation="CAUTION — SOFT BETA READINESS AT RISK",
            overall_maturity="Pre-beta",
            cmo_verdict="Some critical features working, but key blockers remain.",
            endpoint_health=[
                EndpointHealth(
                    url="https://hawkxai.com/api/fleet",
                    status="healthy",
                    response_time_ms=12,
                    response_data={"configured": False, "ok": False},
                ),
                EndpointHealth(
                    url="https://hawkxai.com/api/trends",
                    status="error",
                    response_time_ms=8,
                    error="HTTP 500",
                ),
            ],
            scorecard=[
                MaturityScore(
                    dimension="Footprint reliability",
                    score=0,
                    max_score=5,
                    evidence="FLEET_URL not configured",
                    status_emoji="❌",
                )
            ],
            gate_validations=[
                GateValidation(
                    gate_name="Footprint works end-to-end on real phrase",
                    status="fail",
                    evidence="FLEET_URL not configured",
                    blocker_priority="P0",
                )
            ],
            p0_blockers=["Footprint works end-to-end on real phrase: FLEET_URL not configured"],
            p1_blockers=["Repo/site link to each other: README has live URL"],
            recent_commits_count=7,
            gtm_critical_work_count=1,
            next_check="Friday, Sep 4, 2026, 10:00 AM UTC",
        )
        report = self.monitor.generate_report(assessment)
        self.assertIn('{"configured":false,"ok":false}', report)
        self.assertIn("HTTP 500", report)
        self.assertIn("### P1 — Blocks credibility", report)
        self.assertIn("Repo/site link to each other", report)
        self.assertIn("**Recent commits (14 days):** 7", report)
        self.assertIn("**GTM-critical work:** 1 commits", report)
        self.assertIn("CAUTION — SOFT BETA READINESS AT RISK", report)

    def test_main_without_flags_is_nonzero_and_does_not_scan(self):
        import maturity_monitor as mm

        with patch.object(mm.sys, "argv", ["maturity_monitor.py"]), patch.object(
            mm.MaturityMonitor, "run_scan"
        ) as scan, patch.object(mm.MaturityMonitor, "self_check") as self_check:
            code = mm.main()
        self.assertEqual(code, 1)
        scan.assert_not_called()
        self_check.assert_not_called()

    def test_self_check_passes_when_repo_git_and_docs_exist(self):
        """Do not hit the live site: endpoint check is mocked."""
        with patch.object(
            self.monitor,
            "check_endpoint",
            return_value=_health("/api/fleet", "error", error="mocked"),
        ):
            self.assertTrue(self.monitor.self_check())


if __name__ == "__main__":
    unittest.main()
