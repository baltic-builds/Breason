import type { MarketKey, ResonanceTrend } from "@breason/types";

export const ANALYZE_PROMPT = (market: MarketKey, text: string) => `You are Breason, a B2B localization strategist.
Return strict JSON with keys: score, verdict, marketTension, insight, strengths, risks, suggestions.
Market: ${market}.
Text: ${text}`;

export const RESONANCE_TRENDS_PROMPT = (market: MarketKey) => `You are Breason Resonance researcher.
Return strict JSON with key trends (array max 5), each with title, resonanceScore (0-100), marketTension, insight.
Country: ${market}.`;

export const RESONANCE_GENERATE_PROMPT = (market: MarketKey, trend: ResonanceTrend) => `You are Breason generator.
Generate one localized mini campaign for market ${market} based on trend:
${JSON.stringify(trend)}
Return strict JSON: headline, body, cta.`;
