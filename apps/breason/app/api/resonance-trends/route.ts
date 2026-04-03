import type { MarketKey, ResonanceTrendsResponse, ResonanceTrend } from "@breason/types";
import { isMarketKey } from "@breason/types";
import { resonanceTrends, logger } from "@breason/shared";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function tryTavily(market: MarketKey): Promise<ResonanceTrendsResponse | null> {
  if (!process.env.TAVILY_API_KEY) return null;

  const t0 = Date.now();
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `B2B marketing trends in ${market} 2026`,
        search_depth: "advanced",
        max_results: 5,
      }),
    });

    if (!res.ok) return null;

    const json = await res.json() as {
      results?: Array<{ title?: string; content?: string }>;
    };
    if (!json.results?.length) return null;

    const trends: ResonanceTrend[] = json.results.slice(0, 5).map((item, i) => ({
      title: item.title ?? `Trend ${i + 1}`,
      resonanceScore: Math.max(60, 90 - i * 4),
      marketTension: "Global AI speed vs local trust requirements",
      insight: item.content?.slice(0, 220) ?? "Market data suggests practical, trust-driven messaging performs best.",
    }));

    return {
      provider: "tavily",
      promptVersion: "tavily-search@1",
      trends,
      latencyMs: Date.now() - t0,
      requestedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market") ?? "brazil";

  if (!isMarketKey(market)) {
    return Response.json(
      { error: "market must be brazil | poland | germany" },
      { status: 400 }
    );
  }

  try {
    const fromTavily = await tryTavily(market);
    if (fromTavily) {
      return Response.json(fromTavily, { headers: { "X-Request-Id": requestId } });
    }

    const result = await resonanceTrends(market, requestId);
    return Response.json(result, { headers: { "X-Request-Id": requestId } });
  } catch (err) {
    logger.error("resonance-trends.error", err, { requestId });
    return Response.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
