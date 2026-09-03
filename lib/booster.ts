import { divergenceLabel } from "./ui-helpers";
import { totalScore } from "./metrics";
import { buildCausation, classifyTopic } from "./desk";
import { payloadFromQrImageUrl } from "./qr";
import { buildSentiment } from "./sentiment";
import {
  detectRiskClustering,
  generatePredictionSummary,
  predictCampaignArc,
  predictPeakTime,
  predictPlatformSpread,
} from "./predictions";
import {
  PLATFORMS,
  type AgeLens,
  type AgeTranslation,
  type BoosterPayload,
  type BoosterTopicBrief,
  type CampaignMove,
  type CapturedArtifact,
  type Improvisation,
  type Platform,
  type Topic,
  type TrendsPayload,
} from "./types";

const HASHTAG_RE = /#[\p{L}\p{N}_]{2,48}/gu;
const CASHTAG_RE = /\$[A-Z]{1,5}\b/g;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const QR_HINT_RE =
  /(?:utm_medium=qr|qr\.code|qrcode|qrs\.ly|qrco\.de|goqr|scan\s+this\s+qr|scan\s+the\s+qr)/i;
const SHORT_LINK_RE =
  /https?:\/\/(?:bit\.ly|t\.co|tinyurl\.com|lnkd\.in|qrco\.de|qrs\.ly|goo\.gl|ow\.ly)\/[^\s<>"']+/i;

const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "about", "your",
  "their", "what", "when", "where", "which", "while", "after", "before", "over",
  "under", "than", "then", "just", "more", "most", "some", "have", "been",
  "will", "would", "could", "should", "they", "them", "were", "was", "are",
  "not", "but", "you", "our", "its", "a", "an", "of", "to", "in", "on", "at",
  "by", "or", "as", "is", "it", "be", "we", "i", "if", "so", "no", "yes",
]);

const CONTROVERSY = [
  "lawsuit", "ban", "hack", "leak", "crash", "layoff", "war", "scam",
  "outage", "recall", "boycott", "protest", "death", "killed", "abuse",
];

const AGE_META: Record<AgeLens, { label: string }> = {
  kids: { label: "Family" },
  "gen-z": { label: "18–24" },
  millennial: { label: "25–40" },
  "gen-x": { label: "41–56" },
  boomer: { label: "57+" },
};

export const AUDIENCE_OPTIONS: { id: AgeLens | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kids", label: "Family" },
  { id: "gen-z", label: "18–24" },
  { id: "millennial", label: "25–40" },
  { id: "gen-x", label: "41–56" },
  { id: "boomer", label: "57+" },
];

function allMatches(re: RegExp, text: string): string[] {
  const copy = new RegExp(re.source, re.flags);
  return [...text.matchAll(copy)].map((m) => m[0]);
}

function blobOf(topic: Topic): string {
  const posts = Object.values(topic.platforms).flatMap((s) => s.posts);
  return [topic.label, ...posts.map((p) => `${p.title} ${p.url}`)].join(" ");
}

function postsOf(topic: Topic) {
  return Object.values(topic.platforms).flatMap((s) => s.posts);
}

function platformsFor(topic: Topic, test: (text: string) => boolean): Platform[] {
  const hit: Platform[] = [];
  for (const p of PLATFORMS) {
    const slice = topic.platforms[p];
    const text = [topic.label, ...slice.posts.map((x) => `${x.title} ${x.url}`)].join(" ");
    if (slice.score > 0 && test(text)) hit.push(p);
  }
  return hit;
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function phrasesFrom(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const grams: string[] = [];
  for (let n = 3; n >= 2; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      grams.push(words.slice(i, i + n).join(" "));
    }
  }
  return grams;
}

