# API Source Toggle Feature Demo

## Overview
This document demonstrates the new API Source Toggle feature that allows users to customize which public API sources are used for data collection throughout the HawkxAI application.

## Feature Location
The API Source Toggle button is available on **every page** of the application in the bottom-right corner.

## How to Use

### 1. Access the Toggle
- Look for the **"API Sources"** button in the bottom-right corner
- The button displays the current count (e.g., "45/73" meaning 45 out of 73 sources are enabled)

### 2. Open the Selection Panel
- Click the "API Sources" button to open the selection panel
- A modal will slide up from the bottom showing all available sources organized by category

### 3. Manage Sources

#### Individual Sources
- Each source is represented as a toggle button
- Click any source name to enable/disable it
- Enabled sources are highlighted in blue
- Disabled sources appear in gray

#### Category Management
- Each category has a checkbox on the left
- Click the category checkbox to enable/disable all sources in that category
- Partial selection shows a different indicator

#### Bulk Actions
- **Enable All**: Click to enable all 73+ sources at once
- **Disable All**: Click to disable all sources (not recommended for normal use)

### 4. View Your Selection
- The bottom of the panel shows "X of Y sources enabled"
- Each category shows its own count (e.g., "3/9" for News category)

### 5. Apply Changes
- Click **"Done"** to close the panel
- Your selection is automatically saved and applied
- The API will now only use your selected sources for data collection

## Available Source Categories

### 📰 News (9 sources)
GDELT, Google News, BBC, Guardian, Reuters, Al Jazeera, NHK World, NYT, NPR

### 💬 Social (3 sources)
Bluesky, Mastodon, Lobsters

### 💻 Tech & Development (4 sources)
GitHub, Dev.to, Stack Overflow, TechCrunch

### 🔬 Science & Research (4 sources)
NASA EONET, Spaceflight News, arXiv, OpenAlex

### 💰 Cryptocurrency (4 sources)
CoinGecko, CoinCap, CryptoCompare, Fear & Greed

### 🌤️ Weather & Environment (5 sources)
National Weather Service, GDACS, Open-Meteo, USGS, Carbon Intensity

### 🏛️ Government (3 sources)
Federal Register, FBI Wanted, ReliefWeb

### 🎬 Media & Entertainment (6 sources)
Wikipedia, TVMaze, YouTube, Open Library, Jikan, iTunes

### ⚽ Sports (2 sources)
TheSportsDB, ESPN

### 📦 Other (10+ sources)
SpaceX, NHTSA, Disease.sh, CheapShark, Frankfurter, Nager.Date, CISA KEV, Open Food Facts, DuckDuckGo

## Technical Details

### Storage
- **localStorage**: Stores your preferences locally in the browser
- **Cookies**: Sends preferences to the server for backend filtering
- **Persistence**: Settings persist across browser sessions and page reloads

### Performance
- Disabling unused sources can speed up data collection
- Changes take effect immediately on the next data refresh
- No page reload required

### Real-time Updates
- The app dispatches a custom `api-sources-changed` event when selection changes
- Components can listen to this event to refresh data automatically

## Use Cases

### 1. Privacy-Focused Users
Disable sources you don't trust or don't want to query

### 2. Performance Optimization
Enable only the sources most relevant to your use case

### 3. Regional Focus
Enable only news sources from specific regions

### 4. Topic-Specific
Enable only sources relevant to your industry (e.g., only crypto sources)

### 5. Testing & Development
Quickly toggle sources to test different data combinations

## Example Scenarios

### Scenario 1: Crypto-Only Dashboard
1. Click "Disable All"
2. Enable the "Cryptocurrency" category
3. Optionally enable specific news sources
4. Click "Done"

### Scenario 2: News-Heavy Configuration
1. Enable "News" category (all 9 sources)
2. Enable "Social" category for social trends
3. Enable specific sources from "Tech & Development"
4. Click "Done"

### Scenario 3: Maximum Coverage
1. Click "Enable All" (default)
2. All 73+ sources are active
3. Maximum data diversity, but slower collection

## Tips

- **Start with defaults**: All sources are enabled by default for maximum coverage
- **Experiment**: Try different combinations to see what works best for your needs
- **Category toggles**: Use category checkboxes for quick bulk changes
- **Visual feedback**: Blue = enabled, Gray = disabled
- **Count indicators**: Always visible to show your current selection

## Support

If you encounter any issues or have suggestions for new sources, please open an issue on GitHub.

## Future Enhancements

Potential improvements for future versions:
- Source presets (e.g., "Crypto Focus", "News Only", "Tech Stack")
- Source quality ratings
- Usage statistics per source
- Custom source scheduling
- Rate limiting per source
