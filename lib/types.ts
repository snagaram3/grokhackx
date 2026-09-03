export const PLATFORMS = ["x", "reddit", "hn", "public"] as const;

export type Platform = (typeof PLATFORMS)[number];

export interface PostGeo {
  lat: number;
  lon: number;
  label: string;
}

export interface Post {
  platform: Platform;
  title: string;
  url: string;
  score: number;
  createdAt: string;
  sourceApi?: string;
  /** Proven coordinates from the source. Never geocoded from a title. */
  geo?: PostGeo;
  /** AutoLineage: which collect step produced this receipt. */
  tool?: string;
  /** AutoLineage: when that collect step wrote the receipt. */
  collectedAt?: string;
}

export interface PlatformSlice {
  score: number;
  posts: Post[];
}

export interface Ticker {
  symbol: string;
  sentiment: "pos" | "neg" | "mixed";
  mentions: number;
}

export interface Topic {
  id: string;
  label: string;
  platforms: Record<Platform, PlatformSlice>;
  velocity: "rising" | "peaking" | "fading";
  divergence: number;
  peakHourCT?: string;
  tickers: Ticker[];
  why?: string;
  match?: "exact" | "near" | "neighbor";
}

export interface SourceHealth {
  x: boolean;
  reddit: boolean;
  hn: boolean;
  public: boolean;
}

export interface PublicApiFeedStat {
  name: string;
  category: string;
  posts: number;
}

export interface PublicApiIngest {
  catalog: number;
  live: number;
  attempted: number;
  categories: string[];
  sources: string[];
  feeds?: PublicApiFeedStat[];
  topic?: string;
}

export type ExamplePoiIndustry =
  | "technology"
  | "finance"
  | "healthcare"
  | "retail"
  | "automotive"
  | "real-estate"
  | "entertainment"
  | "education"
  | "hospitality"
  | "manufacturing";

export interface ExamplePoiHop {
  examplePinId: string;
  livePinId: string;
}

export interface ExamplePoiPair {
  poiId: string;
  poiName: string;
  poiCity: string;
  industry: ExamplePoiIndustry;
  liveTitle: string;
  liveUrl: string;
  liveSource: string;
  km: number;
  poiLat: number;
  poiLon: number;
  liveLat: number;
  liveLon: number;
  examplePinId: string;
  livePinId: string;
}

export interface ExamplePoiIndustryCall {
  category: ExamplePoiIndustry;
  poiCount: number;
  liveNear: number;
  nearestKm: number | null;
  sources: string[];
  factors: { id: string; name: string; weight: number; value: number; unit: string; trend: "up" | "down" | "stable" }[];
  constraints: {
    id: string;
    name: string;
    threshold: number;
    current: number;
    met: boolean;
    impact: "critical" | "high" | "medium" | "low";
  }[];
  variables: {
    id: string;
    name: string;
    type: "numeric" | "boolean" | "categorical";
    value: string | number | boolean;
    impact: number;
  }[];
  outlook: ForecastOutlook;
  confidence: number;
  thin: boolean;
  analysis: string;
  /** Last hourly liveNear counts, oldest → newest. */
  window: number[];
  prediction: {
    headline: string;
    nextAction: string;
    timeframe: string;
    confidence: number;
  };
}

export interface ExamplePoiCompare {
  dataset: string;
  license: string;
  collectedAt: string;
  datasetSha: string | null;
  exampleCount: number;
  locatedCount: number;
  pairCount: number;
  pairs: ExamplePoiPair[];
  industries: ExamplePoiIndustryCall[];
  thin: boolean;
  analysis: string;
  /** `hub` when the Hugging Face CSV streamed this process; otherwise the vendored sample. */
  liveRefresh: "hub" | "sample";
}

export interface TrendsPayload {
  topics: Topic[];
  updatedAt: string;
  sources: SourceHealth;
  degraded: string[];
  pipeline?: string;
  publicApis?: PublicApiIngest;
  /** Receipts that already carry coordinates — plotted on the world under the mind map. */
  located?: Post[];
  /** Hugging Face travel places, labeled Example POI — not live tape. */
  examplePoi?: Post[];
  /** Example POI vs located public tape, scored per industry. */
  poiCompare?: ExamplePoiCompare;
  plugged?: string;
  query?: QueryInsight;
}

export type AgeLens = "kids" | "gen-z" | "millennial" | "gen-x" | "boomer";

