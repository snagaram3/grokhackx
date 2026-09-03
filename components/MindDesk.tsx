"use client";

import { useMemo, useState } from "react";
import MindInspect from "@/components/desk/MindInspect";
import MindMapChart from "@/components/desk/MindMap";
import ExamplePoiCompare from "@/components/desk/ExamplePoiCompare";
import WorldMap from "@/components/desk/WorldMap";
import { GhostButton } from "@/components/shell/DeskChrome";
import { CATEGORY_LABEL } from "@/lib/desk";
import type { CityId } from "@/lib/geo";
import { buildMindMap } from "@/lib/mindmap";
import type { BoosterPayload, DeskCategory, ExamplePoiCompare as PoiCompare, ExamplePoiHop, MindNode, Post, Topic } from "@/lib/types";

interface MindDeskProps {
  category: DeskCategory;
  topics: Topic[];
  selected: Topic | null;
  hoverId: string | null;
  booster: BoosterPayload | null;
  loading: boolean;
  caption?: string;
  phrase?: string;
  city?: CityId;
  located?: Post[];
  examplePoi?: Post[];
  poiCompare?: PoiCompare | null;
  onSelect: (topic: Topic | null) => void;
  onHover: (id: string | null) => void;
}

export default function MindDesk({
  category,
  topics,
  selected,
  hoverId,
  booster,
  loading,
  caption,
  phrase,
  city = "all",
  located = [],
  examplePoi = [],
  poiCompare = null,
  onSelect,
  onHover,
}: MindDeskProps) {
  const graph = useMemo(
    () =>
      buildMindMap(
        topics,
        booster?.briefs ?? [],
        category,
        phrase
          ? { label: phrase.slice(0, 42), detail: `${topics.length} related prints` }
          : undefined,
        booster?.forecasts ?? [],
      ),
    [topics, booster, category, phrase],
  );
  const artifacts = graph.nodes.filter((n) => n.kind === "artifact").length;
  const [inspect, setInspect] = useState<MindNode | null>(null);
  const [pairHover, setPairHover] = useState<ExamplePoiHop | null>(null);
  const node =
    inspect ??
    graph.nodes.find((n) => n.id === `topic:${selected?.id}`) ??
    null;
  const brief = node?.topicId
    ? booster?.briefs.find((b) => b.topicId === node.topicId)
    : undefined;

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // Nudge into compact chrome first so the jump does not overshoot when
    // the toolbar collapses mid-smooth-scroll.
    if (window.scrollY <= 56) window.scrollTo({ top: 57, behavior: "auto" });
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        const head = document.querySelector(".mind-desk__head");
        const need = (head?.getBoundingClientRect().bottom ?? 96) + 8;
        const top = el.getBoundingClientRect().top;
        if (Math.abs(top - need) > 12) {
          window.scrollBy({ top: top - need, left: 0, behavior: "auto" });
        }
      }, 420);
    });
  }

  function jumpToWorld() {
    scrollToId("mind-world");
  }

  function jumpToMap() {
    scrollToId("mind-map");
  }

  return (
    <section className="mind-desk signal-glass relative flex min-h-0 flex-col">
      <div className="mind-desk__head flex shrink-0 flex-col gap-3 border-b border-white/8 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-sm font-medium tracking-tight">
            {phrase ? `“${phrase}” mind` : `${CATEGORY_LABEL[category]} mind`}
          </h1>
          <p className="mt-0.5 text-xs text-white/45">
            {caption
              ? caption
              : "Hover a blob to read the receipt. Scroll for the world strip — same tape, only receipts that already have a place."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-end justify-end gap-3">
          <div className="flex gap-4 font-mono text-[11px] tabular-nums">
            <Kpi label="Prints" value={String(topics.length)} />
            <Kpi label="Artifacts" value={String(artifacts)} />
            <Kpi label="Bridges" value={String(graph.bridges)} />
            <Kpi
              label="Called"
              value={String((booster?.forecasts ?? []).filter((f) => !f.thin && f.kind !== "hub").length)}
            />
          </div>
          <div className="flex items-center gap-1">
            <GhostButton onClick={jumpToMap}>Map</GhostButton>
            <GhostButton onClick={jumpToWorld}>World</GhostButton>
          </div>
        </div>
      </div>
      <div className="mind-desk__body">
        <div id="mind-map" className="mind-desk__map-row">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-full border border-white/10" />
            </div>
          ) : (
            <div className="mind-desk__map">
              <MindMapChart
                graph={graph}
                topics={topics}
                selectedId={selected?.id ?? null}
                hoverId={hoverId}
                inspectId={inspect?.id ?? null}
                onSelect={onSelect}
                onHover={onHover}
                onInspect={setInspect}
              />
            </div>
          )}
          {node && !loading ? (
            <MindInspect
              node={node}
              graph={graph}
              topics={topics}
              brief={brief}
              onClose={() => {
                setInspect(null);
                onSelect(null);
              }}
              onPick={(topic) => {
                onSelect(topic);
                setInspect(graph.nodes.find((n) => n.id === `topic:${topic.id}`) ?? null);
              }}
            />
          ) : null}
        </div>
        <div id="mind-world" className="mind-desk__world">
          <WorldMap
            topics={topics}
            located={located}
            examplePoi={examplePoi}
            city={city}
            selectedId={selected?.id ?? null}
            hoverId={hoverId}
            pairHover={pairHover}
            liveRefresh={poiCompare?.liveRefresh ?? null}
            onSelect={onSelect}
            onHover={onHover}
          />
          <ExamplePoiCompare compare={poiCompare} onPairHover={setPairHover} />
        </div>
      </div>
      <div className="mind-desk__legend flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-white/8 px-4 py-2 font-mono text-[10px] text-white/45">
        <span className="text-[#e8a23a]">hub</span>
        <span>topic</span>
        <span className="text-[#7dd3fc]">artifact</span>
        <span className="text-[#34d399]">first print</span>
        <span className="text-[#e8a23a]">shared</span>
        <span className="text-[#a78bfa]">example POI</span>
        <span className="text-[#7dd3fc]">live weather</span>
        <span className="text-[#fb7185]">live hazard</span>
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="signal-label">{label}</p>
      <p className="mt-0.5 text-base tabular-nums text-white">{value}</p>
    </div>
  );
}
