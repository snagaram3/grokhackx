import type {
  FootprintAnalysis,
  InfiltrationMetric,
  POIData,
  PublicDataSource,
  IndustryAnalysis,
} from "./insights-types";

export async function calculateFootprint(
  poiData: POIData,
  publicSources: PublicDataSource[],
  analysis: IndustryAnalysis
): Promise<FootprintAnalysis> {
  const totalDataPoints = publicSources.reduce((sum, s) => sum + s.dataPoints, 0);
  const avgReliability = publicSources.reduce((sum, s) => sum + s.reliability, 0) / publicSources.length;
  
  const infiltrationScore = calculateInfiltrationScore(
    poiData,
    publicSources,
    totalDataPoints
  );
  
  const marketPenetration = calculateMarketPenetration(
    infiltrationScore,
    poiData.category
  );
  
  const reach = calculateReach(publicSources, totalDataPoints);
  const engagement = calculateEngagement(publicSources, infiltrationScore);
  
  const sentiment = determineSentiment(analysis);
  
  const metrics = generateMetrics(
    infiltrationScore,
    marketPenetration,
    reach,
    engagement
  );
  
  const dollarImpact = calculateDollarImpact(
    infiltrationScore,
    marketPenetration,
    reach,
    engagement,
    poiData.category
  );
  
  const organicRatio = calculateOrganicRatio(avgReliability, infiltrationScore);

  return {
    poiId: poiData.id,
    infiltrationScore,
    marketPenetration,
    reach,
    engagement,
    sentiment,
    metrics,
    dollarImpact,
    organicRatio,
  };
}

function calculateInfiltrationScore(
  poiData: POIData,
  publicSources: PublicDataSource[],
  totalDataPoints: number
): number {
  const sourceCoverage = publicSources.length / 10;
  const dataVolume = Math.min(1, totalDataPoints / 10000);
  const relevance = poiData.relevanceScore;
  
  return (sourceCoverage * 0.3 + dataVolume * 0.4 + relevance * 0.3) * 100;
}

function calculateMarketPenetration(
  infiltrationScore: number,
  category: string
): number {
  const categoryMultipliers: Record<string, number> = {
    technology: 1.2,
    finance: 0.9,
    healthcare: 0.8,
    retail: 1.1,
    automotive: 0.95,
    "real-estate": 0.85,
    entertainment: 1.15,
    education: 0.9,
    hospitality: 1.0,
    manufacturing: 0.88,
  };
  
  const multiplier = categoryMultipliers[category] || 1.0;
  return Math.min(100, infiltrationScore * multiplier * 0.85);
}

function calculateReach(
  publicSources: PublicDataSource[],
  totalDataPoints: number
): number {
  return Math.min(100, (totalDataPoints / 5000) * 100);
}

function calculateEngagement(
  publicSources: PublicDataSource[],
  infiltrationScore: number
): number {
  const avgReliability = publicSources.reduce((sum, s) => sum + s.reliability, 0) / publicSources.length;
  return Math.min(100, infiltrationScore * avgReliability * 1.1);
}

function determineSentiment(
  analysis: IndustryAnalysis
): "positive" | "negative" | "neutral" | "mixed" {
  const score = analysis.score;
  const metConstraints = analysis.constraints.filter(c => c.met).length / analysis.constraints.length;
  
  if (score >= 75 && metConstraints >= 0.75) return "positive";
  if (score <= 40 || metConstraints <= 0.3) return "negative";
  if (Math.abs(score - 60) < 10 && Math.abs(metConstraints - 0.6) < 0.2) return "neutral";
  return "mixed";
}

function generateMetrics(
  infiltrationScore: number,
  marketPenetration: number,
  reach: number,
  engagement: number
): InfiltrationMetric[] {
  // Calculate percentiles based on actual metric values vs benchmarks
  const calculatePercentile = (value: number, benchmark: number): number => {
    // Percentile based on how much the value exceeds or falls short of benchmark
    const ratio = value / benchmark;
    if (ratio >= 1.3) return Math.min(95, 75 + Math.floor((ratio - 1.3) * 50));
    if (ratio >= 1.0) return Math.floor(60 + (ratio - 1.0) * 50);
    if (ratio >= 0.7) return Math.floor(40 + (ratio - 0.7) * 66.67);
    return Math.max(10, Math.floor(ratio * 57.14));
  };
  
  const visibilityScore = (infiltrationScore + reach) / 2;
  const organicSpread = (infiltrationScore + engagement) / 2;
  const crossPlatform = Math.min(100, infiltrationScore * 1.15);
  
  return [
    {
      metric: "Visibility Score",
      value: visibilityScore,
      benchmark: 65,
      percentile: calculatePercentile(visibilityScore, 65),
      trend: infiltrationScore > 60 ? "increasing" : "stable",
    },
    {
      metric: "Market Share Estimate",
      value: marketPenetration * 0.01,
      benchmark: 0.5,
      percentile: calculatePercentile(marketPenetration * 0.01 * 100, 50),
      trend: marketPenetration > 70 ? "increasing" : "stable",
    },
    {
      metric: "Engagement Rate",
      value: engagement,
      benchmark: 60,
      percentile: calculatePercentile(engagement, 60),
      trend: engagement > 65 ? "increasing" : "decreasing",
    },
    {
      metric: "Organic Spread",
      value: organicSpread,
      benchmark: 70,
      percentile: calculatePercentile(organicSpread, 70),
      trend: organicSpread > 70 ? "increasing" : "stable",
    },
    {
      metric: "Cross-Platform Presence",
      value: crossPlatform,
      benchmark: 55,
      percentile: calculatePercentile(crossPlatform, 55),
      trend: crossPlatform > 70 ? "increasing" : "stable",
    },
  ];
}

function calculateDollarImpact(
  infiltrationScore: number,
  marketPenetration: number,
  reach: number,
  engagement: number,
  category: string
) {
  const baseImpact: Record<string, number> = {
    technology: 250000,
    finance: 500000,
    healthcare: 300000,
    retail: 150000,
    automotive: 400000,
    "real-estate": 600000,
    entertainment: 200000,
    education: 180000,
    hospitality: 220000,
    manufacturing: 350000,
  };
  
  const base = baseImpact[category] || 200000;
  
  const scoreMultiplier = (infiltrationScore / 100) * (marketPenetration / 100);
  const engagementBonus = 1 + (engagement / 200);
  const reachBonus = 1 + (reach / 300);
  
  const estimated = Math.floor(base * scoreMultiplier * engagementBonus * reachBonus);
  
  const range: [number, number] = [
    Math.floor(estimated * 0.7),
    Math.floor(estimated * 1.4),
  ];
  
  const confidence = Math.min(0.95, (infiltrationScore + marketPenetration) / 200);
  
  const breakdown = [
    { category: "Direct Revenue", amount: Math.floor(estimated * 0.4) },
    { category: "Brand Value", amount: Math.floor(estimated * 0.25) },
    { category: "Market Position", amount: Math.floor(estimated * 0.20) },
    { category: "Customer Acquisition", amount: Math.floor(estimated * 0.15) },
  ];
  
  return {
    estimated,
    range,
    confidence,
    timeframe: "monthly" as const,
    breakdown,
  };
}

function calculateOrganicRatio(
  avgReliability: number,
  infiltrationScore: number
): number {
  const baseOrganic = avgReliability * 0.85;
  const scoreAdjustment = (infiltrationScore / 100) * 0.15;
  return Math.min(1, baseOrganic + scoreAdjustment);
}
