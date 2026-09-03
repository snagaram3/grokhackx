import { searchHn } from "./hn";
import { loadInsightRoot, mergePatents, saveInsightRoot, type CachedRoot } from "./insights-store";
import { slug } from "./metrics";
import { tokenHits } from "./phrase-hit";
import type {
  OriginLag,
  RootLayer,
  RootParent,
  RootReceipt,
  RootSense,
  RootTrace,
} from "./insights-types";

const UA = "HawkxAI/1.0 (+https://github.com/snagaram3/grokhackx)";

const HIDDEN_CAT =
  /^(All |Articles |Wikipedia|Pages |CS1|Use dmy|Use mdy|Short description|Webarchive|Good articles|Featured )/i;

const EXTRACT_YEAR =
  /(?:since|introduced in|first (?:sold|produced|released|launched|published|appeared|introduced) in|founded in|established in|began in)\s+(1[89]\d{2}|20\d{2})\b/i;

const PARENT_YEAR = /(?:introduced|established|founded|launched) in (1[89]\d{2}|20\d{2})\b/i;

export interface WikiPage {
  title: string;
  url: string;
  extract: string;
  senses: { title: string; url: string }[];
}

export interface WikiRoot {
  firstAt: string | null;
  firstEditor: string | null;
  parents: string[];
}

export interface RootEvidence {
  query: string;
  wiki: WikiPage | null;
  wikiRoot: WikiRoot | null;
  abstract: { title: string; url: string; snippet: string } | null;
  dated: RootReceipt[];
  tape: RootReceipt[];
  inceptionAt: string | null;
  inceptionSource: OriginLag["claimedSource"] | null;
  inceptionUrl: string | null;
  degraded: string[];
}

function validTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function yearIso(year: number): string {
  return `${year}-01-01T00:00:00.000Z`;
}

export function keepCategory(name: string): boolean {
  const n = name.replace(/^Category:/, "").trim();
  if (n.length < 3) return false;
  return !HIDDEN_CAT.test(n);
}

export function oldestReceipt(receipts: RootReceipt[]): RootReceipt | null {
  let best: RootReceipt | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const r of receipts) {
    const t = validTime(r.at);
    if (t === null || t >= bestT) continue;
    bestT = t;
    best = r;
  }
  return best;
}

export function extractBirthYear(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(EXTRACT_YEAR);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1800 && y <= 2100 ? y : null;
}

export function inceptionFromParents(parents: string[]): number | null {
  for (const p of parents) {
    const m = p.match(PARENT_YEAR);
    if (!m) continue;
    const y = Number(m[1]);
    if (y >= 1800 && y <= 2100) return y;
  }
  return null;
}

export function pickSenseTitle(
  senses: { title: string; url: string }[],
  senseId: string | null | undefined,
): { title: string; url: string } | null {
  if (!senses.length) return null;
  if (!senseId) return senses[0];
  const want = senseId.trim().toLowerCase();
  return (
    senses.find((s) => slug(s.title) === want || s.title.toLowerCase() === want) ??
    senses[0]
  );
}

export function pickFirstRecord(
  wikiBirth: RootReceipt | null,
  dated: RootReceipt[],
): RootReceipt | null {
  const patents = dated.filter((r) => r.source === "uspto");
  const oldestPatent = oldestReceipt(patents);
  const oldestAll = oldestReceipt([wikiBirth, ...dated].filter((r): r is RootReceipt => Boolean(r)));
  if (!oldestPatent) return oldestAll;
  const patentT = validTime(oldestPatent.at);
  const wikiT = validTime(wikiBirth?.at);
  if (patentT !== null && (wikiT === null || patentT <= wikiT)) return oldestPatent;
  return oldestAll;
}

export function measureOriginLag(
  claimedAt: string | null,
  claimedSource: OriginLag["claimedSource"] | null,
  claimedUrl: string | null,
  firstRecordAt: string | null,
): OriginLag | null {
  const claimedT = validTime(claimedAt);
  const recordT = validTime(firstRecordAt);
  if (!claimedAt || !claimedSource || !firstRecordAt || claimedT === null || recordT === null) return null;
  const lagYears = new Date(recordT).getUTCFullYear() - new Date(claimedT).getUTCFullYear();
  if (lagYears < 1) return null;
  return {
    claimedAt,
    claimedSource,
    claimedUrl,
    firstRecordAt,
    lagYears,
  };
}

