# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JS (user-chosen for fastest hackathon demo), sitting on the existing Python CLI/library.

## Users

Primary: founders and operators scanning emerging tech, finance, and startup signals between meetings.

Secondary: investors and analysts comparing related stories before they decide.

Demo audience: hackathon judges walking the same console in a short live run.

## Product Purpose

HawkxAI is a Discover Trends research console. A user names a topic; the system runs three scouts (tech, finance, startup), collects public events, clusters related stories, scores them, optionally expands once (depth ≤ 2), draws a trend graph, and renders two insight views from the same graph:

- Consumer: What / Why / Next
- Business: Impact / Risk / Opportunity

Success is a scannable, dual-lens briefing from real public sources in one pass, not a marketing page or a generic news feed.

## Positioning

Neighboring products summarize “what’s trending.” This product’s claim is the shared trend graph plus two irreconcilable lenses: a consumer briefing and a business briefing from the same clustered evidence. A generic dashboard cannot truthfully copy that split without the scout → cluster → graph pipeline.

## Operating Context

- Start from Discover Trends with a topic query.
- Inspect three scout streams, then the clustered graph.
- Read Consumer and Business cards side by side.
- Existing Python CLI (`python cli.py research|search|ask|history|fetch`) remains a valid way to run research without the UI.
- Hackathon evaluation is a live demo on a laptop, not a production multi-tenant app.

## Capabilities and Constraints

Confirmed:

- Full pipeline must remain visible in the UI: Discover → three scouts → trend graph → Consumer (What / Why / Next) vs Business (Impact / Risk / Opportunity).
- Data sources for the MVP: Hacker News Algolia, GitHub Search, GDELT, existing DuckDuckGo Instant Answer collector. Unofficial X scraping is out of bounds. Official X API is not funded by Cursor credits.
- Runtime LLM (Gemini 3.5 orchestrator / expansion / insights) is optional behind `GOOGLE_API_KEY`; the demo must still run with heuristic/template insights if that key is absent.
- Keep the Python CLI working; the static UI is additive.

Undecided:

- X mentions come from Gemini + Google Search grounding, not xAI.
- Hosting/deploy target beyond local demo.

## Brand Commitments

Product name in-repo: HawkxAI. No separate logo, voice guide, or visual identity is binding yet.

## Evidence on Hand

- Architecture brief from the team (orchestrator, scouts, collectors, cluster, score, expand, relationship graph, dual insights).
- Current codebase: Python research CLI (`research_agent.py`, `cli.py`, `config.py`); DuckDuckGo search + HTML fetch; JSON/text research output. No UI yet.
- No real customer quotes, screenshots of the finished console, or production metrics. Future work must not invent testimonials, press, or fake live market numbers.

## Product Principles

1. Dual lens is the product: consumer and business insights share one graph and must stay comparable.
2. Evidence before narrative: cards cite clustered public events; do not invent sources.
3. Operator speed: dense, scannable console for a short look, not a long read.
4. Honest demo: degrade without paid APIs rather than fake X data or fabricated proof.
5. CLI remains a first-class path; the web UI is a view of the same research job.
