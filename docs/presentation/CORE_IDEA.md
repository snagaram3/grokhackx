# HawkxAI Core Idea

Capturing the current trend hashtags/ QRs/phrases/URLs etc and analyze them and co-relate them on why they are treanding and collect this information to create a cool interactive dashboard that gives us most useful information to all age groups and compititors in the bussiness that will leverage their campains.

**Additional desks:** look up a particular word or phrase. A marketing team opens **Footprint** (`/footprint`) and plugs a campaign name. **Insights** (`/insights`) traces that name to its origin page, family categories, and oldest dated receipt — a taproot, not a search ranking. A researcher opens **Research** (`/research`) and digs Wikipedia, the open web, HN, Reddit, and X for a topic brief with cited receipts. Trending words stay on `/`. Desks are additive.

## Plug-and-play desk

A **phrase is the plug**. Drop a campaign, product, hashtag, ticker, or event into the desk — the same modules fill from live evidence:

1. **Mind map** — hub is the looked-up phrase, branches are related prints plus captured artifacts / first print / top driver. Click a node to expand the branch and an inspector (receipts, shared artifacts, first print). Amber dashes are **shared artifacts only** (same hashtag, QR, URL, or ticker on two names). Never an invented bridge.
2. **Related prints** — ranked mentions, velocity, risk — still that phrase, not a global trend list.
3. **Sentiment correlation** — pos/neg/risk word hits in receipt titles, split by platform. Click to open source mix and linked receipts with tone words. Never a generated story. First print still marks the occurrence chart.
4. **Occurrence timeseries** — when receipts for this phrase actually landed (area by source, CT). First print is marked.
5. **Floor facts** — for the plugged campaign or product (Camry, #HeatWaveFit), kind + category + nearest receipts a sales team can quote. Empty search returns a close match, not “no trend yet.”
6. **Campaign brief** — hook, timing, risk, five age lenses. Copy / Save .md / Print PDF from live receipts only.
7. **Tape watch** — star a print; on refresh, show measured deltas (velocity, title lean, receipt count). Never explain the spike.
8. **Audience compose** — one lens select. Same receipts, different takeaway on desk, map hover, mind subtitle, and the exported brief.

The mind map is the operating surface (`G`). The desk (`D`) and map (`M`) are the other modules. `J/K` walks the tape. `⌘K` focuses lookup. After each ingest, trending words and title sentiment land in **10 category databases** (the nine plugs plus `all`). The next-window call on each leaf is measured from those collected snapshots — never an invented WHY.

Same modules compose into the topic rail when a print is selected. Swap the phrase; keep the UI.

## What this means in product terms

HawkxAI is a live circle-pack of what is trending, plus an optional phrase war-room. The **Booster Agent** is the intelligence layer that:

1. **Looks up** a word or phrase a team already owns — campaign name, hashtag, product, ticker, event.
2. **Captures** live artifacts around that phrase — hashtags, QR / short-link campaign codes, co-occurring phrases, URLs, cashtags.
3. **Maps the footprint** across X, Reddit, HN, and public APIs: where it printed, how hot, how split.
4. **Correlates** *why* those receipts exist (evidence only — never invent a WHY). Sentiment is counted from titles, not narrated. Shared artifacts become mind-map bridges.
5. **Plugs** the same signal into the desk — mind map, related prints, causation bars, occurrence timeseries.
6. **Translates** the same signal for every age group: kids, Gen Z, millennials, Gen X, boomers.
7. **Arms competitors** with campaign moves: hook, timing, risk, and how to ride the need without copying the meme.
8. **Improvises** after every run — ranked upgrades that make the dashboard more useful.

The map stays the map. Booster sits beside it: capture trending words **or** lookup a phrase (new tab) → correlate → mind map of receipts → campaign → improvise.

## Non-negotiables

- Never invent posts or a fake WHY. If receipts are thin, sentiment says so and lowers confidence.
- `/api/trends` remains the trending-word path. `/api/trends?topic=` and `/footprint` are the phrase-footprint path. `/api/research` and `/research` are the topic-research path. Additive fields only.
- A plugged query with no exact print returns nearest receipts and neighbors from the last tape — never “no trend yet,” and never invented posts.
- Mind-map hub is the looked-up phrase. Bridges exist only when the same artifact key prints on two topics. Empty bridges stay empty.
- If a source is degraded, say so — still boost the sources that worked.
- Kids lens must prefer safety and plain language over slang.
- Campaign advice must include risk, not just opportunity.
- No pie charts. Time-series is area. Causation is horizontal bars.

## Surfaces

| Surface | Owner |
|---|---|
| Phrase lookup | `components/desk/PhraseLookup.tsx` + header `⌘K` |
| Insights taproot | `components/insights/` + `GET /api/insights?q=` + `lib/insights-roots.ts` |
| Research desk | `components/research/ResearchDesk.tsx` + `GET /api/research?q=` + `lib/research-brief.ts` |
| Correlation mind map | `components/MindDesk.tsx` + `lib/mindmap.ts` |
| Category collect + leaf prediction | `lib/collect.ts` · `lib/predict.ts` · `lib/trend-store.ts` · `GET /api/collect` |
| Category filters + desk | `components/desk/` + `components/ChartDesk.tsx` |
| Occurrence + sentiment | `lib/desk.ts` · `lib/sentiment.ts` (live) · `agents/booster-agent/` (CLI) |
| Live map | `components/TrendMap.tsx` |
| Topic receipts | `components/TopicDetailPanel.tsx` |
| Booster briefing | `components/BoosterInsights.tsx` + `components/brief/KeepBrief.tsx` |
| Tape watch | `lib/watch.ts` + `components/TapeWatch.tsx` |
| Live boost API | `GET /api/booster` |
| Offline / CLI brain | `agents/booster-agent/` |
| Living upgrade backlog | `agents/booster-agent/IMPROVISATIONS.md` |

## Next-wave improvisations (always keep adding)

The Booster Agent re-ranks these from real gaps in each run. Seed list:

1. TikTok / YouTube Shorts / Instagram ingest — **partial:** Bluesky what's-hot is live; official YouTube Data v3 runs when `YOUTUBE_API_KEY` is set. TikTok still needs a brand OAuth grant (no unofficial scraper).
2. QR *image* decode (scan attached media, not just QR-shaped URLs).
3. Persist hourly snapshots so occurrence charts cover more than one ingest.
4. Overlay GDELT / NWS events as lagged markers on the same timeseries (never as an invented WHY).
5. Age-group toggle on the map itself — **shipped:** header lens composes desk, map hover, mind subtitle, and the keepable brief.
6. Brand-risk radar (controversy vs ride-along).
7. Geo / city pulse — **shipped:** default tape is worldwide. Place filter zooms a metro. The mind desk now plots a live world under the correlation graph — only receipts that already carry coordinates (USGS, Open-Meteo, EONET, NWS points).
8. Export a one-page campaign brief for a competitor — **shipped:** Copy / Save .md / Print from receipts. Tape-watch stars persist to Cloud SQL (`tape_watch`) when `TREND_DB_*` is set; localStorage is the offline fallback.
9. Shared-artifact bridges on the mind map — keep capturing overlapping campaign codes; never invent a dash.
10. Shareable footprint URL (`/footprint?q=`) — **shipped:** Footprint opens from the trend desk; trending words stay on `/`.
11. Research desk for topic digs (`/research?q=`) — **shipped:** Wikipedia + web + PubMed + arXiv + USPTO + HN + Reddit + X + optional Gemini + Google Search pass; Copy / Save .md / Print; off-query receipts dropped; senses from Wikipedia titles; angles filled from dated receipts. Click an open question to dig that angle.
12. Collect trending words + sentiment into 10 category databases, then predict on each mind-map leaf — **shipped:** memory/JSON now; Postgres `hawkxai_{category}` once `TREND_DB_*` is set.
13. RudriQ / AutoLineage on receipts — **shipped thin:** `tool` + `collectedAt` on each receipt, lineage strip on Footprint and Research, lineage table inside Save .md. Not a second product page.
14. Watchlist desk (`/watchlist`) — **shipped:** persist POIs, Public × POI overlap, organic vs occupancy, last-window Δ. Next-window is HistGB on receipt transitions when ≥16 exist; L2 stumps otherwise. Occupancy HistGB waits for ≥20 gold inspect tags.
15. Generated handbook (`/handbook`, `GET /api/handbook`, `python -m handbook.render`) — **shipped:** architecture mermaid, permission table, HistGB model card, AutoLineage. Flip `fleet/permissions.json` and refresh.