function onQuery(hay: string, query: string): boolean {
  return tokenHits(hay, query);
}

function toSenses(wiki: WikiPage | null): RootSense[] {
  return (wiki?.senses ?? []).map((s) => ({
    id: slug(s.title),
    label: s.title,
    url: s.url,
  }));
}

export function assembleRoots(evidence: RootEvidence): RootTrace {
  const query = evidence.query.trim();
  const wiki = evidence.wiki;
  const extract = wiki?.extract?.trim() || evidence.abstract?.snippet?.trim() || null;
  const originTitle = wiki?.title || evidence.abstract?.title || null;
  const originUrl = wiki?.url || evidence.abstract?.url || null;
  const senses = toSenses(wiki);
  const senseId = wiki ? slug(wiki.title) : senses[0]?.id ?? null;

  const parents: RootParent[] = (evidence.wikiRoot?.parents ?? [])
    .filter(keepCategory)
    .slice(0, 8)
    .map((label) => ({ label }));

  const datedOnQuery = evidence.dated.filter((r) => onQuery(`${r.title} ${r.snippet}`, query));
  const wikiBirth: RootReceipt | null =
    wiki && evidence.wikiRoot?.firstAt
      ? {
          title: `${wiki.title} · first encyclopedia revision`,
          url: wiki.url,
          source: "wikipedia",
          at: evidence.wikiRoot.firstAt,
          snippet: evidence.wikiRoot.firstEditor
            ? `First Wikipedia revision by ${evidence.wikiRoot.firstEditor}`
            : "First Wikipedia revision",
        }
      : null;

  const firstRecord = pickFirstRecord(wikiBirth, datedOnQuery);

  const tapeOnQuery = evidence.tape.filter((r) => onQuery(`${r.title} ${r.snippet}`, query));
  const tapeFirst = oldestReceipt(tapeOnQuery);

  const receipts = [...datedOnQuery, ...tapeOnQuery, ...(wikiBirth ? [wikiBirth] : [])]
    .filter((r, i, all) => all.findIndex((x) => x.url === r.url && x.at === r.at) === i)
    .toSorted((a, b) => (validTime(a.at) ?? Infinity) - (validTime(b.at) ?? Infinity))
    .slice(0, 16);

  const originLag = measureOriginLag(
    evidence.inceptionAt,
    evidence.inceptionSource,
    evidence.inceptionUrl,
    firstRecord?.at ?? null,
  );

  const layers: RootLayer[] = [];
  layers.push({
    id: "plug",
    kind: "plug",
    depth: 0,
    label: query,
    detail: "What you plugged. Not a search ranking — a taproot.",
  });

  const otherSenses = senses.filter((s) => s.label !== wiki?.title);
  if (otherSenses.length) {
    layers.push({
      id: "sense",
      kind: "sense",
      depth: 1,
      label: wiki?.title ?? query,
      detail: `This well is “${wiki?.title ?? query}”. Other senses: ${otherSenses.map((s) => s.label).join(" · ")}.`,
    });
  }

  if (tapeFirst) {
    layers.push({
      id: "tape",
      kind: "tape",
      depth: 2,
      label: "Earliest conversation in this pull",
      detail: tapeFirst.title,
      receipt: tapeFirst,
    });
  }

  if (extract && originTitle) {
    layers.push({
      id: "origin",
      kind: "origin",
      depth: 3,
      label: originTitle,
      detail: extract.slice(0, 420),
      receipt: originUrl
        ? { title: originTitle, url: originUrl, source: "wikipedia", at: null, snippet: extract.slice(0, 280) }
        : undefined,
    });
  }

  if (parents.length) {
    layers.push({
      id: "parent",
      kind: "parent",
      depth: 4,
      label: parents.map((p) => p.label).join(" · "),
      detail: "Encyclopedia categories this page sits in — the family, not invented neighbors.",
    });
  }

  if (firstRecord) {
    const product = firstRecord.source === "uspto";
    layers.push({
      id: "first-record",
      kind: "first-record",
      depth: 5,
      label: firstRecord.at
        ? `${product ? "First product grant" : "First dated record"} · ${firstRecord.at.slice(0, 10)}`
        : product
          ? "First product grant"
          : "First dated record",
      detail: firstRecord.title,
      receipt: firstRecord,
    });
  }

  if (originLag) {
    layers.push({
      id: "lag",
      kind: "lag",
      depth: 6,
      label: `${originLag.lagYears}y between claimed origin and first dated receipt`,
      detail: `${originLag.claimedSource} ${originLag.claimedAt.slice(0, 4)} · first receipt ${originLag.firstRecordAt.slice(0, 10)}. Measured gap — not a WHY.`,
    });
  }

  const thin = !extract && !firstRecord;

  return {
    query,
    updatedAt: new Date().toISOString(),
    originTitle,
    originExtract: extract,
    originUrl,
    layers,
    parents,
    firstRecord,
    tapeFirst,
    receipts,
    senses,
    senseId,
    originLag,
    degraded: [...new Set(evidence.degraded)],
    thin,
  };
}

