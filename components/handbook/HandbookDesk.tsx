"use client";

import { useEffect, useState } from "react";
import { MermaidDiagram } from "@/components/architecture/MermaidDiagram";
import type { HandbookPayload } from "@/lib/handbook-types";

export default function HandbookDesk() {
  const [payload, setPayload] = useState<HandbookPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/handbook")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Handbook failed (${res.status})`);
        return (await res.json()) as HandbookPayload;
      })
      .then(setPayload)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "handbook failed"));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--mute)]">HawkxAI</p>
        <h1 className="text-2xl font-medium text-[var(--ink)]">Handbook</h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--mute-strong)]">
          Flip a tool in <code className="text-[var(--ink)]">fleet/permissions.json</code> and refresh
          once — the permission diff is the contest money shot. Not a slide. Not an invented WHY.
        </p>
        <p className="text-sm text-[var(--mute)]">
          <a href="/architecture" className="underline-offset-2 hover:underline">
            Ingest architecture
          </a>
          {" · "}
          <a href="/api/handbook?format=md" className="underline-offset-2 hover:underline">
            Raw markdown
          </a>
        </p>
      </header>

      {error ? <p className="text-sm text-[var(--mute-strong)]">{error}</p> : null}
      {!payload && !error ? <p className="text-sm text-[var(--mute)]">Generating…</p> : null}

      {payload ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--ink)]">Product</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--mute-strong)]">
              {payload.product.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--ink)]">Tool permissions</h2>
            <p className="text-sm leading-6 text-[var(--mute-strong)]">{payload.permissionDiff.summary}</p>
            {payload.permissionDiff.changes.length ? (
              <ul className="list-disc space-y-1 pl-5 font-mono text-[12px] text-[var(--mute-strong)]">
                {payload.permissionDiff.changes.map((c) => (
                  <li key={c.tool}>
                    {c.tool}: {c.from} → {c.to}
                  </li>
                ))}
              </ul>
            ) : null}
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[var(--mute)]">
                  <th className="py-1 pr-3 font-medium">Tool</th>
                  <th className="py-1 pr-3 font-medium">On</th>
                  <th className="py-1 pr-3 font-medium">Channel</th>
                  <th className="py-1 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(payload.permissions.tools ?? {}).map(([name, cfg]) => (
                  <tr key={name} className="border-t border-white/10">
                    <td className="py-2 pr-3 font-mono text-[12px]">{name}</td>
                    <td className="py-2 pr-3">{cfg.enabled ? "yes" : "no"}</td>
                    <td className="py-2 pr-3">{cfg.channel}</td>
                    <td className="py-2 text-[var(--mute-strong)]">{cfg.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--ink)]">Model card</h2>
            <p className="text-sm leading-6 text-[var(--mute-strong)]">{payload.modelCard.nextWindow}</p>
            <p className="text-sm leading-6 text-[var(--mute-strong)]">{payload.modelCard.occupancy}</p>
            <p className="text-sm leading-6 text-[var(--mute-strong)]">{payload.modelCard.lineage}</p>
            <p className="font-mono text-[12px] text-[var(--mute)]">
              floors: {payload.modelCard.minTransitions} transitions · {payload.modelCard.minGoldTags} gold tags
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--ink)]">Fleet</h2>
            <MermaidDiagram chart={payload.mermaid.fleet} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--ink)]">HistGB</h2>
            <MermaidDiagram chart={payload.mermaid.ml} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium text-[var(--ink)]">Lineage</h2>
            <MermaidDiagram chart={payload.mermaid.lineage} />
          </section>
        </>
      ) : null}
    </main>
  );
}
