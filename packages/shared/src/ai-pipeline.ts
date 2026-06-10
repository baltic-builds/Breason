import "server-only";
import { logger } from "./logger";

export type AiPipelineProviderId =
  | "openai-official-free"
  | "gemini-3.1-flash-lite"
  | "groq-qwen3-32b"
  | "groq-llama-3.3-70b-versatile"
  | "groq-compound"
  | "openrouter-gpt-oss-120b";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ProviderConfig = {
  id: AiPipelineProviderId;
  envKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  call: (args: { apiKey: string; model: string; prompt: string; maxOutputTokens: number; timeoutMs: number }) => Promise<AiTextResult>;
  enabled?: () => boolean;
};

export type AiTextResult = {
  text: string;
  provider: AiPipelineProviderId;
  model: string;
  tokensUsed?: number;
  latencyMs: number;
};

const DEFAULT_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? "0.35");
const FAIL_THRESHOLD = Number(process.env.AI_CIRCUIT_FAIL_THRESHOLD ?? "2");
const RESET_AFTER_MS = Number(process.env.AI_CIRCUIT_RESET_MS ?? "60000");
const OPENAI_DAILY_TOKEN_LIMIT = Number(process.env.OPENAI_DAILY_TOKEN_LIMIT ?? "200000");
const OPENAI_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "2200");

type CircuitState = { failures: number; openUntil: number };
const circuits = new Map<string, CircuitState>();

declare global {
  // Best-effort guard for serverless instances. It is intentionally conservative, but not a billing guarantee.
  // Use a separate OpenAI project and dashboard model/budget limits as the real protection layer.
  var __BREASON_OPENAI_DAILY_USAGE__: { day: string; estimatedTokens: number } | undefined;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function estimateTokens(text: string, maxOutputTokens: number): number {
  // Conservative rough estimate for mixed EN/PT/RU text.
  return Math.ceil(text.length / 3) + maxOutputTokens;
}

function hasOpenAiFreeEligibilityConfirmed(): boolean {
  return process.env.OPENAI_ENABLED !== "false" &&
    process.env.OPENAI_FREE_ONLY === "true" &&
    process.env.OPENAI_DATA_SHARING_CONFIRMED === "true";
}

function canUseOpenAiForFree(prompt: string): boolean {
  if (!hasOpenAiFreeEligibilityConfirmed()) return false;
  const day = todayKey();
  const usage = globalThis.__BREASON_OPENAI_DAILY_USAGE__;
  if (!usage || usage.day !== day) {
    globalThis.__BREASON_OPENAI_DAILY_USAGE__ = { day, estimatedTokens: 0 };
  }
  const current = globalThis.__BREASON_OPENAI_DAILY_USAGE__!.estimatedTokens;
  return current + estimateTokens(prompt, OPENAI_MAX_OUTPUT_TOKENS) <= OPENAI_DAILY_TOKEN_LIMIT;
}

function recordOpenAiEstimate(prompt: string, actualTokens?: number): void {
  const day = todayKey();
  const current = globalThis.__BREASON_OPENAI_DAILY_USAGE__;
  if (!current || current.day !== day) {
    globalThis.__BREASON_OPENAI_DAILY_USAGE__ = { day, estimatedTokens: 0 };
  }
  globalThis.__BREASON_OPENAI_DAILY_USAGE__!.estimatedTokens += actualTokens ?? estimateTokens(prompt, OPENAI_MAX_OUTPUT_TOKENS);
}

function isCircuitOpen(id: string): boolean {
  const state = circuits.get(id);
  if (!state) return false;
  if (state.failures >= FAIL_THRESHOLD && Date.now() < state.openUntil) return true;
  if (Date.now() >= state.openUntil) circuits.delete(id);
  return false;
}

function recordSuccess(id: string): void {
  circuits.delete(id);
}

function recordFailure(id: string): void {
  const state = circuits.get(id) ?? { failures: 0, openUntil: 0 };
  state.failures += 1;
  state.openUntil = Date.now() + RESET_AFTER_MS;
  circuits.set(id, state);
}

function abortSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** i));
      }
    }
  }
  throw lastError;
}

function firstTextFromOpenAiResponses(json: any): string {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text;
  const output = Array.isArray(json?.output) ? json.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text;
    }
  }
  return "";
}

async function callOpenAiOfficial({ apiKey, model, prompt, maxOutputTokens, timeoutMs }: Parameters<ProviderConfig["call"]>[0]): Promise<AiTextResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: maxOutputTokens,
      temperature: DEFAULT_TEMPERATURE,
      text: { format: { type: "json_object" } },
    }),
    signal: abortSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 800)}`);
  }

  const json = await response.json() as any;
  const text = firstTextFromOpenAiResponses(json);
  if (!text) throw new Error("OpenAI returned an empty response");
  return {
    text,
    provider: "openai-official-free",
    model,
    tokensUsed: json?.usage?.total_tokens,
    latencyMs: 0,
  };
}

async function callGemini({ apiKey, model, prompt, maxOutputTokens, timeoutMs }: Parameters<ProviderConfig["call"]>[0]): Promise<AiTextResult> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: DEFAULT_TEMPERATURE,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
    signal: abortSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 800)}`);
  }

  const json = await response.json() as any;
  const text = json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("").trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return {
    text,
    provider: "gemini-3.1-flash-lite",
    model,
    tokensUsed: json?.usageMetadata?.totalTokenCount,
    latencyMs: 0,
  };
}

