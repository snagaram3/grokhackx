# Agents Directory 🤖

This directory contains autonomous AI agents that enhance the development workflow.

## Available Agents

| # | Agent | Role | Run |
|---|---|---|---|
| 1 | [`booster-agent`](booster-agent/README.md) | Core idea: capture → correlate → campaign | `python3 agents/booster-agent/booster_agent.py --self-check` |
| 2 | [`pr-review-bot`](pr-review-bot/README.md) | AI PR review with quality scoring | `python3 agents/pr-review-bot/review_bot.py <pr>` |
| 3 | [`bug-bot`](bug-bot/README.md) | Security and logic scan | `python3 agents/bug-bot/bug_bot.py` |
| 4 | [`docker-ci`](docker-ci/README.md) | Production image build, smoke test, Bug Bot | `python3 agents/docker-ci/ci_agent.py` |
| 5 | [`smartsalesguy`](smartsalesguy/README.md) | VC one-pager from this checkout | `python3 agents/smartsalesguy/smartsalesguy.py` |
| 6 | [`maturity-monitor`](maturity-monitor/README.md) | GTM readiness scanner | `python3 agents/maturity-monitor/maturity_monitor.py --scan` |

### 1. Booster Agent (`booster-agent/`) — **core idea**

Captures the footprint of a looked-up phrase (campaign name, hashtag, product); correlates why those receipts exist; translates insights for every age group and for campaign competitors; and keeps improvising the dashboard.

```bash
python3 agents/booster-agent/booster_agent.py --self-check
python3 agents/booster-agent/booster_agent.py --file agents/booster-agent/fixtures/sample_trends.json
```

[See full documentation →](booster-agent/README.md) · [Core idea →](../docs/presentation/CORE_IDEA.md)

### 2. PR Review Bot (`pr-review-bot/`)

An AI-powered code review agent with reinforcement learning capabilities.

**Features:**
- 🔍 Automated code review
- 🧠 Reinforcement learning
- 📊 Quality scoring (0-10)
- 📝 Detailed reports (JSON + Markdown)
- 🎯 Smart categorization
- 📈 Learning analytics

[See full documentation →](pr-review-bot/README.md)

### 3. Bug Bot (`bug-bot/`)

Intelligent bug detection and tracking agent that finds security vulnerabilities and logic errors.

```bash
python3 agents/bug-bot/bug_bot.py
```

[See full documentation →](bug-bot/README.md)

### 4. Docker CI Agent (`docker-ci/`)

Builds the production Dockerfile, smoke-tests the image, gates every PR commit and every merge to `main` with Bug Bot, and opens a PR on every feature-branch push if one is missing.

Runs via `.github/workflows/docker-ci.yml`.

[See full documentation →](docker-ci/README.md)

### 5. SmartSalesGuy (`smartsalesguy/`) — **VC one-pager**

Checks out HawkxAI and writes a one-page venture proposal in unicorn-founder voice: core problem, solution, what's live, what's next. Evidence from the git tree only — no invented traction.

```bash
python3 agents/smartsalesguy/smartsalesguy.py --self-check
python3 agents/smartsalesguy/smartsalesguy.py
```

Canonical page: [docs/presentation/VC_ONE_PAGER.md](../docs/presentation/VC_ONE_PAGER.md) · [Agent docs →](smartsalesguy/README.md)

### 6. Maturity Monitor (`maturity-monitor/`) — **GTM readiness scanner**

Automated scanning agent that checks endpoints, validates gates, and generates readiness assessments for CMO decision-making. Scans product health, git activity, and Soft Beta gates. Auto-updates the maturity report.

```bash
python3 agents/maturity-monitor/maturity_monitor.py --scan
python3 agents/maturity-monitor/maturity_monitor.py --self-check
```

Canonical report: [docs/MATURITY_MONITOR.md](../docs/MATURITY_MONITOR.md) · [Agent docs →](maturity-monitor/README.md)

---

## Example Results

### PR Review Bot

#### PR #2: Documentation (Score: 9.7/10)
```markdown
## Summary
✓ Generally good! Found 1 minor improvement(s).

## Strengths ✅
- Clear implementation with working code
- Well-documented PR with good description
- Focused PR with manageable scope
- Clean code with good practices
```

