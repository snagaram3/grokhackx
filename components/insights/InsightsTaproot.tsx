"use client";

import type { RootLayer, RootTrace } from "@/lib/insights-types";

const KIND_MARK: Record<RootLayer["kind"], string> = {
  plug: "PLUG",
  sense: "SENSES",
  tape: "TAPE",
  origin: "ORIGIN",
  parent: "FAMILY",
  "first-record": "ROOT",
  lag: "GAP",
};

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(t));
}

function LayerRow({ layer, deepest }: { layer: RootLayer; deepest: boolean }) {
  const when = formatWhen(layer.receipt?.at);
  return (
    <li className={`taproot__layer taproot__layer--${layer.kind}${deepest ? " taproot__layer--deep" : ""}`}>
      <div className="taproot__spine" aria-hidden>
        <span className="taproot__knot" />
      </div>
      <div className="taproot__card">
        <p className="taproot__kind">{KIND_MARK[layer.kind]}</p>
        <p className="taproot__label">{layer.label}</p>
        <p className="taproot__detail">{layer.detail}</p>
        {layer.receipt ? (
          <a
            href={layer.receipt.url}
            target="_blank"
            rel="noreferrer"
            className="taproot__cite"
          >
            {layer.receipt.source}
            {when ? ` · ${when}` : ""}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function SenseRail({
  senses,
  selectedId,
  onSelect,
}: {
  senses: RootTrace["senses"];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (senses.length < 2) return null;
  return (
    <div className="taproot__senses">
      {senses.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={s.id === selectedId ? "taproot__sense taproot__sense--on" : "taproot__sense"}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function InsightsTaproot({
  trace,
  loading,
  queryLabel,
  onSelectSense,
}: {
  trace: RootTrace | null;
  loading: boolean;
  queryLabel: string;
  onSelectSense?: (id: string) => void;
}) {
  if (loading && !trace) {
    return (
      <div className="taproot taproot--wait">
        <p className="signal-label">Tracing {queryLabel || "…"} to its root…</p>
      </div>
    );
  }

  if (!trace) return null;

  const last = trace.layers[trace.layers.length - 1];

  return (
    <section className="taproot" aria-label="Root trace">
      <header className="taproot__head">
        <div>
          <p className="empty-stage__eyebrow">Taproot</p>
          <h1 className="taproot__title">{trace.query}</h1>
        </div>
        <p className="signal-label">
          {trace.thin ? "Thin — no origin page or dated record yet" : `${trace.layers.length} strata · receipts only`}
        </p>
      </header>
      {onSelectSense ? (
        <SenseRail senses={trace.senses} selectedId={trace.senseId} onSelect={onSelectSense} />
      ) : null}
      <ol className="taproot__well">
        {trace.layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            deepest={layer.id === last?.id && (layer.kind === "first-record" || layer.kind === "lag")}
          />
        ))}
      </ol>
      {trace.degraded.length ? (
        <ul className="taproot__degraded">
          {trace.degraded.map((msg) => (
            <li key={msg} className="signal-label">
              {msg}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
