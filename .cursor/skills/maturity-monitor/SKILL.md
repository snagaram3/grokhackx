---
name: maturity-monitor
description: >-
  HawkxAI Maturity Monitor — automated GTM readiness scanner. Checks endpoints,
  validates Soft Beta gates, calculates maturity scorecard, identifies P0/P1 blockers,
  and generates executive assessment reports. Use when checking launch readiness,
  validating gates, assessing product maturity, reviewing GTM blockers, or generating
  CMO-level readiness reports for HawkxAI/grokhackx.
---

# Maturity Monitor

Automated GTM (Go-To-Market) readiness scanner for HawkxAI.

Scans product health, validates hard gates, calculates maturity scores, and generates
executive-level assessment reports. Replaces manual readiness checks with data-driven
automated scans. Think of it as a CI/CD health check for launch readiness.

## When this skill is on

Any GTM / launch readiness work: checking if ready to ship, validating Soft Beta gates,
reviewing P0 blockers, assessing product maturity, generating readiness reports, or
determining if HawkxAI is ready for the next stage (Soft Beta → Paid Pilot → Public Launch).

## Core loop

1. **Scan endpoints** — Check `/api/fleet`, `/api/trends`, and other critical APIs for health
2. **Validate gates** — Test all 8 Soft Beta hard gates automatically (Footprint, Fleet, Homepage, Progress, Sources, Demo, Signup, Links)
3. **Calculate scorecard** — Score 7 maturity dimensions on 0-5 scale (Footprint reliability, Data honesty, Time-to-value, Persistence, Commercial surface, Claim/truth alignment, Roadmap velocity)
4. **Identify blockers** — Find and prioritize P0 (blocks all GTM) and P1 (blocks credibility) issues
5. **Generate report** — Auto-update `docs/MATURITY_MONITOR.md` with findings
6. **Recommend stage** — Determine readiness: HOLD, CAUTION, NEARLY READY, or READY FOR SOFT BETA

## Implementation map

- **Scanner:** `agents/maturity-monitor/maturity_monitor.py`
- **Report:** `docs/MATURITY_MONITOR.md` (auto-generated)
- **Config:** `agents/maturity-monitor/config.yaml`
- **Tests:** `agents/maturity-monitor/tests/test_maturity_monitor.py`

## How to use

### Run full scan

```bash
python3 agents/maturity-monitor/maturity_monitor.py --scan
```

This will:
- Check endpoint health (response time, data validation)
- Validate all 8 Soft Beta gates
- Calculate 7-dimension scorecard
- Identify P0/P1 blockers
- Update `docs/MATURITY_MONITOR.md`
- Return stage recommendation

### Self-check

```bash
python3 agents/maturity-monitor/maturity_monitor.py --self-check
```

Validates the scanner itself (repo exists, git available, docs dir exists, endpoints reachable).

### Custom options

```bash
# Use staging URL
python3 agents/maturity-monitor/maturity_monitor.py --scan --base-url https://staging.hawkxai.com

# Custom output path
python3 agents/maturity-monitor/maturity_monitor.py --scan --output reports/maturity_$(date +%Y%m%d).md
```

## Soft Beta gates (8 total)

The scanner validates these hard gates:

1. ✅/❌ **Footprint works end-to-end** — Can look up a real phrase and get results
2. ✅/❌ **Fleet ingest healthy** — No 503 failures, FLEET_URL configured
3. ✅/❌ **Homepage not broken** — Loads without errors, shows data
4. ✅/❌ **Honest progress state** — 20-60s waits show progress indicators
5. ✅/❌ **One source works live** — Especially X/Twitter source verified
6. ✅/❌ **One "wow" demo** — 30-second stranger test passes (demo chips work)
7. ✅/❌ **Beta signup exists** — Form or path to capture interest
8. ✅/❌ **Repo ↔ site link** — README links to site, site links to GitHub

## Maturity scorecard (7 dimensions)

Each scored 0-5:

