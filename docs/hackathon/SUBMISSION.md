# All Things Agentic — submission pack

Contest: [All Things Agentic](https://allthingsagentichackathon.devpost.com/) · **Taskmaster** · due **Aug 31 2026 5:00pm PDT**.

Architecture diagram (contest poster): [VIDEO_SCRIPT.md](./VIDEO_SCRIPT.md) · live [`/architecture`](../../app/architecture/page.tsx) · static [`/demo/architecture.html`](../../public/demo/architecture.html)

**Devpost upload (png, under 35MB):** [`docs/hackathon/hawkxai-architecture.png`](./hawkxai-architecture.png) — five-lane ingest poster. Upload that file. Do not upload the HTML.  
Generated mermaid (from fleet files): [ARCHITECTURE.md](./ARCHITECTURE.md)

## Devpost form (paste)

| Field | Value |
|---|---|
| Category | Taskmaster |
| Hosted project | https://hawkxai-qalms3xvxq-uc.a.run.app/footprint |
| GitHub | https://github.com/kishanraj41/hawkxai |
| Video | YouTube or Vimeo public URL of the unedited 4-min take |
| Built with | Gemini 3.5 Flash, Google ADK, Cloud Run, Cloud Storage, Cloud SQL, Next.js |

If the repo is ever private, share it with `testing@devpost.com` and `cloudhackathons@google.com`.

## Built during the contest (paste into Devpost if asked)

HawkxAI was created during the Submission Period. All Things Agentic opened 4 August 2026. This repo does not incorporate a pre-contest HawkxAI codebase. Standard tools used: Next.js, Google ADK, Gemini 3.5 Flash, Cloud Run, Cloud Storage, Cloud SQL.

## Technologies

Gemini 3.5 Flash, Google ADK, Cloud Run, Cloud Storage, Cloud SQL, Next.js, HN Algolia, Wikipedia API, Google News RSS, NHTSA recalls API.

## Write-up (paste)

HawkxAI is campaign footprint intelligence. A marketer plugs a phrase they already own. An ADK ingest fleet on Cloud Run fans out to Hacker News and public APIs, scores and dedups existing receipts with Gemini 3.5, writes snapshots to GCS, and merges into the Footprint desk. The desk maps prints, artifacts, and a mind map from those receipts only — never an invented WHY. X is not the centerpiece.

Proof of Action: open `/footprint` on Cloud Run, plug Camry, watch `/dev-ui` on the fleet service, then `/handbook` for the generated architecture diagram. Spin-up is in the README.

## Spin-up

Desk:

```bash
npm install
cp .env.example .env.local
# GOOGLE_API_KEY=...
# FLEET_URL=https://YOUR-SERVICE.run.app
npm run dev
```

Fleet:

```bash
cd fleet
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# GOOGLE_API_KEY=...
# GCS_BUCKET=...   (optional locally)
uvicorn main:app --reload --port 8080
```

Proof of Action: `POST http://localhost:8080/v1/ingest` with `{"phrase":"Camry"}` then open `/footprint` and plug Camry. ADK logs: `http://localhost:8080/dev-ui`.

## 4-minute unedited video (record live)

Full spoken script: [VIDEO_SCRIPT.md](./VIDEO_SCRIPT.md). One take, 1×, English, YouTube or Vimeo.

1. Problem (20s): a marketer owns a phrase and should not babysit feeds or invent a WHY.
2. Cloud Console Cloud Run, then open https://hawkxai-qalms3xvxq-uc.a.run.app/footprint. Address bar must show `.run.app`.
3. Plug **Camry**. Second tab: https://hawkxai-fleet-qalms3xvxq-uc.a.run.app/dev-ui.
4. Desk fills: prints, artifacts, mind map. No invented WHY. X is not the centerpiece.
5. http://localhost:3000/architecture — contest poster. Optional: `/handbook` for the permission-diff mermaid.
6. Close on github.com/kishanraj41/hawkxai. Do not say the repo predates the contest — it does not. Contest opened 4 August 2026.

Do not submit until the `.run.app` URL is in the video. Blog + `#AllThingsAgenticHackathon` if time.

## Hosted URLs

- Desk (Cloud Run): https://hawkxai-qalms3xvxq-uc.a.run.app/footprint
- Desk (Vercel fallback): https://hawkxai.vercel.app/footprint
- Repo: https://github.com/kishanraj41/hawkxai
- Fleet: https://hawkxai-fleet-qalms3xvxq-uc.a.run.app
- ADK UI: https://hawkxai-fleet-qalms3xvxq-uc.a.run.app/dev-ui
- Snapshot store: `gs://hawkxai-fleet-snapshots/`

Set `FLEET_URL=https://hawkxai-fleet-qalms3xvxq-uc.a.run.app`
