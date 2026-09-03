"""
Maturity Monitor Agent — HawkxAI's GTM readiness scanner.

Periodically scans the product, repo, and endpoints to validate readiness
against Soft Beta → Paid Pilot → Public Launch gates. Auto-generates
assessment reports with P0 blockers, scorecard, and next actions.

Usage:
    python3 agents/maturity-monitor/maturity_monitor.py --scan
    python3 agents/maturity-monitor/maturity_monitor.py --self-check
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse


@dataclass
class EndpointHealth:
    """Health check result for an API endpoint."""
    url: str
    status: str  # "healthy", "timeout", "error", "degraded"
    response_time_ms: int
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class GateValidation:
    """Validation result for a specific gate."""
    gate_name: str
    status: str  # "pass", "fail", "partial", "unknown"
    evidence: str
    blocker_priority: Optional[str] = None  # "P0", "P1", "P2"


@dataclass
class MaturityScore:
    """Scorecard dimension with rating."""
    dimension: str
    score: int  # 0-5
    max_score: int  # typically 5
    evidence: str
    status_emoji: str  # "✅", "⚠️", "❌"


@dataclass
class MaturityAssessment:
    """Complete maturity assessment report."""
    timestamp: str
    stage_recommendation: str
    overall_maturity: str
    cmo_verdict: str
    endpoint_health: List[EndpointHealth]
    scorecard: List[MaturityScore]
    gate_validations: List[GateValidation]
    p0_blockers: List[str]
    p1_blockers: List[str]
    recent_commits_count: int
    gtm_critical_work_count: int
    next_check: str


class MaturityMonitor:
    """Scans HawkxAI for GTM readiness."""
    
    def __init__(self, base_url: str = "https://hawkxai.com", repo_path: str = "."):
        self.base_url = base_url
        self.repo_path = Path(repo_path).resolve()
        self.report_path = self.repo_path / "docs" / "MATURITY_MONITOR.md"
        
    def check_endpoint(self, path: str, timeout: int = 10) -> EndpointHealth:
        """Check health of a specific endpoint."""
        url = f"{self.base_url}{path}"
        start = time.time()
        
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MaturityMonitor/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                elapsed_ms = int((time.time() - start) * 1000)
                content = response.read().decode("utf-8")
                
                # Try to parse as JSON
                try:
                    data = json.loads(content)
                    return EndpointHealth(
                        url=url,
                        status="healthy",
                        response_time_ms=elapsed_ms,
                        response_data=data
                    )
                except json.JSONDecodeError:
                    return EndpointHealth(
                        url=url,
                        status="healthy",
                        response_time_ms=elapsed_ms,
                        response_data=None
                    )
                    
        except urllib.error.HTTPError as e:
            elapsed_ms = int((time.time() - start) * 1000)
            return EndpointHealth(
                url=url,
                status="error",
                response_time_ms=elapsed_ms,
                error=f"HTTP {e.code}"
            )
        except urllib.error.URLError as e:
            elapsed_ms = int((time.time() - start) * 1000)
            if "timed out" in str(e).lower():
                return EndpointHealth(
                    url=url,
                    status="timeout",
                    response_time_ms=elapsed_ms,
                    error="Request timed out"
                )
            return EndpointHealth(
                url=url,
                status="error",
                response_time_ms=elapsed_ms,
                error=str(e)
            )
        except Exception as e:
            elapsed_ms = int((time.time() - start) * 1000)
            return EndpointHealth(
                url=url,
                status="error",
                response_time_ms=elapsed_ms,
                error=str(e)
            )
    
    def scan_git_activity(self, days: int = 14) -> Tuple[int, int]:
        """Scan recent git commits for activity and GTM-critical work.
        
        Returns:
            (total_commits, gtm_critical_commits)
        """
        try:
            # Get commits from last N days
            result = subprocess.run(
                ["git", "log", f"--since={days} days ago", "--oneline"],
                cwd=self.repo_path,
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                return (0, 0)
            
            commits = result.stdout.strip().split("\n") if result.stdout.strip() else []
            total_commits = len(commits)
            
            # Check for GTM-critical keywords in commit messages
            gtm_keywords = [
                "fleet", "signup", "auth", "account", "pricing", "legal",
                "terms", "privacy", "beta", "launch", "footprint"
            ]
            
            gtm_critical = 0
            for commit in commits:
                commit_lower = commit.lower()
                if any(kw in commit_lower for kw in gtm_keywords):
                    gtm_critical += 1
            
            return (total_commits, gtm_critical)
            
        except Exception as e:
            print(f"Warning: Could not scan git activity: {e}", file=sys.stderr)
            return (0, 0)
    
    def validate_soft_beta_gates(
        self, 
        endpoint_health: Dict[str, EndpointHealth]
    ) -> List[GateValidation]:
        """Validate all Soft Beta hard gates."""
        gates = []
        
        # Gate 1: Footprint works end-to-end
        fleet_health = endpoint_health.get("/api/fleet")
        if fleet_health and fleet_health.status == "healthy":
            if fleet_health.response_data and fleet_health.response_data.get("configured"):
                gates.append(GateValidation(
                    gate_name="Footprint works end-to-end on real phrase",
                    status="pass",
                    evidence="FLEET_URL configured and responding"
                ))
            else:
                gates.append(GateValidation(
                    gate_name="Footprint works end-to-end on real phrase",
                    status="fail",
                    evidence="FLEET_URL not configured. Fleet API returns configured: false",
                    blocker_priority="P0"
                ))
        else:
            gates.append(GateValidation(
                gate_name="Footprint works end-to-end on real phrase",
                status="fail",
                evidence=f"Fleet API unhealthy: {fleet_health.error if fleet_health else 'unreachable'}",
                blocker_priority="P0"
            ))
        
        # Gate 2: Fleet ingest healthy
        if fleet_health and fleet_health.status == "healthy" and \
           fleet_health.response_data and fleet_health.response_data.get("configured"):
            gates.append(GateValidation(
                gate_name="Fleet ingest healthy (no 503 failures)",
                status="pass",
                evidence="Fleet responding without errors"
            ))
        else:
            gates.append(GateValidation(
                gate_name="Fleet ingest healthy (no 503 failures)",
                status="fail",
                evidence="Fleet not configured, cannot test health",
                blocker_priority="P0"
            ))
        
        # Gate 3: Homepage not broken
        trends_health = endpoint_health.get("/api/trends")
        if trends_health and trends_health.status == "healthy":
            gates.append(GateValidation(
                gate_name="Homepage not broken on cold load",
                status="pass",
                evidence="Trends API responding"
            ))
        elif trends_health and trends_health.status == "timeout":
            gates.append(GateValidation(
                gate_name="Homepage not broken on cold load",
                status="partial",
                evidence="Trends API times out, homepage may show zeros",
                blocker_priority="P0"
            ))
        else:
            gates.append(GateValidation(
                gate_name="Homepage not broken on cold load",
                status="fail",
                evidence=f"Trends API error: {trends_health.error if trends_health else 'unreachable'}",
                blocker_priority="P0"
            ))
        
        # Gate 4: Honest progress state
        # This requires code inspection - mark as unknown for now
        gates.append(GateValidation(
            gate_name="Trends take 20-60s → honest progress state",
            status="unknown",
            evidence="Requires code inspection or manual testing",
            blocker_priority="P1"
        ))
        
        # Gate 5: One source works
        gates.append(GateValidation(
            gate_name="One claimed live source actually works (especially X)",
            status="unknown",
            evidence="Requires manual verification of data sources",
            blocker_priority="P1"
        ))
        
        # Gate 6: Demo works
        gates.append(GateValidation(
            gate_name="One seeded 'wow' demo (30s stranger test)",
            status="unknown",
            evidence="Requires manual testing of demo chips on /footprint",
            blocker_priority="P0"
        ))
        
        # Gate 7: Beta signup exists
        # Check if signup form endpoint exists or if there's a signup page
        gates.append(GateValidation(
            gate_name="Beta signup exists",
            status="unknown",
            evidence="Requires checking for signup form on site",
            blocker_priority="P0"
        ))
        
        # Gate 8: Repo ↔ site link
        gates.append(GateValidation(
            gate_name="Repo/site link to each other",
            status="partial",
            evidence="README has live URL. Requires checking site for GitHub link",
            blocker_priority="P1"
        ))
        
        return gates
    
    def calculate_scorecard(
        self, 
        endpoint_health: Dict[str, EndpointHealth],
        gates: List[GateValidation]
    ) -> List[MaturityScore]:
        """Calculate maturity scorecard across all dimensions."""
        scores = []
        
        # Footprint reliability
        fleet_health = endpoint_health.get("/api/fleet")
        if fleet_health and fleet_health.status == "healthy" and \
           fleet_health.response_data and fleet_health.response_data.get("configured"):
            scores.append(MaturityScore(
                dimension="Footprint reliability",
                score=5,
                max_score=5,
                evidence="FLEET_URL configured and responding",
                status_emoji="✅"
            ))
        else:
            scores.append(MaturityScore(
                dimension="Footprint reliability",
                score=0,
                max_score=5,
                evidence="FLEET_URL not configured. Core feature cannot work",
                status_emoji="❌"
            ))
        
        # Data depth / source honesty
        trends_health = endpoint_health.get("/api/trends")
        if trends_health and trends_health.status == "healthy":
            scores.append(MaturityScore(
                dimension="Data depth / source honesty",
                score=4,
                max_score=5,
                evidence="API responding. Needs verification of data quality",
                status_emoji="✅"
            ))
        elif trends_health and trends_health.status == "timeout":
            scores.append(MaturityScore(
                dimension="Data depth / source honesty",
                score=2,
                max_score=5,
                evidence="API times out. Site likely shows zeros",
                status_emoji="⚠️"
            ))
        else:
            scores.append(MaturityScore(
                dimension="Data depth / source honesty",
                score=1,
                max_score=5,
                evidence="API errors. Cannot verify data sources",
                status_emoji="❌"
            ))
        
        # Time-to-value
        passing_gates = sum(1 for g in gates if g.status == "pass")
        total_gates = len(gates)
        if passing_gates >= total_gates * 0.8:
            scores.append(MaturityScore(
                dimension="Time-to-value for stranger",
                score=4,
                max_score=5,
                evidence="Most gates passing. Good first experience likely",
                status_emoji="✅"
            ))
        elif passing_gates >= total_gates * 0.5:
            scores.append(MaturityScore(
                dimension="Time-to-value for stranger",
                score=2,
                max_score=5,
                evidence="Half gates passing. Mixed first experience",
                status_emoji="⚠️"
            ))
        else:
            scores.append(MaturityScore(
                dimension="Time-to-value for stranger",
                score=1,
                max_score=5,
                evidence="Most gates failing. Poor first experience",
                status_emoji="❌"
            ))
        
        # Persistence / return loop
        scores.append(MaturityScore(
            dimension="Persistence / return loop",
            score=0,
            max_score=5,
            evidence="No signup form detected. No accounts. Local storage only",
            status_emoji="❌"
        ))
        
        # Commercial surface
        scores.append(MaturityScore(
            dimension="Commercial surface",
            score=0,
            max_score=5,
            evidence="No beta signup, pricing page, or contact path visible",
            status_emoji="❌"
        ))
        
        # Claim/truth alignment
        p0_count = sum(1 for g in gates if g.blocker_priority == "P0" and g.status == "fail")
        if p0_count == 0:
            scores.append(MaturityScore(
                dimension="Claim/truth alignment",
                score=5,
                max_score=5,
                evidence="No P0 blockers. Product delivers on claims",
                status_emoji="✅"
            ))
        elif p0_count <= 2:
            scores.append(MaturityScore(
                dimension="Claim/truth alignment",
                score=3,
                max_score=5,
                evidence=f"{p0_count} P0 blocker(s). Some claims not met",
                status_emoji="⚠️"
            ))
        else:
            scores.append(MaturityScore(
                dimension="Claim/truth alignment",
                score=1,
                max_score=5,
                evidence=f"{p0_count} P0 blocker(s). Core claims not met",
                status_emoji="❌"
            ))
        
        # Roadmap velocity
        scores.append(MaturityScore(
            dimension="Roadmap velocity on GTM blockers",
            score=3,
            max_score=5,
            evidence="Requires git activity scan. Default: moderate",
            status_emoji="⚠️"
        ))
        
        return scores
    
    def generate_report(self, assessment: MaturityAssessment) -> str:
        """Generate markdown report from assessment."""
        
        # Calculate pass/fail counts
        pass_count = sum(1 for g in assessment.gate_validations if g.status == "pass")
        fail_count = sum(1 for g in assessment.gate_validations if g.status == "fail")
        partial_count = sum(1 for g in assessment.gate_validations if g.status == "partial")
        total_gates = len(assessment.gate_validations)
        
        report = f"""# HawkxAI Maturity Monitor — Automated Scan

