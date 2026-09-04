"use client";

import type { AttentionSourceRecord, WeeklyRead } from "@/lib/ai-agents-types";
import SourceLinks from "./SourceLinks";

export default function WeeklyReadPanel({
  weekly,
  sources,
}: {
  weekly: WeeklyRead | null;
  sources: AttentionSourceRecord[];
}) {
  const byId = new Map(sources.map((s) => [s.id, s]));

  if (!weekly) {
    return (
      <div className="empty-stage">
        <div className="empty-stage__body">
          <p className="empty-stage__eyebrow">Paid · Weekly read</p>
          <h1 className="empty-stage__title">This week&apos;s attention briefing</h1>
          <p className="empty-stage__copy">
            Generated from the same attention series and receipts as the dashboard — never unsourced claims.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-stage">
      <div className="empty-stage__head">
        <div>
          <p className="empty-stage__eyebrow">Paid · Week of {weekly.weekOf}</p>
          <h2 className="text-lg font-medium">{weekly.title}</h2>
          <p className="mt-2 text-sm text-[var(--mute-strong)]">{weekly.summary}</p>
          <p className="mt-2 signal-label tabular-nums">{weekly.sourceCount} cited receipts</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {weekly.sections.map((section) => (
          <section key={section.heading} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <h3 className="font-medium text-[var(--ink)]">{section.heading}</h3>
            <p className="mt-2 text-sm text-[var(--mute-strong)]">{section.body}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {section.claims.map((claim, i) => (
                <li key={i} className="border-t border-[var(--line)] pt-3">
                  <p className="text-sm text-[var(--ink)]">{claim.text}</p>
                  <p className="mt-1 signal-label font-mono uppercase">{claim.metric}</p>
                  <SourceLinks
                    sources={claim.sourceIds.map((id) => byId.get(id)).filter(Boolean) as AttentionSourceRecord[]}
                    label="Sources"
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
