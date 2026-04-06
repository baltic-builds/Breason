import type { MarketKey, ResonanceTrendsResponse } from "@breason/types";
import { isMarketKey } from "@breason/types";
import { resonanceTrends, logger } from "@breason/shared";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

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
    const result = await resonanceTrends(market, requestId);
    return Response.json(result, { headers: { "X-Request-Id": requestId } });
  } catch (err) {
    logger.error("resonance-trends.error", err, { requestId });
    return Response.json({ error: "Не удалось получить тренды" }, { status: 500 });
  }
}
