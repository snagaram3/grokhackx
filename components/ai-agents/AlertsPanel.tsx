"use client";

import type { AIAgentAlert, AttentionSourceRecord } from "@/lib/ai-agents-types";
import SourceLinks from "./SourceLinks";

export default function AlertsPanel({
  alerts,
  sources,
}: {
  alerts: AIAgentAlert[];
  sources: AttentionSourceRecord[];
}) {
  const byId = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Paid · Alerts</p>
          <h2 className="text-lg font-medium">Trajectory shifts</h2>
          <p className="mt-1 text-sm text-[var(--mute-strong)]">
            Fired when attention rate-of-change or concentration crosses a threshold. Public signal only — not adoption.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-sm text-[var(--mute-strong)]">
              No trajectory alerts in this window. Seeded agents are stable — refresh with live ingest after a big model ship.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <article
              key={alert.id}
              className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="signal-label font-mono uppercase">{alert.kind.replace("_", " ")}</p>
                  <h3 className="mt-1 font-medium text-[var(--ink)]">{alert.title}</h3>
                  <p className="mt-2 text-sm text-[var(--mute-strong)]">{alert.body}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs tabular-nums">
                    <span className={alert.rateOfChange >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
                      RoC {alert.rateOfChange >= 0 ? "+" : ""}
                      {alert.rateOfChange.toFixed(1)}%
                    </span>
                    <span className="signal-label">attention {alert.attention}</span>
                  </div>
                  <SourceLinks
                    sources={alert.sourceIds.map((id) => byId.get(id)).filter(Boolean) as AttentionSourceRecord[]}
                    label="Evidence"
                  />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
