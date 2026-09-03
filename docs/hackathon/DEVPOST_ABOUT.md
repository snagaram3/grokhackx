## Inspiration

Trend dashboards answer a question nobody on a campaign team is asking. They show what is loud *globally*. The question after a launch is smaller and meaner: **where did *our* phrase print, on which platforms, and what can we quote without making a story up?**

We kept seeing the same failure mode. A CMO googles the tag. A junior pastes titles into a chatbot. The chatbot writes a cause. By then the footprint has already moved. Enterprise listening suites can answer this if you have a six-week onboarding and a five-figure contract. We wanted the job as a **plug**: drop `Camry`, get receipts, get a mind map whose lines exist only when two names share a real artifact — the same hashtag, URL, QR-shaped code, or ticker. No invented bridge.

The All Things Agentic contest gave us the right constraint. The product is the desk. The **new work** is an ADK ingest fleet on Cloud Run that does the chore — collect, score, store — while Gemini 3.5 Flash clusters related names. Correlation and divergence stay in code. The model is not allowed to narrate a recap.

## What it does

HawkxAI is a **campaign footprint desk**. A marketer plugs a phrase they already own — a product, a hashtag, a campaign name. An agent fleet collects live receipts and fills one desk: where it printed, which artifacts co-occurred, and how split the heat is across communities. We never invent a WHY. If the tape is thin, the map stays thin.

