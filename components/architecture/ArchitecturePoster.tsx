/** One-page contest architecture. Facts from fleet/, Cloud Run URLs, and /api/trends. */

const FLOW = [
  { n: "01", t: "Plug a phrase you own" },
  { n: "02", t: "POST /api/fleet" },
  { n: "03", t: "ADK Runner.run_async" },
  { n: "04", t: "Collect, then score" },
  { n: "05", t: "GCS snapshot JSON" },
  { n: "06", t: "Merge into Footprint" },
] as const;

export function ArchitecturePoster() {
  return (
    <article className="arch-board" aria-label="HawkxAI ingest architecture">
      <div className="arch-board__wash" aria-hidden />
      <div className="arch-board__grid" aria-hidden />
      <div className="arch-board__inner">
        <header className="arch-board__top">
          <div>
            <h2 className="arch-board__title">HawkxAI ingest architecture</h2>
            <p className="arch-board__lede">
              A marketer plugs a campaign phrase. Google ADK on Cloud Run collects live
              receipts with Gemini 3.5 Flash, writes a snapshot, and the desk maps the
              footprint. Receipts only — never an invented WHY. X is not in the toolset.
            </p>
          </div>
          <div className="arch-board__triad" aria-label="Mandatory contest stack">
            <span className="arch-chip arch-chip--live">
              <span className="arch-chip__k">Model</span>
              <span className="arch-chip__v">Gemini 3.5 Flash</span>
            </span>
            <span className="arch-chip arch-chip--live">
              <span className="arch-chip__k">Agent framework</span>
              <span className="arch-chip__v">Google ADK</span>
            </span>
            <span className="arch-chip arch-chip--live">
              <span className="arch-chip__k">Runtime</span>
              <span className="arch-chip__v">Cloud Run × 2</span>
            </span>
            <span className="arch-chip">
              <span className="arch-chip__k">Snapshots</span>
              <span className="arch-chip__v">Cloud Storage</span>
            </span>
          </div>
        </header>

        <ol className="arch-flow">
          {FLOW.map((step) => (
            <li key={step.n} className="arch-flow__step">
              <span className="arch-flow__n">{step.n}</span>
              <span className="arch-flow__t">{step.t}</span>
            </li>
          ))}
        </ol>

        <div className="arch-lanes">
          <section className="arch-lane">
            <h3 className="arch-lane__name">Operator</h3>
            <p className="arch-lane__host">Phrase is the plug. Same modules fill.</p>
            <div className="arch-node arch-node--phrase">
              <span className="arch-node__name">Campaign phrase</span>
              <span className="arch-node__meta">product · hashtag · event · ticker</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">Desks</span>
              <ul className="arch-node__list">
                <li>/footprint — campaign war-room</li>
                <li>/ — trending tape</li>
                <li>/insights — origin taproot</li>
                <li>/research — cited topic brief</li>
              </ul>
            </div>
          </section>

          <section className="arch-lane">
            <h3 className="arch-lane__name">Desk</h3>
            <p className="arch-lane__host">Cloud Run hawkxai · Next.js 14</p>
            <div className="arch-node">
              <span className="arch-node__name">POST /api/fleet</span>
              <span className="arch-node__meta">{`{ "phrase": "Camry" }`}</span>
            </div>
            <div className="arch-node arch-node--dash">
              <span className="arch-node__name">GET /api/trends</span>
              <span className="arch-node__meta">tape stays the tape · fleet never writes it</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">Merge + map</span>
              <span className="arch-node__meta">prints · artifacts · mind map · lineage strip</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">Vercel fallback</span>
              <span className="arch-node__meta">hawkxai.vercel.app until www cutover</span>
            </div>
          </section>

          <section className="arch-lane arch-lane--ingest">
            <h3 className="arch-lane__name">Ingest fleet</h3>
            <p className="arch-lane__host">Cloud Run hawkxai-fleet · /dev-ui</p>
            <div className="arch-node arch-node--phrase">
              <span className="arch-node__name">hawkxai_ingest</span>
              <span className="arch-node__meta">google.adk Agent · Runner.run_async</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">POST /v1/ingest</span>
              <span className="arch-node__meta">FastAPI + ADK web · FLEET_URL</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">Gemini 3.5 Flash</span>
              <span className="arch-node__meta">orchestrates tools · ranks existing titles</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">permissions.json</span>
              <span className="arch-node__meta">tool on/off · handbook diffs this file</span>
            </div>
          </section>

          <section className="arch-lane">
            <h3 className="arch-lane__name">Channels</h3>
            <p className="arch-lane__host">ADK tools, gated. Thin stays thin.</p>
            <div className="arch-node">
              <span className="arch-node__name">collect_hn</span>
              <span className="arch-node__meta">Hacker News Algolia</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">collect_public_apis</span>
              <span className="arch-node__meta">Wikipedia · Google News RSS · NHTSA</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">score_and_dedup</span>
              <span className="arch-node__meta">dedup URLs · Gemini ranks survivors</span>
            </div>
            <div className="arch-node arch-node--dash">
              <span className="arch-node__name">Google Trends RSS</span>
              <span className="arch-node__meta">desk tape when X is empty · never stamped as X</span>
            </div>
          </section>

          <section className="arch-lane arch-lane--store">
            <h3 className="arch-lane__name">Store + model</h3>
            <p className="arch-lane__host">us-east4 · receipts keep lineage</p>
            <div className="arch-node">
              <span className="arch-node__name">Cloud Storage</span>
              <span className="arch-node__meta">gs://hawkxai-fleet-snapshots/</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">Cloud SQL Postgres 16</span>
              <span className="arch-node__meta">hawkxai-trends · 10 category databases</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">AutoLineage</span>
              <span className="arch-node__meta">receipt.tool + collectedAt</span>
            </div>
            <div className="arch-node">
              <span className="arch-node__name">HistGB next-window</span>
              <span className="arch-node__meta">L2 stumps until 16 transitions · occupancy L1 until 20 gold tags</span>
            </div>
          </section>
        </div>

        <footer className="arch-legend">
          <span className="arch-key">
            <i aria-hidden />
            Contest-window ingest (ADK fleet)
          </span>
          <span className="arch-key arch-key--tape">
            <i aria-hidden />
            Pre-existing tape (GET /api/trends)
          </span>
          <span className="arch-key arch-key--store">
            <i aria-hidden />
            Persisted receipts
          </span>
          <p className="arch-board__rule">
            Shared mind-map bridges exist only when the same artifact prints on two names.
            Occupancy is host-class L1 until twenty gold inspect tags. Never invent a WHY.
          </p>
        </footer>
      </div>
    </article>
  );
}
