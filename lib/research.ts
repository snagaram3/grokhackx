import { z } from "zod";
import { geminiChat, geminiDeepResearch, hasGoogleKey } from "./gemini";
import { searchHn } from "./hn";
import { stampSources } from "./lineage";
import { packResearch } from "./research-pack";
import { searchReddit } from "./reddit";
import { fetchGoogleTrendsSafe, fetchX } from "./signals";
import type {
  ResearchFinding,
  ResearchPayload,
  ResearchSource,
  ResearchSourceKind,
} from "./types";

const UA = "HawkxAI/1.0 (+https://github.com/snagaram3/grokhackx)";

const briefSchema = z.object({
  summary: z.string().min(1).transform((s) => s.slice(0, 1200)),
  findings: z
    .array(
      z.object({
        claim: z.string().min(1).transform((s) => s.slice(0, 400)),
        evidenceIds: z.array(z.string()).max(8),
        confidence: z.enum(["high", "medium", "thin"]),
      }),
    )
    .max(12),
  openQuestions: z.array(z.string().transform((s) => s.slice(0, 240))).max(8),
  angles: z.array(z.string().transform((s) => s.slice(0, 160))).max(8),
});

function parseJsonObject(raw: string): unknown {
  const t = raw.trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("no json object");
  }
}

function sourceId(kind: ResearchSourceKind, n: number): string {
  return `${kind}-${n}`;
}

async function duckDuckGo(query: string): Promise<ResearchSource[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`duckduckgo ${res.status}`);
  const data = (await res.json()) as {
    Heading?: string;
    Abstract?: string;
    AbstractURL?: string;
    RelatedTopics?: { Text?: string; FirstURL?: string; Topics?: unknown[] }[];
  };
  const out: ResearchSource[] = [];
  let n = 0;
  if (data.Abstract && data.AbstractURL) {
    out.push({
      id: sourceId("web", ++n),
      kind: "web",
      title: (data.Heading || query).slice(0, 160),
      url: data.AbstractURL,
      snippet: data.Abstract.slice(0, 480),
    });
  }
  for (const topic of data.RelatedTopics ?? []) {
    if (out.length >= 8) break;
    if (topic.Text && topic.FirstURL) {
      out.push({
        id: sourceId("web", ++n),
        kind: "web",
        title: topic.Text.slice(0, 100),
        url: topic.FirstURL,
        snippet: topic.Text.slice(0, 480),
      });
    }
  }
  return out;
}

async function wikipedia(query: string): Promise<ResearchSource[]> {
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}` +
    `&limit=5&namespace=0&format=json&origin=*`;
  const searchRes = await fetch(searchUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!searchRes.ok) throw new Error(`wikipedia search ${searchRes.status}`);
  const searched = (await searchRes.json()) as [string, string[], string[], string[]];
  const titles = searched[1] ?? [];
  const urls = searched[3] ?? [];
  if (!titles.length) return [];

  const title = titles[0];
  const pageUrl = urls[0] || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const summaryRes = await fetch(summaryUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  const out: ResearchSource[] = [];
  if (summaryRes.ok) {
    const page = (await summaryRes.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    out.push({
      id: sourceId("wikipedia", 1),
      kind: "wikipedia",
      title: page.title || title,
      url: page.content_urls?.desktop?.page || pageUrl,
      snippet: (page.extract || "").slice(0, 600),
    });
  }
  for (let i = 1; i < Math.min(titles.length, 4); i++) {
    out.push({
      id: sourceId("wikipedia", i + 1),
      kind: "wikipedia",
      title: titles[i],
      url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(titles[i].replace(/ /g, "_"))}`,
      snippet: `Wikipedia page: ${titles[i]}`,
    });
  }
  return out;
}

