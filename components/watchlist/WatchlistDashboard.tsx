"use client";

import Sparkline from "@/components/Sparkline";
import { GhostButton } from "@/components/shell/DeskChrome";
import {
  deltaLabel,
  pct,
  rollupWatchlist,
  type WatchlistRollup,
  type WatchSort,
} from "@/lib/watchlist-metrics";
import type { PoiInsight } from "@/lib/types";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="watch-metrics__cell">
      <dt className="signal-label">{label}</dt>
      <dd key={value} className="watch-metrics__value" title={hint}>
        {value}
      </dd>
    </div>
  );
}

export function WatchlistMetrics({
  rollup,
  loading,
}: {
  rollup: WatchlistRollup;
  loading: boolean;
}) {
  const organic =
    rollup.organicMean == null ? "—" : pct(rollup.organicMean);
  const occupancy =
    rollup.occupancyMean == null ? "—" : pct(rollup.occupancyMean);
  return (
    <section className="watch-metrics" aria-label="Watchlist metrics">
      <dl className="watch-metrics__row">
        <Metric label="Watched" value={loading ? "…" : String(rollup.watched)} />
        <Metric label="Receipts" value={loading ? "…" : String(rollup.receipts)} />
        <Metric
          label="Thin"
          value={loading ? "…" : String(rollup.thin)}
          hint="Fewer than 4 overlap receipts"
        />
        <Metric
          label="Occupied"
          value={loading ? "…" : String(rollup.occupied)}
          hint="Occupancy at least 50% among scored names"
        />
        <Metric label="Organic" value={loading ? "…" : organic} hint="Mean official share, scored only" />
        <Metric
          label="Occupancy"
          value={loading ? "…" : occupancy}
          hint="Mean other-printers share, scored only"
        />
        <Metric label="Rising" value={loading ? "…" : String(rollup.rising)} />
        <Metric label="Fading" value={loading ? "…" : String(rollup.fading)} />
      </dl>
      {rollup.lead ? (
        <p className="watch-metrics__lead">
          First this morning: {rollup.lead.entity.label}
          {rollup.lead.thin ? " · thin" : ` · ${rollup.lead.outlook} · occupied ${pct(rollup.lead.occupancy)}`}
        </p>
      ) : null}
    </section>
  );
}

