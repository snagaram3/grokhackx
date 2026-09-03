"use client";

import type { ExamplePoiCompare as Compare, ExamplePoiHop, ExamplePoiIndustryCall, ExamplePoiPair } from "@/lib/types";

interface ExamplePoiCompareProps {
  compare: Compare | null;
  onPairHover?: (hop: ExamplePoiHop | null) => void;
}

function IndustryCard({ call }: { call: ExamplePoiIndustryCall }) {
  const unmet = call.constraints.filter((c) => !c.met);
  return (
    <article className="example-poi__industry">
      <header className="example-poi__industry-head">
        <p className="empty-stage__eyebrow">{call.category}</p>
        <p className="example-poi__outlook">{call.thin ? "thin" : call.outlook}</p>
      </header>
      <p className="example-poi__headline">{call.prediction.headline}</p>
      <p className="example-poi__action">{call.prediction.nextAction}</p>
      <p className="example-poi__analysis">{call.analysis}</p>
      {call.window.length > 1 ? (
        <p className="example-poi__window">hours {call.window.join("→")}</p>
      ) : null}
      <dl className="example-poi__vars">
        {call.variables.slice(0, 4).map((v) => (
          <div key={v.id}>
            <dt>{v.name}</dt>
            <dd>{String(v.value)}</dd>
          </div>
        ))}
      </dl>
      {unmet.length > 0 ? (
        <p className="example-poi__gap">
          Unmet: {unmet.map((c) => `${c.name} (${c.current}/${c.threshold})`).join(" · ")}
        </p>
      ) : (
        <p className="example-poi__gap">Constraints met on this tape</p>
      )}
    </article>
  );
}

function hopOf(pair: ExamplePoiPair): ExamplePoiHop {
  return { examplePinId: pair.examplePinId, livePinId: pair.livePinId };
}

export default function ExamplePoiCompare({ compare, onPairHover }: ExamplePoiCompareProps) {
  if (!compare) return null;
  const sha = compare.datasetSha ? compare.datasetSha.slice(0, 7) : "sample";
  const refresh = compare.liveRefresh === "hub" ? "hub" : "sample";
  return (
    <section className="example-poi" aria-label="Example POI compare">
      <header className="example-poi__head">
        <div>
          <p className="empty-stage__eyebrow">Example POI</p>
          <p className="example-poi__lead">Hugging Face places vs live public tape</p>
        </div>
        <p className="signal-label">
          {compare.exampleCount} HF · {compare.locatedCount} live · {compare.pairCount} pairs · {compare.dataset} · {refresh} · {sha}
        </p>
      </header>
      <p className="example-poi__analysis example-poi__analysis--lead">{compare.analysis}</p>
      {compare.industries.length > 0 ? (
        <div className="example-poi__grid">
          {compare.industries.slice(0, 4).map((call) => (
            <IndustryCard key={call.category} call={call} />
          ))}
        </div>
      ) : null}
      {compare.pairs.length > 0 ? (
        <table className="example-poi__table">
          <caption className="sr-only">Nearest live receipt to each example POI</caption>
          <thead>
            <tr>
              <th>Example POI</th>
              <th>Industry</th>
              <th>Live tape</th>
              <th>km</th>
            </tr>
          </thead>
          <tbody>
            {compare.pairs.slice(0, 8).map((pair) => (
              <tr
                key={`${pair.poiId}:${pair.liveUrl}`}
                tabIndex={0}
                onPointerEnter={() => onPairHover?.(hopOf(pair))}
                onPointerLeave={() => onPairHover?.(null)}
                onFocus={() => onPairHover?.(hopOf(pair))}
                onBlur={() => onPairHover?.(null)}
              >
                <td>
                  {pair.poiName}
                  {pair.poiCity ? <span className="example-poi__city"> · {pair.poiCity}</span> : null}
                </td>
                <td>{pair.industry}</td>
                <td>
                  <a href={pair.liveUrl} target="_blank" rel="noreferrer">
                    {pair.liveSource}
                  </a>
                </td>
                <td>{pair.km}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