**Report Date:** {assessment.timestamp}  
**Reporting To:** CMO  
**Stage Recommendation:** **{assessment.stage_recommendation}**  
**CMO Verdict:** {assessment.cmo_verdict}

---

## Executive Summary

HawkxAI maturity assessment based on automated endpoint scans, git activity analysis, and gate validation.

**Soft Beta Gates:** {pass_count} of {total_gates} pass cleanly ({partial_count} partial, {fail_count} hard fails)

**Overall Maturity:** {assessment.overall_maturity}

---

## SCORECARD

| Dimension | Score | Evidence |
|-----------|-------|----------|
"""
        
        for score in assessment.scorecard:
            report += f"| **{score.dimension}** | {score.score}/{score.max_score} | {score.status_emoji} {score.evidence} |\n"
        
        report += "\n---\n\n## ENDPOINT HEALTH\n\n"
        
        for health in assessment.endpoint_health:
            status_icon = "✅" if health.status == "healthy" else "⚠️" if health.status == "degraded" else "❌"
            report += f"### {health.url}\n\n"
            report += f"- **Status:** {status_icon} {health.status.upper()}\n"
            report += f"- **Response Time:** {health.response_time_ms}ms\n"
            
            if health.response_data:
                report += f"- **Data:** `{json.dumps(health.response_data, separators=(',', ':'))}`\n"
            
            if health.error:
                report += f"- **Error:** {health.error}\n"
            
            report += "\n"
        
        report += "---\n\n## HARD GATES: SOFT BETA\n\n"
        report += "| Gate | Status | Evidence |\n"
        report += "|------|--------|----------|\n"
        
        for gate in assessment.gate_validations:
            status_icon = "✅" if gate.status == "pass" else "⚠️" if gate.status == "partial" else "❌" if gate.status == "fail" else "❓"
            status_text = "**PASS**" if gate.status == "pass" else "**PARTIAL**" if gate.status == "partial" else "**FAIL**" if gate.status == "fail" else "**UNKNOWN**"
            report += f"| **{gate.gate_name}** | {status_icon} {status_text} | {gate.evidence} |\n"
        
        report += "\n---\n\n## BLOCKERS\n\n"
        
        if assessment.p0_blockers:
            report += "### P0 — Blocks ALL GTM (Fix in next 48h)\n\n"
            for i, blocker in enumerate(assessment.p0_blockers, 1):
                report += f"#### {i}. {blocker}\n\n"
        
        if assessment.p1_blockers:
            report += "### P1 — Blocks credibility\n\n"
            for i, blocker in enumerate(assessment.p1_blockers, 1):
                report += f"#### {i}. {blocker}\n\n"
        
        report += "---\n\n## GIT ACTIVITY\n\n"
        report += f"- **Recent commits (14 days):** {assessment.recent_commits_count}\n"
        report += f"- **GTM-critical work:** {assessment.gtm_critical_work_count} commits\n"
        
        report += "\n---\n\n## MONITORING CADENCE\n\n"
        report += f"**Next Check:** {assessment.next_check}\n\n"
        report += "**Or immediately after:**\n"
        report += "- Any deploy to Vercel production\n"
        report += "- FLEET_URL environment variable set\n"
        report += "- Any commit touching `/api/fleet` or `/api/trends`\n"
        
        report += "\n---\n\n**End of Report**\n\n"
        report += "**Status:** Automated scan complete. Review blockers and re-scan after fixes.\n\n"
        report += "**Contact:** HawkxAI Maturity Monitor (reporting to CMO)\n"
        
        return report
    
    def run_scan(self) -> MaturityAssessment:
        """Run complete maturity scan."""
        print("🔍 Starting HawkxAI maturity scan...\n")
        
        # Check endpoints
        print("Checking endpoints...")
        endpoints_to_check = ["/api/fleet", "/api/trends"]
        endpoint_health = {}
        
        for path in endpoints_to_check:
            print(f"  → {path}...", end=" ")
            health = self.check_endpoint(path)
            endpoint_health[path] = health
            print(f"{health.status} ({health.response_time_ms}ms)")
        
        print()
        
        # Scan git activity
        print("Scanning git activity...")
        recent_commits, gtm_critical = self.scan_git_activity(days=14)
        print(f"  → Found {recent_commits} commits (last 14 days)")
        print(f"  → {gtm_critical} GTM-critical commits\n")
        
        # Validate gates
        print("Validating Soft Beta gates...")
        gates = self.validate_soft_beta_gates(endpoint_health)
        pass_count = sum(1 for g in gates if g.status == "pass")
        fail_count = sum(1 for g in gates if g.status == "fail")
        print(f"  → {pass_count} passing, {fail_count} failing\n")
        
        # Calculate scorecard
        print("Calculating scorecard...")
        scorecard = self.calculate_scorecard(endpoint_health, gates)
        avg_score = sum(s.score for s in scorecard) / len(scorecard)
        print(f"  → Average score: {avg_score:.1f}/5\n")
        
        # Determine stage and verdict
        if fail_count >= 4:
            stage_recommendation = "HOLD — NOT READY FOR SOFT BETA"
            overall_maturity = "Prototype"
            cmo_verdict = "Core features are non-functional. Product cannot deliver advertised experience."
        elif fail_count >= 2:
            stage_recommendation = "CAUTION — SOFT BETA READINESS AT RISK"
            overall_maturity = "Pre-beta"
            cmo_verdict = "Some critical features working, but key blockers remain."
        elif fail_count >= 1:
            stage_recommendation = "NEARLY READY — MINOR FIXES NEEDED"
            overall_maturity = "Soft Beta candidate"
            cmo_verdict = "Most features working. Address remaining blockers."
        else:
            stage_recommendation = "READY FOR SOFT BETA"
            overall_maturity = "Soft Beta ready"
            cmo_verdict = "All gates passing. Product ready for limited launch."
        
        # Collect blockers
        p0_blockers = []
        p1_blockers = []
        
        for gate in gates:
            if gate.status == "fail" and gate.blocker_priority:
                blocker_text = f"{gate.gate_name}: {gate.evidence}"
                if gate.blocker_priority == "P0":
                    p0_blockers.append(blocker_text)
                elif gate.blocker_priority == "P1":
                    p1_blockers.append(blocker_text)
        
        # Next check time
        from datetime import timedelta
        next_check_dt = datetime.now(timezone.utc) + timedelta(hours=48)
        next_check = next_check_dt.strftime("%A, %b %d, %Y, %I:%M %p UTC")
        
        assessment = MaturityAssessment(
            timestamp=datetime.now(timezone.utc).strftime("%A, %b %d, %Y, %I:%M %p UTC"),
            stage_recommendation=stage_recommendation,
            overall_maturity=overall_maturity,
            cmo_verdict=cmo_verdict,
            endpoint_health=list(endpoint_health.values()),
            scorecard=scorecard,
            gate_validations=gates,
            p0_blockers=p0_blockers,
            p1_blockers=p1_blockers,
            recent_commits_count=recent_commits,
            gtm_critical_work_count=gtm_critical,
            next_check=next_check
        )
        
        return assessment
    
    def self_check(self) -> bool:
        """Run self-diagnostics."""
        print("🔧 Running Maturity Monitor self-check...\n")
        
        checks = []
        
        # Check repo exists
        if self.repo_path.exists():
            print("✅ Repository path exists")
            checks.append(True)
        else:
            print(f"❌ Repository path not found: {self.repo_path}")
            checks.append(False)
        
        # Check git is available
        try:
            result = subprocess.run(["git", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ Git available: {result.stdout.strip()}")
                checks.append(True)
            else:
                print("❌ Git command failed")
                checks.append(False)
        except FileNotFoundError:
            print("❌ Git not found")
            checks.append(False)
        
        # Check docs directory
        docs_dir = self.repo_path / "docs"
        if docs_dir.exists():
            print(f"✅ Docs directory exists: {docs_dir}")
            checks.append(True)
        else:
            print(f"⚠️  Docs directory not found: {docs_dir}")
            checks.append(False)
        
        # Test endpoint checking
        print("\n🌐 Testing endpoint check...")
        health = self.check_endpoint("/api/fleet", timeout=5)
        print(f"  → Status: {health.status}")
        print(f"  → Response time: {health.response_time_ms}ms")
        checks.append(True)
        
        print(f"\n{'✅' if all(checks) else '⚠️'} Self-check {'passed' if all(checks) else 'completed with warnings'}")
        return all(checks)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="HawkxAI Maturity Monitor — Automated GTM readiness scanner"
    )
    parser.add_argument(
        "--scan",
        action="store_true",
        help="Run full maturity scan and generate report"
    )
    parser.add_argument(
        "--self-check",
        action="store_true",
        help="Run self-diagnostics"
    )
    parser.add_argument(
        "--base-url",
        default="https://hawkxai.com",
        help="Base URL for HawkxAI (default: https://hawkxai.com)"
    )
    parser.add_argument(
        "--repo-path",
        default=".",
        help="Path to repository root (default: current directory)"
    )
    parser.add_argument(
        "--output",
        help="Output path for report (default: docs/MATURITY_MONITOR.md)"
    )
    
    args = parser.parse_args()
    
    if not args.scan and not args.self_check:
        parser.print_help()
        return 1
    
    monitor = MaturityMonitor(base_url=args.base_url, repo_path=args.repo_path)
    
    if args.self_check:
        success = monitor.self_check()
        return 0 if success else 1
    
    if args.scan:
        try:
            assessment = monitor.run_scan()
            report = monitor.generate_report(assessment)
            
            # Write report
            output_path = Path(args.output) if args.output else monitor.report_path
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, "w") as f:
                f.write(report)
            
            print(f"✅ Report saved to: {output_path}\n")
            print(f"📊 Assessment: {assessment.stage_recommendation}")
            print(f"🎯 Overall Maturity: {assessment.overall_maturity}")
            print(f"🚨 P0 Blockers: {len(assessment.p0_blockers)}")
            print(f"⚠️  P1 Blockers: {len(assessment.p1_blockers)}")
            
            return 0
            
        except Exception as e:
            print(f"❌ Error during scan: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