#### PR #1: Research Agent (Score: 0.0/10)
```markdown
## Summary
⚡ Found 82 major issue(s) to address before merging.

## Areas for Improvement 🔧
- Fix 82 major issue(s)
- Several minor style/documentation improvements possible
- Add more documentation (docstrings, comments)
```

Issues found:
- 82 major: Print statements (should use logging)
- 132 minor: Trailing whitespace, missing docstrings

### Bug Bot

#### Full Repository Scan
```markdown
## Summary
🚨 CRITICAL: 13 critical bug(s) found - immediate action required!

Total: 390 bugs
  🚨 Critical: 13 (security vulnerabilities)
  ⚠️  High: 37 (logic errors, resource leaks)
  💡 Medium: 330 (type issues, None checks)
  🔸 Low: 10 (performance, code smells)
```

Critical issues found:
- Hardcoded passwords/API keys
- Potential SQL injection
- Code injection with eval()
- Shell injection vulnerabilities

---

## Adding New Agents

To add a new agent:

1. Create directory: `agents/your-agent-name/`
2. Add main script: `agent.py` or similar
3. Add README.md with documentation
4. Add config file if needed
5. Update this README

### Agent Structure Template

```
agents/
└── your-agent-name/
    ├── README.md           # Documentation
    ├── agent.py            # Main agent code
    ├── config.yaml         # Configuration
    ├── requirements.txt    # Dependencies
    └── tests/              # Tests
```

### Agent Best Practices

✅ **DO:**
- Document usage clearly
- Include configuration options
- Provide examples
- Handle errors gracefully
- Support batch operations
- Save results for later review

❌ **DON'T:**
- Hardcode values
- Ignore edge cases
- Skip error handling
- Forget to document
- Make breaking changes without versioning

---

## Future Agents (Ideas)

Shipped (do not rebuild): Booster, PR Review Bot, Bug Bot, Docker CI, SmartSalesGuy.

Still worth building:
- **Test Coverage Agent** - Ensure adequate test coverage
- **Performance Profiler** - Find performance bottlenecks
- **Dependency Updater** - Keep dependencies current
- **Code Refactoring Agent** - Suggest refactorings
- **API Design Reviewer** - Review API consistency
- **Accessibility Checker** - Ensure accessibility standards

---

## Agent Integration

### CI/CD Integration

Docker builds and Bug Bot already run on every PR commit, every feature-branch push (which also opens a PR if missing), and every push to `main`:

```yaml
# .github/workflows/docker-ci.yml
# build Dockerfile → smoke-test image → Bug Bot --fail-on critical
```

```yaml
# Optional extra: PR Review Bot only
name: AI Agents

on: pull_request

jobs:
  pr-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: PR Review Bot
        run: python3 agents/pr-review-bot/review_bot.py ${{ github.event.pull_request.number }}
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
python3 agents/pr-review-bot/review_bot.py $(gh pr view --json number -q .number)
```

### CLI Integration

```bash
# Add to package.json or Makefile
review-pr:
    python3 agents/pr-review-bot/review_bot.py $(PR)

# Usage: make review-pr PR=2
```

---

## Agent Analytics

Track agent performance:

```bash
# View learning statistics
python3 -c "from agents.pr_review_bot.review_bot import PRReviewBot; import json; print(json.dumps(PRReviewBot().learner.get_learning_stats(), indent=2))"

# Count reviews
ls agents/pr-review-bot/reviews/*.json | wc -l

# Average score
python3 -c "import json, glob; scores = [json.load(open(f))['overall_score'] for f in glob.glob('agents/pr-review-bot/reviews/*.json')]; print(f'Average: {sum(scores)/len(scores):.1f}/10')"
```

---

## Contributing

To contribute new agents or improve existing ones:

1. Fork the repository
2. Create your agent in `agents/your-agent/`
3. Add comprehensive documentation
4. Test thoroughly
5. Submit a pull request

---

**Built to make development smarter, faster, and better!** 🚀