| Dimension | What it measures |
|-----------|------------------|
| **Footprint reliability** | FLEET_URL configured, core feature works |
| **Data depth / source honesty** | APIs respond, data quality verified |
| **Time-to-value for stranger** | Cold load experience, first 30 seconds |
| **Persistence / return loop** | Signup, accounts, saved state, cross-device |
| **Commercial surface** | Beta signup, pricing, contact path |
| **Claim/truth alignment** | Marketing claims match live capability |
| **Roadmap velocity on GTM blockers** | Work on fleet, signup, auth, pricing |

## Stage recommendations

| Gates Failing | Recommendation |
|---------------|----------------|
| 4+ | **HOLD — NOT READY FOR SOFT BETA** |
| 2-3 | **CAUTION — SOFT BETA READINESS AT RISK** |
| 1 | **NEARLY READY — MINOR FIXES NEEDED** |
| 0 | **READY FOR SOFT BETA** |

## Rules

- **Never fake results** — Only report what the scanner actually checks. If manual verification is needed, mark as "unknown"
- **Prioritize blockers** — P0 blocks *all* GTM, P1 blocks credibility. Make priority clear
- **Be specific** — "FLEET_URL not configured" not "fleet issue"
- **Data-driven** — Base recommendations on actual endpoint checks and gate validation, not assumptions
- **Update after changes** — Run scan after any deploy, env var change, or critical code change

## After every relevant change

1. **Run scan** — After deploy, FLEET_URL change, or work on P0 blockers
2. **Check P0 status** — If P0 blockers exist, do NOT recommend launching
3. **Report in user message** — Summarize: stage, maturity, P0 count, P1 count
4. **Link to report** — Point to `docs/MATURITY_MONITOR.md` for full details

## Example output

```
🔍 Starting HawkxAI maturity scan...

Checking endpoints...
  → /api/fleet... healthy (838ms)
  → /api/trends... healthy (8681ms)

Scanning git activity...
  → Found 59 commits (last 14 days)
  → 5 GTM-critical commits

Validating Soft Beta gates...
  → 1 passing, 2 failing

Calculating scorecard...
  → Average score: 1.6/5

✅ Report saved to: docs/MATURITY_MONITOR.md

📊 Assessment: CAUTION — SOFT BETA READINESS AT RISK
🎯 Overall Maturity: Pre-beta
🚨 P0 Blockers: 2
⚠️  P1 Blockers: 0
```

## When to run

### Automatic (recommended)

Set up GitHub Action or cron to run daily:

```yaml
# .github/workflows/maturity-scan.yml
on:
  schedule:
    - cron: '0 15 * * *'  # Daily at 9 AM CT
  workflow_dispatch:
  push:
    branches: [main]
    paths: ['app/api/**', 'lib/**']
```

### Manual triggers

- Before any launch announcement
- After deploying FLEET_URL or other env vars
- After fixing a P0 blocker
- When user asks "are we ready to launch?"
- When user asks about GTM status

## Integration with other agents

- **Booster Agent** — Product feature (campaign footprint). Maturity Monitor checks if it works
- **SmartSalesGuy** — Generates VC pitch. Maturity Monitor validates claims are true
- **Docker CI** — Validates build. Maturity Monitor validates product readiness
- **Bug Bot** — Finds code issues. Maturity Monitor finds GTM blockers

## Common P0 blockers

1. **FLEET_URL not configured** — `/api/fleet` returns `configured: false`
2. **API timeout** — `/api/trends` times out, site shows zeros
3. **No beta signup** — No form, no email capture, no path to interest
4. **Demo broken** — Demo chips on /footprint fail due to fleet issues

## Reporting format

When summarizing to user:

```
Maturity Scan Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Stage: CAUTION — SOFT BETA READINESS AT RISK
🎯 Maturity: Pre-beta
✅ Gates Passing: 1/8
🚨 P0 Blockers: 2
⚠️  P1 Blockers: 0

Top P0 Blockers:
1. FLEET_URL not configured (blocks Footprint feature)
2. Fleet ingest health unknown (cannot test without FLEET_URL)

📄 Full report: docs/MATURITY_MONITOR.md
```

## Additional resources

- [Agent README](../../agents/maturity-monitor/README.md)
- [Full report](../../docs/MATURITY_MONITOR.md)
- [Config](../../agents/maturity-monitor/config.yaml)
