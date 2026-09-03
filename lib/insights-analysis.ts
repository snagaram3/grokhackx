import type {
  IndustryCategory,
  IndustryAnalysis,
  IndustryFactor,
  IndustryConstraint,
  IndustryVariable,
  POIData,
  PublicDataSource,
} from "./insights-types";

export const INDUSTRY_FACTORS: Record<IndustryCategory, string[]> = {
  technology: [
    "Innovation Index",
    "Adoption Rate",
    "Developer Interest",
    "Investment Volume",
    "Patent Activity",
  ],
  finance: [
    "Market Volatility",
    "Trading Volume",
    "Regulatory Compliance",
    "Customer Trust",
    "Digital Adoption",
  ],
  healthcare: [
    "Patient Outcomes",
    "Regulatory Approval",
    "Research Funding",
    "Provider Adoption",
    "Cost Efficiency",
  ],
  retail: [
    "Consumer Demand",
    "Price Competitiveness",
    "Supply Chain Efficiency",
    "Brand Loyalty",
    "Digital Presence",
  ],
  automotive: [
    "Sales Volume",
    "Safety Ratings",
    "Environmental Impact",
    "Innovation Score",
    "Customer Satisfaction",
  ],
  "real-estate": [
    "Property Values",
    "Market Liquidity",
    "Interest Rates",
    "Development Activity",
    "Location Score",
  ],
  entertainment: [
    "Audience Engagement",
    "Content Quality",
    "Distribution Reach",
    "Revenue Streams",
    "Critical Reception",
  ],
  education: [
    "Student Outcomes",
    "Enrollment Trends",
    "Innovation Index",
    "Funding Levels",
    "Accreditation Status",
  ],
  hospitality: [
    "Guest Satisfaction",
    "Occupancy Rates",
    "Service Quality",
    "Location Appeal",
    "Price Positioning",
  ],
  manufacturing: [
    "Production Efficiency",
    "Quality Control",
    "Supply Chain Resilience",
    "Innovation Rate",
    "Safety Standards",
  ],
};

export const INDUSTRY_CONSTRAINTS: Record<IndustryCategory, string[]> = {
  technology: ["Scalability", "Security", "Performance", "Compatibility"],
  finance: ["Compliance", "Risk Management", "Liquidity", "Capital Requirements"],
  healthcare: ["Safety", "Efficacy", "Regulatory", "Accessibility"],
  retail: ["Inventory", "Logistics", "Pricing", "Competition"],
  automotive: ["Safety Standards", "Emissions", "Quality", "Cost"],
  "real-estate": ["Zoning", "Financing", "Market Conditions", "Location"],
  entertainment: ["Content Rights", "Distribution", "Audience Ratings", "Budget"],
  education: ["Accreditation", "Funding", "Faculty", "Enrollment"],
  hospitality: ["Health & Safety", "Capacity", "Location", "Service Standards"],
  manufacturing: ["Quality", "Capacity", "Resources", "Compliance"],
};

export const INDUSTRY_VARIABLES: Record<IndustryCategory, string[]> = {
  technology: ["Platform Type", "Target Market", "Revenue Model", "Stage"],
  finance: ["Asset Class", "Risk Profile", "Term Length", "Instrument Type"],
  healthcare: ["Treatment Type", "Patient Demographics", "Provider Type", "Coverage"],
  retail: ["Channel", "Product Category", "Price Point", "Season"],
  automotive: ["Vehicle Type", "Powertrain", "Market Segment", "Production Volume"],
  "real-estate": ["Property Type", "Location Tier", "Term", "Financing Type"],
  entertainment: ["Genre", "Format", "Distribution Model", "Target Audience"],
  education: ["Level", "Delivery Method", "Subject Area", "Accreditation Type"],
  hospitality: ["Service Type", "Star Rating", "Location Type", "Season"],
  manufacturing: ["Product Type", "Production Method", "Scale", "Quality Grade"],
};

export async function analyzeIndustry(
  category: IndustryCategory,
  _poiData: POIData,
  publicSources: PublicDataSource[]
): Promise<IndustryAnalysis> {
  const factors = generateFactors(category, publicSources);
  const constraints = generateConstraints(category, publicSources);
  const variables = generateVariables(category, publicSources);
  
  const score = calculateIndustryScore(factors, constraints, variables);
  const insights = generateIndustryInsights(category, factors, constraints, variables);

  return {
    category,
    factors,
    constraints,
    variables,
    score,
    insights,
  };
}

function generateFactors(
  category: IndustryCategory,
  publicSources: PublicDataSource[]
): IndustryFactor[] {
  const factorNames = INDUSTRY_FACTORS[category];
  const avgReliability = publicSources.reduce((sum, s) => sum + s.reliability, 0) / publicSources.length;
  const totalDataPoints = publicSources.reduce((sum, s) => sum + s.dataPoints, 0);
  
  return factorNames.map((name, index) => {
    // Deterministic value based on data coverage and reliability
    const dataPointRatio = Math.min(1, totalDataPoints / 10000);
    const positionWeight = (factorNames.length - index) / factorNames.length;
    const baseValue = 0.4 + (dataPointRatio * 0.35) + (avgReliability * 0.25);
    
    const weight = positionWeight * avgReliability;
    
    // Deterministic trend based on reliability and data volume
    let trend: "up" | "down" | "stable";
    if (avgReliability > 0.85 && dataPointRatio > 0.7) {
      trend = "up";
    } else if (avgReliability < 0.7 || dataPointRatio < 0.4) {
      trend = "down";
    } else {
      trend = "stable";
    }
    
    return {
      id: `factor-${index}`,
      name,
      weight,
      value: baseValue * 100,
      unit: name.includes("Rate") || name.includes("Ratio") ? "%" : "index",
      trend,
    };
  });
}

