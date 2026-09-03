"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AmbientBackground from "@/components/AmbientBackground";
import ChartDesk from "@/components/ChartDesk";
import CategoryPlugs from "@/components/desk/CategoryPlugs";
import PhraseLookup from "@/components/desk/PhraseLookup";
import TopicPlug from "@/components/desk/TopicPlug";
import { KeepBrief } from "@/components/brief/KeepBrief";
import IntelRail from "@/components/IntelRail";
import MapStage from "@/components/MapStage";
import MindDesk from "@/components/MindDesk";
import OverviewRail from "@/components/OverviewRail";
import {
  DeskFrame,
  DeskNav,
  FieldSelect,
  GhostButton,
  HomeMark,
  PrimaryButton,
  SegmentControl,
  StatusChip,
} from "@/components/shell/DeskChrome";
import DeskWorkspace from "@/components/shell/DeskWorkspace";
import TapeWatch from "@/components/TapeWatch";
import TickerTape from "@/components/TickerTape";
import TrendMap from "@/components/TrendMap";
import { AUDIENCE_OPTIONS, boostTrends } from "@/lib/booster";
import { lensCaption } from "@/lib/brief";
import { categoryCounts, filterByCategory } from "@/lib/desk";
import type { FleetHealth } from "@/lib/fleet";
import { fleetChip } from "@/lib/fleet";
import { formatUpdatedAt } from "@/lib/ui-helpers";
import { CITY_OPTIONS, type CityId } from "@/lib/geo";
import {
  ingestTape,
  mergeWatchStores,
  parseWatchStore,
  TAPE_WATCH_KEY,
  toggleWatch,
  type TapeDelta,
  type TapeWatchStore,
} from "@/lib/watch";
import { notifyWatchlistChanged } from "@/lib/watchlist-sync";
import type { AgeLens, BoosterPayload, DeskCategory, Platform, Topic, TrendsPayload } from "@/lib/types";

type SortKey = "score" | Platform | "risk";
type VelocityFilter = Topic["velocity"] | "all";
type Surface = "mind" | "desk" | "map";
type DeskKind = "trends" | "footprint";

function readWatch(): TapeWatchStore {
  if (typeof window === "undefined") return { ids: [], snaps: {} };
  try {
    return parseWatchStore(window.localStorage.getItem(TAPE_WATCH_KEY));
  } catch {
    return parseWatchStore(null);
  }
}

function writeWatchLocal(store: TapeWatchStore) {
  try {
    window.localStorage.setItem(TAPE_WATCH_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function persistWatch(store: TapeWatchStore) {
  writeWatchLocal(store);
  void fetch("/api/tape-watch", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ store }),
  }).catch(() => undefined);
}

function setQueryUrl(phrase: string, vs = "") {
  const url = new URL(window.location.href);
  if (phrase) url.searchParams.set("q", phrase);
  else url.searchParams.delete("q");
  if (vs) url.searchParams.set("vs", vs);
  else url.searchParams.delete("vs");
  url.searchParams.delete("topic");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="text-sm text-white/45">Loading…</p>
    </div>
  );
}

export function TrendDesk() {
  return <LiveDesk desk="trends" />;
}

export function FootprintDesk() {
  return <LiveDesk desk="footprint" />;
}

export default function HawkxAIApp() {
  return <TrendDesk />;
}

