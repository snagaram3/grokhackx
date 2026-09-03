"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import { nearPlaceFilter, type CityId } from "@/lib/geo";
import { buildTrendPins, type TrendPin } from "@/lib/trend-geo";
import type { ExamplePoiHop, Post, Topic } from "@/lib/types";
import { loadWorldLand, type LandPolygon } from "@/lib/world-land";

interface WorldMapProps {
  topics: Topic[];
  located?: Post[];
  examplePoi?: Post[];
  city?: CityId;
  selectedId: string | null;
  hoverId: string | null;
  pairHover?: ExamplePoiHop | null;
  liveRefresh?: "hub" | "sample" | null;
  onSelect: (topic: Topic) => void;
  onHover: (id: string | null) => void;
}

function pinFill(pin: TrendPin, selected: boolean, hovered: boolean): string {
  if (pin.kind === "lens") return "transparent";
  if (pin.kind === "example") return hovered ? "#ddd6fe" : "#a78bfa";
  if (selected) return "#e8a23a";
  if (hovered) return "#fff";
  if (/usgs|eonet|quake/i.test(pin.source)) return "#fb7185";
  if (/meteo|weather/i.test(pin.source)) return "#7dd3fc";
  return "#f4f4f5";
}

export default function WorldMap({
  topics,
  located = [],
  examplePoi = [],
  city = "all",
  selectedId,
  hoverId,
  pairHover = null,
  liveRefresh = null,
  onSelect,
  onHover,
}: WorldMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pinGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const hopRef = useRef<d3.Selection<SVGPathElement, unknown, null, undefined> | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const topicsRef = useRef(topics);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  topicsRef.current = topics;
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  const pins = useMemo(
    () => buildTrendPins(topics, city, located, examplePoi),
    [topics, city, located, examplePoi],
  );
  const receipts = pins.filter((p) => p.kind === "receipt");
  const examples = pins.filter((p) => p.kind === "example");

  // Own the SVG once; rebuild only when the pin set / city lens changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();
    const width0 = host.clientWidth || 640;
    const height0 = host.clientHeight || 220;
    const svg = d3
      .select(host)
      .append("svg")
      .attr("class", "world-map__svg")
      .attr("role", "img")
      .attr("aria-label", "World map of located receipts")
      .attr("viewBox", `0 0 ${width0} ${height0}`);
    const meshG = svg.append("g").attr("class", "world-map__mesh");
    const landG = svg.append("g").attr("class", "world-map__land");
    const hop = svg.append("path").attr("class", "world-map__hop");
    const pinG = svg.append("g").attr("class", "world-map__pins");
    const projection = d3.geoNaturalEarth1();
    pinGRef.current = pinG;
    hopRef.current = hop;
    projectionRef.current = projection;
    const path = d3.geoPath(projection);
    const graticule = d3.geoGraticule10();

    meshG.append("path").attr("class", "world-map__sphere");
    meshG.append("path").attr("class", "world-map__graticule");

    function layout() {
      const frame = hostRef.current;
      if (!frame) return;
      const width = frame.clientWidth || 640;
      const height = frame.clientHeight || 220;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      projection.fitExtent(
        [
          [8, 8],
          [width - 8, height - 8],
        ],
        { type: "Sphere" },
      );
      meshG.select("path.world-map__graticule").attr("d", path(graticule) ?? "");
      meshG.select("path.world-map__sphere").attr("d", path({ type: "Sphere" }) ?? "");
      landG.selectAll<SVGPathElement, LandPolygon>("path").attr("d", (d) => path(d) ?? "");
      pinG
        .selectAll<SVGGElement, TrendPin>("g.world-map__pin")
        .attr("transform", (d) => {
          const p = projection([d.lon, d.lat]);
          return p ? `translate(${p[0]},${p[1]})` : "translate(-99,-99)";
        });
    }

    const nodes = pinG
      .selectAll<SVGGElement, TrendPin>("g.world-map__pin")
      .data(pins, (d) => d.id)
      .join((enter) => {
        const g = enter.append("g").attr("class", "world-map__pin");
        g.append("circle").attr("class", "world-map__halo").attr("r", 10);
        g.append("circle").attr("class", "world-map__dot");
        g.append("title");
        return g;
      });

    nodes
      .classed("world-map__pin--lens", (d) => d.kind === "lens")
      .classed("world-map__pin--example", (d) => d.kind === "example")
      .classed("world-map__pin--far", (d) => d.kind === "example" && !nearPlaceFilter(d.lat, d.lon, city))
      .attr("tabindex", (d) => (d.kind === "receipt" || d.kind === "example" ? 0 : null))
      .attr("role", (d) => (d.kind === "receipt" || d.kind === "example" ? "button" : null))
      .attr("aria-label", (d) => `${d.label} · ${d.source}`)
      .on("pointerenter", (_event, d) => onHoverRef.current(d.topicIds[0] ?? null))
      .on("pointerleave", () => onHoverRef.current(null))
      .on("click", (_event, d) => {
        const topic = d.topicIds.map((id) => topicsRef.current.find((t) => t.id === id)).find(Boolean);
        if (topic) onSelectRef.current(topic);
      });

    nodes
      .select("circle.world-map__dot")
      .attr("r", (d) =>
        d.kind === "lens" ? 7 : d.kind === "example" ? 3.2 : Math.max(3, Math.min(7, 2 + d.weight / 40)),
      );
    nodes.select("title").text((d) => `${d.kind === "example" ? "Example POI · " : ""}${d.label} · ${d.source}\n${d.title}`);

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(host);

    let cancelled = false;
    void loadWorldLand().then((land) => {
      if (cancelled || !land) return;
      landG
        .selectAll("path")
        .data([land])
        .join("path")
        .attr("class", "world-map__continent");
      layout();
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      pinG.on("pointerenter", null).on("pointerleave", null).on("click", null);
      pinGRef.current = null;
      hopRef.current = null;
      projectionRef.current = null;
      host.replaceChildren();
    };
  }, [pins, city]);

  // Paint selection / hover without tearing down the map.
  useEffect(() => {
    const pinG = pinGRef.current;
    if (!pinG) return;
    const pairHot = (id: string) =>
      Boolean(pairHover && (pairHover.examplePinId === id || pairHover.livePinId === id));
    pinG
      .selectAll<SVGGElement, TrendPin>("g.world-map__pin")
      .classed("world-map__pin--on", (d) => d.topicIds.includes(selectedId ?? "") || d.id === `lens:${city}` || pairHot(d.id))
      .classed("world-map__pin--hot", (d) => d.topicIds.includes(hoverId ?? "") || pairHot(d.id))
      .classed("world-map__pin--hop", (d) => pairHot(d.id))
      .select("circle.world-map__dot")
      .attr("fill", (d) =>
        pinFill(d, d.topicIds.includes(selectedId ?? "") || pairHot(d.id), d.topicIds.includes(hoverId ?? "") || pairHot(d.id)),
      )
      .attr("r", (d) => {
        if (pairHot(d.id)) return d.kind === "example" ? 5 : Math.max(4.5, Math.min(8, 3 + d.weight / 40));
        return d.kind === "lens" ? 7 : d.kind === "example" ? 3.2 : Math.max(3, Math.min(7, 2 + d.weight / 40));
      });

    const hop = hopRef.current;
    const projection = projectionRef.current;
    if (!hop || !projection) return;
    const a = pairHover ? pins.find((p) => p.id === pairHover.examplePinId) : null;
    const b = pairHover ? pins.find((p) => p.id === pairHover.livePinId) : null;
    if (!a || !b) {
      hop.attr("d", "").attr("opacity", 0).classed("world-map__hop--close", false);
      return;
    }
    const pa = projection([a.lon, a.lat]);
    const pb = projection([b.lon, b.lat]);
    if (!pa || !pb) {
      hop.attr("d", "").attr("opacity", 0).classed("world-map__hop--close", false);
      return;
    }
    const dist = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    // Co-located hops (< ~2 km) collapse to a point — bow the path so it reads.
    if (dist < 14) {
      const mx = (pa[0] + pb[0]) / 2;
      const my = (pa[1] + pb[1]) / 2 - 18;
      hop
        .attr("d", `M${pa[0]},${pa[1]} Q${mx},${my} ${pb[0]},${pb[1]}`)
        .attr("opacity", 1)
        .classed("world-map__hop--close", true);
    } else {
      hop
        .attr("d", `M${pa[0]},${pa[1]}L${pb[0]},${pb[1]}`)
        .attr("opacity", 1)
        .classed("world-map__hop--close", false);
    }
  }, [selectedId, hoverId, city, pins, pairHover]);

  const refreshLabel = liveRefresh === "hub" ? "hub" : liveRefresh === "sample" ? "sample" : null;

  return (
    <section className="world-map" aria-label="Live world">
      <header className="world-map__head">
        <div>
          <p className="empty-stage__eyebrow">World</p>
          <p className="world-map__lead">Live places vs example POI</p>
        </div>
        <p className="signal-label">
          {receipts.length || examples.length
            ? `${receipts.length} live · ${examples.length} example POI${refreshLabel ? ` · HF ${refreshLabel}` : ""}`
            : "No located receipts yet · weather and quakes land here"}
        </p>
      </header>
      <div ref={hostRef} className="world-map__canvas" />
    </section>
  );
}
