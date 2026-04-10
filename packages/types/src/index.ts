export type AIProvider = 'gemini' | 'groq' | 'openai' | 'anthropic' | 'local';

export interface AIResponseMeta {
  provider: AIProvider;
  latencyMs: number;
  requestedAt: string;
}

export type MarketKey = "germany" | "poland" | "brazil" | "global";

export type PromptKey = 
  | "search" 
  | "evaluate" 
  | "improve_icebreaker" 
  | "improve_thought_leader" 
  | "improve_landing_page" 
  | "improve_follow_up" 
  | "improve_social"
  | "improve_standard";

export type CustomPrompts = Partial<Record<PromptKey, string>>;

export interface NewsItem {
  headline: string;
  topic: string;
  category: string;
  summary: string;
  business_impact: string;
}

export interface Rewrite {
  block: string;
  original: string;
  suggested: string;
  suggested_local: string;
  reason: string;
}

export interface FeatureFlags {
  resonanceEnabled: boolean;
  reDuckEnabled: boolean;
  analyzeEnabled: boolean;
}