async function pubmed(query: string): Promise<ResearchSource[]> {
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed` +
    `&term=${encodeURIComponent(query)}&retmax=6&retmode=json&sort=relevance`;
  const searchRes = await fetch(searchUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!searchRes.ok) throw new Error(`pubmed search ${searchRes.status}`);
  const search = (await searchRes.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  const ids = search.esearchresult?.idlist ?? [];
  if (!ids.length) return [];

  const summaryUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed` +
    `&id=${ids.join(",")}&retmode=json`;
  const summaryRes = await fetch(summaryUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!summaryRes.ok) throw new Error(`pubmed summary ${summaryRes.status}`);
  const summary = (await summaryRes.json()) as {
    result?: Record<string, { title?: string; sortpubdate?: string; source?: string } | string[]>;
  };
  const result = summary.result ?? {};
  const out: ResearchSource[] = [];
  let n = 0;
  for (const id of ids) {
    const row = result[id];
    if (!row || Array.isArray(row) || !row.title) continue;
    out.push({
      id: sourceId("pubmed", ++n),
      kind: "pubmed",
      title: row.title.slice(0, 220),
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      snippet: [row.source, row.sortpubdate, row.title].filter(Boolean).join(" · ").slice(0, 480),
      createdAt: row.sortpubdate || undefined,
    });
  }
  return out;
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function arxiv(query: string): Promise<ResearchSource[]> {
  const url =
    `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}` +
    `&start=0&max_results=6&sortBy=relevance&sortOrder=descending`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/atom+xml, application/xml, text/xml", "User-Agent": UA },
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) throw new Error(`arxiv ${res.status}`);
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  const out: ResearchSource[] = [];
  let n = 0;
  for (const entry of entries) {
    if (n >= 6) break;
    const title = decodeXml((entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/\s+/g, " ").trim());
    const summary = decodeXml((entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/\s+/g, " ").trim());
    const id = (entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] ?? "").trim();
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? "").trim();
    if (!title || !id) continue;
    out.push({
      id: sourceId("arxiv", ++n),
      kind: "arxiv",
      title: title.slice(0, 220),
      url: id.startsWith("http") ? id : `https://arxiv.org/abs/${id}`,
      snippet: summary.slice(0, 480),
      createdAt: published || undefined,
    });
  }
  return out;
}

async function uspto(query: string): Promise<ResearchSource[]> {
  const q = JSON.stringify({ _text_any: { patent_title: query } });
  const url =
    `https://api.patentsview.org/patents/query?q=${encodeURIComponent(q)}` +
    `&f=["patent_number","patent_title","patent_date","patent_abstract"]&o={"per_page":5}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) throw new Error(`uspto ${res.status}`);
  const data = (await res.json()) as {
    patents?: {
      patent_number?: string;
      patent_title?: string;
      patent_date?: string;
      patent_abstract?: string;
    }[];
  };
  const out: ResearchSource[] = [];
  let n = 0;
  for (const p of data.patents ?? []) {
    if (!p.patent_number || !p.patent_title) continue;
    out.push({
      id: sourceId("uspto", ++n),
      kind: "uspto",
      title: p.patent_title.slice(0, 220),
      url: `https://patents.google.com/patent/US${p.patent_number}`,
      snippet: (p.patent_abstract || `USPTO ${p.patent_number} · ${p.patent_date ?? ""}`).slice(0, 480),
      createdAt: p.patent_date || undefined,
    });
  }
  return out;
}

function postsToSources(
  kind: Extract<ResearchSourceKind, "hn" | "reddit" | "x" | "public">,
  posts: { title: string; url: string; score: number; createdAt: string; tool?: string; collectedAt?: string }[],
  limit: number,
): ResearchSource[] {
  return posts.slice(0, limit).map((p, i) => ({
    id: sourceId(kind, i + 1),
    kind,
    title: p.title.slice(0, 200),
    url: p.url,
    snippet: p.title.slice(0, 400),
    score: p.score,
    createdAt: p.createdAt,
    tool: p.tool,
    collectedAt: p.collectedAt,
  }));
}

async function settle<T>(label: string, run: () => Promise<T>, degraded: string[]): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.warn(`[research] ${label}`, err instanceof Error ? err.message : err);
    degraded.push(`${label} offline`);
    return null;
  }
}

function thinBrief(query: string, sources: ResearchSource[]): {
  summary: string;
  findings: ResearchFinding[];
  openQuestions: string[];
  angles: string[];
} {
  const top = sources.slice(0, 5);
  const findings: ResearchFinding[] = top.map((s) => ({
    claim: s.snippet.slice(0, 280) || s.title,
    evidenceIds: [s.id],
    confidence: sources.length >= 6 ? ("medium" as const) : ("thin" as const),
  }));
  const pack = packResearch(query, sources);
  return {
    summary: pack.summary,
    findings,
    openQuestions: pack.openQuestions,
    angles: pack.angles,
  };
}

async function synthesize(
  query: string,
  sources: ResearchSource[],
): Promise<{
  summary: string;
  findings: ResearchFinding[];
  openQuestions: string[];
  angles: string[];
}> {
  if (!hasGoogleKey() || sources.length === 0) {
    return thinBrief(query, sources);
  }

  const compact = sources.slice(0, 28).map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    url: s.url,
    snippet: s.snippet.slice(0, 280),
  }));

  const prompt = `You are HawkxAI Research. Topic: ${JSON.stringify(query)}
Use ONLY the evidence list below. Never invent a fact, URL, or citation.
If evidence is thin, say so and set confidence to "thin".
Every finding.claim must be grounded in at least one evidenceIds id from the list.
Return JSON only:
{"summary":"2-5 sentences","findings":[{"claim":"","evidenceIds":["id"],"confidence":"high|medium|thin"}],"openQuestions":[""],"angles":[""]}
Evidence: ${JSON.stringify(compact)}`;

  try {
    const raw = await geminiChat(prompt, 45_000);
    const parsed = briefSchema.parse(parseJsonObject(raw));
    const known = new Set(sources.map((s) => s.id));
    const findings = parsed.findings
      .map((f) => ({
        ...f,
        evidenceIds: f.evidenceIds.filter((id) => known.has(id)),
      }))
      .filter((f) => f.evidenceIds.length > 0);
    return {
      summary: parsed.summary,
      findings: findings.length ? findings : thinBrief(query, sources).findings,
      openQuestions: parsed.openQuestions,
      angles: parsed.angles,
    };
  } catch (err) {
    console.warn("[research] synthesize", err instanceof Error ? err.message : err);
    return thinBrief(query, sources);
  }
}

