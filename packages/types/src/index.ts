export type AIProvider = 'gemini' | 'groq' | 'openai' | 'anthropic' | 'local';

export interface AIResponseMeta {
  provider: AIProvider;
  latencyMs: number;
  requestedAt: string;
}

export type MarketKey = "germany" | "poland" | "brazil";

export type PromptKey = 
  | "search" 
  | "evaluate" 
  | "improve_icebreaker" 
  | "improve_thought_leader" 
  | "improve_landing_page" 
  | "improve_follow_up" 
  | "improve_social"
  | "improve_standard";

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

export interface EvaluateResult {
  verdict: "PASS" | "SUSPICIOUS" | "FOREIGN";
  verdict_reason: string;
  rewrites: Rewrite[];
}

export interface ImproveResult {
  improved_text: string;
  improved_local: string;
  tone_achieved: string;
  changes: { what: string; why: string }[];
}
