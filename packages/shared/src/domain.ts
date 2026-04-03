import type {
  AIResponseMeta,
  AnalyzeResult,
  MarketKey,
  ResonanceGenerateResponse,
  ResonanceTrend,
  ResonanceTrendsResponse,
} from "@breason/types";
import {
  analyzePrompt,
  resonanceTrendsPrompt,
  resonanceGeneratePrompt,
} from "@breason/prompts";
import { callAiWithFallback, softJson } from "./ai";

export const marketLabel: Record<MarketKey, string> = {
  brazil: "Brazil",
  poland: "Poland",
  germany: "Germany",
};

const NOW = () => new Date().toISOString();

type AnalyzePayload = Omit<AnalyzeResult, keyof AIResponseMeta>;
type GeneratePayload = Omit<ResonanceGenerateResponse, keyof AIResponseMeta>;

export async function analyzeMarketing(
  text: string,
  market: MarketKey,
  requestId?: string
): Promise<AnalyzeResult> {
  const t0 = Date.now();
  const { text: raw, provider, tokensUsed } = await callAiWithFallback(
    analyzePrompt(market, text),
    "analyze@1",
    requestId
  );

  const parsed = softJson<AnalyzePayload>(raw);
  const meta: AIResponseMeta = {
    provider,
    promptVersion: "analyze@1",
    tokensUsed,
    latencyMs: Date.now() - t0,
    requestedAt: NOW(),
  };

  if (parsed) return { ...parsed, ...meta };

  const len = text.trim().length;
  const score = Math.max(35, Math.min(92, Math.floor(len / 6) + 40));
  return {
    ...meta,
    provider: "local",
    score,
    verdict: score >= 75 ? "PASS" : score >= 56 ? "SUSPICIOUS" : "FOREIGN",
    marketTension: `${marketLabel[market]} buyers require concrete value + local confidence markers.`,
    insight: "Message is understandable but can sound generic for local enterprise context.",
    strengths: ["Clear topic", "Business-friendly structure"],
    risks: ["Low local specificity", "Weak proof framing"],
    suggestions: ["Add local trust marker", "Use sharper CTA", "Reduce abstract phrasing"],
  };
}

export async function resonanceTrends(
  market: MarketKey,
  requestId?: string
): Promise<ResonanceTrendsResponse> {
  const t0 = Date.now();
  const { text: raw, provider, tokensUsed } = await callAiWithFallback(
    resonanceTrendsPrompt(market),
    "resonance-trends@1",
    requestId
  );

  const parsed = softJson<{ trends: ResonanceTrend[] }>(raw);
  const meta: AIResponseMeta = {
    provider,
    promptVersion: "resonance-trends@1",
    tokensUsed,
    latencyMs: Date.now() - t0,
    requestedAt: NOW(),
  };

  if (parsed?.trends?.length) return { ...meta, trends: parsed.trends.slice(0, 5) };

  const localTrends: Record<MarketKey, ResonanceTrend[]> = {
    brazil: [
      { title: "Conversational funnel via WhatsApp", resonanceScore: 84, marketTension: "Speed vs trust", insight: "Brands that reply within minutes convert more qualified demand." },
      { title: "Founder-led credibility posts", resonanceScore: 76, marketTension: "Humanity vs polish", insight: "Raw, practical posts outperform polished generic brand language." },
    ],
    poland: [
      { title: "ROI-first narrative", resonanceScore: 87, marketTension: "Innovation vs certainty", insight: "Decision makers reward transparent value math and concrete savings." },
      { title: "Operational proof content", resonanceScore: 79, marketTension: "Promise vs evidence", insight: "Local case snippets with metrics outperform abstract thought leadership." },
    ],
    germany: [
      { title: "Compliance as growth enabler", resonanceScore: 91, marketTension: "Speed vs governance", insight: "DSGVO and audit-readiness messaging increases enterprise trust." },
      { title: "Reliability positioning", resonanceScore: 80, marketTension: "Novelty vs uptime", insight: "Stable operations messaging wins over disruptive claims." },
    ],
  };

  return { ...meta, provider: "local", trends: localTrends[market] };
}

export async function resonanceGenerate(
  market: MarketKey,
  trend: ResonanceTrend,
  requestId?: string
): Promise<ResonanceGenerateResponse> {
  const t0 = Date.now();
  const { text: raw, provider, tokensUsed } = await callAiWithFallback(
    resonanceGeneratePrompt(market, trend),
    "resonance-generate@1",
    requestId
  );

  const parsed = softJson<GeneratePayload>(raw);
  const meta: AIResponseMeta = {
    provider,
    promptVersion: "resonance-generate@1",
    tokensUsed,
    latencyMs: Date.now() - t0,
    requestedAt: NOW(),
  };

  if (parsed?.headline && parsed?.body && parsed?.cta) return { ...parsed, ...meta };

  return {
    ...meta,
    provider: "local",
    headline: `${trend.title}: message that sounds native in ${marketLabel[market]}`,
    body: `${trend.insight} Breason suggests reframing around this market tension: ${trend.marketTension}.`,
    cta: "See localised version",
  };
}
