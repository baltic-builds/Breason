import type { MarketKey, CustomPrompts, PromptKey } from "@breason/types";

// ── Профили рынков ──
export const MARKET_PROFILES: Record<string, {
  label: string; labelRu: string; language: string;
  searchQueries: string[];
  tone: string; trust: string[]; redFlags: string[]; cta: string;
}> = {
  germany: {
    label: "Germany (DACH)", labelRu: "Германия", language: "German",
    searchQueries: ["B2B Software Trends Deutschland 2025", "Digitalisierung Mittelstand aktuell"],
    tone: "Formal, precise, process-oriented, deeply skeptical of hype",
    trust: ["GDPR compliance", "ISO certifications", "EU data residency", "SLA clarity"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta: "Soft: 'Demo anfragen', 'Unverbindlich beraten lassen'",
  },
  poland: {
    label: "Poland", labelRu: "Польша", language: "Polish",
    searchQueries: ["trendy B2B Polska 2025", "rynek SaaS Polska nowe technologie"],
    tone: "Direct but fact-based, values concrete numbers, transparent pricing",
    trust: ["specific ROI metrics", "transparent pricing", "technical specifications", "implementation timeline"],
    redFlags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta: "Direct: 'Umów demo (15 min)', 'Zobacz jak to działa'",
  },
  brazil: {
    label: "Brazil", labelRu: "Бразилия", language: "Brazilian Portuguese",
    searchQueries: ["tendências B2B Brasil 2025", "mercado SaaS Brasil novidades"],
    tone: "Warm, human, relationship-first, low-friction",
    trust: ["Portuguese language support", "local case studies", "WhatsApp contact", "LGPD compliance"],
    redFlags: ["cold corporate tone", "aggressive sales push", "English-only support"],
    cta: "Human: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
  },
};

export const TARGET_TOPICS = ["B2B Продажи и CRM", "Финансы и Консалтинг", "Ритейл и E-commerce", "IT и Разработка"];

// ── Базовые шаблоны ──
export const SYSTEM_PROMPT_TEMPLATES: Record<PromptKey, string> = {
  search: `Ты старший аналитик B2B-рынков. Составь деловой дайджест для рынка {{MARKET}}.
СЕГОДНЯ: {{TODAY}}. Период: с {{NINETY_DAYS_AGO}}.

{{CUSTOM_INSTRUCTIONS}}

КОНТЕКСТ ИЗ СМИ:
---
{{NEWS_CONTEXT}}
---

ЗАДАЧА: Сгенерируй ровно 12 актуальных B2B-трендов. СТРОГО по 3 тренда на каждую из 4 тем: B2B Продажи и CRM, Финансы и Консалтинг, Ритейл и E-commerce, IT и Разработка.
{{KEYWORD_FOCUS}}

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Весь текст ТОЛЬКО на русском языке.
2. Только plain text. Никакого Markdown.
3. Не упоминай COVID.

Ответь ТОЛЬКО валидным JSON:
{
  "market": "{{MARKET}}",
  "generated_at": "{{TODAY}}",
  "items": [
    {
      "headline": "Краткий заголовок",
      "topic": "Строго одна из тем: B2B Продажи и CRM, Финансы и Консалтинг, Ритейл и E-commerce, IT и Разработка",
      "category": "Подкатегория",
      "summary": "2 предложения сути",
      "business_impact": "Следствие для B2B продаж"
    }
  ]
}`,

  evaluate: `Ты старший аудитор B2B-локализации. Проанализируй текст для рынка {{MARKET}}.
ПРОФИЛЬ: Тон: {{TONE}} | Доверие: {{TRUST}} | Красные флаги: {{RED_FLAGS}}
{{TREND_CONTEXT}}
{{CUSTOM_INSTRUCTIONS}}

ТЕКСТ:
"""{{TEXT}}"""

Ответь ТОЛЬКО JSON:
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно предложение (RU)",
  "genericness_score": 0,
  "generic_phrases": ["фраза 1", "фраза 2"],
  "tone_map": {
    "formal_casual": 0,
    "bold_cautious": 0,
    "technical_benefit": 0,
    "abstract_concrete": 0,
    "global_native": 0
  },
  "missing_trust_signals": ["сигнал 1"],
  "rewrites": [
    {
      "block": "Заголовок/CTA (RU)",
      "original": "фрагмент исходника",
      "suggested": "EN rewrite",
      "suggested_local": "Rewrite in {{LANGUAGE}} (PLAIN TEXT)",
      "reason": "Почему лучше (RU)"
    }
  ]
}`,

  improve_icebreaker: `Ты — Senior B2B Copywriter на рынке: {{MARKET}}.
Перепиши текст холодного сообщения.
ХУК: Используй тренд "{{TREND_NAME}}". Боль рынка: "{{TREND_TENSION}}".
СТРУКТУРА: 1. Тема. 2. Хук. 3. Ценность. 4. Пруф. 5. Мягкий CTA.
{{CUSTOM_INSTRUCTIONS}}

ИСХОДНЫЙ ТЕКСТ:
"""{{TEXT}}"""

СИСТЕМНОЕ ОГРАНИЧЕНИЕ: Вернуть СТРОГО JSON. Никакого Markdown.
{
  "improved_text": "Полная версия на EN",
  "improved_local": "Финальная версия на {{LANGUAGE}} (СТРОГО БЕЗ MARKDOWN)",
  "changes": [{ "what": "Что изменено (RU)", "why": "Почему работает лучше (RU)" }],
  "tone_achieved": "Описание тона (RU)"
}`,

  improve_thought_leader: `Ты — топовый B2B Influencer на рынке: {{MARKET}}.
Трансформируй текст в пост.
ХУК: Вплети тренд "{{TREND_NAME}}" (Боль: "{{TREND_TENSION}}").
СТРУКТУРА: Провокационный хук, раскрытие проблемы, решение, открытый вопрос к аудитории.
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

  improve_landing_page: `Ты — продуктовый маркетолог на рынке: {{MARKET}}.
Перепиши описание продукта под менталитет рынка, опираясь на тренд: "{{TREND_NAME}}".
СТРУКТУРА:
Главное обещание.
Как мы решаем боль.
Три прагматичных преимущества (буллиты).
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

  improve_follow_up: `Ты — Account Executive на рынке: {{MARKET}}.
Напиши фоллоу-ап.
ХУК: Упомяни тренд "{{TREND_NAME}}" как причину для контакта и покажи решение боли "{{TREND_TENSION}}".
СТРУКТУРА: 1 абзац. Максимум 4-5 предложений.
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

  improve_standard: `Ты эксперт B2B-копирайтер для рынка {{MARKET}}. Перепиши текст нативно. Учитывай тренд: {{TREND_NAME}}.
ПРОФИЛЬ: Тон: {{TONE}} | Доверие: {{TRUST}} | Избегать: {{RED_FLAGS}}
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
};

// ── Построители промптов ──

export function buildSearchPrompt(market: string, newsContext: string, today: string, ninetyDaysAgo: string, keyword?: string, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const keywordClause = keyword?.trim() ? `ФОКУС: Приоритизируй тренды, связанные с "${keyword.trim()}".` : "";
  const customClause  = userPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:\n${userPrompt.trim()}\n` : "";

  return SYSTEM_PROMPT_TEMPLATES.search
    .replace('{{MARKET}}', p.label)
    .replace(/\{\{TODAY\}\}/g, today)
    .replace('{{NINETY_DAYS_AGO}}', ninetyDaysAgo)
    .replace('{{NEWS_CONTEXT}}', newsContext)
    .replace('{{KEYWORD_FOCUS}}', keywordClause)
    .replace('{{CUSTOM_INSTRUCTIONS}}', customClause);
}

export function buildEvaluatePrompt(text: string, market: string, trendContext?: string, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const customClause = userPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ: ${userPrompt.trim()}\n` : "";
  const trendStr = trendContext ? `\nТРЕНД РЫНКА (учитывай при аудите): ${trendContext}` : "";

  return SYSTEM_PROMPT_TEMPLATES.evaluate
    .replace('{{MARKET}}', p.label)
    .replace('{{TONE}}', p.tone)
    .replace('{{TRUST}}', p.trust.join(", "))
    .replace('{{RED_FLAGS}}', p.redFlags.join(", "))
    .replace('{{TREND_CONTEXT}}', trendStr)
    .replace('{{CUSTOM_INSTRUCTIONS}}', customClause)
    .replace('{{TEXT}}', text)
    .replace('{{LANGUAGE}}', p.language);
}

export function buildImprovePrompt(text: string, market: string, preset: string, trendContext?: any, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const trendName    = trendContext?.headline     || "Оптимизация корпоративных систем";
  const trendTension = trendContext?.business_impact || "Бизнес ищет снижение издержек";
  const customClause = userPrompt?.trim() ? `\nДОП. ИНСТРУКЦИИ: ${userPrompt.trim()}\n` : "";

  const promptKey = `improve_${preset}` as PromptKey;
  const template = SYSTEM_PROMPT_TEMPLATES[promptKey] || SYSTEM_PROMPT_TEMPLATES.improve_standard;

  return template
    .replace(/\{\{MARKET\}\}/g, p.label)
    .replace(/\{\{TREND_NAME\}\}/g, trendName)
    .replace(/\{\{TREND_TENSION\}\}/g, trendTension)
    .replace('{{TONE}}', p.tone)
    .replace('{{TRUST}}', p.trust.join(", "))
    .replace('{{RED_FLAGS}}', p.redFlags.join(", "))
    .replace('{{CUSTOM_INSTRUCTIONS}}', customClause)
    .replace('{{TEXT}}', text)
    .replace(/\{\{LANGUAGE\}\}/g, p.language);
}