export function captureArtifacts(topic: Topic): CapturedArtifact[] {
  const blob = blobOf(topic);
  const counts = new Map<string, CapturedArtifact>();

  const bump = (
    kind: CapturedArtifact["kind"],
    value: string,
    platforms: Platform[],
  ) => {
    const key = `${kind}:${value.toLowerCase()}`;
    const prev = counts.get(key);
    if (prev) {
      prev.mentions += 1;
      for (const p of platforms) {
        if (!prev.platforms.includes(p)) prev.platforms.push(p);
      }
      return;
    }
    counts.set(key, { kind, value, mentions: 1, platforms: [...platforms] });
  };

  for (const tag of allMatches(HASHTAG_RE, blob)) {
    bump("hashtag", tag, platformsFor(topic, (t) => t.toLowerCase().includes(tag.toLowerCase())));
  }
  for (const cash of allMatches(CASHTAG_RE, blob)) {
    bump("ticker", cash, platformsFor(topic, (t) => t.includes(cash)));
  }
  for (const tk of topic.tickers) {
    bump("ticker", `$${tk.symbol.replace("$", "")}`, platformsFor(topic, () => true));
  }

  const urls = allMatches(URL_RE, blob);
  for (const raw of urls) {
    const url = raw.replace(/[).,]+$/, "");
    const plats = platformsFor(topic, (t) => t.includes(url));
    const qrPayload = payloadFromQrImageUrl(url);
    if (qrPayload) {
      bump("qr", qrPayload, plats);
    } else if (QR_HINT_RE.test(url) || SHORT_LINK_RE.test(url) || /utm_medium=qr/i.test(url)) {
      bump("qr", url, plats);
    } else {
      bump("url", url, plats);
    }
  }
  if (QR_HINT_RE.test(blob) && ![...counts.values()].some((a) => a.kind === "qr")) {
    bump("qr", "QR campaign mentioned (no scannable payload yet)", platformsFor(topic, (t) => QR_HINT_RE.test(t)));
  }

  const gramCounts = new Map<string, number>();
  for (const g of phrasesFrom(blob)) {
    gramCounts.set(g, (gramCounts.get(g) ?? 0) + 1);
  }
  const rankedPhrases = [...gramCounts.entries()].toSorted(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length,
  );
  const minCount = rankedPhrases.some(([, n]) => n >= 2) ? 2 : 1;
  for (const [phrase] of rankedPhrases.filter(([, n]) => n >= minCount).slice(0, 4)) {
    bump("phrase", phrase, platformsFor(topic, (t) => t.toLowerCase().includes(phrase)));
  }

  return [...counts.values()]
    .toSorted((a, b) => b.mentions - a.mentions)
    .slice(0, 12);
}

export function whyTrending(topic: Topic, artifacts: CapturedArtifact[]): { why: string; confidence: number } {
  const div = divergenceLabel(topic);
  const score = totalScore(topic);
  const active = PLATFORMS.filter((p) => topic.platforms[p]?.score > 0);
  const tags = artifacts.filter((a) => a.kind === "hashtag").slice(0, 3).map((a) => a.value);
  const domains = artifacts
    .filter((a) => a.kind === "url" || a.kind === "qr")
    .map((a) => domainOf(a.value))
    .filter((d): d is string => Boolean(d));
  const uniqueDomains = [...new Set(domains)].slice(0, 2);

  const parts: string[] = [];
  if (topic.velocity === "rising" && topic.divergence >= 0.66) {
    parts.push(`Breaking first as a ${div}. Other sources have not caught up — early window.`);
  } else if (topic.velocity === "rising") {
    parts.push(`Rising and ${div}. Heat is spread across sources, not a single spike.`);
  } else if (topic.velocity === "peaking") {
    parts.push(`At peak attention (${div}). Cheap to amplify, expensive to originate.`);
  } else {
    parts.push(`Cooling (${div}). Better as a recap than a new launch.`);
  }

  if (active.length) parts.push(`Print on ${active.join(", ")}.`);
  if (tags.length) parts.push(`In play: ${tags.join(" ")}.`);
  if (uniqueDomains.length) parts.push(`Traffic on ${uniqueDomains.join(", ")}.`);
  if (topic.peakHourCT) parts.push(`Usual peak ${topic.peakHourCT} CT.`);

  const evidence = postsOf(topic).length + artifacts.length;
  const confidence = Math.max(0.25, Math.min(0.92, 0.35 + evidence * 0.06 + (score > 80 ? 0.1 : 0)));
  if (postsOf(topic).length === 0) {
    return {
      why: "Signal is thin — label only, no receipt posts. Do not invent a why.",
      confidence: 0.2,
    };
  }
  return { why: parts.join(" "), confidence: Number(confidence.toFixed(2)) };
}

function controversyHit(topic: Topic): boolean {
  const blob = blobOf(topic).toLowerCase();
  return CONTROVERSY.some((w) => blob.includes(w));
}

