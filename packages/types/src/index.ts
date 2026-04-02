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

// Market & other types (добавляй по мере необходимости)
export type MarketKey = string;
export const isMarketKey = (key: string): key is MarketKey => {
  return ['br', 'mx', 'latam', 'global'].includes(key);
};
