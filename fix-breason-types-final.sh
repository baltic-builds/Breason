#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
TYPES_FILE="$ROOT/packages/types/src/index.ts"

if [ ! -f "$TYPES_FILE" ]; then
  echo "Cannot find $TYPES_FILE. Run this from the repository root." >&2
  exit 1
fi

cp "$TYPES_FILE" "$TYPES_FILE.bak.$(date +%Y%m%d%H%M%S)"

cat > "$TYPES_FILE" <<'TS'
// packages/types/src/index.ts
// Shared public contracts used across apps, prompts, and shared runtime.
// Keep these types intentionally permissive where legacy shared code returns
// flattened metadata and newer code may return nested meta objects.

export type AIProvider = string;

export interface AIResponseMeta {
  provider: AIProvider;
  latencyMs: number;
  requestedAt: string;
  promptVersion?: string;
  tokensUsed?: number;
  requestId?: string;
  model?: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  provider?: AIProvider;
  promptVersion?: string;
  latencyMs?: number;
  tokensUsed?: number;
  requestId?: string;
  error?: string;
  model?: string;
  [key: string]: unknown;
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

export interface AnalyzeResult extends AIResponseMeta {
  score: number;
  verdict: "PASS" | "SUSPICIOUS" | "FOREIGN" | string;
  marketTension?: string;
  insight?: string;
  strengths?: string[];
  risks?: string[];
  suggestions?: string[];
  meta?: AIResponseMeta;
  [key: string]: unknown;
}

export interface ResonanceTrend {
  title: string;
  resonanceScore?: number;
  marketTension?: string;
  insight?: string;
  narrative_hook?: string;
  market_tension?: string;
  why_now?: string;
  source?: string;
  proof?: string;
  angle?: string;
  [key: string]: unknown;
}

export interface ResonanceTrendsResponse extends AIResponseMeta {
  trends: ResonanceTrend[];
  analyst_note?: string;
  market?: string;
  year?: number;
  meta?: AIResponseMeta;
  [key: string]: unknown;
}

export interface ResonanceGenerateResponse extends AIResponseMeta {
  headline: string;
  body: string;
  cta: string;
  meta?: AIResponseMeta;
  [key: string]: unknown;
}
TS

npm run type-check
