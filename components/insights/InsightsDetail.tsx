"use client";

import type { RootTrace } from "@/lib/insights-types";

function formatWhen(iso: string | null): string {
  if (!iso) return "undated";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(t));
}

export default function InsightsDetail({ trace }: { trace: RootTrace | null }) {
  if (!trace) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="signal-label text-center">Oldest receipts land here. Newest stays at the surface.</p>
      </div>
    );
  }

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <p className="text-sm font-medium tracking-tight">{trace.originTitle ?? trace.query}</p>
        <p className="mt-0.5 font-mono text-[10px] tabular-nums text-white/45">
          {trace.thin ? "thin" : "rooted"}
          {trace.firstRecord?.at ? ` · first ${formatWhen(trace.firstRecord.at)}` : ""}
        </p>
        {trace.originLag ? (
          <p className="mt-2 text-[12px] leading-relaxed text-white/70">
            {trace.originLag.lagYears}y between {trace.originLag.claimedSource} {trace.originLag.claimedAt.slice(0, 4)}{" "}
            and first dated receipt {formatWhen(trace.originLag.firstRecordAt)}. Measured gap — not a WHY.
          </p>
        ) : null}
      </div>

      {trace.originExtract ? (
        <p className="text-[12px] leading-relaxed text-white/75">{trace.originExtract}</p>
      ) : (
        <p className="text-[12px] text-white/50">No origin extract. We do not invent one.</p>
      )}

      {trace.parents.length ? (
        <div>
          <p className="signal-label">Family</p>
          <ul className="mt-1 space-y-0.5">
            {trace.parents.map((p) => (
              <li key={p.label} className="text-[12px] text-white/70">
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="signal-label">Oldest receipts · {trace.receipts.length}</p>
        {trace.receipts.length === 0 ? (
          <p className="mt-1 text-[12px] text-white/50">No dated receipts in this pull.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {trace.receipts.map((r) => (
              <li key={`${r.url}-${r.at ?? "x"}`}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-md px-1 py-1 hover:bg-white/[0.04]"
                >
                  <span className="line-clamp-2 text-[12px] leading-snug text-white/88">{r.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-white/40">
                    {r.source} · {formatWhen(r.at)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