async function deepCornerNotes(
  query: string,
): Promise<{ notes: string; degraded: string[] }> {
  if (!hasGoogleKey()) {
    return { notes: "", degraded: ["gemini deep research offline"] };
  }
  try {
    const raw = await geminiDeepResearch(
      `Research topic: ${JSON.stringify(query)}
Find lesser-known but real public sources: papers, agency reports, niche forums, archival news, primary docs.
Return plain text notes only. Each bullet must name a real source or URL you retrieved.
If you cannot verify something, omit it. Never invent.`,
      90_000,
    );
    return { notes: raw.slice(0, 6000), degraded: [] };
  } catch (err) {
    console.warn("[research] deep", err instanceof Error ? err.message : err);
    return { notes: "", degraded: ["gemini deep research offline"] };
  }
}

/** Parallel gather + evidence-only brief for the Research desk. */
export async function researchTopic(rawQuery: string): Promise<ResearchPayload> {
  const query = rawQuery.trim().slice(0, 200);
  if (!query) {
    return {
      query: "",
      updatedAt: new Date().toISOString(),
      summary: "",
      findings: [],
      openQuestions: [],
      angles: [],
      sources: [],
      degraded: [],
      thin: true,
      droppedCount: 0,
      dropped: [],
      senses: [],
      defaultSenseId: null,
    };
  }

  const degraded: string[] = [];
  const [wiki, ddg, hn, reddit, x, papers, preprints, patents, deep] = await Promise.all([
    settle("wikipedia", () => wikipedia(query), degraded),
    settle("web", () => duckDuckGo(query), degraded),
    settle("hn", () => searchHn(query, 12), degraded),
    settle("reddit", () => searchReddit(query), degraded),
    settle("x", () => fetchX(undefined, query), degraded),
    settle("pubmed", () => pubmed(query), degraded),
    settle("arxiv", () => arxiv(query), degraded),
    settle("uspto", () => uspto(query), degraded),
    deepCornerNotes(query),
  ]);

  degraded.push(...deep.degraded);

  const sources: ResearchSource[] = [
    ...(wiki ?? []),
    ...(ddg ?? []),
    ...(papers ?? []),
    ...(preprints ?? []),
    ...(patents ?? []),
    ...postsToSources("hn", hn ?? [], 10),
    ...postsToSources("reddit", reddit ?? [], 10),
    ...postsToSources("x", x ?? [], 8),
  ];

  if (!(x ?? []).length) {
    const trends = await fetchGoogleTrendsSafe("all", query);
    if (trends.length) {
      sources.push(...postsToSources("public", trends, 8));
      const i = degraded.indexOf("x offline");
      if (i >= 0) degraded[i] = "x offline · google trends fallback";
      else degraded.push("x offline · google trends fallback");
    }
  }

  if (deep.notes) {
    sources.push({
      id: sourceId("web", 90),
      kind: "web",
      title: `Deep pass notes · ${query}`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: deep.notes.slice(0, 900),
    });
  }

  const seen = new Set<string>();
  const deduped = sources.filter((s) => {
    const key = s.url || `${s.kind}:${s.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(s.title);
  });

  const pack = packResearch(query, deduped);
  const brief = await synthesize(query, pack.defaultSources);
  const known = new Set(pack.defaultSources.map((s) => s.id));
  const findings = brief.findings.filter((f) => f.evidenceIds.some((id) => known.has(id)));
  const thin =
    pack.kept.length < 4 ||
    findings.every((f) => f.confidence === "thin") ||
    Boolean(deep.degraded.length && pack.kept.length < 6);

  return {
    query,
    updatedAt: new Date().toISOString(),
    summary: pack.summary,
    findings: findings.length ? findings : brief.findings,
    openQuestions: pack.openQuestions,
    angles: pack.angles,
    sources: stampSources(pack.kept),
    degraded: [...new Set(degraded)],
    thin,
    droppedCount: pack.droppedCount,
    dropped: pack.dropped,
    senses: pack.senses,
    defaultSenseId: pack.defaultSense?.id ?? null,
  };
}
