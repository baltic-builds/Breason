export type AIProvider = 'gemini' | 'groq' | 'openrouter' | 'openai' | 'anthropic';

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

// Market & other types
export type MarketKey = string;
export const isMarketKey = (key: string): key is MarketKey => {
  return ['br', 'mx', 'latam', 'global'].includes(key);
};

// Resonance
export type ResonanceTrend = {
  /** Название / ключевая фраза тренда */
  title: string;
  /** Рынок / страна, например "BR", "MX" */
  market?: string;
  /** Язык, например "pt-BR", "es" */
  language?: string;
  /** Источник данных: tavily, google и т.д. */
  source?: string;
  /** Релевантность запросу/аудитории (0..1) — используется в тестах как resonanceScore */
  resonanceScore?: number;
  /** Краткое пояснение / контекст */
  description?: string;
  /** Любые числовые или строковые метрики */
  metrics?: Record<string, number | string>;
};