export const CATEGORIES = [
  "markets",
  "news",
  "weather",
  "tech",
  "sports",
  "health",
  "security",
  "campaigns",
  "culture",
] as const;

export type CategoryId = (typeof CATEGORIES)[number];

export type DeskCategory = CategoryId | "all";

/** One Postgres database per desk plug. Hub `all` is the tenth. */
export const TREND_DATABASES = ["all", ...CATEGORIES] as const;

export type TrendDatabase = (typeof TREND_DATABASES)[number];

export interface CausationDriver {
  id: string;
  label: string;
  weight: number;
  evidence: string;
}

export interface CausationReport {
  topicId: string;
  firstAt: string | null;
  firstPlatform: Platform | null;
  lagHours: number | null;
  peakAt: string | null;
  drivers: CausationDriver[];
  thin: boolean;
}

export type QueryKind = "ticker" | "hashtag" | "campaign" | "event" | "product" | "place" | "generic";

export type SentimentLean = "pos" | "neg" | "mixed" | "thin";

export interface SentimentMix {
  pos: number;
  neg: number;
  risk: number;
  n: number;
}

export interface SentimentHit {
  title: string;
  url: string;
  platform: Platform;
  pos: number;
  neg: number;
  risk: number;
}

export interface SentimentReport {
  topicId: string;
  lean: SentimentLean;
  overall: SentimentMix;
  byPlatform: Partial<Record<Platform, SentimentMix>>;
  drivers: CausationDriver[];
  quotes: string[];
  hits: SentimentHit[];
  thin: boolean;
}

export interface QueryInsight {
  raw: string;
  kind: QueryKind;
  category: CategoryId;
  aliases: string[];
  search: string;
  match: "exact" | "near" | "neighbor";
  hitCount: number;
  floor: string;
}

export interface TimeBucket {
  t: string;
  label: string;
  x: number;
  reddit: number;
  hn: number;
  public: number;
  total: number;
}

export type MindNodeKind = "hub" | "topic" | "artifact" | "driver" | "source";

export type MindLinkKind = "branch" | "shared";

export type ForecastOutlook = "rising" | "peaking" | "fading" | "stable" | "thin";

/** Measured next-window call from collected snapshots. Never a generated WHY. */
export interface LeafForecast {
  leafId: string;
  topicId: string;
  category: DeskCategory;
  kind: MindNodeKind;
  outlook: ForecastOutlook;
  sentimentLean: SentimentLean;
  confidence: number;
  analysis: string;
  evidence: string;
  thin: boolean;
  model?: { name: "histgb" | "stump"; samples: number };
}

export interface MindNode {
  id: string;
  kind: MindNodeKind;
  label: string;
  topicId?: string;
  weight: number;
  detail?: string;
  forecast?: LeafForecast;
  /** Receipt kind for artifact leaves. Hub / topic / source / driver omit this. */
  artifactKind?: ArtifactKind;
}

export interface MindLink {
  source: string;
  target: string;
  kind: MindLinkKind;
  label?: string;
}

export interface MindGraph {
  hubId: string;
  nodes: MindNode[];
  links: MindLink[];
  bridges: number;
}

export type ArtifactKind = "hashtag" | "phrase" | "url" | "qr" | "ticker";

export interface CapturedArtifact {
  kind: ArtifactKind;
  value: string;
  mentions: number;
  platforms: Platform[];
}

export interface CampaignMove {
  angle: string;
  forCompetitors: string;
  risk: "low" | "medium" | "high";
  timing: Topic["velocity"];
  hook: string;
}

export interface AgeTranslation {
  lens: AgeLens;
  label: string;
  takeaway: string;
}

export interface PeakTimePrediction {
  predictedPeakTime: string | null;
  confidence: number;
  reasoning: string;
  currentPhase: "pre-peak" | "at-peak" | "post-peak" | "unknown";
  hoursUntilPeak: number | null;
}

export interface PlatformSpreadPrediction {
  willSpreadTo: {
    platform: Platform;
    probability: number;
    estimatedHours: number | null;
  }[];
  reasoning: string;
  confidence: number;
}

export interface CampaignArcPrediction {
  currentPhase: "rise" | "peak" | "fade";
  estimatedPhaseEnd: string | null;
  totalLifecycleHours: number | null;
  arcCurve: {
    phase: "rise" | "peak" | "fade";
    durationHours: number;
    peakMultiplier: number;
  }[];
  confidence: number;
  reasoning: string;
}

