// ─── AI Providers ─────────────────────────────────────────────────────────────

export type AIProvider =
  | 'gemini'
  | 'gemini-2.5-flash'
  | 'groq'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'tavily'
  | 'local';

// ─── AI Meta ──────────────────────────────────────────────────────────────────

export interface AIResponseMeta {
  provider: AIProvider;
  promptVersion: string;
  tokensUsed?: number;
  latencyMs: number;
  requestedAt: string;
  costUsd?: number;
}

// ─── ReDuck ───────────────────────────────────────────────────────────────────

export interface ReDuckProcessRequest {
  text: string;
  providerId: string;
  modelId?: string;
  promptVersion?: string;
}

export interface ReDuckProcessResult {
  processedText: string;
  meta: AIResponseMeta;
}

export interface ReDuckModel {
  id: string;
  label: string;
  providerId: string;
  description?: string;
}

export interface ReDuckProviderGroup {
  id: string;
  name: string;
  models: ReDuckModel[];
}

// ─── Market ───────────────────────────────────────────────────────────────────

export type MarketKey = string;

export const isMarketKey = (key: string): key is MarketKey => {
  return ['br', 'mx', 'latam', 'global', 'brazil', 'poland', 'germany'].includes(key);
};

// ─── Logger ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  provider?: string;
  promptVersion?: string;
  latencyMs?: number;
  tokensUsed?: number;
  requestId?: string;
  success?: boolean;
  context?: Record<string, unknown>;
  error?: string | { message: string; stack?: string; code?: string };
  [key: string]: unknown;
}

// ─── Resonance ────────────────────────────────────────────────────────────────

export type ResonanceTrend = {
  title: string;
  market?: string;
  language?: string;
  source?: string;
  resonanceScore?: number;
  marketTension?: string;
  insight?: string;
  description?: string;
  metrics?: Record<string, number | string>;
  [key: string]: unknown;
};

export interface ResonanceTrendsResponse extends AIResponseMeta {
  trends: ResonanceTrend[];
  market?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

export interface ResonanceGenerateResponse extends AIResponseMeta {
  headline: string;
  body: string;
  cta: string;
  trend?: ResonanceTrend;
  market?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  text: string;
  market: string;
}

export interface ResonanceGenerateRequest {
  market: string;
  trend: ResonanceTrend;
}

// ─── Analyze ──────────────────────────────────────────────────────────────────

export interface AnalyzeResult extends AIResponseMeta {
  score: number;
  verdict: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  risks?: string[];
  marketTension?: string;
  insight?: string;
  market?: string;
  language?: string;
  raw?: string;
  [key: string]: unknown;
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlags {
  enableResonance: boolean;
  enableReDuckIntegration: boolean;
  enableRateLimiting: boolean;
}
