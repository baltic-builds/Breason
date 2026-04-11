import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

// ── Утилиты ──────────────────────────────────────────────────────────────────

function parseJson(text: string): any {
  try {
    const clean = text.replace(/```(json)?\n?/g, '').replace(/```\n?/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON found in response");
    return JSON.parse(match[0]);
  } catch (e: any) {
    console.error("❌ JSON Parse Error:", text.slice(0, 300));
    throw new Error(`Invalid JSON: ${e.message}`);
  }
}

function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Serper API ────────────────────────────────────────────────────────────────

interface SerperNewsItem { title: string; snippet: string; source: string; date?: string; link: string; }

async function fetchRealNews(market: string, queries: string[], keyword?: string): Promise<SerperNewsItem[]> {
  if (!process.env.SERPER_API_KEY) return [];

  const baseQuery = queries.slice(0, 2).join(" OR ");
  const combinedQuery = keyword ? `(${baseQuery}) ${keyword}` : baseQuery;

  try {
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: combinedQuery,
        gl: market === "germany" ? "de" : market === "poland" ? "pl" : "br",
        hl: market === "germany" ? "de" : market === "poland" ? "pl" : "pt",
        num: 15, tbs: "qdr:m3",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Serper ${res.status}`);
    const data = await res.json();
    const news: SerperNewsItem[] = (data.news || []).map((item: any) => ({
      title: item.title || "", snippet: item.snippet || "",
      source: item.source || "", date: item.date || "", link: item.link || "",
    }));
    const seen = new Set<string>();
    return news.filter(item => {
      if (!item.title || seen.has(item.title)) return false;
      seen.add(item.title); return true;
    }).slice(0, 20);
  } catch (e: any) {
    console.warn(`⚠️ Serper failed: ${e.message}`);
    return [];
  }
}

function formatNewsForPrompt(news: SerperNewsItem[]): string {
  if (!news.length) return "Реальные новости недоступны — используй свои знания рынка.";
  return news.map((item, i) =>
    `[${i + 1}] ${item.title}\nИсточник: ${item.source}${item.date ? ` · ${item.date}` : ""}\n${item.snippet}`
  ).join("\n\n");
}

// ── Провайдеры ─────────────────────────────────────────────────────────────

async function groqFallback(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAI(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return parseJson(result.response.text());
  } catch (e: any) {
    console.warn(`⚠️ Gemini failed: ${e.message}`);
  }
  try {
    const raw = await groqFallback(prompt);
    return parseJson(raw);
  } catch (e: any) {
    console.warn(`⚠️ Groq failed: ${e.message}`);
    throw new Error("All providers failed.");
  }
}

// ── Профили рынков ────────────────────────────────────────────────────────────

const MARKET_PROFILES: Record<string, {
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

const TARGET_TOPICS = ["B2B Продажи и CRM", "Финансы и Консалтинг", "Ритейл и E-commerce", "IT и Разработка"];

function normalizeTrends(items: any[]): any[] {
  const grouped: Record<string, any[]> = {};
  TARGET_TOPICS.forEach(t => grouped[t] = []);

  items.forEach(item => {
    let topic = item.topic || "IT и Разработка";
    const matched = TARGET_TOPICS.find(t => t.toLowerCase().includes(topic.toLowerCase().split(' ')[0])) || "IT и Разработка";
    grouped[matched].push(item);
  });

  const finalItems: any[] = [];
  TARGET_TOPICS.forEach(t => {
    const topicItems = grouped[t];
    while (topicItems.length < 3) {
      topicItems.push({
        headline: `Адаптация процессов в секторе ${t.split(' ')[0]}`,
        topic: t, category: "Оптимизация",
        summary: "Индустрия адаптируется к новым экономическим реалиям.",
        business_impact: "Требует пересмотра текущих стратегий."
      });
    }
    finalItems.push(...topicItems.slice(0, 3));
  });
  return finalItems;
}

// ── Системные промпты (экспортируемые шаблоны) ───────────────────────────────
// Шаблоны принимают плейсхолдеры вида {{MARKET}}, {{DATE}} и т.д.
// Фронт заменяет плейсхолдеры перед отправкой или использует промпт as-is

export const SYSTEM_PROMPT_TEMPLATES = {
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
  "genericness_score": <0-100>,
  "generic_phrases": ["фраза 1", "фраза 2"],
  "tone_map": {
    "formal_casual": <-5..5>,
    "bold_cautious": <-5..5>,
    "technical_benefit": <-5..5>,
    "abstract_concrete": <-5..5>,
    "global_native": <-5..5>
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


  improve_social: `Ты — SMM-стратег и B2B-копирайтер для рынка {{MARKET}}.
Задача: превратить текст в виральный пост для профессиональных соцсетей (LinkedIn / X).
Тренд для хука: "{{TREND_NAME}}".
{{CUSTOM_INSTRUCTIONS}}

ПРАВИЛА:
- Начни с провокационного или неожиданного утверждения (1 предложение).
- Раскрой проблему через реальную боль рынка {{MARKET}} (2-3 предложения).
- Дай решение или инсайт, связанный с трендом (2-3 предложения).
- Заверши вовлекающим вопросом к аудитории.
- Добавь 3-5 релевантных хэштегов на языке {{LANGUAGE}}.
- Умеренно используй эмодзи (2-4 штуки) для визуального ритма.
- НЕ используй корпоративный язык. Пиши как человек, а не бренд.

ИСХОДНЫЙ ТЕКСТ:
"""{{TEXT}}"""

Вернуть СТРОГО JSON. Никакого Markdown внутри текста.
{
  "improved_text": "Полная версия на EN",
  "improved_local": "Финальная версия на {{LANGUAGE}} (ТОЛЬКО ЧИСТЫЙ ТЕКСТ)",
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

// ── Построители промптов (принимают пользовательские промпты, если переданы) ──

function buildSearchPrompt(
  market: string, newsContext: string,
  today: string, ninetyDaysAgo: string,
  keyword?: string, userPrompt?: string,
): string {
  // Если userPrompt — полный промпт от пользователя, используем его как основу,
  // иначе берём системный шаблон и подставляем переменные
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const keywordClause = keyword?.trim() ? `ФОКУС: Приоритизируй тренды, связанные с "${keyword.trim()}".` : "";
  const customClause  = userPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:\n${userPrompt.trim()}\n` : "";

  return `
Ты старший аналитик B2B-рынков. Составь деловой дайджест для рынка ${p.label}.
СЕГОДНЯ: ${today}. Период: с ${ninetyDaysAgo}.
${customClause}
КОНТЕКСТ ИЗ СМИ:
---
${newsContext}
---
ЗАДАЧА: Сгенерируй ровно 12 актуальных B2B-трендов. СТРОГО по 3 тренда на каждую из 4 тем: ${TARGET_TOPICS.join(", ")}.
${keywordClause}

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Весь текст ТОЛЬКО на русском языке.
2. Только plain text. Никакого Markdown.
3. Не упоминай COVID.

Ответь ТОЛЬКО валидным JSON:
{
  "market": "${p.label}",
  "generated_at": "${today}",
  "items": [
    {
      "headline": "Краткий заголовок",
      "topic": "Строго одна из тем: ${TARGET_TOPICS.join(", ")}",
      "category": "Подкатегория",
      "summary": "2 предложения сути",
      "business_impact": "Следствие для B2B продаж"
    }
  ]
}
  `.trim();
}

function buildEvaluatePrompt(text: string, market: string, trendContext?: string, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const customClause = userPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ: ${userPrompt.trim()}\n` : "";

  return `
Ты старший аудитор B2B-локализации. Проанализируй текст для рынка ${p.label}.
ПРОФИЛЬ: Тон: ${p.tone} | Доверие: ${p.trust.join(", ")} | Красные флаги: ${p.redFlags.join(", ")}
${trendContext ? `\nТРЕНД РЫНКА (учитывай при аудите): ${trendContext}` : ""}
${customClause}
ТЕКСТ:
"""${text}"""

Ответь ТОЛЬКО JSON:
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно предложение (RU)",
  "genericness_score": <0-100>,
  "generic_phrases": ["фраза 1", "фраза 2"],
  "tone_map": {
    "formal_casual": <-5..5>,
    "bold_cautious": <-5..5>,
    "technical_benefit": <-5..5>,
    "abstract_concrete": <-5..5>,
    "global_native": <-5..5>
  },
  "missing_trust_signals": ["сигнал 1"],
  "rewrites": [
    {
      "block": "Заголовок/CTA (RU)",
      "original": "фрагмент исходника",
      "suggested": "EN rewrite",
      "suggested_local": "Rewrite in ${p.language} (PLAIN TEXT)",
      "reason": "Почему лучше (RU)"
    }
  ]
}
  `.trim();
}

function buildImprovePrompt(
  text: string, market: string, preset: string,
  trendContext?: any, userPrompt?: string,
): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const trendName    = trendContext?.headline     || "Оптимизация корпоративных систем";
  const trendTension = trendContext?.business_impact || "Бизнес ищет снижение издержек";
  const customClause = userPrompt?.trim() ? `\nДОП. ИНСТРУКЦИИ: ${userPrompt.trim()}\n` : "";

  const PRESET_TEMPLATES: Record<string, string> = {
    icebreaker: `Ты — Senior B2B Copywriter на рынке: ${p.label}. 
Перепиши текст холодного сообщения.
ХУК: Используй тренд "${trendName}". Боль рынка: "${trendTension}".
СТРУКТУРА: 1. Тема. 2. Хук. 3. Ценность. 4. Пруф. 5. Мягкий CTA.`,

    thought_leader: `Ты — топовый B2B Influencer на рынке: ${p.label}.
Трансформируй текст в пост.
ХУК: Вплети тренд "${trendName}" (Боль: "${trendTension}").
СТРУКТУРА: Провокационный хук, раскрытие проблемы, решение, открытый вопрос к аудитории.`,

    landing_page: `Ты — продуктовый маркетолог на рынке: ${p.label}.
Перепиши описание продукта под менталитет рынка, опираясь на тренд: "${trendName}".
СТРУКТУРА: 
Главное обещание.
Как мы решаем боль.
Три прагматичных преимущества (буллиты).`,

    follow_up: `Ты — Account Executive на рынке: ${p.label}.
Напиши фоллоу-ап.
ХУК: Упомяни тренд "${trendName}" как причину для контакта и покажи решение боли "${trendTension}".
СТРУКТУРА: 1 абзац. Максимум 4-5 предложений.`,


    social: `Ты — SMM-стратег для рынка ${p.label}.
Превратите текст в виральный B2B-пост для LinkedIn / X.
Тренд для хука: "${trendName}".
ПРАВИЛА: Провокационный старт → боль рынка → решение → вопрос к аудитории. Хэштеги, умеренные эмодзи.`,

    standard: `Ты эксперт B2B-копирайтер для рынка ${p.label}. Перепиши текст нативно. Учитывай тренд: ${trendName}.`,
  };

  const basePrompt = PRESET_TEMPLATES[preset] || PRESET_TEMPLATES["standard"];

  return `
${basePrompt}
${customClause}

ИСХОДНЫЙ ТЕКСТ:
"""${text}"""

СИСТЕМНОЕ ОГРАНИЧЕНИЕ (КРИТИЧЕСКИ ВАЖНО):
Вернуть результат СТРОГО в формате JSON. НИКАКОГО Markdown. Только plain text.

{
  "improved_text": "Полная версия на EN",
  "improved_local": "Финальная версия на ${p.language} (СТРОГО БЕЗ MARKDOWN. ТОЛЬКО ЧИСТЫЙ ТЕКСТ)",
  "changes": [
    { "what": "Что изменено (RU)", "why": "Почему работает лучше (RU)" }
  ],
  "tone_achieved": "Описание тона (RU)"
}
  `.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// Роуты API
// ════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // GET /api/resonance-trends?action=prompts
  // Возвращает все системные промпты для редактора на фронте
  if (action === 'prompts') {
    return NextResponse.json({
      prompts: SYSTEM_PROMPT_TEMPLATES,
      promptKeys: Object.keys(SYSTEM_PROMPT_TEMPLATES),
    });
  }

  // GET /api/resonance-trends?market=germany (backward compat)
  return handleSearch(searchParams.get('market') || 'germany', searchParams.get('keyword') || '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, market = 'germany', keyword, text, trendContext, preset, customPrompts } = body;

    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json({ error: "Некорректный рынок." }, { status: 400 });
    }

    if (action === "search") {
      return handleSearch(market, keyword, customPrompts?.search);
    }

    if (action === "evaluate") {
      if (!text?.trim()) return NextResponse.json({ error: "Текст не передан." }, { status: 400 });
      const prompt = buildEvaluatePrompt(text, market, trendContext?.headline, customPrompts?.evaluate);
      const data   = await callAI(prompt);
      return NextResponse.json(data);
    }

    if (action === "improve") {
      if (!text?.trim()) return NextResponse.json({ error: "Текст не передан." }, { status: 400 });
      const prompt = buildImprovePrompt(text, market, preset || "standard", trendContext, customPrompts?.improve);
      const data   = await callAI(prompt);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });

  } catch (error: any) {
    console.error("❌ POST Error:", error.message);
    return NextResponse.json(
      { error: "Сервисы генерации временно недоступны.", details: error.message },
      { status: 503 },
    );
  }
}

async function handleSearch(market: string, keyword?: string, userPrompt?: string): Promise<NextResponse> {
  const { today, ninetyDaysAgo } = getDateRange();
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;

  const realNews    = await fetchRealNews(market, profile.searchQueries, keyword);
  const newsContext = formatNewsForPrompt(realNews);
  const prompt      = buildSearchPrompt(market, newsContext, today, ninetyDaysAgo, keyword, userPrompt);

  try {
    const data            = await callAI(prompt);
    const items           = data?.items ?? (Array.isArray(data) ? data : []);
    const normalizedItems = normalizeTrends(items);

    return NextResponse.json({
      market: profile.label,
      generated_at: today,
      keyword_focus: keyword || "",
      items: normalizedItems,
    });

  } catch (error: any) {
    return NextResponse.json({
      market: profile.label, generated_at: today, keyword_focus: keyword || "",
      items: normalizeTrends([]),
    }, { status: 200 });
  }
}