async function settle<T>(label: string, run: () => Promise<T>, degraded: string[]): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.warn(`[insights-roots] ${label}`, err instanceof Error ? err.message : err);
    degraded.push(`${label} offline`);
    return null;
  }
}

async function wikipediaPage(query: string, senseId?: string | null): Promise<WikiPage | null> {
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
  if (!titles.length) return null;

  const senses = titles.slice(0, 5).map((t, i) => ({
    title: t,
    url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}`,
  }));
  const chosen = pickSenseTitle(senses, senseId) ?? senses[0];
  const pageUrl = chosen.url;
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(chosen.title.replace(/ /g, "_"))}`;
  const summaryRes = await fetch(summaryUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  let extract = "";
  let display = chosen.title;
  let url = pageUrl;
  if (summaryRes.ok) {
    const page = (await summaryRes.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    display = page.title || chosen.title;
    extract = (page.extract || "").slice(0, 720);
    url = page.content_urls?.desktop?.page || pageUrl;
  }

  return { title: display, url, extract, senses };
}

async function wikipediaRoot(title: string): Promise<WikiRoot> {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const revUrl =
    `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encoded}` +
    `&rvlimit=1&rvdir=newer&rvprop=timestamp|user&format=json&origin=*`;
  const catUrl =
    `https://en.wikipedia.org/w/api.php?action=query&prop=categories&clshow=!hidden` +
    `&titles=${encoded}&cllimit=16&format=json&origin=*`;

  const [revRes, catRes] = await Promise.all([
    fetch(revUrl, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    }),
    fetch(catUrl, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    }),
  ]);

  let firstAt: string | null = null;
  let firstEditor: string | null = null;
  if (revRes.ok) {
    const rev = (await revRes.json()) as {
      query?: { pages?: Record<string, { revisions?: { timestamp?: string; user?: string }[] }> };
    };
    const page = Object.values(rev.query?.pages ?? {})[0];
    const r0 = page?.revisions?.[0];
    firstAt = r0?.timestamp ?? null;
    firstEditor = r0?.user ?? null;
  }

  const parents: string[] = [];
  if (catRes.ok) {
    const cat = (await catRes.json()) as {
      query?: { pages?: Record<string, { categories?: { title?: string }[] }> };
    };
    const page = Object.values(cat.query?.pages ?? {})[0];
    for (const c of page?.categories ?? []) {
      const label = (c.title ?? "").replace(/^Category:/, "");
      if (keepCategory(label)) parents.push(label);
    }
  }

  return { firstAt, firstEditor, parents };
}

export function wikidataTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/([+-]?\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  if (!Number.isFinite(year) || year < 1800 || year > 2100) return null;
  return yearIso(year);
}

async function wikidataInception(title: string): Promise<{ at: string; url: string; patents: RootReceipt[] } | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const propsUrl =
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item` +
    `&titles=${encoded}&format=json&origin=*`;
  const propsRes = await fetch(propsUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!propsRes.ok) throw new Error(`wikidata item ${propsRes.status}`);
  const props = (await propsRes.json()) as {
    query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> };
  };
  const qid = Object.values(props.query?.pages ?? {})[0]?.pageprops?.wikibase_item;
  if (!qid) return null;

  const entUrl =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}` +
    `&props=claims&format=json&origin=*`;
  const entRes = await fetch(entUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
  });
  if (!entRes.ok) throw new Error(`wikidata entity ${entRes.status}`);
  const ent = (await entRes.json()) as {
    entities?: Record<
      string,
      {
        claims?: Record<
          string,
          { mainsnak?: { datavalue?: { value?: { time?: string } | string } } }[]
        >;
      }
    >;
  };
  const claims = ent.entities?.[qid]?.claims ?? {};
  const inceptionClaim = claims.P571?.[0] ?? claims.P580?.[0] ?? claims.P569?.[0];
  const timeRaw =
    inceptionClaim && typeof inceptionClaim.mainsnak?.datavalue?.value === "object"
      ? inceptionClaim.mainsnak.datavalue.value.time
      : undefined;
  const at = wikidataTime(timeRaw);
  const patents: RootReceipt[] = [];
  for (const row of claims.P1246 ?? []) {
    const num = row.mainsnak?.datavalue?.value;
    if (typeof num !== "string" || num.length < 4) continue;
    const clean = num.replace(/\s+/g, "");
    patents.push({
      title: `${title} · USPTO ${clean}`,
      url: `https://patents.google.com/patent/${encodeURIComponent(clean)}`,
      source: "uspto",
      at: null,
      snippet: `Wikidata patent ${clean}`,
    });
  }
  if (!at && !patents.length) return null;
  return {
    at: at ?? patents[0]?.at ?? "",
    url: `https://www.wikidata.org/wiki/${qid}`,
    patents,
  };
}