export function campaignMove(topic: Topic, artifacts: CapturedArtifact[]): CampaignMove {
  const hot = artifacts.find((a) => a.kind === "hashtag")?.value ?? topic.label;
  const risky = controversyHit(topic);
  if (topic.velocity === "fading") {
    return {
      angle: "Recap, don't launch",
      forCompetitors: `Use "${hot}" as context in an explainer. Do not drop a new campaign into a cooling wave.`,
      risk: risky ? "high" : "medium",
      timing: "fading",
      hook: "Recap what changed. Do not launch into a cooling wave.",
    };
  }
  if (topic.divergence >= 0.66) {
    return {
      angle: "Win the source that's moving first",
      forCompetitors: `Stay native to the ${divergenceLabel(topic)}. Bridge to a product need — don't copy the post.`,
      risk: risky ? "high" : "low",
      timing: topic.velocity,
      hook: "Still local. Be useful on the source that's moving first.",
    };
  }
  return {
    angle: "Sell the job underneath",
    forCompetitors: `Answer the job behind "${topic.label}" (speed, trust, status, safety). Repeating the phrase without proof looks late.`,
    risk: risky ? "high" : topic.velocity === "peaking" ? "medium" : "low",
    timing: topic.velocity,
    hook: `${topic.velocity[0].toUpperCase()}${topic.velocity.slice(1)} — lead with a proof point, not a slogan.`,
  };
}

export function ageTranslations(topic: Topic): AgeTranslation[] {
  const label = topic.label;
  return (Object.keys(AGE_META) as AgeLens[]).map((lens) => {
    const meta = AGE_META[lens];
    const takeaway =
      lens === "kids"
        ? `“${label}” is in the news. Don’t scan unknown QR codes or links without a parent.`
        : lens === "gen-z"
          ? `“${label}” is moving now. Only jump in if you have a real point of view.`
          : lens === "millennial"
            ? `“${label}” is up. Check if it changes a purchase, commute, or bill before spending time on it.`
            : lens === "gen-x"
              ? `“${label}” is ${topic.velocity}. Look for a product, policy, or outage — skip the noise.`
              : `“${label}” is ${topic.velocity}. Practical angle: news, money, or family plans.`;
    return { lens, label: meta.label, takeaway };
  });
}

export function topicRisk(topic: Topic): CampaignMove["risk"] {
  const blob = blobOf(topic).toLowerCase();
  if (CONTROVERSY.some((w) => blob.includes(w))) return "high";
  if (topic.velocity === "fading") return "medium";
  if (topic.velocity === "peaking") return "medium";
  return "low";
}

export function boostTopic(topic: Topic): BoosterTopicBrief {
  const artifacts = captureArtifacts(topic);
  const { why, confidence } = whyTrending(topic, artifacts);
  const sentiment = buildSentiment(topic);
  const tone =
    sentiment.lean === "pos"
      ? ` Titles lean positive (${sentiment.overall.pos}/${sentiment.overall.n}).`
      : sentiment.lean === "neg"
        ? ` Titles lean negative (${sentiment.overall.neg}/${sentiment.overall.n}).`
        : sentiment.thin
          ? ""
          : ` Titles are split (${sentiment.overall.pos} pos / ${sentiment.overall.neg} neg).`;

  const brief: BoosterTopicBrief = {
    topicId: topic.id,
    whyTrending: why + tone,
    confidence,
    category: classifyTopic(topic, artifacts),
    artifacts,
    audiences: ageTranslations(topic),
    campaign: campaignMove(topic, artifacts),
    causation: buildCausation(topic, artifacts),
    sentiment,
  };

  // Generate world-class predictions
  const peakTime = predictPeakTime(topic);
  const platformSpread = predictPlatformSpread(topic, brief);
  const campaignArc = predictCampaignArc(topic, brief);
  const riskAlert = detectRiskClustering(topic, sentiment);
  const summary = generatePredictionSummary(topic, brief);

  brief.predictions = {
    peakTime,
    platformSpread,
    campaignArc,
    riskAlert,
    summary,
  };

  return brief;
}

