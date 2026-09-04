# HawkxAI Agent Intelligence

Independent **attention** desk for engineering leaders choosing which agent or model to build on.

## Positioning

Do **not** compete on benchmarks. Lead with what is shifting **this week** — public discourse volume + rate of change across HN, Reddit, X, GitHub, and provider changelogs.

**Metric language:** always **attention**, never **adoption**.

## Layers

| Layer | Surfaces |
|-------|----------|
| Free | Live attention board, filters, RoC sort/filter, source-linked metrics |
| Paid (Pro demo unlock) | Compare, cost calculator (editable assumptions), trajectory alerts, weekly sourced read |

## Data path

1. **Seed fallback** — deterministic 14-day series + receipts so no view is empty.
2. **Live ingest** (`?live=true` / Live ingest button) — HN + Reddit search per agent, plus changelog/GitHub receipts.
3. **Score** — `attention = 0.35·volume_norm + 0.65·RoC_norm` (`lib/ai-agents-attention.ts`).
4. **Trace** — every number links to `AttentionSourceRecord` via `/api/ai-agents/sources`.

## APIs

- `GET /api/ai-agents` — board payload (`sort`, `minRoc`, `layer=free|paid`, `live=true`)
- `GET /api/ai-agents/compare?ids=a,b`
- `GET /api/ai-agents/sources?agentId=`
- `GET /api/ai-agents/weekly`
- `GET /api/ai-agents/alerts`

## Routes (this branch only)

| Path | Mode |
|------|------|
| `/` | Free trends |
| `/watchlist` | Compare (paid) |
| `/footprint` | Calculator (paid) |
| `/insights` | Weekly read (paid) |
| `/research` | Alerts (paid) |

Main branch remains the general trends desk — this branch stays separate.