async function duckAbstract(query: string): Promise<{ title: string; url: string; snippet: string } | null> {
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
  };
  if (!data.Abstract || !data.AbstractURL) return null;
  return {
    title: (data.Heading || query).slice(0, 160),
    url: data.AbstractURL,
    snippet: data.Abstract.slice(0, 480),
  };
}

export function patentsFromLegacy(data: unknown): RootReceipt[] {
  const patents = (data as { patents?: { patent_number?: string; patent_title?: string; patent_date?: string; patent_abstract?: string }[] })
    .patents;
  const out: RootReceipt[] = [];
  for (const p of patents ?? []) {
    if (!p.patent_number || !p.patent_title) continue;
    out.push({
      title: p.patent_title.slice(0, 220),
      url: `https://patents.google.com/patent/US${p.patent_number}`,
      source: "uspto",
      at: p.patent_date || null,
      snippet: (p.patent_abstract || `USPTO ${p.patent_number}`).slice(0, 280),
    });
  }
  return out;
}

export function patentsFromV2(data: unknown): RootReceipt[] {
  const rows = (data as { patents?: { patent_id?: string; patent_title?: string; patent_date?: string; patent_abstract?: string }[] }).patents;
  const out: RootReceipt[] = [];
  for (const p of rows ?? []) {
    if (!p.patent_id || !p.patent_title) continue;
    out.push({
      title: p.patent_title.slice(0, 220),
      url: `https://patents.google.com/patent/${p.patent_id}`,
      source: "uspto",
      at: p.patent_date || null,
      snippet: (p.patent_abstract || `USPTO ${p.patent_id}`).slice(0, 280),
    });
  }
  return out;
}

async function usptoDated(query: string): Promise<RootReceipt[]> {
  const q = JSON.stringify({ _text_any: { patent_title: query } });
  const legacy =
    `https://api.patentsview.org/patents/query?q=${encodeURIComponent(q)}` +
    `&f=["patent_number","patent_title","patent_date","patent_abstract"]&o={"per_page":5}`;
  const v2 =
    `https://search.patentsview.org/api/v1/patent/?q=${encodeURIComponent(q)}` +
    `&f=["patent_id","patent_title","patent_date","patent_abstract"]&o={"size":5}`;

  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": UA };
  const key = process.env.PATENTS_VIEW_KEY?.trim();
  if (key) headers["X-Api-Key"] = key;

  const errors: string[] = [];
  for (const [url, parse] of [
    [legacy, patentsFromLegacy],
    [v2, patentsFromV2],
  ] as const) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(14_000),
      });
      if (!res.ok) {
        errors.push(`${res.status}`);
        continue;
      }
      const rows = parse(await res.json());
      if (rows.length) return rows;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "fail");
    }
  }
  throw new Error(`uspto ${errors.join(" · ") || "empty"}`);
}

