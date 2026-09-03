# AI Agents Intelligence

> Track trends, capabilities, and adoption metrics across the leading AI agents ecosystem

## Overview

The AI Agents Intelligence feature brings HawkxAI's core capability — tracking anything with an internet footprint — to the rapidly evolving AI agents landscape. Monitor adoption trends, compare capabilities, and discover insights across leading AI agents from OpenAI, Anthropic, Google, Meta, and more.

## Features

### 📊 Real-time Tracking

- **8+ Leading Agents**: GPT-4, Claude, Gemini, Llama, Perplexity, Cursor, Midjourney, GitHub Copilot
- **Live Metrics**: Mentions, sentiment, velocity, trending status
- **Weekly Trends**: Track adoption growth and decline

### 🎯 Smart Filtering

- **By Category**: Code generation, reasoning, multimodal, search, automation, analysis, creative, enterprise
- **By Provider**: OpenAI, Anthropic, Google, Meta, Mistral, and more
- **By Status**: Trending agents, high-adoption agents
- **By Pricing**: Free, freemium, paid, enterprise tiers

### 💡 Insights Generation

- **Capability Leadership**: Who leads in each capability area
- **Rising Stars**: Agents with rapid adoption growth
- **Innovation Tracking**: Recent releases and major updates
- **Market Analysis**: Distribution across categories and providers

### 📱 Three-Pane Layout

1. **Agents List**: Browse and filter all tracked agents
2. **Overview**: High-level insights and market summary
3. **Detail View**: Deep dive into individual agents

## Agent Data Model

Each agent includes:

- **Identity**: Name, provider, category, description
- **Capabilities**: Scored abilities (0-100) with descriptions
- **Metrics**: Mentions, sentiment, velocity, trending status, weekly change
- **Pricing**: Tier, input/output costs, currency
- **Releases**: Version history with features and dates
- **Links**: Official site, docs, API, GitHub

## Usage

### Web Interface

Visit `/ai-agents` in your browser:

```
https://your-deployment.vercel.app/ai-agents
```

### API Endpoint

Query the API directly:

```bash
# Get all agents
curl https://your-deployment.vercel.app/api/ai-agents

# Filter by category
curl https://your-deployment.vercel.app/api/ai-agents?category=code-generation

# Filter by provider
curl https://your-deployment.vercel.app/api/ai-agents?provider=anthropic

# Trending only
curl https://your-deployment.vercel.app/api/ai-agents?trending=true

# Combine filters
curl https://your-deployment.vercel.app/api/ai-agents?category=reasoning&trending=true

# Refresh data
curl https://your-deployment.vercel.app/api/ai-agents?refresh=true
```

### API Response

```json
{
  "agents": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "category": "reasoning",
      "description": "...",
      "capabilities": [...],
      "metrics": {
        "mentions": 1234,
        "sentiment": "positive",
        "velocity": "rising",
        "trending": true,
        "trend_score": 95,
        "weekly_change": 23.5
      },
      "pricing": {...},
      "releases": [...],
      "tags": [...]
    }
  ],
  "trends": [...],
  "insights": [...],
  "metadata": {
    "total": 8,
    "byCategory": {...},
    "byProvider": {...},
    "trending": 3
  },
  "updatedAt": "2026-09-03T06:00:00Z"
}
```

## Categories

- **code-generation**: Agents optimized for writing code
- **reasoning**: Strong logical and analytical capabilities
- **multimodal**: Text, image, video, audio understanding
- **search**: Real-time web search and research
- **automation**: Task automation and workflows
- **analysis**: Data analysis and insights
- **creative**: Image, video, music generation
- **enterprise**: Business and enterprise solutions

## Providers

- **openai**: OpenAI (GPT-4, ChatGPT)
- **anthropic**: Anthropic (Claude)
- **google**: Google DeepMind (Gemini)
- **meta**: Meta AI (Llama)
- **mistral**: Mistral AI
- **cohere**: Cohere
- **huggingface**: Hugging Face
- **open-source**: Community models
- **other**: Independent providers

## Roadmap

See `IMPROVISATIONS.md` for the full backlog. Highlights:

### P0 — Immediate
- Real-time mentions from X/Reddit/HN
- Agent comparison matrix
- Historical trend charts

### P1 — Near-term
- Release timeline view
- Booster agent integration
- Sentiment analysis
- Trend alerts

### P2 — Future
- API cost calculator
- Usage recommendations
- Market share tracking
- Developer experience scores

## Architecture

```
lib/
  ai-agents-types.ts        # Type definitions
  ai-agents-store.ts        # Data store and business logic

app/
  ai-agents/
    page.tsx                # Page component
  api/
    ai-agents/
      route.ts              # API endpoint

components/
  ai-agents/
    AIAgentsDesk.tsx        # Main UI component

docs/
  ai-agents/
    README.md               # This file
    IMPROVISATIONS.md       # Booster backlog
    DEPLOYMENT.md           # Vercel setup guide
```

## Development

### Local Development

```bash
# Start dev server
npm run dev

# Visit AI Agents page
open http://localhost:3000/ai-agents

# Run tests (when available)
npm test -- lib/ai-agents
```

### Adding New Agents

Edit `lib/ai-agents-store.ts` and add to `SEED_AGENTS`:

```typescript
{
  id: "new-agent",
  name: "New Agent",
  provider: "provider",
  category: "category",
  description: "...",
  capabilities: [...],
  pricing: {...},
  releases: [...],
  officialUrl: "...",
  launchDate: "2024-01-01",
  tags: [...],
}
```

### Customizing Metrics

Metrics are generated in `generateMetrics()`. Customize scoring logic:

- Base score: Average of capability scores
- Age factor: Newer agents trend more
- Velocity: Rising, peaking, stable, fading
- Weekly change: Growth/decline percentage

## Booster Agent Pattern

This feature follows HawkxAI's booster agent pattern:

1. **Look up**: Track AI agent names as campaign phrases
2. **Capture**: Releases, pricing, benchmarks, API changes
3. **Correlate**: Velocity, sentiment, competitive position
4. **Translate**: "Which agent for my use case?"
5. **Improvise**: Suggest 3-5 ranked improvements

## Integration Points

- **Trends Desk**: Link agent mentions to trend tracking
- **Footprint Desk**: Look up agent names as phrases
- **Research Desk**: Deep dive into agent capabilities
- **Watch Desk**: Monitor specific agents over time

## Contributing

Follow the booster agent pattern:

1. Track real adoption signals (not invented data)
2. Provide evidence for claims
3. Generate actionable insights
4. Suggest concrete next steps
5. Keep thin data thin (don't fake confidence)

## License

Same as parent project (HawkxAI / grokhackx).

## Support

- Technical issues: See branch commits
- Feature requests: Add to `IMPROVISATIONS.md`
- Deployment help: See `DEPLOYMENT.md`
