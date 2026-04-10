// ─── AI Providers ─────────────────────────────────────────────────────────────
export type AIProvider = 'gemini' | 'gemini-2.5-flash' | 'groq' | 'openrouter' | 'openai' | 'anthropic' | 'local';

export interface AIResponseMeta {
  provider: AIProvider;
  promptVersion: string;
  tokensUsed?: number;
  latencyMs: number;
  requestedAt: string;
  costUsd?: number;
}

// ─── Market ───────────────────────────────────────────────────────────────────
export type MarketKey = "germany" | "poland" | "brazil" | "global";

export const isMarketKey = (key: string): key is MarketKey => {
  return ['brazil', 'poland', 'germany', 'global'].includes(key);
};

// ─── Prompts (New Architecture) ───────────────────────────────────────────────
export type PromptKey = 
  | "search" 
  | "evaluate" 
  | "improve_icebreaker" 
  | "improve_thought_leader" 
  | "improve_landing_page" 
  | "improve_follow_up" 
  | "improve_standard";

export type CustomPrompts = Partial<Record<PromptKey, string>>;

// ─── Resonance / Output Interfaces ────────────────────────────────────────────
export interface NewsItem {
  headline: string;
  topic: string;
  category: string;
  summary: string;
  business_impact: string;
  resonance_score?: number;
}

export interface ToneMap {
  formal_casual: number;
  bold_cautious: number;
  technical_benefit: number;
  abstract_concrete: number;
  global_native: number;
}

export interface Rewrite {
  block: string;
  original: string;
  suggested: string;
  suggested_local: string;
  reason: string;
}

// ─── Feature Flags ────────────────────────────────────────────────────────────
export interface FeatureFlags {
  resonanceEnabled: boolean;
  reDuckEnabled: boolean;
  analyzeEnabled: boolean;
}
