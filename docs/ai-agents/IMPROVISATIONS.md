# AI Agents Tracking — Booster Improvisations

Living backlog for AI Agents Intelligence feature.

Last run: 2026-09-03T06:00:00+00:00

## ✅ SHIPPED — Core AI Agents Tracking

- **What:** New `/ai-agents` desk tracks 8+ leading AI agents with real-time metrics, capabilities, pricing, and trends. Filter by category (code-generation, reasoning, multimodal, search, automation, analysis, creative, enterprise), provider (OpenAI, Anthropic, Google, Meta, etc.), and trending status. Three-pane layout: agents list, overview insights, detailed agent view.
- **Files:** `lib/ai-agents-types.ts`, `lib/ai-agents-store.ts`, `app/api/ai-agents/route.ts`, `components/ai-agents/AIAgentsDesk.tsx`, `app/ai-agents/page.tsx`
- **Next:** Wire real-time mentions from X/Reddit/HN. Persist agent metrics to trend DB.

## P0 — Real-time Mentions from Social Platforms

- **Why:** Current metrics are simulated. Real adoption signals come from X, Reddit, HN discussions mentioning agent names.
- **Next:** Reuse `lib/signals.ts` collectors. Query `agents.map(a => a.name)` as plugged phrases. Count platform posts per agent. Update metrics hourly.

## P0 — Agent Comparison Matrix

- **Why:** Users want side-by-side capability comparisons. "Claude vs GPT-4 vs Gemini for coding" is a common query.
- **Next:** Add `/ai-agents?compare=id1,id2,id3` route. Render capability radar chart. Show pricing table. Highlight leader in each category.

## P1 — Historical Trend Charts

- **Why:** "Is Claude adoption growing faster than GPT?" needs time-series data.
- **Next:** Store daily snapshots in `ai_agent_trends` table. Plot 30-day mention velocity, sentiment, and market share. Use same time-series components as Watch occurrence.

## P1 — Agent Release Timeline

- **Why:** Major releases (GPT-4 Turbo, Claude 3.5, Gemini 2.0) drive adoption spikes. Timeline shows correlation.
- **Next:** Render vertical timeline of releases across all agents. Mark trending periods. Link release features to capability score changes.

## P1 — Integration with Booster Agent

- **Why:** Booster agent should suggest which AI agent to use for campaign tracking, footprint analysis, or research queries.
- **Next:** When user plugs a phrase in Footprint, recommend "Use Perplexity for research" or "Use Claude for code analysis" based on task type and agent capabilities.

## P2 — Community Sentiment Analysis

- **Why:** Raw mention counts don't capture "GPT-4 is slow" vs "Claude is amazing for coding". Sentiment matters.
- **Next:** Run sentiment analysis on agent mentions. Plot positive/negative/mixed ratios. Flag controversial changes (pricing increase → negative spike).

## P2 — API Cost Calculator

- **Why:** "How much will 1M tokens cost across 5 agents?" is a common developer question.
- **Next:** Add calculator widget. Input token count (input/output split). Output costs for all agents. Highlight cheapest option.

## P2 — Agent Usage Recommendations

- **Why:** New users ask "Which agent for my use case?" Recommendations drive adoption.
- **Next:** Quiz flow: "What do you need? (Code / Research / Creative / Analysis)". Recommend top 3 agents with reasoning. Link to detail pages.

## P2 — Market Share Over Time

- **Why:** Track OpenAI vs Anthropic vs Google market dynamics. Shows ecosystem health.
- **Next:** Calculate market share as % of total mentions. Plot stacked area chart. Annotate major events (releases, pricing changes, outages).

## P1 — Trend Alerts

- **Why:** Notify when an agent's velocity shifts from stable → rising or peaking → fading.
- **Next:** Subscribe to agent IDs. Email/Slack alert on status change. Include evidence (mention spike, sentiment shift, release).

## P2 — Developer Experience Score

- **Why:** Capabilities alone don't show "Is the API easy to use?" DX matters for adoption.
- **Next:** Aggregate DX signals: docs quality (link check), API uptime (status page scrape), error rate mentions (sentiment on "timeout", "rate limit"). Add DX score 0-100.

## P1 — Export Agent Data

- **Why:** Teams want to import agent metrics into internal dashboards or reports.
- **Next:** Add "Export CSV" and "Export JSON" buttons. Include all metrics, capabilities, pricing. Respect filter state.

## Booster Improvisations — Meta

These improvisations follow the booster agent pattern:
1. **Look up** AI agent names from real adoption signals (X, Reddit, HN, GitHub stars)
2. **Capture** artifacts: version releases, pricing changes, capability benchmarks, API changes
3. **Correlate** velocity, sentiment, competitive position, market share
4. **Translate** for decision-makers: "Which agent for my use case?", "Is adoption growing?", "What's the ROI?"
5. **Improvise** — every AI Agents page refresh should suggest 3-5 ranked insights

## Next Steps

1. Wire real-time social mentions (P0)
2. Add agent comparison matrix (P0)
3. Build historical trend charts (P1)
4. Create release timeline view (P1)
5. Integrate booster recommendations (P1)
6. Add sentiment analysis (P2)
7. Build cost calculator (P2)
8. Create usage recommendations (P2)

---

*This feature demonstrates HawkxAI's core capability: track anything with an internet footprint. AI agents are products with campaigns, launches, and adoption curves — perfect for the booster agent pattern.*
