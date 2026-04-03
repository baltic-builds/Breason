import type { AIProvider } from "@breason/types";
import { logger } from "./logger";

export interface AICallResult {
  text: string;
  provider: AIProvider;
  tokensUsed?: number;
  latencyMs: number;
}

interface ProviderConfig {
  id: AIProvider;
  envKey: string;
  call: (apiKey: string, prompt: string) => Promise<{ text: string; tokensUsed?: number }>;
}

const FAIL_THRESHOLD = 3;
const RESET_AFTER_MS = 60_000;

interface CircuitState {
  failures: number;
  openUntil: number;
}

const circuits = new Map<string, CircuitState>();

function isOpen(provider: string): boolean {
  const state = circuits.get(provider);
  if (!state) return false;
  if (state.failures >= FAIL_THRESHOLD && Date.now() < state.openUntil) return true;
  if (Date.now() >= state.openUntil) circuits.delete(provider);
  return false;
}

function recordSuccess(provider: string): void {
  circuits.delete(provider);
}

function recordFailure(provider: string): void {
  const state = circuits.get(provider) ?? { failures: 0, openUntil: 0 };
  state.failures += 1;
  state.openUntil = Date.now() + RESET_AFTER_MS;
  circuits.set(provider, state);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 2, baseDelayMs = 300 }: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
      }
    }
  }
  throw lastErr;
}

async function callGemini(apiKey: string, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini: empty response");
  return { text, tokensUsed: json?.usageMetadata?.totalTokenCount };
}

async function callOpenRouter(apiKey: string, prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const text = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter: empty response");
  return { text, tokensUsed: json?.usage?.total_tokens };
}

async function callGroq(apiKey: string, prompt: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  const text = json?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Groq: empty response");
  return { text, tokensUsed: json?.usage?.total_tokens };
}

const PROVIDERS: ProviderConfig[] = [
  { id: "gemini-2.5-flash", envKey: "GEMINI_API_KEY",    call: callGemini },
  { id: "openrouter",       envKey: "OPENROUTER_API_KEY", call: callOpenRouter },
  { id: "groq",             envKey: "GROQ_API_KEY",       call: callGroq },
];

export async function callAiWithFallback(
  prompt: string,
  promptVersion = "unknown",
  requestId?: string
): Promise<AICallResult> {
  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;
    if (isOpen(provider.id)) {
      logger.warn("ai.circuit.open", { provider: provider.id, promptVersion, requestId });
      continue;
    }

    const t0 = Date.now();
    try {
      const result = await withRetry(() => provider.call(apiKey, prompt));
      const latencyMs = Date.now() - t0;
      recordSuccess(provider.id);
      logger.aiCall({ provider: provider.id, promptVersion, latencyMs, success: true, tokensUsed: result.tokensUsed, requestId });
      return { text: result.text, provider: provider.id, tokensUsed: result.tokensUsed, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - t0;
      recordFailure(provider.id);
      logger.error(`ai.call.error [${provider.id}]`, err, { provider: provider.id, promptVersion, latencyMs, requestId });
    }
  }

  logger.warn("ai.all.failed — using local fallback", { promptVersion, requestId });
  return { text: "", provider: "local", latencyMs: 0 };
}

export function softJson<T>(raw: string): T | null {
  const stripped = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  for (const candidate of [stripped, raw]) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      const start = candidate.indexOf("{");
      const end = candidate.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        try {
          return JSON.parse(candidate.slice(start, end + 1)) as T;
        } catch { /* continue */ }
      }
    }
  }
  return null;
}
