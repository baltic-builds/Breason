import type { ResonanceGenerateRequest } from "@breason/types";
import { isMarketKey } from "@breason/types";
import { resonanceGenerate, logger } from "@breason/shared";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  let body: Partial<ResonanceGenerateRequest>;
  try {
    body = await request.json() as Partial<ResonanceGenerateRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isMarketKey(body.market)) {
    return Response.json({ error: "market must be brazil | poland | germany" }, { status: 400 });
  }
  if (!body.trend?.title) {
    return Response.json({ error: "trend is required" }, { status: 400 });
  }

  try {
    const result = await resonanceGenerate(body.market, body.trend, requestId);
    return Response.json(result, { headers: { "X-Request-Id": requestId } });
  } catch (err) {
    logger.error("resonance-generate.error", err, { requestId });
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