async function callGroq({ apiKey, model, prompt, maxOutputTokens, timeoutMs }: Parameters<ProviderConfig["call"]>[0]): Promise<AiTextResult> {
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: DEFAULT_TEMPERATURE,
      max_completion_tokens: maxOutputTokens,
      response_format: { type: "json_object" },
    }),
    signal: abortSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${(await response.text()).slice(0, 800)}`);
  }

  const json = await response.json() as any;
  const text = json?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error(`Groq ${model} returned an empty response`);
  return {
    text,
    provider: model === "qwen/qwen3-32b" ? "groq-qwen3-32b" : model === "groq/compound" ? "groq-compound" : "groq-llama-3.3-70b-versatile",
    model,
    tokensUsed: json?.usage?.total_tokens,
    latencyMs: 0,
  };
}

async function callOpenRouter({ apiKey, model, prompt, maxOutputTokens, timeoutMs }: Parameters<ProviderConfig["call"]>[0]): Promise<AiTextResult> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Breason",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: maxOutputTokens,
      response_format: { type: "json_object" },
    }),
    signal: abortSignal(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 800)}`);
  }

  const json = await response.json() as any;
  const text = json?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error(`OpenRouter ${model} returned an empty response`);
  return {
    text,
    provider: "openrouter-gpt-oss-120b",
    model,
    tokensUsed: json?.usage?.total_tokens,
    latencyMs: 0,
  };
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai-official-free",
    envKey: "OPENAI_API_KEY",
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini-2026-03-17",
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? "25000"),
    maxOutputTokens: OPENAI_MAX_OUTPUT_TOKENS,
    call: callOpenAiOfficial,
    enabled: () => true,
  },
  {
    id: "gemini-3.1-flash-lite",
    envKey: "GEMINI_API_KEY",
    model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? "22000"),
    maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "2600"),
    call: callGemini,
  },
  {
    id: "groq-qwen3-32b",
    envKey: "GROQ_API_KEY",
    model: process.env.GROQ_QWEN_MODEL ?? "qwen/qwen3-32b",
    timeoutMs: Number(process.env.GROQ_TIMEOUT_MS ?? "22000"),
    maxOutputTokens: Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? "2600"),
    call: callGroq,
  },
  {
    id: "groq-llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
    model: process.env.GROQ_LLAMA_MODEL ?? "llama-3.3-70b-versatile",
    timeoutMs: Number(process.env.GROQ_TIMEOUT_MS ?? "22000"),
    maxOutputTokens: Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? "2600"),
    call: callGroq,
  },
  {
    id: "groq-compound",
    envKey: "GROQ_API_KEY",
    model: process.env.GROQ_COMPOUND_MODEL ?? "groq/compound",
    timeoutMs: Number(process.env.GROQ_COMPOUND_TIMEOUT_MS ?? "28000"),
    maxOutputTokens: Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? "2600"),
    call: callGroq,
  },
  {
    id: "openrouter-gpt-oss-120b",
    envKey: "OPENROUTER_API_KEY",
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free",
    timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? "28000"),
    maxOutputTokens: Number(process.env.OPENROUTER_MAX_OUTPUT_TOKENS ?? "2600"),
    call: callOpenRouter,
    enabled: () => process.env.OPENROUTER_ENABLED !== "false",
  },
];

function providerCanRun(provider: ProviderConfig, prompt: string): boolean {
  if (provider.enabled && !provider.enabled()) return false;
  if (!process.env[provider.envKey]) return false;
  if (provider.id === "openai-official-free") return canUseOpenAiForFree(prompt);
  return true;
}

export async function callFreeAi(prompt: string, requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`): Promise<AiTextResult> {
  const errors: Array<{ provider: string; message: string }> = [];

  for (const provider of PROVIDERS) {
    if (!providerCanRun(provider, prompt)) {
      logger.warn("ai.provider.skipped", { provider: provider.id, requestId });
      continue;
    }
    if (isCircuitOpen(provider.id)) {
      logger.warn("ai.circuit.open", { provider: provider.id, requestId });
      continue;
    }

    const startedAt = Date.now();
    try {
      const result = await withRetry(() => provider.call({
        apiKey: process.env[provider.envKey]!,
        model: provider.model,
        prompt,
        maxOutputTokens: provider.maxOutputTokens,
        timeoutMs: provider.timeoutMs,
      }));
      const latencyMs = Date.now() - startedAt;
      recordSuccess(provider.id);
      if (provider.id === "openai-official-free") recordOpenAiEstimate(prompt, result.tokensUsed);
      logger.aiCall({ provider: provider.id, promptVersion: "resonance-trends", latencyMs, success: true, tokensUsed: result.tokensUsed, requestId });
      return { ...result, latencyMs };
    } catch (error: unknown) {
      const latencyMs = Date.now() - startedAt;
      recordFailure(provider.id);
      errors.push({ provider: provider.id, message: error instanceof Error ? error.message : String(error) });
      logger.error("ai.provider.failed", error, { provider: provider.id, latencyMs, requestId });
    }
  }

  throw new Error(`All AI providers failed or were skipped: ${JSON.stringify(errors).slice(0, 1200)}`);
}

export function extractFirstJsonBlock(text: string): string {
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const startObj = clean.indexOf("{");
  const startArr = clean.indexOf("[");
  const start = startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);
  if (start === -1) throw new Error("No JSON object found in AI response");

  const openChar = clean[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < clean.length; i += 1) {
    const char = clean[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return clean.slice(start, i + 1);
    }
  }
  throw new Error("Unbalanced JSON object in AI response");
}

export function parseAiJson<T = unknown>(text: string): T {
  return JSON.parse(extractFirstJsonBlock(text)) as T;
}

export async function callFreeAiJson<T = unknown>(prompt: string, requestId?: string): Promise<T> {
  const result = await callFreeAi(prompt, requestId);
  return parseAiJson<T>(result.text);
}