export interface RiskAlert {
  level: "low" | "medium" | "high";
  clustering: boolean;
  recentPosts: number;
  riskRatio: number;
  timeWindow: string;
  reasoning: string;
  recommendations: string[];
}

export interface PredictionSummary {
  headline: string;
  nextAction: string;
  confidence: number;
  timeframe: string;
}

export interface BoosterTopicBrief {
  topicId: string;
  whyTrending: string;
  confidence: number;
  category: CategoryId;
  artifacts: CapturedArtifact[];
  audiences: AgeTranslation[];
  campaign: CampaignMove;
  causation: CausationReport;
  sentiment: SentimentReport;
  predictions?: {
    peakTime: PeakTimePrediction;
    platformSpread: PlatformSpreadPrediction;
    campaignArc: CampaignArcPrediction;
    riskAlert: RiskAlert;
    summary: PredictionSummary;
  };
}

export interface Improvisation {
  priority: "P0" | "P1" | "P2";
  title: string;
  why: string;
  next: string;
}

export interface SnapshotPoint {
  at: string;
  score: number;
  receipts: number;
}

export interface CollectionStatus {
  backend: "memory" | "postgres";
  databases: string[];
  snapshots: number;
  predicted: number;
  /** Hourly topic-score history for the lead print. Never an invented WHY. */
  history?: SnapshotPoint[];
}

export interface BoosterPayload {
  updatedAt: string;
  sourceUpdatedAt: string;
  summary: string;
  briefs: BoosterTopicBrief[];
  improvisations: Improvisation[];
  forecasts?: LeafForecast[];
  collection?: CollectionStatus;
}

export interface RawSignals {
  reddit: Post[];
  hn: Post[];
  x: Post[];
  public: Post[];
  sources: SourceHealth;
  degraded: string[];
}

export type ResearchSourceKind =
  | "wikipedia"
  | "web"
  | "hn"
  | "reddit"
  | "x"
  | "public"
  | "pubmed"
  | "arxiv"
  | "uspto";

export interface ResearchSource {
  id: string;
  kind: ResearchSourceKind;
  title: string;
  url: string;
  snippet: string;
  score?: number;
  createdAt?: string;
  /** AutoLineage: which collect step produced this source. */
  tool?: string;
  collectedAt?: string;
}

export interface ResearchFinding {
  claim: string;
  evidenceIds: string[];
  confidence: "high" | "medium" | "thin";
}

export interface ResearchSense {
  id: string;
  label: string;
  count: number;
  sourceIds: string[];
}

export interface ResearchDropped {
  title: string;
  url: string;
}

export interface ResearchPayload {
  query: string;
  updatedAt: string;
  summary: string;
  findings: ResearchFinding[];
  openQuestions: string[];
  angles: string[];
  sources: ResearchSource[];
  degraded: string[];
  thin: boolean;
  droppedCount?: number;
  dropped?: ResearchDropped[];
  senses?: ResearchSense[];
  defaultSenseId?: string | null;
}

export interface WatchlistEntity {
  id: string;
  label: string;
  aliases: string[];
  owner: string;
  createdAt: string;
}

export type PoiTag = "official" | "occupied" | "ignore";

export interface Occupier {
  title: string;
  url: string;
  host: string;
  tag?: PoiTag;
  qrPayload?: string;
}

export interface PoiInsight {
  entity: WatchlistEntity;
  receiptCount: number;
  officialCount: number;
  occupiedCount: number;
  organic: number;
  occupancy: number;
  outlook: ForecastOutlook;
  confidence: number;
  thin: boolean;
  analysis: string;
  occupiers: Occupier[];
  snapshotCount: number;
  /** Last snapshot overlap count minus the one before. */
  delta: number;
  /** Entity share of that snapshot’s public tape. */
  baselineRatio: number;
  /** Sort key: |delta| × occupancy so occupied names float. */
  rankScore: number;
  /** Last overlap counts, oldest → newest. */
  window: number[];
  /** How the next-window call was made. Stump until HistGB has enough transitions. */
  model?: { name: "histgb" | "stump"; samples: number };
  /** Gold official+occupied inspect tags on this name. Occupancy HistGB needs 20. */
  goldTags?: number;
}
