# HawkxAI ingest fleet

Contest-window agents for [All Things Agentic](https://allthingsagentichackathon.devpost.com/). **Taskmaster.**

This fleet is additive to the Next.js desk. It does not replace `GET /api/trends`. An ADK agent collects receipts for a plugged phrase, scores/dedups **existing** titles, writes a GCS (or local) snapshot, and the desk merges that snapshot on `POST /api/fleet`.

- Gemini 3.5 Flash
- Google ADK (`ingest_agent`) — `/v1/ingest` **runs the agent**, it does not bypass it
- Cloud Run + GCS snapshots
- Channels: HN Algolia + Wikipedia / Google News RSS / NHTSA
- X is not in the toolset

## Layout

```
fleet/
  permissions.json        # tool on/off — handbook diffs this
  ingest_agent/agent.py   # ADK root_agent
  ingest_agent/runner.py  # Runner.run_async then persist
  tools/hn_channel.py
  tools/public_apis.py
  tools/score.py          # dedup + Gemini rank
  tools/snapshot.py       # GCS or fleet/snapshots
  main.py                 # /health /v1/ingest /dev-ui
  handbook/render.py      # HANDBOOK.md + architecture diagram
```

## Local

```bash
cd fleet
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `GOOGLE_API_KEY` (AI Studio). Optional: `GCS_BUCKET=your-bucket` (otherwise snapshots write under `fleet/snapshots/`).

```bash
uvicorn main:app --reload --port 8080
```

```bash
curl -s "http://localhost:8080/health"
curl -s -X POST "http://localhost:8080/v1/ingest" -H "content-type: application/json" -d "{\"phrase\":\"Camry\"}"
```

ADK web UI (Proof of Action logs): `http://localhost:8080/dev-ui` — ask it to ingest **Camry**.

Desk: in repo root `.env.local` set `FLEET_URL=http://localhost:8080` then `npm run dev` and plug Camry on `/footprint`. Trends `/` still uses `GET /api/trends`.

## Cloud Run

From `fleet/`, project billed to `nyayex.root@gmail.com`:

```bash
gcloud run deploy hawkxai-fleet --image us-central1-docker.pkg.dev/project-16647bb0-5d45-4404-956/cloud-run-source-deploy/hawkxai-fleet:latest --region us-central1 --allow-unauthenticated --set-env-vars GEMINI_MODEL=gemini-3.5-flash,GCS_BUCKET=YOUR_BUCKET
```

Set Vercel (and `.env.local`) `FLEET_URL=https://hawkxai-fleet-303927325261.us-central1.run.app`. Screenshot that `.run.app` URL in the demo video.

## Handbook

```bash
python -m handbook.render
```

Writes `handbook/out/HANDBOOK.md` and `docs/hackathon/ARCHITECTURE.md`. Flip a tool in `permissions.json` and re-render to get a permission diff.
