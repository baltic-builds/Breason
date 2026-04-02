import type { ReDuckProcessRequest } from "@breason/types";
import { logger } from "@breason/shared";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// ── Provider dispatch ─────────────────────────────────────────────────────────
// Mirrors apps/reduck/api/process.ts but lives in Next.js API routes.
// API keys stay server-side — never reach the client bundle.

async function callOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  text: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`${baseUrl} ${res.status}: ${await res.text()}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = json?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty response from provider");
  return content;
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, text: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!content) throw new Error("Empty response from Gemini");
  return content;
}

async function callAnthropic(apiKey: string, model: string, systemPrompt: string, text: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
  const content = json?.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
  if (!content) throw new Error("Empty response from Anthropic");
  return content;
}

async function dispatch(
  providerId: string,
  modelId: string,
  systemPrompt: string,
  text: string,
): Promise<string> {
  if (providerId === "demo") {
    return `${text}\n\n---\n*[Demo mode — add an API key to .env.local]*`;
  }
  if (providerId === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");
    return callGemini(key, modelId, systemPrompt, text);
  }
  if (providerId === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not set");
    return callOpenAICompatible(key, "https://api.groq.com/openai", modelId, systemPrompt, text);
  }
  if (providerId === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY not set");
    return callOpenAICompatible(key, "https://openrouter.ai/api", modelId, systemPrompt, text);
  }
  if (providerId === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    return callOpenAICompatible(key, "https://api.openai.com", modelId, systemPrompt, text);
  }
  if (providerId === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    return callAnthropic(key, modelId, systemPrompt, text);
  }
  throw new Error(`Unknown provider: ${providerId}`);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const t0 = Date.now();

  let body: Partial<ReDuckProcessRequest>;
  try {
    body = await request.json() as Partial<ReDuckProcessRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const systemPrompt = body.systemPrompt?.trim();
  const text = body.text?.trim();
  const providerId = body.providerId ?? "demo";
  const modelId = body.modelId ?? "";
  const promptVersion = body.promptVersion ?? "unknown";

  if (!systemPrompt) return Response.json({ error: "systemPrompt is required" }, { status: 400 });
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  if (text.length > 200_000) return Response.json({ error: "text too long (max 200 000 chars)" }, { status: 400 });

  const acceptsStream = request.headers.get("accept") === "text/event-stream";

  if (acceptsStream) {
    // ── SSE streaming path ────────────────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const enc = (data: object) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
        try {
          controller.enqueue(enc({ type: "status", message: "Processing…" }));
          const processedText = await dispatch(providerId, modelId, systemPrompt, text);
          const latencyMs = Date.now() - t0;
          logger.aiCall({ provider: providerId as import("@breason/types").AIProvider, promptVersion, latencyMs, success: true, requestId });
          controller.enqueue(enc({ type: "result", processedText, provider: providerId, model: modelId, latencyMs, requestedAt: new Date().toISOString(), promptVersion }));
        } catch (err) {
          logger.error("reduck.process.stream.error", err, { requestId, provider: providerId as import("@breason/types").AIProvider, promptVersion });
          controller.enqueue(enc({ type: "error", message: err instanceof Error ? err.message : "Processing failed" }));
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
    const processedText = await dispatch(providerId, modelId, systemPrompt, text);
    const latencyMs = Date.now() - t0;
    logger.aiCall({ provider: providerId as import("@breason/types").AIProvider, promptVersion, latencyMs, success: true, requestId });
    return Response.json(
      { processedText, provider: providerId, model: modelId, promptVersion, latencyMs, requestedAt: new Date().toISOString() },
      { headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const latencyMs = Date.now() - t0;
    logger.error("reduck.process.error", err, { requestId, provider: providerId as import("@breason/types").AIProvider, promptVersion, latencyMs });
    return Response.json({ error: err instanceof Error ? err.message : "Processing failed" }, { status: 500 });
  }
}
