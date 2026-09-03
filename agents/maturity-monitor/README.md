# Maturity Monitor Agent 📊

**Automated GTM readiness scanner for HawkxAI**

Periodically scans the product, repository, and endpoints to validate readiness against Soft Beta → Paid Pilot → Public Launch gates. Auto-generates assessment reports with P0 blockers, scorecard, and next actions.

## What It Does

The Maturity Monitor agent:

1. **🌐 Checks Endpoints** — Validates `/api/fleet`, `/api/trends`, and other critical APIs
2. **📝 Scans Git Activity** — Analyzes recent commits for GTM-critical work
3. **✅ Validates Gates** — Tests all Soft Beta hard gates (8 gates total)
4. **📊 Calculates Scorecard** — Scores 7 maturity dimensions (0-5 scale)
5. **🚨 Identifies Blockers** — Prioritizes P0/P1 issues blocking launch
6. **📄 Generates Report** — Auto-updates `docs/MATURITY_MONITOR.md`

## Usage

### Run Full Scan

```bash
python3 agents/maturity-monitor/maturity_monitor.py --scan
```

This will:
- Check all critical endpoints
- Scan git activity (last 14 days)
- Validate all gates
- Generate updated report at `docs/MATURITY_MONITOR.md`

### Self-Check

```bash
python3 agents/maturity-monitor/maturity_monitor.py --self-check
```

Validates the agent itself:
- Repository path exists
- Git is available
- Docs directory exists
- Endpoint checking works

### Custom Options

```bash
# Use custom base URL
python3 agents/maturity-monitor/maturity_monitor.py --scan --base-url https://staging.hawkxai.com

# Custom output path
python3 agents/maturity-monitor/maturity_monitor.py --scan --output reports/maturity_$(date +%Y%m%d).md

# Custom repo path
python3 agents/maturity-monitor/maturity_monitor.py --scan --repo-path /path/to/grokhackx
```

## What It Checks

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/fleet` | Footprint feature configuration |
| `/api/trends` | Homepage data and performance |

### Soft Beta Gates (8 total)

1. ✅/❌ Footprint works end-to-end on real phrase
2. ✅/❌ Fleet ingest healthy (no 503 failures)
3. ✅/❌ Homepage not broken on cold load
4. ✅/❌ Trends take 20-60s → honest progress state
5. ✅/❌ One claimed live source actually works (especially X)
6. ✅/❌ One seeded "wow" demo (30s stranger test)
7. ✅/❌ Beta signup exists
8. ✅/❌ Repo/site link to each other

### Scorecard Dimensions

| Dimension | Max Score |
|-----------|-----------|
| Footprint reliability | 5 |
| Data depth / source honesty | 5 |
| Time-to-value for stranger | 5 |
| Persistence / return loop | 5 |
| Commercial surface | 5 |
| Claim/truth alignment | 5 |
| Roadmap velocity on GTM blockers | 5 |

## Stage Recommendations

The agent determines readiness based on gate pass/fail counts:

| Gates Failing | Recommendation |
|---------------|----------------|
| 4+ | **HOLD — NOT READY FOR SOFT BETA** |
| 2-3 | **CAUTION — SOFT BETA READINESS AT RISK** |
| 1 | **NEARLY READY — MINOR FIXES NEEDED** |
| 0 | **READY FOR SOFT BETA** |

## Automation

### GitHub Actions (Recommended)

Create `.github/workflows/maturity-scan.yml`:

```yaml
name: Maturity Scan

on:
  schedule:
    # Run every day at 9 AM CT (3 PM UTC)
    - cron: '0 15 * * *'
  workflow_dispatch:  # Allow manual trigger
  push:
    branches:
      - main
    paths:
      - 'app/api/**'
      - 'lib/**'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Maturity Scan
        run: python3 agents/maturity-monitor/maturity_monitor.py --scan
      
      - name: Commit Updated Report
        run: |
          git config user.name "Maturity Monitor Bot"
          git config user.email "bot@hawkxai.com"
          git add docs/MATURITY_MONITOR.md
          git diff --staged --quiet || git commit -m "chore: update maturity assessment [skip ci]"
          git push
```

### Cron Job

```bash
# Run daily at 9 AM
0 9 * * * cd /path/to/grokhackx && python3 agents/maturity-monitor/maturity_monitor.py --scan
```

### Manual After Deploys

```bash
# After Vercel deploy
vercel deploy --prod && python3 agents/maturity-monitor/maturity_monitor.py --scan

# After environment variable change
vercel env add FLEET_URL && python3 agents/maturity-monitor/maturity_monitor.py --scan
```

## Output Format

The agent generates a structured markdown report:

```markdown
# HawkxAI Maturity Monitor — Automated Scan

**Report Date:** Monday, Sep 1, 2026, 1:00 PM UTC
**Stage Recommendation:** HOLD — NOT READY FOR SOFT BETA
**CMO Verdict:** Core features are non-functional...

