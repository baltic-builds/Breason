#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [ ! -f "packages/prompts/src/index.ts" ]; then
  echo "Run this from the Breason repo root, or pass repo path as first argument."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

idx = Path('packages/prompts/src/index.ts')
s = idx.read_text()

# 1) PromptKey now requires improve_social. Add the missing template before improve_standard.
if 'improve_social:' not in s:
    marker = '  improve_standard: `Ты эксперт B2B-копирайтер для рынка {{MARKET}}.'
    social = '''  improve_social: `Ты — Senior Social Media Strategist на рынке: {{MARKET}}.
Перепиши текст как сильный B2B social post.
ХУК: Используй тренд "{{TREND_NAME}}" и напряжение рынка "{{TREND_TENSION}}".
СТРУКТУРА: 1. Сильный первый абзац. 2. Конкретная проблема. 3. Практичный вывод. 4. Мягкий вопрос или CTA.
{{CUSTOM_INSTRUCTIONS}}

ИСХОДНЫЙ ТЕКСТ:
"""{{TEXT}}"""

Вернуть СТРОГО JSON. Никакого Markdown.
{
  "improved_text": "Полная версия на EN",
  "improved_local": "Финальная версия на {{LANGUAGE}} (СТРОГО БЕЗ MARKDOWN)",
  "changes": [{ "what": "Что изменено (RU)", "why": "Почему работает лучше (RU)" }],
  "tone_achieved": "Описание тона (RU)"
}`,

'''
    if marker not in s:
        raise SystemExit('Could not find improve_standard marker in packages/prompts/src/index.ts')
    s = s.replace(marker, social + marker)

# 2) Restore legacy exports expected by existing tests and older app code.
if 'export function analyzePrompt(' not in s:
    compat = r'''

// ── Legacy compatibility API ──
// Kept intentionally small so older tests/app imports continue to work while
// the newer build*Prompt API remains the source of truth.

export interface LegacyResonanceTrend {
  title: string;
  resonanceScore: number;
  marketTension: string;
  insight: string;
}

export function analyzePrompt(market: string, text: string): string {
  return buildEvaluatePrompt(text, market);
}

export function resonanceTrendsPrompt(market: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Analyze current B2B resonance trends for ${market}. Return strict JSON with a trends array. Date: ${today}.`;
}

export function resonanceGeneratePrompt(market: string, trend: LegacyResonanceTrend): string {
  return `Create B2B copy for ${market} using this trend: ${JSON.stringify(trend)}. Return strict JSON with headline, body, and cta keys.`;
}

export type PromptId =
  | "reduck/lead-magnet@1"
  | "reduck/articles@1"
  | "reduck/editorial@1"
  | "reduck/localization@1";

export interface ReduckPrompt {
  meta: {
    id: PromptId;
    title: string;
  };
  systemPrompt: string;
}

export const REDUCK_PROMPTS: ReduckPrompt[] = [
  {
    meta: { id: "reduck/lead-magnet@1", title: "Lead magnet" },
    systemPrompt: "You create practical B2B lead magnets with clear audience, promise, structure, proof, and conversion path. Return useful, specific, non-generic output.",
  },
  {
    meta: { id: "reduck/articles@1", title: "Articles" },
    systemPrompt: "You create expert B2B articles with strong thesis, structured argument, concrete examples, market relevance, and actionable conclusion. Avoid generic filler.",
  },
  {
    meta: { id: "reduck/editorial@1", title: "Editorial" },
    systemPrompt: "You create editorial B2B content with a clear point of view, human tone, useful framing, credible reasoning, and sharp final takeaway.",
  },
  {
    meta: { id: "reduck/localization@1", title: "Localization" },
    systemPrompt: "You localize B2B copy so it sounds native for the target market, preserving intent while adapting tone, trust signals, CTA, and cultural expectations.",
  },
];

export const REDUCK_PROMPT_MAP = {
  "lead-magnet": REDUCK_PROMPTS[0],
  articles: REDUCK_PROMPTS[1],
  editorial: REDUCK_PROMPTS[2],
  localization: REDUCK_PROMPTS[3],
} as const;
'''
    s = s.rstrip() + compat + '\n'

idx.write_text(s)

# 3) Add the legacy ResonanceTrend type expected by prompt tests.
types = Path('packages/types/src/index.ts')
ts = types.read_text()
if 'export interface ResonanceTrend' not in ts:
    insert = '''
export interface ResonanceTrend {
  title: string;
  resonanceScore: number;
  marketTension: string;
  insight: string;
}
'''
    ts = ts.rstrip() + '\n' + insert + '\n'
    types.write_text(ts)
PY

npm run type-check
