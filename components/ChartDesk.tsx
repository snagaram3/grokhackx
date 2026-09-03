"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Desk } from "@/components/desk/Desk";
import FloorBrief from "@/components/desk/FloorBrief";
import ExamplePoiCompare from "@/components/desk/ExamplePoiCompare";
import WorldMap from "@/components/desk/WorldMap";
import { buildCausation, buildTimeseries } from "@/lib/desk";
import { buildEventTicks } from "@/lib/event-ticks";
import { buildMindMap } from "@/lib/mindmap";
import { alignTotals } from "@/lib/occurrence-overlay";
import { buildSentiment } from "@/lib/sentiment";
import type { BoosterPayload, ExamplePoiCompare as PoiCompare, ExamplePoiHop, MindNode, Post, QueryInsight, Topic } from "@/lib/types";
import type { CityId } from "@/lib/geo";
import type { DeskCategory } from "@/lib/types";

interface ChartDeskProps {
  category: DeskCategory;
  topics: Topic[];
  selected: Topic | null;
  hoverId: string | null;
  booster: BoosterPayload | null;
  loading: boolean;
  query?: QueryInsight | null;
  takeaway?: string;
  overlayTopics?: Topic[] | null;
  overlayLabel?: string | null;
  city?: CityId;
  located?: Post[];
  examplePoi?: Post[];
  poiCompare?: PoiCompare | null;
  onSelect: (topic: Topic) => void;
  onHover: (id: string | null) => void;
}

export default function ChartDesk({
  category,
  topics,
  selected,
  hoverId,
  booster,
  loading,
  query = null,
  takeaway,
  overlayTopics = null,
  overlayLabel = null,
  city = "all",
  located = [],
  examplePoi = [],
  poiCompare = null,
  onSelect,
  onHover,
}: ChartDeskProps) {
  const focus = selected ?? topics[0] ?? null;
  const brief = focus ? booster?.briefs.find((b) => b.topicId === focus.id) : undefined;
  const series = useMemo(() => buildTimeseries(topics), [topics]);
  const overlaySeries = useMemo(
    () => (overlayTopics && overlayTopics.length ? buildTimeseries(overlayTopics) : []),
    [overlayTopics],
  );
  const overlay = useMemo(() => {
    if (!overlayLabel || overlaySeries.length === 0) return null;
    return { label: overlayLabel, totals: alignTotals(series, overlaySeries) };
  }, [overlayLabel, overlaySeries, series]);
  const ticks = useMemo(() => buildEventTicks(topics), [topics]);
  const history = booster?.collection?.history ?? [];
  const graph = useMemo(
    () =>
      buildMindMap(
        topics,
        booster?.briefs ?? [],
        category,
        query
          ? { label: query.raw.slice(0, 42), detail: `${topics.length} related prints` }
          : undefined,
        booster?.forecasts ?? [],
      ),
    [topics, booster, category, query],
  );
  const causation = useMemo(() => {
    if (!focus) return null;
    return brief?.causation ?? buildCausation(focus, brief?.artifacts ?? []);
  }, [focus, brief]);
  const sentiment = useMemo(() => {
    if (!focus) return null;
    return brief?.sentiment ?? buildSentiment(focus);
  }, [focus, brief]);
  const [open, setOpen] = useState<"mind" | "sentiment" | null>(null);
  const [pairHover, setPairHover] = useState<ExamplePoiHop | null>(null);
  const [inspect, setInspect] = useState<MindNode | null>(null);
  const [bucketT, setBucketT] = useState<string | null>(null);
  const openPanel = useCallback((panel: "mind" | "sentiment" | null) => setOpen(panel), []);
  const inspectNode = useCallback((node: MindNode | null) => setInspect(node), []);
  const selectBucket = useCallback((t: string | null) => setBucketT(t), []);
  useEffect(() => {
    setBucketT(null);
  }, [selected?.id, query?.raw, overlayLabel]);
  const actions = useMemo(
    () => ({
      select: onSelect,
      hover: onHover,
      open: openPanel,
      inspect: inspectNode,
      selectBucket,
    }),
    [onSelect, onHover, openPanel, inspectNode, selectBucket],
  );

  return (
    <Desk.Provider
      state={{
        category,
        topics,
        selectedId: selected?.id ?? null,
        hoverId,
        series,
        causation,
        sentiment,
        graph,
        loading,
        open,
        inspectId: inspect?.id ?? null,
        focus,
        brief,
        query,
        bucketT,
        overlay,
        ticks,
        history,
      }}
      actions={actions}
    >
      <Desk.Frame>
        <Desk.Header />
        <Desk.Stage>
          <div className="h-full min-h-0 overflow-y-auto p-4">
            {query ? (
              <div className="mb-4">
                <FloorBrief
                  query={query}
                  sentiment={sentiment}
                  hook={brief?.campaign.hook}
                  takeaway={takeaway}
                />
              </div>
            ) : null}
            <Desk.Mind />
            <div className="world-map--card mt-4 overflow-hidden">
              <WorldMap
                topics={topics}
                located={located}
                examplePoi={examplePoi}
                city={city}
                selectedId={selected?.id ?? focus?.id ?? null}
                hoverId={hoverId}
                pairHover={pairHover}
                liveRefresh={poiCompare?.liveRefresh ?? null}
                onSelect={onSelect}
                onHover={onHover}
              />
              <ExamplePoiCompare compare={poiCompare} onPairHover={setPairHover} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Desk.Timeseries />
              <Desk.Sentiment />
            </div>
            <Desk.Trends />
          </div>
          <Desk.MindSheet />
          <Desk.SentimentSheet />
        </Desk.Stage>
      </Desk.Frame>
    </Desk.Provider>
  );
}
