/**
 * API Source Selection Manager
 * Handles user preferences for which public API sources to use
 */

export interface ApiSourceCategory {
  name: string;
  sources: string[];
  description: string;
}

export const API_SOURCE_CATEGORIES: ApiSourceCategory[] = [
  {
    name: "News",
    sources: ["GDELT", "Google News", "BBC", "Guardian", "Reuters", "Al Jazeera", "NHK World", "NYT", "NPR"],
    description: "News sources from around the world",
  },
  {
    name: "Social",
    sources: ["Bluesky", "Mastodon", "Lobsters"],
    description: "Social media platforms",
  },
  {
    name: "Tech & Development",
    sources: ["GitHub", "Dev.to", "Stack Overflow", "TechCrunch"],
    description: "Technology and developer resources",
  },
  {
    name: "Science & Research",
    sources: ["NASA EONET", "Spaceflight News", "arXiv", "OpenAlex"],
    description: "Scientific and research sources",
  },
  {
    name: "Cryptocurrency",
    sources: ["CoinGecko", "CoinCap", "CryptoCompare", "Fear & Greed"],
    description: "Cryptocurrency and blockchain",
  },
  {
    name: "Weather & Environment",
    sources: ["National Weather Service", "GDACS", "Open-Meteo", "USGS", "Carbon Intensity"],
    description: "Weather and environmental data",
  },
  {
    name: "Government",
    sources: ["Federal Register", "FBI Wanted", "ReliefWeb"],
    description: "Government sources",
  },
  {
    name: "Media & Entertainment",
    sources: ["Wikipedia", "TVMaze", "YouTube", "Open Library", "Jikan", "iTunes"],
    description: "Media, books, and entertainment",
  },
  {
    name: "Sports",
    sources: ["TheSportsDB", "ESPN"],
    description: "Sports and fitness",
  },
  {
    name: "Other",
    sources: [
      "SpaceX",
      "NHTSA",
      "Disease.sh",
      "CheapShark",
      "Frankfurter",
      "Nager.Date",
      "CISA KEV",
      "Open Food Facts",
      "DuckDuckGo",
    ],
    description: "Various other sources",
  },
];

export function getAllApiSources(): string[] {
  return API_SOURCE_CATEGORIES.flatMap((cat) => cat.sources);
}

const STORAGE_KEY = "hawkxai:api-sources";

export interface ApiSourceSelection {
  enabled: string[];
  updatedAt: string;
}

function getDefaultSelection(): ApiSourceSelection {
  return {
    enabled: getAllApiSources(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadApiSourceSelection(): ApiSourceSelection {
  if (typeof window === "undefined") return getDefaultSelection();
  
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultSelection();
    
    const parsed = JSON.parse(stored) as ApiSourceSelection;
    if (!parsed.enabled || !Array.isArray(parsed.enabled)) {
      return getDefaultSelection();
    }
    
    return parsed;
  } catch {
    return getDefaultSelection();
  }
}

export function saveApiSourceSelection(selection: ApiSourceSelection): void {
  if (typeof window === "undefined") return;
  
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch (err) {
    console.warn("[api-source-selection] Failed to save:", err);
  }
}

export function toggleApiSource(source: string): ApiSourceSelection {
  const current = loadApiSourceSelection();
  const isEnabled = current.enabled.includes(source);
  
  const enabled = isEnabled
    ? current.enabled.filter((s) => s !== source)
    : [...current.enabled, source];
  
  const updated: ApiSourceSelection = {
    enabled,
    updatedAt: new Date().toISOString(),
  };
  
  saveApiSourceSelection(updated);
  return updated;
}

export function toggleCategory(category: string, enable: boolean): ApiSourceSelection {
  const current = loadApiSourceSelection();
  const categoryData = API_SOURCE_CATEGORIES.find((c) => c.name === category);
  
  if (!categoryData) return current;
  
  let enabled = [...current.enabled];
  
  if (enable) {
    for (const source of categoryData.sources) {
      if (!enabled.includes(source)) {
        enabled.push(source);
      }
    }
  } else {
    enabled = enabled.filter((s) => !categoryData.sources.includes(s));
  }
  
  const updated: ApiSourceSelection = {
    enabled,
    updatedAt: new Date().toISOString(),
  };
  
  saveApiSourceSelection(updated);
  return updated;
}

export function enableAllSources(): ApiSourceSelection {
  const updated: ApiSourceSelection = {
    enabled: getAllApiSources(),
    updatedAt: new Date().toISOString(),
  };
  
  saveApiSourceSelection(updated);
  return updated;
}

export function disableAllSources(): ApiSourceSelection {
  const updated: ApiSourceSelection = {
    enabled: [],
    updatedAt: new Date().toISOString(),
  };
  
  saveApiSourceSelection(updated);
  return updated;
}