function seriesPath(values: number[], width: number, height: number, min: number, max: number) {
  const span = max - min || 1;
  const step = values.length <= 1 ? width : width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - 6 - ((v - min) / span) * (height - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${pts.join(" L")}`;
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

function OverlayArea({
  primary,
  compare,
}: {
  primary: { label: string; values: number[] };
  compare?: { label: string; values: number[] } | null;
}) {
  const width = 320;
  const height = 72;
  const all = [...primary.values, ...(compare?.values ?? [])];
  if (primary.values.length < 2 && (!compare || compare.values.length < 2)) {
    return (
      <div className="watch-area">
        <p className="signal-label">{primary.label}{compare ? ` vs ${compare.label}` : ""}</p>
        <p className="mt-2 text-[12px] text-white/45">Need two snapshots before a window chart.</p>
      </div>
    );
  }
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const a = primary.values.length >= 2 ? seriesPath(primary.values, width, height, min, max) : null;
  const b = compare && compare.values.length >= 2 ? seriesPath(compare.values, width, height, min, max) : null;
  return (
    <div className="watch-area">
      <p className="signal-label">
        {primary.label}
        {compare ? ` vs ${compare.label}` : ` · last ${primary.values.length} windows`}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 h-[72px] w-full"
        role="img"
        aria-label={
          compare
            ? `${primary.label} ${primary.values.join(" to ")} versus ${compare.label} ${compare.values.join(" to ")}`
            : `${primary.label} overlap counts ${primary.values.join(" to ")}`
        }
      >
        {a ? (
          <>
            <path d={a.area} fill="var(--amber)" fillOpacity="0.16" />
            <path d={a.line} fill="none" stroke="var(--amber)" strokeWidth="1.5" />
          </>
        ) : null}
        {b ? (
          <>
            <path d={b.area} fill="var(--up)" fillOpacity="0.14" />
            <path d={b.line} fill="none" stroke="var(--up)" strokeWidth="1.5" />
          </>
        ) : null}
      </svg>
      <p className="mt-1 font-mono text-[10px] tabular-nums text-white/40">
        <span style={{ color: "var(--amber)" }}>{primary.label} {primary.values.join("→") || "—"}</span>
        {compare ? (
          <>
            {" · "}
            <span style={{ color: "var(--up)" }}>{compare.label} {compare.values.join("→") || "—"}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

export function WatchlistViz({
  insights,
  selectedId,
  compareId,
  sort,
  onSelect,
  onSort,
}: {
  insights: PoiInsight[];
  selectedId: string | null;
  compareId: string | null;
  sort: WatchSort;
  onSelect: (id: string) => void;
  onSort: (sort: WatchSort) => void;
}) {
  const rollup = rollupWatchlist(insights);
  const selected = insights.find((row) => row.entity.id === selectedId) ?? insights[0] ?? null;
  const compared = insights.find((row) => row.entity.id === compareId) ?? null;
  const mixN = rollup.officialReceipts + rollup.occupiedReceipts;
  const officialShare = mixN === 0 ? 0 : rollup.officialReceipts / mixN;
  const occupiedShare = mixN === 0 ? 0 : rollup.occupiedReceipts / mixN;
  const bars = insights.slice(0, 8);
  const barMetric = sort === "organic" ? "organic" : "occupancy";

  return (
    <section className="watch-viz" aria-label="Watchlist visuals">
      <div className="watch-viz__pane">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="signal-label">{barMetric === "organic" ? "Organic by name" : "Occupancy by name"}</p>
          <div className="flex gap-1">
            <button
              type="button"
              className={`watch-sort ${sort === "occupancy" ? "watch-sort--on" : ""}`}
              aria-pressed={sort === "occupancy"}
              onClick={() => onSort("occupancy")}
            >
              Occupied
            </button>
            <button
              type="button"
              className={`watch-sort ${sort === "organic" ? "watch-sort--on" : ""}`}
              aria-pressed={sort === "organic"}
              onClick={() => onSort("organic")}
            >
              Organic
            </button>
          </div>
        </div>
        <ul className="mt-2 space-y-1.5">
          {bars.map((row) => {
            const active = row.entity.id === selectedId;
            const share = row.thin ? 0 : barMetric === "organic" ? row.organic : row.occupancy;
            return (
              <li key={row.entity.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.entity.id)}
                  className={`watch-bar ${active ? "watch-bar--active" : ""}`}
                >
                  <span className="watch-bar__name">{row.entity.label}</span>
                  <span className="watch-bar__track" aria-hidden>
                    <span
                      className={`watch-bar__fill ${barMetric === "organic" ? "is-organic" : ""}`}
                      style={{ transform: `scaleX(${Math.max(share, 0.02)})` }}
                    />
                  </span>
                  <span className="watch-bar__n">{row.thin ? "thin" : pct(share)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="watch-viz__pane">
        <p className="signal-label">Tape mix · official vs occupied</p>
        <div
          className="watch-mix"
          role="img"
          aria-label={`${rollup.officialReceipts} official, ${rollup.occupiedReceipts} occupied`}
        >
          <span
            className="watch-mix__official"
            style={{ transform: `scaleX(${officialShare})` }}
          />
          <span
            className="watch-mix__occupied"
            style={{ transform: `scaleX(${occupiedShare})` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-white/45">
          <span>official {rollup.officialReceipts}</span>
          <span>occupied {rollup.occupiedReceipts}</span>
        </div>
        {selected ? (
          <OverlayArea
            primary={{ label: selected.entity.label, values: selected.window ?? [] }}
            compare={
              compared && compared.entity.id !== selected.entity.id
                ? { label: compared.entity.label, values: compared.window ?? [] }
                : null
            }
          />
        ) : null}
      </div>
    </section>
  );
}

export function WatchlistNames({
  insights,
  selectedId,
  compareId,
  onSelect,
  onCompare,
}: {
  insights: PoiInsight[];
  selectedId: string | null;
  compareId: string | null;
  onSelect: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  return (
    <aside className="signal-glass flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/8 px-3 py-2">
        <p className="text-[13px] font-medium tracking-tight">Names</p>
          <p className="mt-0.5 text-[11px] text-white/45">J/K to move. Click a name to load its trend. Shift-click to overlay.</p>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {insights.map((row) => {
          const active = row.entity.id === selectedId;
          const vs = row.entity.id === compareId;
          return (
            <li key={row.entity.id}>
              <button
                type="button"
                onClick={(e) => {
                  if (e.shiftKey) onCompare(row.entity.id);
                  else onSelect(row.entity.id);
                }}
                aria-current={active ? "true" : undefined}
                className={`watch-name ${active ? "watch-name--active" : ""} ${vs ? "watch-name--compare" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-left text-[13px]">{row.entity.label}</span>
                  <span className="watch-bar__track watch-bar__track--mini mt-1" aria-hidden>
                    <span
                      className="watch-bar__fill"
                      style={{ transform: `scaleX(${Math.max(row.thin ? 0 : row.occupancy, 0.02)})` }}
                    />
                  </span>
                </span>
                <span
                  className={`watch-delta shrink-0 ${row.delta > 0 ? "is-up" : row.delta < 0 ? "is-down" : ""}`}
                >
                  {deltaLabel(row.delta)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function SplitBar({ official, occupied }: { official: number; occupied: number }) {
  const n = official + occupied;
  if (n === 0) {
    return <div className="watch-split watch-split--empty" aria-hidden />;
  }
  return (
    <div
      className="watch-split"
      role="img"
      aria-label={`${official} official, ${occupied} occupied`}
    >
      <span className="watch-split__official" style={{ flexGrow: official }} />
      <span className="watch-split__occupied" style={{ flexGrow: occupied }} />
    </div>
  );
}

export function WatchlistTable({
  insights,
  selectedId,
  loading,
  sort,
  onSelect,
  onSort,
}: {
  insights: PoiInsight[];
  selectedId: string | null;
  loading: boolean;
  sort: WatchSort;
  onSelect: (id: string) => void;
  onSort: (sort: WatchSort) => void;
}) {
  function Head({ id, label, numeric = true }: { id: WatchSort; label: string; numeric?: boolean }) {
    const on = sort === id;
    return (
      <th scope="col" className={numeric ? "watch-table__num" : undefined}>
        <button
          type="button"
          className={`watch-th ${on ? "watch-th--on" : ""}`}
          aria-pressed={on}
          onClick={() => onSort(id)}
        >
          {label}
        </button>
      </th>
    );
  }

  return (
    <section className="signal-glass flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-white/8 px-3 py-2">
        <div>
          <h1 className="text-[13px] font-medium tracking-tight">Public × POI</h1>
          <p className="mt-0.5 text-[11px] text-white/45">
            Click a column to sort. Click a row to load trends. Enter opens Footprint.
          </p>
        </div>
        {loading ? (
          <span className="font-mono text-[11px] tabular-nums text-white/45">updating…</span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="watch-table">
          <thead>
            <tr>
              <Head id="rank" label="Name" numeric={false} />
              <th scope="col">Window</th>
              <Head id="outlook" label="Outlook" />
              <Head id="delta" label="Δ" />
              <Head id="organic" label="Organic" />
              <Head id="occupancy" label="Occupied" />
              <th scope="col">Mix</th>
              <Head id="receipts" label="Receipts" />
              <th scope="col" className="watch-table__num">
                Share
              </th>
              <th scope="col" className="watch-table__num">
                Snaps
              </th>
              <th scope="col" className="watch-table__num">
                Conf
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && insights.length === 0
              ? [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="watch-table__skel">
                    <td colSpan={11}>
                      <span className="watch-skel" />
                    </td>
                  </tr>
                ))
              : insights.map((row) => {
                  const active = row.entity.id === selectedId;
                  const outlook = row.thin ? "thin" : row.outlook;
                  return (
                    <tr
                      key={row.entity.id}
                      tabIndex={0}
                      aria-selected={active}
                      className={active ? "watch-table__row--active" : undefined}
                      onClick={() => onSelect(row.entity.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSelect(row.entity.id);
                      }}
                    >
                      <td>
                        <p className="truncate text-[13px] text-white/92">{row.entity.label}</p>
                        <p className="watch-table__aliases truncate">
                          {row.entity.aliases.join(" · ")}
                        </p>
                      </td>
                      <td>
                        <Sparkline values={row.window ?? []} fill />
                      </td>
                      <td className="watch-table__num">{outlook}</td>
                      <td
                        className={`watch-table__num watch-delta ${row.delta > 0 ? "is-up" : row.delta < 0 ? "is-down" : ""}`}
                      >
                        {deltaLabel(row.delta)}
                      </td>
                      <td className="watch-table__num">{row.thin ? "—" : pct(row.organic)}</td>
                      <td className="watch-table__num">{row.thin ? "—" : pct(row.occupancy)}</td>
                      <td>
                        <SplitBar official={row.officialCount} occupied={row.occupiedCount} />
                      </td>
                      <td className="watch-table__num">{row.receiptCount}</td>
                      <td className="watch-table__num">
                        {row.thin ? "—" : `${Math.round(row.baselineRatio * 1000) / 10}%`}
                      </td>
                      <td className="watch-table__num">{row.snapshotCount}</td>
                      <td className="watch-table__num">
                        {row.thin ? "—" : pct(row.confidence)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function WatchlistInspect({
  insight,
  compareActive,
  onOpen,
  onRemove,
  onCompare,
  onTag,
}: {
  insight: PoiInsight | null;
  compareActive: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onCompare: () => void;
  onTag: (url: string, tag: "official" | "occupied" | "ignore") => void;
}) {
  if (!insight) {
    return (
      <aside className="signal-glass flex min-h-0 flex-col p-4">
        <p className="text-[13px] font-medium tracking-tight">Inspect</p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/55">
          Select a name to see occupiers, official vs occupied mix, and the next-window call.
        </p>
      </aside>
    );
  }

  const e = insight.entity;
  return (
    <aside className="signal-glass flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/8 px-3 py-2">
        <p className="truncate text-[13px] font-medium tracking-tight">{e.label}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-white/40">
          {e.aliases.join(" · ")}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="text-[12px] leading-relaxed text-white/75">{insight.analysis}</p>
        <dl className="watch-inspect__facts">
          <div>
            <dt>Outlook</dt>
            <dd>{insight.thin ? "thin" : insight.outlook}</dd>
          </div>
          <div>
            <dt>Δ last window</dt>
            <dd className={`watch-delta ${insight.delta > 0 ? "is-up" : insight.delta < 0 ? "is-down" : ""}`}>
              {deltaLabel(insight.delta)}
            </dd>
          </div>
          <div>
            <dt>Official</dt>
            <dd>{insight.officialCount}</dd>
          </div>
          <div>
            <dt>Occupied</dt>
            <dd>{insight.occupiedCount}</dd>
          </div>
          <div>
            <dt>Tape share</dt>
            <dd>{insight.thin ? "—" : `${Math.round(insight.baselineRatio * 1000) / 10}%`}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{insight.thin ? "—" : pct(insight.confidence)}</dd>
          </div>
          <div>
            <dt>Next-window</dt>
            <dd>
              {insight.model?.name === "histgb"
                ? `HistGB · ${insight.model.samples}`
                : `L2 stumps${insight.model?.samples ? ` · ${insight.model.samples} transitions` : ""}`}
            </dd>
          </div>
          <div>
            <dt>Gold tags</dt>
            <dd>{insight.goldTags ?? 0}/20 occupancy</dd>
          </div>
        </dl>
        <SplitBar official={insight.officialCount} occupied={insight.occupiedCount} />
        <p className="signal-label mt-4">Occupiers</p>
        {insight.occupiers.length === 0 ? (
          <p className="mt-1 text-[12px] text-white/50">
            No other printers in this overlap. Official sources only, or still thin.
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {insight.occupiers.map((o) => (
              <li key={o.url} className="rounded-md px-1 py-1">
                <a
                  href={o.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-left hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--amber)]"
                >
                  <span className="line-clamp-2 text-[12px] leading-snug text-white/88">{o.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-white/40">
                    {o.host}
                    {o.tag ? ` · ${o.tag}` : ""}
                    {o.qrPayload ? ` · QR ${o.qrPayload}` : ""}
                  </span>
                </a>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button type="button" className="watch-sort" onClick={() => onTag(o.url, "official")}>
                    Official
                  </button>
                  <button type="button" className="watch-sort" onClick={() => onTag(o.url, "occupied")}>
                    Occupied
                  </button>
                  <button type="button" className="watch-sort" onClick={() => onTag(o.url, "ignore")}>
                    Ignore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/8 px-3 py-2">
        <GhostButton onClick={onCompare}>{compareActive ? "Clear overlay" : "Overlay window"}</GhostButton>
        <GhostButton onClick={onOpen}>Open Footprint</GhostButton>
        <GhostButton onClick={onRemove}>Remove</GhostButton>
      </div>
    </aside>
  );
}
