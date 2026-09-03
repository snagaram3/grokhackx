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

/** Parse localStorage JSON. Corrupt or unshaped payloads fall back to every catalog source. */
export function parseApiSourceSelection(raw: string | null): ApiSourceSelection {
  if (!raw) return getDefaultSelection();

  try {
    const parsed = JSON.parse(raw) as ApiSourceSelection;
    if (!parsed.enabled || !Array.isArray(parsed.enabled)) {
      return getDefaultSelection();
    }
    return parsed;
  } catch {
    return getDefaultSelection();
  }
}

/**
 * Query `sources=` wins over the cookie. `undefined` means "no preference / all feeds".
 * Cookie must be a JSON array of names (the toggle writes `JSON.stringify(enabled)`),
 * not the `{enabled, updatedAt}` localStorage object.
 */
export function parseEnabledSources(
  sourcesParam: string | null | undefined,
  sourcesCookie: string | null | undefined,
): string[] | undefined {
  if (sourcesParam) {
    return sourcesParam.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!sourcesCookie) return undefined;
  try {
    const parsed = JSON.parse(sourcesCookie) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // Invalid cookie, ignore
  }
  return undefined;
}

/** `undefined` = do not filter. `[]` = disable every named source. */
export function filterByEnabledSources<T extends { name: string }>(
  items: T[],
  enabledSources?: string[],
): T[] {
  if (enabledSources == null) return items;
  return items.filter((item) => enabledSources.includes(item.name));
}

export function applyToggleSource(current: ApiSourceSelection, source: string): ApiSourceSelection {
  const isEnabled = current.enabled.includes(source);
  const enabled = isEnabled
    ? current.enabled.filter((s) => s !== source)
    : [...current.enabled, source];
  return {
    enabled,
    updatedAt: new Date().toISOString(),
  };
}

export function applyToggleCategory(
  current: ApiSourceSelection,
  category: string,
  enable: boolean,
): ApiSourceSelection {
  const categoryData = API_SOURCE_CATEGORIES.find((c) => c.name === category);
  if (!categoryData) return current;

  let enabled = [...current.enabled];
  if (enable) {
    for (const source of categoryData.sources) {
      if (!enabled.includes(source)) enabled.push(source);
    }
  } else {
    enabled = enabled.filter((s) => !categoryData.sources.includes(s));
  }

  return {
    enabled,
    updatedAt: new Date().toISOString(),
  };
}

export function loadApiSourceSelection(): ApiSourceSelection {
  if (typeof window === "undefined") return getDefaultSelection();

  try {
    return parseApiSourceSelection(window.localStorage.getItem(STORAGE_KEY));
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
  const updated = applyToggleSource(loadApiSourceSelection(), source);
  saveApiSourceSelection(updated);
  return updated;
}

export function toggleCategory(category: string, enable: boolean): ApiSourceSelection {
  const updated = applyToggleCategory(loadApiSourceSelection(), category, enable);
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
