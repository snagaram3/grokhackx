# Runbook

Operational path for HawkxAI: local, Docker, Vercel, and CI.

## Health

There is no `/health` route. Treat these as live checks:

| Check | Expect |
|-------|--------|
| `GET /` | 200, lookup desk |
| `GET /api/trends?topic=Camry` | 200 JSON after first lookup (30–60s cold) |
| `GET /api/insights?q=Camry` | 200 `{ query, layers, firstRecord, thin }` — origin extract + oldest dated receipt |
| `GET /api/booster` | 200 after a phrase is cached; **409** if lookup never ran |
| `GET /api/collect?category=markets` | 200 `{ backend, databases, snapshots, forecasts }` after a tape exists |
| `GET /api/fleet` | 200 `{ configured, ok, ms }` — warms Cloud Run `/health` |
| `GET /api/collect?hourly=1` | 200 `{ snapped, skipped, snapshots }` after a tape or watchlist exists. Vercel Hobby cron hits this daily at 12:00 UTC. |
| `POST /api/ask` `{"q":"..."}` | 200 `{ answer, topicIds }`; **400** if `q` missing; **409** if no lookup |

`degraded` on trends (e.g. `reddit offline`) is expected on some networks — still render other sources.

## Local

```bash
npm install
cp .env.example .env.local   # set GOOGLE_API_KEY
npm run dev
```

Force refresh: `GET /api/trends?topic=Camry&refresh=1`. Cache TTL is 5 minutes.

After the server is provisioned:

```bash
# .env.local
TREND_DB_HOST=...
TREND_DB_USER=...
TREND_DB_PASSWORD=...
npm run provision:trend-db
```

That creates `hawkxai_all` plus one database per category plug. Until those vars are set, collection stays in memory on the warm instance.

## Docker

```bash
docker build -t hawkxai:latest .
docker run --rm -p 3001:3000 -e GOOGLE_API_KEY=... hawkxai:latest
```

Host **:3000** is often Grafana. Map the container to **:3001**. Image user is `nextjs` (non-root).

Without `GOOGLE_API_KEY` the UI still boots; Gemini clustering and Ask degrade.

## Vercel

1. `npm run build` must pass locally.
2. Set `GOOGLE_API_KEY` in Vercel project env.
3. `vercel.json` sets `maxDuration: 60` on `/api/trends` and `/api/ask`.

Rollback: revert the Vercel deployment to the previous production alias.

## CI

`.github/workflows/docker-ci.yml` runs on every PR commit, every feature-branch push (opens a PR against `main` if missing), and every push to `main`:

1. Dockerfile contract tests
2. Hadolint (advisory)
3. Production image build (GHA layer cache)
4. Smoke-test `GET /`
5. Bug Bot `--fail-on critical` on `app/`, `lib/`, `components/`
6. PR Review Bot (advisory) + sticky comment on pull requests
7. Auto-open a PR against `main` on feature-branch pushes when none exists

Failure of build, smoke, or critical Bug Bot blocks merge.

## Common issues

| Symptom | Fix |
|---------|-----|
| `Bind for 0.0.0.0:3000 failed` | Something else (often Grafana) holds 3000. Use `-p 3001:3000`. |
| `/api/booster` or `/api/ask` 409 | Hit `GET /api/trends?topic=` first. |
| Ask says Gemini is offline | `GOOGLE_API_KEY` missing in `.env.local`, Docker `-e`, or Vercel env. |
| Reddit pill `reddit offline` | 403 on some networks. Expected; map still renders HN/X. |
| First lookup ~60s | Cold live search. Subsequent hits use the 5-minute cache. |
| Docker build SWC unicode regex | Production target is ES2017 (`tsconfig`); already fixed on this line. |

## Escalation

Hackathon team: backend owns `lib/*` + `app/api/*`; map owns `components/` + `app/page.tsx`. Do not invent data to unblock a demo — degrade honestly.
