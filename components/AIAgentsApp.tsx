"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AmbientBackground from "@/components/AmbientBackground";
import AIAgentsDesk from "@/components/ai-agents/AIAgentsDesk";
import {
  DeskFrame,
  DeskNav,
  GhostButton,
  HomeMark,
  StatusChip,
} from "@/components/shell/DeskChrome";
import type { AIAgentsPayload } from "@/lib/ai-agents-types";

export default function AIAgentsApp() {
  const [payload, setPayload] = useState<AIAgentsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const fetchAgents = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "true");

      const res = await fetch(`/api/ai-agents?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      
      const data = await res.json();
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch AI agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <main className="desk-shell">
      <AmbientBackground />

      <DeskFrame
        context={
          <>
            <span className="signal-label shrink-0">AI Agents & LLM Intelligence</span>
            {payload && (
              <>
                <StatusChip>{payload.metadata.total} agents tracked</StatusChip>
                <StatusChip>{payload.metadata.trending} trending</StatusChip>
                {payload.updatedAt && (
                  <StatusChip>Updated {new Date(payload.updatedAt).toLocaleTimeString()}</StatusChip>
                )}
              </>
            )}
            <GhostButton onClick={() => void fetchAgents(true)} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </GhostButton>
          </>
        }
      >
        <div className="desk-chrome__brand flex min-w-0 shrink-0 items-center gap-3">
          <HomeMark />
          <DeskNav active="trends" />
        </div>
      </DeskFrame>

      {error && (
        <div role="alert" className="relative z-20 mx-3 mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--panel-strong)] px-4 py-2.5">
          <p className="signal-label">{error}</p>
        </div>
      )}

      <div className="desk-workspace">
        <div className="desk-workspace__panes" style={{ display: "block", padding: "12px" }}>
          <AIAgentsDesk />
        </div>
      </div>
    </main>
  );
}
