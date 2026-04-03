// ─── AI Providers ─────────────────────────────────────────────────────────────

export type AIProvider =
  | 'gemini'
  | 'gemini-2.5-flash'
  | 'groq'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'local';

// ─── AI Meta (всегда отдельный объект внутри response) ────────────────────────

export interface AIResponseMeta {
  provider: AIProvider;
  promptVersion: string;
  tokensUsed?: number;
  latencyMs: number;
  requestedAt: string;
  costUsd?: number;
}

// ─── ReDuck ───────────────────────────────────────────────────────────────────

export interface ReDuckProcessResult {
  processedText: string;
  meta: AIResponseMeta;
}

export interface ReDuckProcessRequest {
  text: string;
  providerId: string;
  modelId?: string;
  promptVersion?: string;
}

// ─── Market ───────────────────────────────────────────────────────────────────

export type MarketKey = string;

export const isMarketKey = (key: string): key is MarketKey => {
  return ['br', 'mx', 'latam', 'global'].includes(key);
};

// ─── Logger ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  provider?: string;
  promptVersion?: string;
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

export interface ResonanceTrendsResponse {
  trends: ResonanceTrend[];
  market?: string;
  generatedAt?: string;
  meta?: AIResponseMeta;
  [key: string]: unknown;
}

export interface ResonanceGenerateResponse {
  headline: string;
  body: string;
  cta: string;
  trend?: ResonanceTrend;
  market?: string;
  generatedAt?: string;
  meta?: AIResponseMeta;
  [key: string]: unknown;
}

// ─── Analyze ──────────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  score: number;
  verdict: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  market?: string;
  language?: string;
  raw?: string;
  meta?: AIResponseMeta;
  [key: string]: unknown;
}
