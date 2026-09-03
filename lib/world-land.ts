/** Decode world-atlas TopoJSON land into a MultiPolygon. No extra package. */

export interface LandPolygon {
  type: "MultiPolygon";
  coordinates: [number, number][][][];
}

interface TopoTransform {
  scale: [number, number];
  translate: [number, number];
}

interface Topology {
  type: "Topology";
  transform?: TopoTransform;
  arcs: number[][][];
  objects?: Record<string, { type?: string; arcs?: unknown }>;
}

/** Prefer local asset so the silhouette does not depend on a CDN. */
const LAND_URLS = ["/geo/land-110m.json", "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json"];

let cached: LandPolygon | null = null;
let inflight: Promise<LandPolygon | null> | null = null;

function decodeArc(arc: number[][], transform?: TopoTransform): [number, number][] {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    if (!transform) return [x, y];
    return [x * transform.scale[0] + transform.translate[0], y * transform.scale[1] + transform.translate[1]];
  });
}

function stitch(indexes: number[], arcs: [number, number][][]): [number, number][] {
  const ring: [number, number][] = [];
  for (const i of indexes) {
    const fwd = i >= 0;
    const pts = arcs[fwd ? i : ~i];
    if (!pts) continue;
    const seq = fwd ? pts : [...pts].reverse();
    if (ring.length) seq.shift();
    ring.push(...seq);
  }
  return ring;
}

function asArcTree(raw: unknown): number[][][] {
  if (!Array.isArray(raw)) return [];
  if (typeof raw[0] === "number") return [[raw as number[]]];
  if (Array.isArray(raw[0]) && typeof raw[0][0] === "number") return [raw as number[][]];
  return raw as number[][][];
}

function landArcRoots(land: { type?: string; arcs?: unknown; geometries?: { type?: string; arcs?: unknown }[] }): unknown {
  if (land.arcs != null) return land.arcs;
  // world-atlas land-110m is a GeometryCollection of one MultiPolygon.
  const geom = land.geometries?.find((g) => g.type === "MultiPolygon" || g.arcs != null);
  return geom?.arcs ?? null;
}

export function topoLandToMultiPolygon(topo: unknown): LandPolygon | null {
  if (!topo || typeof topo !== "object") return null;
  const t = topo as Topology;
  if (!Array.isArray(t.arcs)) return null;
  const decoded = t.arcs.map((arc) => decodeArc(arc, t.transform));
  const land = t.objects?.land;
  if (!land) return null;
  const roots = landArcRoots(land);
  if (roots == null) return null;
  const polygons: [number, number][][][] = [];
  for (const poly of asArcTree(roots)) {
    const rings = poly.map((ring) => stitch(ring, decoded)).filter((r) => r.length > 3);
    if (rings.length) polygons.push(rings);
  }
  if (!polygons.length) return null;
  return { type: "MultiPolygon", coordinates: polygons };
}

export async function loadWorldLand(): Promise<LandPolygon | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      for (const url of LAND_URLS) {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) continue;
          const land = topoLandToMultiPolygon(await res.json());
          if (!land) continue;
          cached = land;
          return land;
        } catch {
          /* try next source */
        }
      }
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
