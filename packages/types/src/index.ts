// ── Markets ───────────────────────────────────────────────────────────────────

export type MarketKey = "brazil" | "poland" | "germany";

export const MARKET_KEYS: MarketKey[] = ["brazil", "poland", "germany"];

export function isMarketKey(v: unknown): v is MarketKey {
  return typeof v === "string" && MARKET_KEYS.includes(v as MarketKey);
}

// ── Feature flags ─────────────────────────────────────────────────────────────

export interface FeatureFlags {
  enableResonance: boolean;
  enableReDuckIntegration: boolean;
  enableRateLimiting: boolean;
}

// ── AI provider metadata ──────────────────────────────────────────────────────

export type AIProvider =
  | "gemini-2.5-flash"
  | "openrouter"
  | "groq"
  | "tavily"
  | "gemini-grounding"
  | "local";

/** Standardised metadata returned alongside every AI response. */
export interface AIResponseMeta {
  provider: AIProvider;
  promptVersion: string;
  tokensUsed?: number;
  latencyMs: number;
  requestedAt: string;
}

// ── Analyze ───────────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  text: string;
  market: MarketKey;
}

export interface AnalyzeResult extends AIResponseMeta {
  score: number;
  verdict: "PASS" | "SUSPICIOUS" | "FOREIGN";
  marketTension: string;
  insight: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
}

// ── Resonance ─────────────────────────────────────────────────────────────────

export interface ResonanceTrend {
  title: string;
  resonanceScore: number;
  marketTension: string;
  insight: string;
}

export interface ResonanceTrendsRequest {
  market: MarketKey;
}

export interface ResonanceTrendsResponse extends AIResponseMeta {
  trends: ResonanceTrend[];
}

export interface ResonanceGenerateRequest {
  market: MarketKey;
  trend: ResonanceTrend;
}

export interface ResonanceGenerateResponse extends AIResponseMeta {
  headline: string;
  body: string;
  cta: string;
}

// ── ReDuck ────────────────────────────────────────────────────────────────────

export interface ReDuckPreset {
  id: string;
  label: string;
  icon: string;
  description: string;
  systemPrompt: string;
}

export interface ReDuckProcessRequest {
  systemPrompt: string;
  text: string;
  providerId: string;
  modelId: string;
  promptVersion?: string;
}

export interface ReDuckProcessResult extends AIResponseMeta {
  processedText: string;
}

export interface ReDuckModelInfo {
  id: string;
  label: string;
  providerId: string;
  description?: string;
}

export interface ReDuckProviderGroup {
  id: string;
  name: string;
  models: ReDuckModelInfo[];
}

// ── Logging ───────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  provider?: AIProvider;
  promptVersion?: string;
  latencyMs?: number;
  error?: string;
  requestId?: string;
  timestamp: string;
}