**Live:** [Footprint on Cloud Run](https://hawkxai-qalms3xvxq-uc.a.run.app/footprint) · **Repo:** [github.com/kishanraj41/hawkxai](https://github.com/kishanraj41/hawkxai)

- **Footprint** — plug a name. Mind map, prints, artifacts, occurrence. Amber dashes only for shared artifacts.
- **Watch** — track POIs you own. Public $\times$ POI overlap. Star a print; later refresh shows measured deltas, not a generated spike story.
- **Insights** — taproot: origin page, family, oldest dated receipt.
- **Research** — cited brief from the same tape (Wikipedia, web, HN, Reddit, optional Gemini pass).
- **Comparison** — overlay a second name (`?vs=`): this year’s campaign vs last year’s, or a rival, on the same receipts. Never an invented shared WHY.
- **User labels for ML** — phrases they plug, stars, overlays, and Official / Occupied / Ignore tags are the training set. We do not scrape a private account graph.

Divergence $D$ is calculated in code. Let $k$ be platforms with score $> 20$ and $P$ the platform count:

$$
D = 1 - \frac{k}{P}.
$$

$D = 0$ is everywhere we can see. $D \to 1$ is a single-platform bubble.

## How we built it

Two Cloud Run services, one job.

1. **Desk (Next.js).** Footprint is the opening surface. Insights and Research read the same tape. Trends stays `GET /api/trends` so a fleet merge cannot poison the global list.
2. **Ingest fleet (Python + Google ADK).** `POST /api/fleet` fans out to Hacker News (Algolia), Wikipedia, Google News RSS, and NHTSA. Gemini scores and dedups **existing** titles. Snapshots land in GCS (`gs://hawkxai-fleet-snapshots/`). Each receipt keeps lineage: `tool` + `collectedAt`. X is not the centerpiece and is not in the fleet toolset.

```text
marketer → /footprint → POST /api/fleet → Cloud Run ADK (Gemini 3.5)
        → HN + public APIs → score/dedup → GCS snapshot → desk merge
```

**Velocity is a ratio**, not a generated adjective. If $s_t$ is the current total score and $s_{t-1}$ the previous snapshot:

$$
\text{outlook} =
\begin{cases}
\text{rising}  & s_t > 1.08\, s_{t-1} \\
\text{fading}  & s_t < 0.92\, s_{t-1} \\
\text{peaking} & \text{otherwise.}
\end{cases}
$$

The same thresholds label the **next-window** call on collected counts. When we have enough *user-backed* history we fit a small histogram gradient-boosting model (24 rounds, learning rate $0.25$, 16 bins) on a last-4 window vector. Softmax over class scores $z$:

$$
\hat{p}_i = \frac{e^{z_i - \max z}}{\sum_j e^{z_j - \max z}}.
$$

Let $G$ be gold inspect tags and $T$ be next-window transitions from snapshots they caused:

$$
\text{occupancy} =
\begin{cases}
\text{HistGB} & G \ge 20 \\
\text{L1 official-host} & \text{otherwise}
\end{cases}
\qquad
\text{next-window} =
\begin{cases}
\text{HistGB} & T \ge 16 \\
\text{L2 ratio stumps} & \text{otherwise.}
\end{cases}
$$

Fitted models persist on Cloud SQL (`poi_models`) when `TREND_DB_*` is set. Confidence on a booster brief is clamped to evidence $e$ (receipts + artifacts):

$$
c = \mathrm{clip}_{[0.25,\,0.92]}\bigl(0.35 + 0.06\,e + 0.1\cdot\mathbf{1}_{s>80}\bigr).
$$

Zero posts $\Rightarrow$ we refuse a why. Thin user data $\Rightarrow$ we keep the stump.

The handbook at `/handbook` is generated from `fleet/` files and `permissions.json` — the architecture diagram the submission needs, not a slide we drew by hand.

HawkxAI was created during the Submission Period (contest opened 4 August 2026). Standard tools: Next.js, Google ADK, Gemini 3.5 Flash, Cloud Run, Cloud Storage, Cloud SQL. There is no separate pre-contest HawkxAI codebase to disclose.

## Challenges we ran into

**Time and the day job.** We cut in public: one HN channel first, then public APIs, then scoring, then the handbook. If something slipped we cut X, cut pretty, never cut the live plug, never cut Cloud Run proof, never invented a WHY.

**Gemini vs the chore.** Clustering related names from titles is a model job. Divergence, velocity, mind-map bridges, and lineage are not. The hard part was the boundary: Gemini classifies and dedups; code owns the numbers.

**Serverless clocks.** Vercel Hobby caps functions at 60s. Agent ingest wants longer. We split the world: the desk stays Next.js; the fleet is Cloud Run so ADK can actually finish.

**“Hourly” vs the cron we could afford.** Collect is a snapshot writer. The Vercel cron we shipped is once daily (`0 12 * * *`). HistGB will not look smart until those snapshots — and the user tags on them — accumulate.

**Cold start on user labels.** Occupancy needs twenty gold inspect tags. Until a human marks Official / Occupied / Ignore, we refuse a fitted occupancy model. The Watch owner is still `demo` until auth exists. The loop is designed so each user’s phrases and tags become *their* comparison set and *our* training floor, not a silent scrape.

**Honesty under a four-minute video.** Judges need a `.run.app` address bar, a live Camry plug, and `/dev-ui` moving. We cannot fill Camry with invented posts if HN is quiet.

## Accomplishments that we're proud of

- A **live Cloud Run plug**: open `/footprint`, type Camry, watch the ADK fleet in `/dev-ui`, see the desk fill from receipts.
- **Evidence-only correlation.** Mind-map bridges exist only when the same artifact key prints on two names. Empty stays empty.
- **Lineage on every receipt** (`tool` + `collectedAt`) so a brief that leaves the room can still be audited.
- **HistGB with floors**, not a vibe model. We would rather show an L2 stump than a fake forecast.
- **Comparison as a first-class job** (`?vs=`, Watch POIs) — two owned names, one tape.
- A **generated handbook** that diffs fleet permissions. Agents that cannot explain themselves are not shippable.
- **QR payload decode** from image URLs (jsQR), not only QR-shaped links.
- Degrading in public: Reddit 403, X off — we still ship HN + public APIs and say so.

## What we learned

**Agents are a choreography, not a chat.** The useful unit is “collect this phrase, stamp lineage, write a snapshot the desk already knows how to render.” If the model writes the WHY, you have a hallucination with a URL bar.

**Evidence-only is a product decision.** A fully connected graph looks better in a demo. It is not defensible in a sales room.

**User data is the training set, not a side channel.** The phrases they own, the stars, the overlay, and the inspect tags are what let occupancy and next-window leave the stump. No gold tags, no occupancy model.

**Platforms lie about being “live.”** Official firehoses are a budget. Demo on what actually returned.

**Persistence is the difference between a screenshot and a footprint.** Without time — and without the labels users leave on the desk — $D$ and outlook are a single frame.

**One plug, many desks, one tape.** Footprint, Insights, and Research are different jobs on the same receipts. The mistake is treating each desk as a new product.

## What's next for HawkxAI

- **Gold labels.** Tag Camry occupiers Official / Occupied / Ignore until occupancy HistGB leaves host-class L1 ($G \ge 20$).
- **Auth and consent.** Split Watch off owner `demo`. One line on inspect: tags fit next-window and occupancy when floors are met. Do not train on a phrase they did not plug or tag.
- **Real time.** Wire `TREND_DB_*` on the Cloud Run desk so snapshots survive. Move collect from daily cron to hourly when the store is live.
- **Channels campaigns actually live on.** Official YouTube Data v3 when the key is set; TikTok / Reels only with a brand OAuth grant — no unofficial scraper. X stays optional, never the centerpiece.
- **Keep the wedge.** Paste a campaign name. Get receipts, comparison, and a brief you can quote. Charge later. Never invent a WHY.
