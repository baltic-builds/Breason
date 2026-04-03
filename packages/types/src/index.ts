// ─── AI Providers ────────────────────────────────────────────────────────────

export type AIProvider =
  | 'gemini'
  | 'gemini-2.5-flash'
  | 'groq'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'local';

export interface AIResponseMeta {
  provider: AIProvider;
  promptVersion: string;
  tokensUsed?: number;
  latencyMs: number;
  requestedAt: string;
  /** Approximate cost in USD for this request */
  costUsd?: number;
}

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

// ─── Resonance ────────────────────────────────────────────────────────────────

export type ResonanceTrend = {
  /** Название / ключевая фраза тренда */
  title: string;
  /** Рынок / страна, например "BR", "MX" */
  market?: string;
  /** Язык, например "pt-BR", "es" */
  language?: string;
  /** Источник данных: tavily, google и т.д. */
  source?: string;
  /** Релевантность / сила резонанса (0..100) */
  resonanceScore?: number;
  /** Основное рыночное противоречие/напряжение */
  marketTension?: string;
  /** Ключевой инсайт по тренду */
  insight?: string;
  /** Краткое пояснение / контекст */
  description?: string;
  /** Любые числовые или строковые метрики */
  metrics?: Record<string, number | string>;
};

export interface ResonanceTrendsResponse {
  trends: ResonanceTrend[];
  market: string;
  generatedAt: string;
}

export interface ResonanceGenerateResponse {
  headline: string;
  body: string;
  cta: string;
  trend: ResonanceTrend;
  market: string;
  generatedAt: string;
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
}

// ─── Logger ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}
