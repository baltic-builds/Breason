import type { AnalyzeRequest, AnalyzeResult } from "@breason/types";
import { isMarketKey } from "@breason/types";
import { analyzeMarketing } from "@breason/shared";
import { logger } from "@breason/shared";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();

  let body: Partial<AnalyzeRequest>;
  try {
    body = await request.json() as Partial<AnalyzeRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }
  if (!isMarketKey(body.market)) {
    return Response.json({ error: "market must be brazil | poland | germany" }, { status: 400 });
  }
  if (body.text.length > 50_000) {
    return Response.json({ error: "text too long (max 50 000 chars)" }, { status: 400 });
  }

  const acceptsStream = request.headers.get("accept") === "text/event-stream";

  if (acceptsStream) {
    // ── Streaming SSE path ────────────────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const encode = (data: object) =>
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

        try {
          controller.enqueue(encode({ type: "status", message: "Analysing…" }));
          const result: AnalyzeResult = await analyzeMarketing(body.text!, body.market!, requestId);
          controller.enqueue(encode({ type: "result", ...result }));
        } catch (err) {
          logger.error("analyze.stream.error", err, { requestId });
          controller.enqueue(encode({ type: "error", message: "Analysis failed" }));
        } finally {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Request-Id": requestId,
      },
    });
  }

  // ── Standard JSON path ────────────────────────────────────────────────────
  try {
    const result = await analyzeMarketing(body.text, body.market, requestId);
    return Response.json(result, { headers: { "X-Request-Id": requestId } });
  } catch (err) {
    logger.error("analyze.error", err, { requestId });
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