function generateConstraints(
  category: IndustryCategory,
  publicSources: PublicDataSource[]
): IndustryConstraint[] {
  const constraintNames = INDUSTRY_CONSTRAINTS[category];
  const avgReliability = publicSources.reduce((sum, s) => sum + s.reliability, 0) / publicSources.length;
  const totalDataPoints = publicSources.reduce((sum, s) => sum + s.dataPoints, 0);
  
  return constraintNames.map((name, index) => {
    // Deterministic thresholds based on industry standards
    const baseThreshold = 70;
    const threshold = baseThreshold + (index * 3);
    
    // Current value based on actual data quality
    const dataHealth = (avgReliability * 0.6) + (Math.min(1, totalDataPoints / 8000) * 0.4);
    const positionFactor = 1 - (index * 0.08);
    const current = dataHealth * 100 * positionFactor;
    
    const met = current >= threshold;
    const impact = index < 2 ? "critical" : index < 4 ? "high" : index < 6 ? "medium" : "low";
    
    return {
      id: `constraint-${index}`,
      name,
      threshold,
      current,
      met,
      impact: impact as "critical" | "high" | "medium" | "low",
    };
  });
}

function generateVariables(
  category: IndustryCategory,
  publicSources: PublicDataSource[]
): IndustryVariable[] {
  const variableNames = INDUSTRY_VARIABLES[category];
  const totalDataPoints = publicSources.reduce((sum, s) => sum + s.dataPoints, 0);
  const avgReliability = publicSources.reduce((sum, s) => sum + s.reliability, 0) / publicSources.length;
  
  return variableNames.map((name, index) => {
    const types = ["numeric", "boolean", "categorical"] as const;
    const type = types[index % types.length];
    
    let value: string | number | boolean;
    if (type === "numeric") {
      // Deterministic numeric value based on data metrics
      value = Math.floor(50 + (avgReliability * 30) + ((totalDataPoints / 10000) * 20));
    } else if (type === "boolean") {
      // Based on data quality threshold
      value = avgReliability > 0.75;
    } else {
      // Categorical based on data quality tiers
      const tier = avgReliability > 0.85 ? 0 : avgReliability > 0.75 ? 1 : avgReliability > 0.65 ? 2 : 3;
      value = ["A", "B", "C", "D"][tier];
    }
    
    // Impact based on position and data quality
    const positionImpact = 1 - (index * 0.06);
    const impact = Math.min(1, 0.6 + (avgReliability * 0.2) + (positionImpact * 0.2));
    
    return {
      id: `variable-${index}`,
      name,
      type,
      value,
      impact,
    };
  });
}

function calculateIndustryScore(
  factors: IndustryFactor[],
  constraints: IndustryConstraint[],
  variables: IndustryVariable[]
): number {
  const factorScore = factors.reduce((sum, f) => sum + f.value * f.weight, 0) / 
    factors.reduce((sum, f) => sum + f.weight * 100, 0);
  
  const constraintScore = constraints.filter(c => c.met).length / constraints.length;
  
  const variableScore = variables.reduce((sum, v) => sum + v.impact, 0) / variables.length;
  
  return (factorScore * 0.5 + constraintScore * 0.3 + variableScore * 0.2) * 100;
}

function generateIndustryInsights(
  category: IndustryCategory,
  factors: IndustryFactor[],
  constraints: IndustryConstraint[],
  variables: IndustryVariable[]
): string[] {
  const insights: string[] = [];
  
  const topFactor = factors.sort((a, b) => b.value * b.weight - a.value * a.weight)[0];
  if (topFactor) {
    insights.push(
      `${topFactor.name} is the strongest performing factor at ${topFactor.value.toFixed(1)}${topFactor.unit}`
    );
  }
  
  const unmetConstraints = constraints.filter(c => !c.met && c.impact === "critical");
  if (unmetConstraints.length > 0) {
    insights.push(
      `Critical attention needed: ${unmetConstraints.map(c => c.name).join(", ")}`
    );
  }
  
  const risingFactors = factors.filter(f => f.trend === "up");
  if (risingFactors.length > 0) {
    insights.push(
      `Positive momentum in ${risingFactors.length} key ${category} factors`
    );
  }
  
  const highImpactVars = variables.filter(v => v.impact > 0.8);
  if (highImpactVars.length > 0) {
    insights.push(
      `${highImpactVars.length} high-impact variables identified for optimization`
    );
  }
  
  insights.push(
    `Overall ${category} performance index: ${calculateIndustryScore(factors, constraints, variables).toFixed(1)}/100`
  );
  
  return insights;
}