## SCORECARD
| Dimension | Score | Evidence |
|-----------|-------|----------|
| Footprint reliability | 0/5 | ❌ FLEET_URL not configured |
...

## ENDPOINT HEALTH
### https://hawkxai.com/api/fleet
- **Status:** ✅ HEALTHY
- **Response Time:** 234ms
...

## HARD GATES: SOFT BETA
| Gate | Status | Evidence |
|------|--------|----------|
| Footprint works end-to-end | ❌ **FAIL** | FLEET_URL not configured |
...

## BLOCKERS
### P0 — Blocks ALL GTM
1. Footprint works end-to-end: FLEET_URL not configured
...
```

## Integration with Other Agents

### With Booster Agent

```bash
# Run booster analysis, then check maturity
python3 agents/booster-agent/booster_agent.py --file sample.json
python3 agents/maturity-monitor/maturity_monitor.py --scan
```

### With Docker CI

```bash
# Build, test, scan maturity
python3 agents/docker-ci/ci_agent.py
python3 agents/maturity-monitor/maturity_monitor.py --scan
```

### With SmartSalesGuy

```bash
# Generate VC pitch, validate readiness
python3 agents/smartsalesguy/smartsalesguy.py
python3 agents/maturity-monitor/maturity_monitor.py --scan
```

## Dependencies

**None!** Uses Python standard library only:

- `urllib.request` — Endpoint health checks
- `subprocess` — Git activity scanning
- `json` — Data parsing
- `dataclasses` — Structured data
- `pathlib` — File handling

Compatible with Python 3.7+.

## Monitoring Cadence

**Recommended schedule:**

- **Daily** at 9 AM CT — Automated scan via GitHub Actions
- **After every deploy** — Manual scan to validate changes
- **Before launch announcements** — Verify all gates passing
- **48 hours after P0 fix** — Confirm blocker resolved

## CMO Dashboard

The report is designed for CMO-level decision making:

- ✅ **READY FOR SOFT BETA** → Safe to announce, post on social media
- ⚠️ **NEARLY READY** → Fix minor blockers, don't announce yet
- 🚨 **HOLD** → Core features broken, roll back any "ready to launch" claims

## Example Output

```
🔍 Starting HawkxAI maturity scan...

Checking endpoints...
  → /api/fleet... healthy (234ms)
  → /api/trends... timeout (10043ms)

Scanning git activity...
  → Found 32 commits (last 14 days)
  → 4 GTM-critical commits

Validating Soft Beta gates...
  → 2 passing, 4 failing

Calculating scorecard...
  → Average score: 1.7/5

✅ Report saved to: docs/MATURITY_MONITOR.md

📊 Assessment: HOLD — NOT READY FOR SOFT BETA
🎯 Overall Maturity: Prototype
🚨 P0 Blockers: 3
⚠️  P1 Blockers: 2
```

## Troubleshooting

### "Git not found"

```bash
# Install git
sudo apt install git  # Ubuntu/Debian
brew install git      # macOS
```

### "Connection timeout"

The agent uses 10-second timeout for API checks. If your site is slow:

```python
# Edit maturity_monitor.py
health = self.check_endpoint(path, timeout=30)  # Increase timeout
```

### "No module named X"

The agent uses stdlib only. If you get import errors, check Python version:

```bash
python3 --version  # Should be 3.7+
```

## Architecture

```
maturity_monitor.py
├── MaturityMonitor (main class)
│   ├── check_endpoint()          # HTTP health checks
│   ├── scan_git_activity()       # Git commit analysis
│   ├── validate_soft_beta_gates() # Gate validation
│   ├── calculate_scorecard()     # Scoring logic
│   ├── generate_report()         # Markdown generation
│   └── run_scan()                # Orchestration
├── EndpointHealth (dataclass)    # API health result
├── GateValidation (dataclass)    # Gate pass/fail
├── MaturityScore (dataclass)     # Scorecard dimension
└── MaturityAssessment (dataclass) # Complete report
```

## Contributing

To improve the agent:

1. **Add more gates** — Edit `validate_soft_beta_gates()`
2. **Add more endpoints** — Extend `endpoints_to_check` list
3. **Improve scoring** — Refine `calculate_scorecard()` logic
4. **Better git analysis** — Enhance `scan_git_activity()` patterns

## Comparison with Booster Agent

| Aspect | Booster Agent | Maturity Monitor |
|--------|---------------|------------------|
| **Purpose** | Campaign footprint lookup | GTM readiness assessment |
| **Trigger** | On-demand via API | Scheduled / periodic |
| **Output** | JSON for dashboard | Markdown report |
| **User** | Marketing teams | CMO / product leadership |
| **Frequency** | Per campaign lookup | Daily / after deploys |

Both agents are complementary:
- **Booster** = Product feature (core value prop)
- **Maturity Monitor** = Internal ops tool (launch readiness)

---

**Built to keep HawkxAI launch-ready!** 🚀