async function pubmedDated(query: string): Promise<RootReceipt[]> {
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed` +
    `&term=${encodeURIComponent(query)}&retmax=6&retmode=json&sort=pub_date`;
  const searchRes = await fetch(searchUrl, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(15_000),
  });
  if (!searchRes.ok) throw new Error(`pubmed ${searchRes.status}`);
  const search = (await searchRes.json()) as { esearchresult?: { idlist?: string[] } };
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
  const out: RootReceipt[] = [];
  for (const id of ids) {
    const row = result[id];
    if (!row || Array.isArray(row) || !row.title) continue;
    const at = row.sortpubdate ? row.sortpubdate.replace(" ", "T") : null;
    out.push({
      title: row.title.slice(0, 220),
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: "pubmed",
      at,
      snippet: [row.source, row.sortpubdate].filter(Boolean).join(" · ").slice(0, 280),
    });
  }
  return out;
}

async function hnTape(query: string): Promise<RootReceipt[]> {
  const posts = await searchHn(query, 20);
  return posts.slice(0, 12).map((p) => ({
    title: p.title.slice(0, 200),
    url: p.url,
    source: "hn",
    at: p.createdAt || null,
    snippet: p.title.slice(0, 280),
  }));
}

export function resolveInception(
  wiki: WikiPage | null,
  wikiRoot: WikiRoot | null,
  wikidata: { at: string; url: string } | null,
  cached: CachedRoot | null,
): { at: string | null; source: OriginLag["claimedSource"] | null; url: string | null } {
  if (wikidata?.at) return { at: wikidata.at, source: "wikidata", url: wikidata.url };
  if (cached?.inceptionAt && cached.inceptionSource) {
    return { at: cached.inceptionAt, source: cached.inceptionSource, url: cached.inceptionUrl };
  }
  const parentYear = inceptionFromParents(wikiRoot?.parents ?? []);
  if (parentYear) return { at: yearIso(parentYear), source: "category", url: wiki?.url ?? null };
  const extractYear = extractBirthYear(wiki?.extract);
  if (extractYear) return { at: yearIso(extractYear), source: "extract", url: wiki?.url ?? null };
  return { at: null, source: null, url: null };
}

export async function traceRoots(query: string, senseId?: string | null): Promise<RootTrace> {
  const q = query.trim();
  const degraded: string[] = [];
  const wiki = await settle("wikipedia", () => wikipediaPage(q, senseId), degraded);
  const senseKey = wiki?.title ?? senseId ?? "";
  const cached = await loadInsightRoot(q, senseKey);

  let wikiRoot: WikiRoot | null = cached?.firstAt
    ? {
        firstAt: cached.firstAt,
        firstEditor: cached.firstEditor,
        parents: cached.parents.length ? cached.parents : [],
      }
    : null;
  if (!wikiRoot && wiki) {
    wikiRoot = await settle("wikipedia-root", () => wikipediaRoot(wiki.title), degraded);
  } else if (wiki && cached && cached.parents.length === 0) {
    const live = await settle("wikipedia-root", () => wikipediaRoot(wiki.title), degraded);
    if (live) wikiRoot = live;
  }

  const [abstract, livePatents, papers, tape, wikidata] = await Promise.all([
    settle("web", () => duckAbstract(q), degraded),
    settle("uspto", () => usptoDated(q), []),
    settle("pubmed", () => pubmedDated(q), degraded),
    settle("hn", () => hnTape(q), degraded),
    wiki ? settle("wikidata", () => wikidataInception(wiki.title), degraded) : Promise.resolve(null),
  ]);

  const patents = mergePatents(cached?.patents ?? [], [
    ...(livePatents ?? []),
    ...(wikidata?.patents ?? []),
  ]);
  if (!livePatents && !cached?.patents.length && !wikidata?.patents.length) {
    degraded.push("uspto offline");
  } else if (!livePatents && patents.length) {
    degraded.push("uspto offline · cached grants");
  }

  const inception = resolveInception(wiki, wikiRoot, wikidata, cached);

  if (wiki && (wikiRoot?.firstAt || patents.length || inception.at)) {
    void saveInsightRoot(q, senseKey, {
      wikiTitle: wiki.title,
      wikiUrl: wiki.url,
      firstAt: wikiRoot?.firstAt ?? cached?.firstAt ?? null,
      firstEditor: wikiRoot?.firstEditor ?? cached?.firstEditor ?? null,
      parents: wikiRoot?.parents?.length ? wikiRoot.parents : cached?.parents ?? [],
      patents,
      inceptionAt: inception.at,
      inceptionSource: inception.source,
      inceptionUrl: inception.url,
      cachedAt: new Date().toISOString(),
    });
  }

  return assembleRoots({
    query: q,
    wiki,
    wikiRoot,
    abstract,
    dated: [...patents, ...(papers ?? [])],
    tape: tape ?? [],
    inceptionAt: inception.at,
    inceptionSource: inception.source,
    inceptionUrl: inception.url,
    degraded,
  });
}