export function improvisationsFor(payload: TrendsPayload, briefs: BoosterTopicBrief[]): Improvisation[] {
  const items: Improvisation[] = [];
  const allArtifacts = briefs.flatMap((b) => b.artifacts);
  const hashtags = allArtifacts.filter((a) => a.kind === "hashtag");
  const qrs = allArtifacts.filter((a) => a.kind === "qr");
  const qrDecoded = qrs.some((a) => !/^https?:/i.test(a.value) && !/mentioned/i.test(a.value));
  const bubbles = payload.topics.filter((t) => t.divergence >= 0.66).length;

  items.push({
    priority: "P0",
    title: "Tag Camry occupiers for occupancy HistGB",
    why: "Next-window HistGB is live; occupancy still uses host-class L1 until 20 gold inspect tags.",
    next: "On Watch inspect, mark occupiers Official / Occupied / Ignore. Camry first. Do not invent tags.",
  });

  if (payload.degraded.some((d) => d.includes("x") && !d.includes("google trends"))) {
    items.push({
      priority: "P0",
      title: "Stabilize X ingest",
      why: "Hashtag and QR campaigns mostly start on X. Offline X blinds the booster.",
      next: "Keep Gemini Google Search for X mentions. Google Trends RSS already fills public when X is empty.",
    });
  }
  if (payload.degraded.some((d) => d.includes("google trends"))) {
    items.push({
      priority: "P1",
      title: "Google Trends RSS is a thin X stand-in",
      why: "Daily search heat is not an X post. Phrase lookups stay empty unless the name is actually trending.",
      next: "Keep Gemini Google Search for X. Do not stamp Trends receipts as X.",
    });
  }
  if (payload.degraded.some((d) => d.includes("reddit"))) {
    items.push({
      priority: "P0",
      title: "Reddit fallback (OAuth or Pushshift-style)",
      why: "403s wipe phrase capture from the largest long-form platform.",
      next: "Authenticated Reddit client + cache last-good posts for 15m.",
    });
  }
  if (!payload.sources.public) {
    items.push({
      priority: "P0",
      title: "Public-API ingest is offline",
      why: "News, weather, crypto, and sports receipts come from the public-apis catalog. Without them WHY stays social-only.",
      next: "Retry GDELT/NWS/CoinGecko feeds; keep catalog cache so the allowlist still configures the desk.",
    });
  }
  if (hashtags.length < 3) {
    items.push({
      priority: "P0",
      title: "Ingest TikTok / Reels / Shorts caption text",
      why: "Almost no hashtags in HN/Reddit titles. Short-form campaigns are invisible.",
      next: "Set YOUTUBE_API_KEY for official Shorts titles. TikTok Display API still needs a brand OAuth grant — no unofficial scraper.",
    });
  }
  if (qrs.length === 0 && !qrDecoded) {
    items.push({
      priority: "P0",
      title: "QR image decode, not just QR-shaped URLs",
      why: "Campaigns hide the payload in images. Text regex cannot see a poster QR.",
      next: "Cap is 8 image fetches per ingest. Keep tagging Camry posters when they land — do not invent QR payloads.",
    });
  }
  if (bubbles >= 3) {
    items.push({
      priority: "P1",
      title: "Platform-native campaign studio",
      why: `${bubbles} topics are still single-platform bubbles — the cheapest time to act.`,
      next: "One-click brief: format + hook + risk for the bubbling network only.",
    });
  }
  if (bubbles >= 3) {
    items.push({
      priority: "P1",
      title: "Platform-native campaign studio",
      why: `${bubbles} topics are still single-platform bubbles — the cheapest time to act.`,
      next: "One-click brief: format + hook + risk for the bubbling network only.",
    });
  }
  if (!payload.topics.some((t) => t.tickers.length > 0)) {
    items.push({
      priority: "P1",
      title: "Finance overlay even without explicit tickers",
      why: "Competitors still need category ETFs / peers when $TICKER is absent.",
      next: "Map topic labels to a small industry lexicon (retail, AI, airlines) — never invent symbols.",
    });
  }
  const thinCausation = briefs.filter((b) => b.causation.thin).length;
  if (thinCausation >= 3) {
    items.push({
      priority: "P1",
      title: "Keep hourly snapshots writing",
      why: `${thinCausation} topics have fewer than two dated receipts — occurrence still needs time.`,
      next: "Confirm GET /api/collect?hourly=1 snaps watchlist phrases; TREND_DB_* keeps them across instances.",
    });
  }
  items.push({
    priority: "P2",
    title: "Wire the provisioned Postgres server",
      why: "Leaf calls currently land in the warm-instance memory store. Ten category databases are ready once credentials arrive.",
      next: "Set TREND_DB_HOST / USER / PASSWORD, run npm run provision:trend-db, confirm GET /api/collect says backend=postgres.",
    });

  const rank = { P0: 0, P1: 1, P2: 2 };
  return items.toSorted((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 8);
}

export function boostTrends(payload: TrendsPayload): BoosterPayload {
  const ranked = [...payload.topics].toSorted((a, b) => totalScore(b) - totalScore(a));
  const briefs = ranked.slice(0, 16).map(boostTopic);
  const improvisations = improvisationsFor(payload, briefs);
  const top = briefs[0];
  const summary = payload.plugged
    ? `“${payload.plugged}” footprint · ${payload.query?.hitCount ?? 0} live prints · ${top?.campaign.hook ?? "receipts only"}`
    : top
      ? `${payload.topics.find((t) => t.id === top.topicId)?.label ?? "Lead"} · ${top.campaign.risk} risk · ${top.campaign.hook}`
      : payload.query?.floor ?? "Look up a phrase to fill the desk.";
  return {
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: payload.updatedAt,
    summary,
    briefs,
    improvisations,
  };
}
