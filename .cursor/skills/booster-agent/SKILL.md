---
name: booster-agent
description: >-
  HawkxAI Booster Agent — looks up a word or phrase (campaign name) and maps
  its internet footprint; captures hashtags, QRs, phrases, and URLs around it;
  correlates why those receipts exist; translates insights for all age groups and
  business competitors; and always suggests improvisations. Use when working on
  HawkxAI, phrase lookup, campaign footprint, hashtags, QR codes,
  campaign intelligence, the booster agent, dashboard insights, or product betterment.
---

# Booster Agent

Look up a word or a phrase. See its footprint on the internet.
A marketing team plugs a campaign name; the same interactive dashboard fills
with where that phrase is printing — useful for every age group and for
competitors who will leverage their campaigns.

This agent does extremely smart things. Treat it as the product's core idea, not a side bot.

## When this skill is on

Any HawkxAI work: capture, clustering, map UI, Ask box, campaign copy, age-group UX, or "what should we build next."

## Core loop

1. **Look up** a word or phrase from real intent (campaign name, hashtag, product). Do not invent it.
2. **Capture** artifacts around that phrase: hashtags, QR/short-link campaign codes, co-occurring phrases, URLs.
3. **Correlate** why those receipts exist using velocity, divergence, cross-platform overlap, and receipts.
4. **Translate** for five age lenses plus competitors (campaign hook, timing, risk).
5. **Collect** into dashboard-ready JSON (`BoosterPayload`) for the interactive map.
6. **Improvise** — every response that touches this product must end with 3–5 ranked upgrades.

## Implementation map

- Brain (CLI / reports): `agents/booster-agent/booster_agent.py`
- Live path: `lib/booster.ts` → `GET /api/booster`
- UI: `PhraseLookup` (empty desk) + `BoosterInsights` (per print)
- North star: `docs/presentation/CORE_IDEA.md`
- Living backlog: `agents/booster-agent/IMPROVISATIONS.md`

## Rules

- Never invent posts or a fake WHY. If evidence is thin, say so and lower confidence.
- Do not break `GET /api/trends` or the D3 map. Booster is additive.
- Kids lens = safety + plain language. Competitors = leverage the *need*, not copy the meme.
- Prefer composition over boolean props (`showBooster`, `isCampaignMode`).
- This app is React 18 — do not use `use()` or drop `forwardRef` assumptions from React 19 docs.

## After every relevant change

1. Run `python3 agents/booster-agent/booster_agent.py --self-check` when Python changed.
2. Keep `IMPROVISATIONS.md` in sync if a gap was closed or a smarter gap appeared.
3. End the user-facing reply with **Booster improvisations** (P0 / P1 / P2): title, why it matters, next concrete step.

## Additional resources

- [CORE_IDEA.md](../../../docs/presentation/CORE_IDEA.md)
- [booster agent README](../../../agents/booster-agent/README.md)
