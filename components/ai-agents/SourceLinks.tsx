"use client";

import type { AttentionSourceRecord } from "@/lib/ai-agents-types";

export default function SourceLinks({
  sources,
  label = "Sources",
  empty = "Seeded fallback sources will appear after load.",
}: {
  sources: AttentionSourceRecord[];
  label?: string;
  empty?: string;
}) {
  if (!sources.length) {
    return (
      <p className="signal-label mt-2">{empty}</p>
    );
  }

  return (
    <div className="mt-2">
      <p className="signal-label mb-2">{label} · {sources.length}</p>
      <ul className="flex flex-col gap-1.5">
        {sources.slice(0, 8).map((s) => (
          <li key={s.id} className="min-w-0">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm text-[var(--amber)] underline-offset-2 hover:underline"
              title={`${s.platform} · ${s.tool} · ${s.collectedAt}`}
            >
              <span className="font-mono text-[10px] uppercase text-[var(--mute)]">{s.platform}</span>
              {" · "}
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