function LiveDesk({ desk }: { desk: DeskKind }) {
  const footprint = desk === "footprint";
  const [payload, setPayload] = useState<TrendsPayload | null>(null);
  const [loading, setLoading] = useState(!footprint);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Topic | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [askQuery, setAskQuery] = useState("");
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [city, setCity] = useState<CityId>("all");
  const [booster, setBooster] = useState<BoosterPayload | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [velocityFilter, setVelocityFilter] = useState<VelocityFilter>("all");
  const [lens, setLens] = useState<AgeLens | "all">("all");
  const [category, setCategory] = useState<DeskCategory>("all");
  const [surface, setSurface] = useState<Surface>("mind");
  const [mindCompact, setMindCompact] = useState(false);
  const [plugged, setPlugged] = useState("");
  const [watchIds, setWatchIds] = useState<string[]>([]);
  const [watchHydrated, setWatchHydrated] = useState(false);
  const [deltas, setDeltas] = useState<TapeDelta[]>([]);
  const [watchingPoi, setWatchingPoi] = useState(false);
  const [vsQuery, setVsQuery] = useState("");
  const [compareLabel, setCompareLabel] = useState("");
  const [comparePayload, setComparePayload] = useState<TrendsPayload | null>(null);
  const [overlaying, setOverlaying] = useState(false);
  const [fleet, setFleet] = useState<FleetHealth | null>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const pluggedRef = useRef("");
  const compareLabelRef = useRef("");
  const bootedRef = useRef(false);
  const surfaceScrollRef = useRef<Record<Surface, number>>({ mind: 0, desk: 0, map: 0 });
  const surfaceRef = useRef<Surface>(surface);
  pluggedRef.current = plugged;
  compareLabelRef.current = compareLabel;
  surfaceRef.current = surface;

  const changeSurface = useCallback((next: Surface) => {
    const current = surfaceRef.current;
    if (next === current) return;
    surfaceScrollRef.current[current] = typeof window !== "undefined" ? window.scrollY : 0;
    setSurface(next);
  }, []);

  useEffect(() => {
    const y = surfaceScrollRef.current[surface] ?? 0;
    let cancelled = false;
    // Wait for shell height mode (scroll vs locked) to settle before restoring.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [surface]);

  useEffect(() => {
    if (surface !== "mind") {
      setMindCompact(false);
      return;
    }
    const onScroll = () => {
      setMindCompact(window.scrollY > 56);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [surface]);

  const loadTrends = useCallback(async (refresh = false, topicOverride?: string | null) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const topic =
        topicOverride === null ? "" : (topicOverride ?? pluggedRef.current).trim();

      async function fetchTrendsTape(phrase: string): Promise<TrendsPayload> {
        const params = new URLSearchParams();
        if (refresh) params.set("refresh", "1");
        if (city !== "all") params.set("city", city);
        if (phrase) params.set("topic", phrase);
        const qs = params.toString();
        const res = await fetch(`/api/trends${qs ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error(`Trends failed (${res.status})`);
        return (await res.json()) as TrendsPayload;
      }

      async function applyTape(data: TrendsPayload, phraseUrl: boolean) {
        setPayload(data);
        const local = boostTrends(data);
        setBooster(local);
        void fetch("/api/booster")
          .then((boostRes) => (boostRes.ok ? boostRes.json() : null))
          .then((remote: BoosterPayload | null) => {
            if (!remote?.forecasts?.length) return;
            setBooster((prev) =>
              prev && prev.sourceUpdatedAt === remote.sourceUpdatedAt
                ? { ...prev, forecasts: remote.forecasts, collection: remote.collection }
                : prev,
            );
          })
          .catch(() => undefined);
        if (data.plugged) {
          setPlugged(data.plugged);
          if (phraseUrl) setQueryUrl(data.plugged, compareLabelRef.current);
          const first = data.topics[0] ?? null;
          setSelected(first);
          setHighlightedIds(data.topics.map((t) => t.id));
          if (footprint) changeSurface("desk");
        }
        return data;
      }

      if (footprint && topic) {
        const res = await fetch("/api/fleet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phrase: topic }),
        });
        if (res.ok) {
          const data = (await res.json()) as TrendsPayload;
          return applyTape(data, true);
        }
        const data = await fetchTrendsTape(topic);
        return applyTape(
          { ...data, degraded: [...(data.degraded ?? []), "fleet offline · live tape"] },
          true,
        );
      }

      const data = await fetchTrendsTape(topic);
      return applyTape(data, Boolean(footprint && topic));
    } catch (err) {
      setError(err instanceof Error ? err.message : footprint ? "Could not look up that phrase" : "Could not load trends");
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city, footprint, changeSurface]);

  async function overlayPhrase(raw: string) {
    const vs = raw.trim();
    const primary = pluggedRef.current.trim();
    if (vs.length < 2 || !primary || vs.toLowerCase() === primary.toLowerCase()) return;
    setOverlaying(true);
    try {
      const res = await fetch(`/api/trends?topic=${encodeURIComponent(vs)}`);
      if (!res.ok) throw new Error(`Overlay failed (${res.status})`);
      const data = (await res.json()) as TrendsPayload;
      setComparePayload(data);
      setCompareLabel(data.plugged || vs);
      setVsQuery(data.plugged || vs);
      setQueryUrl(primary, data.plugged || vs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not overlay that phrase");
      setComparePayload(null);
      setCompareLabel("");
    } finally {
      setOverlaying(false);
    }
  }

  useEffect(() => {
    if (!footprint) return;
    void fetch("/api/fleet")
      .then((res) => (res.ok ? res.json() : null))
      .then((row: FleetHealth | null) => {
        if (row) setFleet(row);
      })
      .catch(() => undefined);
  }, [footprint]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateWatch() {
      const local = readWatch();
      let remote: TapeWatchStore = { ids: [], snaps: {} };
      try {
        const res = await fetch("/api/tape-watch");
        if (res.ok) {
          const data = (await res.json()) as { store?: TapeWatchStore };
          remote = parseWatchStore(JSON.stringify(data.store ?? null));
        }
      } catch {
        /* offline — localStorage still holds stars */
      }
      if (cancelled) return;
      const merged = mergeWatchStores(local, remote);
      writeWatchLocal(merged);
      setWatchIds(merged.ids);
      setWatchHydrated(true);
    }
    void hydrateWatch();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!watchHydrated || !payload || !booster) return;
    const next = ingestTape(
      readWatch(),
      payload.topics,
      booster.briefs,
      payload.updatedAt,
    );
    persistWatch(next.store);
    setWatchIds(next.store.ids);
    setDeltas(next.deltas);
  }, [watchHydrated, payload, booster]);

  useEffect(() => {
    if (footprint) {
      if (!bootedRef.current) {
        bootedRef.current = true;
        const params = new URLSearchParams(window.location.search);
        const q = (params.get("q") ?? params.get("topic") ?? "").trim();
        if (q) {
          setAskQuery(q);
          setPlugged(q);
          const vs = (params.get("vs") ?? "").trim();
          if (vs) setVsQuery(vs);
          void loadTrends(false, q).then(() => {
            if (vs) void overlayPhrase(vs);
          });
        }
        return;
      }
      if (!pluggedRef.current) return;
    }
    setSelected(null);
    setHighlightedIds([]);
    void loadTrends();
  }, [loadTrends, footprint]);

  function ensureWatched(topicId: string) {
    const store = readWatch();
    if (store.ids.includes(topicId)) return;
    const next = toggleWatch(store, topicId);
    persistWatch(next);
    setWatchIds(next.ids);
  }

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    const q = askQuery.trim();
    if (!q || asking) return;
    setAsking(true);
    setPlugged(q);
    setAskAnswer(null);
    setHighlightedIds([]);
    setVsQuery("");
    setCompareLabel("");
    setComparePayload(null);
    changeSurface("desk");
    setCategory("all");
    try {
      const data = await loadTrends(true, q);
      setAskAnswer(data?.query?.floor ?? `Nearest receipts for “${q}”.`);
      if (data?.topics[0]) ensureWatched(data.topics[0].id);
    } catch {
      setAskAnswer(footprint ? "Lookup failed — try a close alias (Camry → Toyota Camry)." : "Search failed — try a close alias (Camry → Toyota Camry).");
    } finally {
      setAsking(false);
    }
  }

  async function handlePlug(topic: string) {
    const q = topic.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskQuery(q);
    setPlugged(q);
    setAskAnswer(null);
    setVsQuery("");
    setCompareLabel("");
    setComparePayload(null);
    changeSurface("desk");
    setCategory("all");
    try {
      const data = await loadTrends(true, q);
      setAskAnswer(data?.query?.floor ?? `Nearest receipts for “${q}”.`);
      if (data?.topics[0]) ensureWatched(data.topics[0].id);
    } finally {
      setAsking(false);
    }
  }

  async function handleClearPlug() {
    setPlugged("");
    setAskQuery("");
    setAskAnswer(null);
    setSelected(null);
    setHighlightedIds([]);
    setVsQuery("");
    setCompareLabel("");
    setComparePayload(null);
    if (footprint) {
      setPayload(null);
      setBooster(null);
      setQueryUrl("");
      return;
    }
    await loadTrends(true, null);
  }

  function handleClearOverlay() {
    setVsQuery("");
    setCompareLabel("");
    setComparePayload(null);
    if (pluggedRef.current) setQueryUrl(pluggedRef.current, "");
  }

  const artifactsById = useMemo(() => {
    const map = new Map<string, NonNullable<BoosterPayload["briefs"][number]["artifacts"]>>();
    for (const brief of booster?.briefs ?? []) map.set(brief.topicId, brief.artifacts);
    return map;
  }, [booster]);

  const topics = useMemo(() => {
    const all = payload?.topics ?? [];
    const byVelocity = velocityFilter === "all" ? all : all.filter((t) => t.velocity === velocityFilter);
    return filterByCategory(byVelocity, category, artifactsById);
  }, [payload, velocityFilter, category, artifactsById]);

  const counts = useMemo(() => {
    const all = payload?.topics ?? [];
    const byVelocity = velocityFilter === "all" ? all : all.filter((t) => t.velocity === velocityFilter);
    return categoryCounts(byVelocity, artifactsById);
  }, [payload, velocityFilter, artifactsById]);

  useEffect(() => {
    if (selected && !topics.some((t) => t.id === selected.id)) {
      setSelected(null);
      setHighlightedIds([]);
    }
  }, [topics, selected]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (event.key === "Escape") {
        setSelected(null);
        setHighlightedIds([]);
        return;
      }
      if (typing && !((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        askRef.current?.focus();
        return;
      }
      if (event.key === "g" || event.key === "G") changeSurface("mind");
      if (event.key === "m" || event.key === "M") changeSurface("map");
      if (event.key === "d" || event.key === "D") changeSurface("desk");
      if (event.key === "j" || event.key === "k" || event.key === "J" || event.key === "K") {
        event.preventDefault();
        if (!topics.length) return;
        const idx = selected ? topics.findIndex((t) => t.id === selected.id) : -1;
        const nextIdx =
          event.key.toLowerCase() === "j"
            ? idx < 0 ? 0 : Math.min(topics.length - 1, idx + 1)
            : idx < 0 ? 0 : Math.max(0, idx - 1);
        const next = topics[nextIdx];
        if (next) {
          setSelected(next);
          setHighlightedIds([next.id]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, topics, changeSurface]);

  function pickTopicId(id: string) {
    const topic = topics.find((t) => t.id === id) ?? payload?.topics.find((t) => t.id === id) ?? null;
    pickTopic(topic);
  }

  function pickTopic(topic: Topic | null) {
    setSelected(topic);
    setHighlightedIds(topic ? [topic.id] : []);
    if (!topic) return;
    const feeds = [
      ...new Set(
        (topic.platforms.public?.posts ?? [])
          .map((p) => p.sourceApi)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    if (topic.platforms.x?.posts.length) feeds.push("X");
    if (topic.platforms.reddit?.posts.length) feeds.push("Reddit");
    if (topic.platforms.hn?.posts.length) feeds.push("HN");
    if (!feeds.length) return;
    void fetch("/api/rl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeds, reward: 1 }),
    });
  }

  async function watchPlugged() {
    const name = plugged.trim();
    if (!name) return;
    setWatchingPoi(true);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: name }),
      });
      notifyWatchlistChanged();
    } finally {
      setWatchingPoi(false);
    }
  }

  function handleToggleWatch(topicId: string) {
    const next = toggleWatch(readWatch(), topicId);
    persistWatch(next);
    setWatchIds(next.ids);
  }

  const focus = selected ?? topics[0] ?? null;
  const focusBrief = focus
    ? booster?.briefs.find((b) => b.topicId === focus.id)
    : undefined;
  const focusCaption = lensCaption(focusBrief, lens);
  const sinceLastLook = focus
    ? (deltas.find((d) => d.topicId === focus.id)?.lines ?? [])
    : [];

  return (
    <KeepBrief.Provider
      topic={focus}
      brief={focusBrief}
      query={payload?.query ?? null}
      lens={lens}
      since={sinceLastLook}
    >
    <main
      className={`desk-shell${
        surface === "mind"
          ? ` desk-shell--mind-scroll${mindCompact ? " desk-shell--mind-compact" : ""}`
          : ""
      }`}
    >
      <AmbientBackground />

      <DeskFrame
        toolbar={
          <>
            <SegmentControl
              value={surface}
              onChange={(id) => changeSurface(id as Surface)}
              options={[
                { id: "mind", label: "Mind", hint: "G", blurb: "Receipt map" },
                { id: "desk", label: "Desk", hint: "D", blurb: "Charts and facts" },
                { id: "map", label: "Map", hint: "M", blurb: "Where it landed" },
              ]}
            />
            <FieldSelect
              label="Velocity"
              value={velocityFilter}
              onChange={(v) => setVelocityFilter(v as VelocityFilter)}
            >
              <option value="all" className="bg-[#0a0e17]">All</option>
              <option value="rising" className="bg-[#0a0e17]">Rising</option>
              <option value="peaking" className="bg-[#0a0e17]">Peaking</option>
              <option value="fading" className="bg-[#0a0e17]">Fading</option>
            </FieldSelect>
            <FieldSelect
              label="Audience"
              value={lens}
              onChange={(v) => setLens(v as AgeLens | "all")}
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#0a0e17]">
                  {opt.label}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label="Place"
              value={city}
              onChange={(v) => setCity(v as CityId)}
            >
              {CITY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#0a0e17]">
                  {opt.label}
                </option>
              ))}
            </FieldSelect>
            <form
              onSubmit={handleAsk}
              className="desk-chrome__toolbar-form flex min-w-0 flex-1 items-center gap-2 sm:min-w-[220px] sm:max-w-lg"
            >
              <label htmlFor="desk-lookup" className="sr-only">
                {footprint ? "Look up a campaign or phrase" : "Ask or plug a name"}
              </label>
              <input
                id="desk-lookup"
                ref={askRef}
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder={footprint ? "Campaign, hashtag, or phrase…" : "Ask or plug a name…"}
                enterKeyHint="search"
                autoComplete="off"
                className="field-input"
              />
              <PrimaryButton type="submit" disabled={asking || !askQuery.trim()}>
                {footprint ? "Look up" : "Ask / Plug"}
              </PrimaryButton>
            </form>
          </>
        }
        context={
          footprint ? (
            plugged ? (
              <>
                <span className="signal-label shrink-0">Footprint</span>
                <span className="max-w-[min(220px,55vw)] truncate rounded border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[12px]">
                  {plugged}
                </span>
                {payload?.query ? (
                  <StatusChip>
                    {payload.query.kind} · {payload.query.match} · {payload.query.hitCount}
                  </StatusChip>
                ) : null}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void overlayPhrase(vsQuery);
                  }}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <label htmlFor="desk-overlay" className="sr-only">
                    Overlay a second phrase
                  </label>
                  <input
                    id="desk-overlay"
                    value={vsQuery}
                    onChange={(e) => setVsQuery(e.target.value)}
                    placeholder="vs another phrase…"
                    autoComplete="off"
                    className="field-input max-w-[160px]"
                  />
                  <GhostButton type="submit" disabled={overlaying || vsQuery.trim().length < 2}>
                    {overlaying ? "Overlay…" : compareLabel ? "Update" : "Overlay"}
                  </GhostButton>
                </form>
                {compareLabel ? (
                  <>
                    <StatusChip>
                      {plugged} vs {compareLabel}
                    </StatusChip>
                    <GhostButton onClick={handleClearOverlay}>Clear overlay</GhostButton>
                  </>
                ) : null}
                <GhostButton onClick={() => void handleClearPlug()}>Clear</GhostButton>
                <div className="desk-chrome__context-trail ml-auto flex items-center gap-2">
                  <CategoryPlugs value={category} counts={counts} onChange={setCategory} />
                </div>
              </>
            ) : (
              <>
                <span className="signal-label shrink-0">
                  Look up a campaign or phrase
                  <span className="desk-shortcut"> · ⌘K</span>
                </span>
                <div className="desk-chrome__context-trail ml-auto">
                  <CategoryPlugs value={category} counts={counts} onChange={setCategory} />
                </div>
              </>
            )
          ) : (
            <>
              <span className="signal-label shrink-0">Plug</span>
              <TopicPlug
                value={plugged}
                busy={asking || loading || refreshing}
                onPlug={(q) => void handlePlug(q)}
                onClear={() => void handleClearPlug()}
              />
              <div className="desk-chrome__context-trail ml-auto">
                <CategoryPlugs value={category} counts={counts} onChange={setCategory} />
              </div>
            </>
          )
        }
      >
        <div className="desk-chrome__brand flex min-w-0 shrink-0 items-center gap-3">
          <HomeMark />
          <DeskNav active={footprint ? "footprint" : "trends"} />
        </div>
        <div className="desk-chrome__status flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <StatusChip>
            {loading
              ? footprint
                ? "looking up"
                : "loading"
              : footprint && !plugged
                ? "look up a phrase"
                : `${topics.length} ${footprint ? "prints" : "names"} · ${formatUpdatedAt(payload?.updatedAt ?? null)}`}
          </StatusChip>
          {payload?.degraded.map((msg) => (
            <StatusChip key={msg}>{msg}</StatusChip>
          ))}
          {footprint && fleetChip(fleet) && !payload?.degraded.some((m) => m.includes("fleet")) ? (
            <StatusChip>{fleetChip(fleet)}</StatusChip>
          ) : null}
        </div>
        <div className="desk-chrome__actions ml-auto flex shrink-0 items-center gap-1">
          {footprint && plugged ? (
            <GhostButton onClick={() => void watchPlugged()} disabled={watchingPoi}>
              {watchingPoi ? "Watching…" : "Watch this"}
            </GhostButton>
          ) : null}
          <KeepBrief.Actions />
          <GhostButton
            onClick={() => void loadTrends(true)}
            disabled={refreshing || (footprint && !plugged)}
          >
            Refresh
          </GhostButton>
        </div>
      </DeskFrame>

      <div className="mind-chrome-collapse">
        <TickerTape topics={payload?.topics ?? []} artifactsById={artifactsById} onSelect={pickTopic} />

        {askAnswer ? (
          <div className="no-print relative z-20 mx-3 mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--panel-strong)] px-4 py-2.5">
            <p className="text-sm leading-relaxed text-white/80">{askAnswer}</p>
          </div>
        ) : null}

        <TapeWatch deltas={deltas} onPick={pickTopicId} />
      </div>

      {error ? (
        <div className="relative z-20 mx-3 mt-2 rounded-[var(--radius-md)] border border-white/8 bg-[var(--panel-strong)] px-4 py-2.5">
          <p className="signal-label">{error}</p>
        </div>
      ) : null}

      <DeskWorkspace
        listLabel="Watch"
        listBlurb="Starred names"
        stageLabel={surface === "mind" ? "Mind" : surface === "desk" ? "Desk" : "Map"}
        stageBlurb={
          surface === "mind" ? "Receipt map" : surface === "desk" ? "Charts and facts" : "Where it landed"
        }
        detailLabel="Intel"
        detailBlurb="This print"
        jumpToDetailKey={plugged ? null : selected?.id ?? null}
        preferStage={Boolean(footprint && !plugged && !loading)}
        stageKey={plugged || null}
        list={
          <OverviewRail
            payload={payload}
            topics={topics}
            selectedId={selected?.id ?? null}
            hoverId={hoverId}
            sortKey={sortKey}
            watchedIds={watchIds}
            artifactsById={artifactsById}
            onSort={setSortKey}
            onSelect={pickTopic}
            onHover={setHoverId}
            onToggleWatch={handleToggleWatch}
          />
        }
        stage={
          footprint && !(plugged || loading) ? (
            <PhraseLookup
              onLookup={(q) => void handlePlug(q)}
              onFocusLookup={() => askRef.current?.focus()}
            />
          ) : surface === "mind" ? (
            <MindDesk
              category={category}
              topics={topics}
              selected={selected}
              hoverId={hoverId}
              booster={booster}
              loading={loading}
              phrase={plugged}
              caption={focusCaption}
              city={city}
              located={payload?.located ?? []}
              examplePoi={payload?.examplePoi ?? []}
              poiCompare={payload?.poiCompare ?? null}
              onSelect={pickTopic}
              onHover={setHoverId}
            />
          ) : surface === "desk" ? (
            <ChartDesk
              category={category}
              topics={topics}
              selected={selected}
              hoverId={hoverId}
              booster={booster}
              loading={loading}
              query={payload?.query ?? null}
              takeaway={lens === "all" ? undefined : focusCaption}
              overlayTopics={comparePayload?.topics ?? null}
              overlayLabel={compareLabel || null}
              city={city}
              located={payload?.located ?? []}
              examplePoi={payload?.examplePoi ?? []}
              poiCompare={payload?.poiCompare ?? null}
              onSelect={pickTopic}
              onHover={setHoverId}
            />
          ) : (
            <MapStage
              topics={topics}
              loading={loading}
              selectedId={selected?.id ?? null}
              hoverId={hoverId}
              onSelect={pickTopic}
              onHover={setHoverId}
            >
              {loading ? (
                <MapSkeleton />
              ) : topics.length > 0 ? (
                <TrendMap
                  topics={topics}
                  selectedId={selected?.id ?? null}
                  highlightedIds={highlightedIds}
                  hoverId={hoverId}
                  captionFor={(t) =>
                    lensCaption(
                      booster?.briefs.find((b) => b.topicId === t.id),
                      lens,
                    )
                  }
                  onSelect={pickTopic}
                  onHover={setHoverId}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="signal-label">
                    {footprint
                      ? "No prints in this filter — try All"
                      : "Nearest names are in another plug — try All"}
                  </p>
                </div>
              )}
            </MapStage>
          )
        }
        detail={
          <IntelRail
            selected={selected}
            booster={booster}
            topics={topics}
            hoverId={hoverId}
            lens={lens}
            onSelect={pickTopic}
            onPickId={pickTopicId}
            onHover={setHoverId}
          />
        }
      />
      <KeepBrief.Sheet />
    </main>
    </KeepBrief.Provider>
  );
}
