/** Mermaid sources for the live HawkxAI runtime. Keep in sync with docs/ARCHITECTURE.md. */

export const DEPLOY_GRAPH = `flowchart LR
  gh["GitHub<br/>snagaram3/grokhackx"]
  vercel["Vercel hawkxai.vercel.app<br/>Cloud Run hawkxai also live"]
  fn["Next.js 14 functions<br/>region iad1"]
  env["Env: GOOGLE_API_KEY<br/>FLEET_URL<br/>YOUTUBE_API_KEY<br/>TREND_DB_*"]
  sql["Cloud SQL Postgres 16<br/>hawkxai-trends · us-east4<br/>35.245.139.208:5432 TLS"]
  dbs["10 databases<br/>hawkxai_all + 9 plugs"]

  gh -->|push / redeploy| vercel
  vercel --> fn
  env --> fn
  fn -->|"pg + TREND_DB_SSL=1"| sql
  sql --> dbs
`;

export const REQUEST_GRAPH = `sequenceDiagram
  participant Desk as Desk browser
  participant Trends as GET /api/trends
  participant Booster as GET /api/booster
  participant Collect as collectAndForecast
  participant SQL as Cloud SQL

  Desk->>Trends: ingest tape (Grok cluster + public APIs)
  Trends-->>Desk: topics (never invent a WHY)
  Desk->>Booster: hydrate after local boost
  Booster->>Collect: collect, then predict
  Collect->>SQL: write snapshot into hawkxai_all and category DB
  Collect->>SQL: read last snapshots from hawkxai_all
  Collect->>SQL: write leaf predictions
  Booster-->>Desk: analysis + next-window on each leaf
`;

export const STORE_GRAPH = `flowchart TB
  cfg{"TREND_DB_HOST set?"}
  mem["memory store<br/>warm instance only"]
  pg["postgres store<br/>pg Pool per database"]
  cfg -->|no| mem
  cfg -->|yes| pg
  pg --> all[(hawkxai_all)]
  pg --> markets[(hawkxai_markets)]
  pg --> news[(hawkxai_news)]
  pg --> weather[(hawkxai_weather)]
  pg --> tech[(hawkxai_tech)]
  pg --> sports[(hawkxai_sports)]
  pg --> health[(hawkxai_health)]
  pg --> security[(hawkxai_security)]
  pg --> campaigns[(hawkxai_campaigns)]
  pg --> culture[(hawkxai_culture)]
`;

export const SCHEMA_GRAPH = `flowchart LR
  snap[snapshots]
  words[words]
  sent[sentiments]
  arts[artifacts]
  rec[receipts]
  pred[predictions]
  snap --> words
  snap --> sent
  snap --> arts
  snap --> rec
  snap --> pred
`;

export const ENV_GRAPH = `flowchart TB
  local["Laptop .env.local<br/>gitignored"]
  vercel["Vercel env<br/>Production + Preview sensitive<br/>Development not sensitive"]
  sql["Cloud SQL postgres user"]
  local -->|"npm run dev"| sql
  vercel -->|"iad1 functions"| sql
  note["Do not vercel env pull over .env.local"]
`;

export const FLEET_GRAPH = `flowchart LR
  marketer[Marketer] --> phrase["Phrase plug"]
  phrase --> footprint["Cloud Run desk /footprint"]
  footprint -->|"POST /api/fleet"| deskApi["Next.js POST /api/fleet"]
  trendsTab["GET /api/trends tape"] -.-> deskCollectors["Desk collectors"]
  deskApi --> cloudRun["Cloud Run hawkxai-fleet"]
  cloudRun --> adk["ADK hawkxai_ingest<br/>Gemini 3.5 Flash"]
  adk --> hnTool["collect_hn<br/>HN Algolia"]
  adk --> apiTool["collect_public_apis<br/>Wiki News NHTSA"]
  adk --> scoreTool["score_and_dedup<br/>Gemini ranks existing"]
  hnTool --> gcs["GCS snapshots"]
  apiTool --> gcs
  scoreTool --> gcs
  gcs --> deskApi
  deskApi --> footprint
  gcs --> lineage["tool + collectedAt"]
  lineage --> footprint
`;

export const ML_GRAPH = `flowchart TB
  receipts[Receipt windows + gold inspect tags] --> features[last-4 counts · occupancy · host · QR]
  features --> histgb["HistGB next-window and occupancy"]
  histgb -->|n transitions under 16| stumps[L2 ratio stumps]
  histgb -->|gold tags under 20| l1[L1 official-host class]
  histgb --> outlook[rising / peaking / fading]
  stumps --> outlook
  l1 --> organic[organic vs occupied]
  note["Labels are the next actual count or an inspect tag. Never an invented WHY."]
`;

export const LINEAGE_GRAPH = `flowchart LR
  collect[Collector tool] --> stamp["Post.tool + collectedAt"]
  stamp --> strip[Footprint / Research lineage strip]
  stamp --> save[Save .md lineage table]
  stamp --> handbook["Generated handbook"]
`;

export const ARCHITECTURE_SECTIONS = [
  {
    id: "deploy",
    title: "Deploy path",
    caption: "GitHub snagaram3/grokhackx is the source. Vercel hawkxai.vercel.app is production; Cloud Run hawkxai is also live. Functions reach Cloud SQL over TLS on the public IP.",
    chart: DEPLOY_GRAPH,
  },
  {
    id: "request",
    title: "Collect then predict",
    caption: "/api/trends stays the tape. Booster is additive. History is read from hawkxai_all before a leaf call. Thin evidence stays thin.",
    chart: REQUEST_GRAPH,
  },
  {
    id: "store",
    title: "Ten databases on one instance",
    caption: "One Cloud SQL instance, ten Postgres databases named after the desk plugs. Unset TREND_DB_HOST keeps collection in memory.",
    chart: STORE_GRAPH,
  },
  {
    id: "schema",
    title: "Same schema in each database",
    caption: "Applied by npm run provision:trend-db from sql/trend-category.sql. Predictions are written after collect.",
    chart: SCHEMA_GRAPH,
  },
  {
    id: "env",
    title: "Env contract",
    caption: "Same TREND_DB_* keys locally and on Vercel. Password is sensitive on Production and Preview. vercel env pull replaces .env.local — do not run it over this file.",
    chart: ENV_GRAPH,
  },
  {
    id: "fleet",
    title: "Ingest fleet",
    caption: "Footprint POSTs a phrase to Cloud Run hawkxai-fleet. ADK hawkxai_ingest (Gemini 3.5 Flash) fans out HN and public APIs, scores existing titles, writes GCS. GET /api/trends is untouched. Each receipt keeps tool + collectedAt.",
    chart: FLEET_GRAPH,
  },
  {
    id: "ml",
    title: "HistGB next-window",
    caption: "Fitted on receipt window transitions and gold occupier tags. Under 16 transitions the desk keeps L2 stumps. Under 20 gold tags occupancy stays host-class L1. Thin stays thin.",
    chart: ML_GRAPH,
  },
  {
    id: "lineage",
    title: "AutoLineage",
    caption: "RudriQ extracts receipts. AutoLineage records which collect step produced each one (tool + collectedAt). Snapshots persist those fields on Cloud SQL receipts. Visible on the desk and in the generated handbook.",
    chart: LINEAGE_GRAPH,
  },
] as const;
