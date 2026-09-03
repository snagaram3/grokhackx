# Documentation

Ops docs for HawkxAI live here. **Pitch and investor materials** are in **[presentation/](./presentation/)**.

- **[Contributing](./CONTRIBUTING.md)** — setup, scripts, tests, PR checklist
- **[Runbook](./RUNBOOK.md)** — local / Docker / Vercel / CI, health checks, rollback
- **[Architecture](./ARCHITECTURE.md)** — Vercel `iad1`, Cloud SQL, ten category databases (Mermaid)
- **[Handbook](../app/handbook/page.tsx)** — live generated handbook (`/handbook`, HistGB card, permissions, lineage)
- **[Vercel hosting](./VERCEL.md)** — import the GitHub repo, set `GOOGLE_API_KEY` and `FLEET_URL`, deploy (keep until www DNS cutover)
- **[Cloud Run hosting](./GCP.md)** — production desk on GCP; GoDaddy records; do not cut Vercel until www HTTPS works
- **[Presentation](./presentation/README.md)** — VC one-pager, core idea, research, agent canvas

North star (product contract): [presentation/CORE_IDEA.md](./presentation/CORE_IDEA.md) · Booster: [agents/booster-agent/README.md](../agents/booster-agent/README.md) · Improvisations: [IMPROVISATIONS.md](../agents/booster-agent/IMPROVISATIONS.md)

<!-- AUTO-GENERATED: commands. Source: package.json + agent CLIs. Do not hand-edit. -->

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (http://localhost:3000) |
| `npm run build` | Production build with type checking |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint via next lint |
| `npm run booster` | Booster Agent self-check (no network) |
| `npm run sales` | SmartSalesGuy self-check / refresh one-pager |
| `python3 agents/docker-ci/ci_agent.py` | Lint Dockerfile, build image, smoke-test, Bug Bot |
| `python3 agents/bug-bot/bug_bot.py [path] --fail-on critical` | Scan tree; CI gate on critical |
| `python3 agents/pr-review-bot/review_bot.py <pr>` | Review a GitHub PR |
| `docker build -t hawkxai:latest .` | Production image |

<!-- /AUTO-GENERATED: commands -->

<!-- AUTO-GENERATED: environment. Source: .env.example. Do not hand-edit. -->

## Environment

Copy `.env.example` to `.env.local` (gitignored). Never commit keys.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GOOGLE_API_KEY` | Yes (for live Gemini) | Gemini API key for clustering, Ask, Google Search, and tickers. App still boots without it; Ask/trends degrade. | from AI Studio |
| `GEMINI_API_KEY` | No | Alias for `GOOGLE_API_KEY` if that name is unset. | |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.5-flash`. | `gemini-3.5-flash` |
| `YOUTUBE_API_KEY` | No | Official YouTube / Shorts titles. Feed is skipped when unset. | Google Cloud API key |
| `FLEET_URL` | Yes for Footprint | Cloud Run ingest base URL. `/footprint` POSTs here. | `https://hawkxai-fleet-….run.app` |
| `TREND_DB_HOST` | No | Cloud SQL primary. Unset = in-memory collect. | Cloud SQL IP |
| `TREND_DB_PORT` | No | Postgres port. | `5432` |
| `TREND_DB_USER` | No | Database user. | `postgres` |
| `TREND_DB_PASSWORD` | No | Database password. | |
| `TREND_DB_SSL` | No | Set `1` from Vercel. | `1` |
| `TREND_DB_PREFIX` | No | Database name prefix. | `hawkxai` |
| `TREND_DB_ADMIN` | No | Admin DB for provision. | `postgres` |

Vercel: set the same variable in project env. Docker: `-e GOOGLE_API_KEY=...`.

<!-- /AUTO-GENERATED: environment -->

<!-- AUTO-GENERATED: API. Source: app/api/*/route.ts. Do not hand-edit. -->

## API

Warm `/api/trends?topic=` with a phrase before Ask or Booster (409 until the cache is populated). First lookup can take 30–60s; then 5-minute cache. `?refresh=1` bypasses cache.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/api/trends?topic=` | `GOOGLE_API_KEY` for Gemini cluster + Google Search | Phrase footprint `{ topics, updatedAt, sources, degraded, plugged, query }` |
| `GET` | `/api/trends?topic=&refresh=1` | same | Force refetch |
| `POST` | `/api/fleet` | `FLEET_URL` | Body `{ "phrase": "Camry" }` → same desk payload from the Cloud Run ADK fleet. Does not touch `GET /api/trends`. |
| `POST` | `/api/ask` | Gemini optional | Body `{ "q": "..." }` → `{ answer, topicIds[] }`. 400 if `q` missing; 409 if no lookup. |
| `GET` | `/api/booster` | none (uses lookup cache) | Artifacts, footprint correlation, age lenses, campaign. 409 if no lookup. |

Vercel `maxDuration`: 60s for `/api/trends`, `/api/ask`, and `/api/fleet`; 30s for `/api/booster` (`vercel.json`).

<!-- /AUTO-GENERATED: API -->

<!-- AUTO-GENERATED: infra. Source: Dockerfile + .github/workflows/docker-ci.yml. Do not hand-edit. -->

## Infrastructure

- **Dockerfile** — multi-stage Next.js standalone, non-root `nextjs`, port 3000.
- **Docker CI** — `.github/workflows/docker-ci.yml` on every PR commit, every feature-branch push (auto-opens a PR if missing), and every push to `main`: contract tests, Hadolint (advisory), image build, smoke test, Bug Bot `--fail-on critical`.
- **Local image:** Grafana often holds host `:3000`; map HawkxAI to `:3001` (`-p 3001:3000`).

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [RUNBOOK.md](./RUNBOOK.md).

<!-- /AUTO-GENERATED: infra -->
