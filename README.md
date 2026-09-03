# HawkxAI — Campaign Footprint Intelligence

**🚀 Ready to launch!** See [LAUNCH_NOW.md](LAUNCH_NOW.md) for 3-day launch plan.

A live trend map across X, Reddit, and Hacker News. Gemini 3.5 clusters related topics, while divergence is calculated in code. A topic exploding on one platform tells a different story from one gaining momentum across all platforms.

**Campaign Footprint**: Look up a specific phrase you own (product, hashtag, event) on `/footprint`. See where it printed, what artifacts co-occurred (hashtags, QR codes, URLs), and when it will peak. Evidence-only. No invented WHY.

| Desk | Job | Vercel |
|---|---|---|
| Trends `/` | Live tape — what’s printing now | [hawkxai.vercel.app](https://hawkxai.vercel.app/) |
| Watch `/watchlist` | Names you track | [Watch](https://hawkxai.vercel.app/watchlist) |
| Footprint `/footprint` | Campaign war-room — mind map, artifacts, lineage | [Footprint](https://hawkxai.vercel.app/footprint) |
| Insights `/insights` | Taproot — origin page, family, oldest dated receipt | [Insights](https://hawkxai.vercel.app/insights) |
| Research `/research` | Cited topic brief — Wiki, web, HN; lineage on sources | [Research](https://hawkxai.vercel.app/research) |
| Handbook `/handbook` | Generated architecture + permissions | [Handbook](https://hawkxai.vercel.app/handbook) |
| Architecture `/architecture` | Ingest poster + mermaid | [Architecture](https://hawkxai.vercel.app/architecture) |

Also on Cloud Run: [hawkxai-qalms3xvxq-uc.a.run.app](https://hawkxai-qalms3xvxq-uc.a.run.app/footprint). Contest poster: [`public/demo/architecture.html`](public/demo/architecture.html).

**What makes HawkxAI different**: Brandwatch tells you "what's trending globally." We tell you "where YOUR campaign landed." Different job, different tool. See [docs/BRANDWATCH_COMPARISON.md](docs/BRANDWATCH_COMPARISON.md) for detailed positioning.

# Core Idea — Booster Agent

The Booster Agent captures trending signals such as hashtags, phrases, URLs, and other emerging topics, then analyzes and correlates them to understand why they are trending.

It also looks up a particular word or phrase a marketing team already owns, and fills the same interactive dashboard with that phrase's footprint.

Capture signals → Correlate trends → Explain why → Identify audience relevance → Generate campaign insights → Continuously improve

Phrase lookup is additive: `/` stays the trending desk. `/footprint` is the campaign-name war-room. Footprint ingest is the Cloud Run ADK fleet (`POST /api/fleet`). Trends stay on `GET /api/trends`.

```bash
python3 agents/booster-agent/booster_agent.py --self-check
```

North star: [docs/presentation/CORE_IDEA.md](docs/presentation/CORE_IDEA.md) — trending desk on `/`, phrase footprint on `/footprint`. Live: `GET /api/trends`. Footprint plug: `POST /api/fleet` `{ "phrase": "Camry" }` (needs `FLEET_URL`).

Repo: https://github.com/snagaram3/grokhackx

## Team split

| Person | Owns | Do not touch |
|---|---|---|
| Backend | `lib/*`, `app/api/*` | D3 map UI |
| Map | `app/page.tsx`, `components/` (new) | Gemini prompts, fetchers |
| Polish | top bar, Ask box, detail panel, Vercel | pipeline timeouts |

**No extra features.** If you are behind, cut tickers and peak-hour — never the map, never `/api/trends`.

## Setup (everyone)

```bash
git clone https://github.com/snagaram3/grokhackx.git
cd grokhackx
git pull
npm install
cp .env.example .env.local
```

Put the Gemini key only in `.env.local` (gitignored). Never commit it, never paste it in Discord.

```
GOOGLE_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
FLEET_URL=http://localhost:8080
```

```bash
npm run dev
```

- App: http://localhost:3000
- Watch: http://localhost:3000/watchlist
- Footprint tab: http://localhost:3000/footprint (plug goes to `POST /api/fleet`)
- Insights: http://localhost:3000/insights?q=Camry
- Research: http://localhost:3000/research?q=Camry
- Handbook: http://localhost:3000/handbook
- Architecture poster: http://localhost:3000/architecture · http://localhost:3000/demo/architecture.html
- Data: http://localhost:3000/api/trends
- Force refresh: http://localhost:3000/api/trends?refresh=1
- Fleet ingest: `POST /api/fleet` body `{ "phrase": "Camry" }`
- Ask: `POST /api/ask` body `{ "q": "what's printing worldwide?" }`
- Booster: http://localhost:3000/api/booster  (after trends are cached)
- Contest fleet: [fleet/README.md](fleet/README.md) · architecture: [docs/hackathon/ARCHITECTURE.md](docs/hackathon/ARCHITECTURE.md)

First `/api/trends` can take ~60–90s (Gemini cluster). After that it caches **5 minutes**.

## Map teammate — payload contract

`GET /api/trends?topic=` returns:

```ts
{
  topics: Topic[]
  updatedAt: string
  sources: { x: boolean; reddit: boolean; hn: boolean; public: boolean }
  degraded: string[]   // e.g. ["reddit offline"]
  plugged?: string     // the looked-up phrase
  query?: { raw, kind, category, match, hitCount, floor }
}
```

Each `Topic`:

- `id` — slug, use as React key
- `label` — human phrase
- `platforms.x | reddit | hn` — `{ score: 0-100, posts: Post[] }`
- `velocity` — `"rising" | "peaking" | "fading"`
- `divergence` — `0` = everywhere, `1` = single-platform bubble
- `tickers` — may be `[]` (cut until map is live)
- `peakHourCT` — optional, e.g. `"7pm"`
- `why` — optional; omit if missing (never fake)

`Post`: `{ platform, title, url, score, createdAt }`

**UI spec (do this next):**

- Full-viewport D3 v7 **circle packing** SVG
- Outer circle = topic, sized by `x.score + reddit.score + hn.score`
- Inner circles = platforms: X `#ffffff`, Reddit `#ff4500`, HN `#ff6600` on `#0a0e14`
- Glow on `velocity === "rising"`
- Click zooms 600ms; right panel: label, velocity, divergence one-liner (`"X-only bubble"` / `"spreading"` / `"everywhere"`), 3 receipt links from `posts`, ticker chips
- Top bar: logo, footprint status, lookup (`⌘K`)
- Loading: skeleton circles, never a blank screen
- If `degraded` has `"reddit offline"`, show a small pill — still render the other sources

Lookup: header search or `/?q=Camry` → `GET /api/trends?topic=Camry` → same mind / desk / map for that phrase.

D3 is already in `package.json`.

## Known degradations (expected)

- **Reddit** may 403 on some networks. Pill: `reddit offline`. Try venue wifi.
- **X via Google Search** can time out. Clustering still runs on HN (+ Reddit when available).
- **Tickers** are skipped until the map boots.

Never invent posts or a fake WHY.

## Deploy

Public URL: host on **Vercel**. Step-by-step: [docs/VERCEL.md](docs/VERCEL.md).

1. Import `snagaram3/grokhackx` at [vercel.com/new](https://vercel.com/new)
2. Framework: Next.js · root: `.`
3. Env: `GOOGLE_API_KEY` and `FLEET_URL` (Production + Preview)
4. Deploy. First `/api/trends` can take up to ~60s.

Do not commit `.env.local`. Docker CI still builds the production image on every PR and opens a PR on every feature-branch push (`agents/docker-ci`).

## Stack

Next.js 14 (app router) · TypeScript · D3 v7 · Tailwind · Gemini 3.5 · Google Search · Cloud SQL Postgres (10 category DBs) · no auth

Runtime topology (Mermaid): [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · live at `/architecture`. Ingest poster: [`public/demo/architecture.html`](public/demo/architecture.html). Each receipt keeps `tool` + `collectedAt`. `GET /api/trends` stays the tape — the fleet never writes it.

## Agents

Roster: [agents/README.md](agents/README.md)

| Agent | Role |
|---|---|
| [Booster](agents/booster-agent/README.md) | Capture → correlate → campaign (core idea) |
| [PR Review Bot](agents/pr-review-bot/README.md) | AI code review with quality scoring |
| [Bug Bot](agents/bug-bot/README.md) | Security and logic scan |
| [Docker CI](agents/docker-ci/README.md) | Production image build, smoke test, Bug Bot; auto-PR on every feature-branch push |
| [SmartSalesGuy](agents/smartsalesguy/README.md) | VC one-pager from this checkout |

```bash
python3 agents/booster-agent/booster_agent.py --self-check
python3 agents/docker-ci/ci_agent.py
python3 agents/smartsalesguy/smartsalesguy.py
```

Canonical investor page: [docs/presentation/VC_ONE_PAGER.md](docs/presentation/VC_ONE_PAGER.md) · Deck file list: [docs/presentation/README.md](docs/presentation/README.md#proposal-presentation)

## Launch Resources

🚀 **Ready to go public?** Start here:

- **[LAUNCH_NOW.md](LAUNCH_NOW.md)** — 3-day launch plan (Deploy → Record → Publish)
- **[DECISION_SUMMARY.md](DECISION_SUMMARY.md)** — Executive summary: Should you make HawkxAI public? (YES)
- **[docs/GO_TO_MARKET_STRATEGY.md](docs/GO_TO_MARKET_STRATEGY.md)** — Complete GTM strategy (15 pages)
- **[docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)** — Pre-launch checklist (18 tasks)
- **[marketing/SOCIAL_MEDIA_TEMPLATES.md](marketing/SOCIAL_MEDIA_TEMPLATES.md)** — Copy-paste ready posts for X, LinkedIn, Reddit, Product Hunt, HN

**TL;DR**: Target 10-20 performance marketers first. Success metric: 10 daily active users by Week 4. Then scale to public launch (Product Hunt, HN, Reddit).
