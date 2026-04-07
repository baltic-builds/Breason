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
    if (!match) throw new Error("No JSON found in AI response");
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
  if (!process.env.SERPER_API_KEY) {
    console.warn("⚠️ SERPER_API_KEY not set");
    return [];
  }

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
        num: 15,
        tbs: "qdr:m3",
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
      seen.add(item.title);
      return true;
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

// ── AI провайдеры ─────────────────────────────────────────────────────────────

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
    console.log(`🤖 Gemini: ${GEMINI_MODEL}`);
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
    console.log("🔄 Trying Groq...");
    const raw = await groqFallback(prompt);
    return parseJson(raw);
  } catch (e: any) {
    console.warn(`⚠️ Groq failed: ${e.message}`);
    throw new Error("All AI providers failed.");
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
    trust: ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity"],
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

const TOPIC_CATEGORIES = "Sales, Marketing, Tech & AI, Finance, HR & Culture, Operations, Legal & Compliance";

// ── Построители промптов ──────────────────────────────────────────────────────

function buildSearchPrompt(market: string, newsContext: string, today: string, ninetyDaysAgo: string, keyword?: string, customPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const customClause = customPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ПОЛЬЗОВАТЕЛЯ:\n${customPrompt.trim()}\n` : "";
  const keywordClause = keyword?.trim() ? `ФОКУС: Приоритизируй тренды, связанные с темой/ключевым словом: "${keyword.trim()}".` : "Охвати разные индустрии и темы рынка.";

  return `
Ты старший аналитик B2B-рынков. Составь деловой дайджест для рынка ${p.label}.
СЕГОДНЯШНЯЯ ДАТА: ${today}. Период: с ${ninetyDaysAgo}.
${customClause}
КОНТЕКСТ ИЗ СМИ:
---
${newsContext}
---
ЗАДАЧА: Сгенерируй ровно 12 актуальных B2B-трендов.
${keywordClause}
Каждый тренд относи к одной теме (topic) из списка: ${TOPIC_CATEGORIES}.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Весь текст ТОЛЬКО на русском языке.
2. Только plain text, никакого Markdown. Не упоминай COVID.
3. Будь конкретным — реальные события, компании, цифры.
4. Строго 12 объектов в массиве items.

Ответь ТОЛЬКО валидным JSON:
{
  "market": "${p.label}",
  "generated_at": "${today}",
  "keyword_focus": "${keyword?.trim() || ""}",
  "items": [
    {
      "headline": "Краткий заголовок тренда (до 8 слов)",
      "topic": "Одна из тем: ${TOPIC_CATEGORIES}",
      "category": "Подкатегория (AI / SaaS / Regulation / ...)",
      "summary": "2-3 предложения: суть тренда",
      "business_impact": "Практическое следствие для B2B продаж/маркетинга",
      "resonance_score": <число 50-100>
    }
  ]
}
  `.trim();
}

function buildEvaluatePrompt(text: string, market: string, trendContext?: any, customPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const customClause = customPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ: ${customPrompt.trim()}\n` : "";
  const trendHeadline = trendContext?.headline || "";

  return `
Ты старший аудитор B2B-локализации. Проанализируй текст для рынка ${p.label}.
ПРОФИЛЬ РЫНКА: Тон: ${p.tone} | Доверие: ${p.trust.join(", ")} | Красные флаги: ${p.redFlags.join(", ")}
${trendHeadline ? `\nАКТУАЛЬНЫЙ ТРЕНД (учитывай при аудите): ${trendHeadline}` : ""}
${customClause}
ТЕКСТ:
"""${text}"""

КРИТИЧЕСКИЕ ПРАВИЛА JSON:
1. "generic_phrases" — массив строк.
2. "tone_map" — ТОЛЬКО целые числа -5..5. Никаких строк!
3. suggested_local на ${p.language}, остальное на русском.

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
  "trend_context": "Связь с трендами рынка (RU)",
  "rewrites": [
    {
      "block": "Заголовок/CTA (RU)",
      "original": "фрагмент исходника",
      "suggested": "EN rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Почему лучше (RU)"
    }
  ],
  "brief_text": "Полный переписанный текст на EN"
}
  `.trim();
}

// ── ФАБРИКА ПРЕСЕТОВ (Улучшение) ──────────────────────────────────────────────
function buildImprovePrompt(text: string, market: string, preset: string, trendContext?: any, customPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  
  // Извлекаем переменные тренда
  const trendName = trendContext?.headline || "Общий рыночный тренд";
  const trendTension = trendContext?.business_impact || "Необходимость повышения эффективности и снижения издержек";

  const PRESET_TEMPLATES: Record<string, string> = {
    icebreaker: `Ты — Senior B2B Copywriter и эксперт по локальным продажам на рынке: {market}. 
Твоя задача — переписать предоставленный текст холодного сообщения, сделав его конверсионным и культурно релевантным.

КОНТЕКСТ ДЛЯ АДАПТАЦИИ (ОТКРЫВАЮЩИЙ ХУК):
Используй текущий локальный тренд: "{trend_name}". 
Боль рынка: "{trend_tension}". 
Свяжи оригинальный продукт/оффер с решением этой боли.

КУЛЬТУРНЫЙ КОД (СТРОГО СОБЛЮДАТЬ):
- Если рынок Germany: Пиши максимально сухо, опирайся на ROI, безопасность и цифры. Никакой лишней эмоциональности. Обращение на "Вы" (Sie).
- Если рынок Brazil: Будь теплым, сфокусируйся на партнерстве, росте и инновациях. Используй более дружелюбный тон.
- Если рынок Poland: Пиши прагматично, подчеркни эффективность и европейские стандарты качества. Прямолинейно, без агрессивных продаж.

СТРУКТУРА ПИСЬМА:
1. Subject line (Тема): Броская, до 5 слов, без кликбейта.
2. Hook (Хук): 1 предложение. Привязка к тренду.
3. Value (Ценность): 2 предложения. Как наш оффер решает боль.
4. Social Proof (Пруф): 1 предложение из оригинального текста.
5. CTA (Призыв): Мягкий, без давления.

ОГРАНИЧЕНИЯ:
Не используй слова "инновационный", "революционный". Пиши как живой человек.`,

    thought_leader: `Ты — топовый B2B Influencer и стратег на рынке: {market}.
Твоя задача — трансформировать сухой текст о продукте в вовлекающий LinkedIn-пост, который вызовет дискуссию в комментариях.

КОНТЕКСТНАЯ ПРИВЯЗКА:
Вплети в рассказ актуальный тренд: "{trend_name}" (Боль: "{trend_tension}"). 
Покажи, что автор поста глубоко понимает повестку дня в этой стране.

КУЛЬТУРНАЯ И ТОНАЛЬНАЯ АДАПТАЦИЯ:
- Germany: Фокус на логику, кейсы и структурность. Минимум эмодзи (максимум 1-2).
- Brazil: Эмоциональный сторителлинг. Можно использовать больше эмодзи, дружелюбный и мотивирующий тон.
- Poland: Скептический, но конструктивный тон. Фокус на "как сделать процессы дешевле и быстрее".

ФОРМАТ ПОСТА:
- Строка 1: Провокационный хук (вопрос или неочевидный факт о тренде).
- Строка 2: Пустая.
- Строки 3-5: Раскрытие проблемы.
- Строки 6-8: Наше решение (адаптировано из оригинального текста).
- Последняя строка: Открытый вопрос к аудитории для стимуляции комментариев.

ОГРАНИЧЕНИЯ ДЛЯ ИИ:
Избегай корпоративного булшита (synergy, empower). Пиши ритмично: чередуй короткие и длинные предложения.`,

    landing_page: `Ты — продуктовый маркетолог (PMM) экстра-класса, специализирующийся на локализации SaaS/B2B продуктов для рынка: {market}.
Твоя задача — переписать описание продукта так, чтобы оно резонировало с местным менталитетом, опираясь на тренд: "{trend_name}".

ПРАВИЛА ЛОКАЛИЗАЦИИ:
- Germany: Делай упор на соответствие GDPR, стабильность, предсказуемость затрат.
- Brazil: Делай упор на скорость интеграции, гибкость, обход бюрократии e масштабирование.
- Poland: Делай упор на оптимизацию ресурсов, интеграцию с ERP и быстрый ROI.

ТРЕБУЕМЫЙ ФОРМАТ ВЫДАЧИ (строго с Markdown):
# [H1: Главное обещание + привязка к тренду, до 8 слов]
### [H2: Раскрытие того, как мы решаем боль "{trend_tension}", до 15 слов]
**Почему это работает здесь:**
- [Буллит 1: Прагматичная выгода из исходного текста]
- [Буллит 2: Адаптация под местный контекст]
- [Буллит 3: Ключевая фича продукта]

ОГРАНИЧЕНИЯ:
Пиши емко. Без воды. Только результат по структуре выше.`,

    follow_up: `Ты — деликатный и опытный Account Executive, работающий на рынке: {market}.
Твоя задача — написать фоллоу-ап (напоминание) на основе предоставленного текста.

ПСИХОЛОГИЯ ПИСЬМА:
Вместо банального "Just checking in", мы используем метод "Value-add Follow-up". 
Используй тренд "{trend_name}" как причину для контакта. Скажи что-то вроде: "Увидел новости о [тренд], вспомнил наш разговор и подумал, что наше решение может помочь вам с [боль тренда]".

КУЛЬТУРНЫЕ НОРМЫ:
- Germany: Извинитесь за беспокойство, дайте сухую ссылку на материал/кейс, не требуйте немедленного ответа.
- Brazil: Спросите, как дела у команды, будьте неформальны, предложите созвониться на кофе (виртуально).
- Poland: Будьте кратки, уважительны, сразу переходите к сути пользы.

ФОРМАТ:
1 абзац. Максимум 4-5 предложений. Идеально для ответа в старой ветке писем.`,

    standard: `Ты эксперт B2B-копирайтер для рынка {market}. Перепиши текст нативно.
ПРОФИЛЬ: Тон: ${p.tone} | Доверие: ${p.trust.join(", ")} | Избегать: ${p.redFlags.join(", ")}
КОНТЕКСТ/ТРЕНДЫ: {trend_name} - {trend_tension}`
  };

  // 1. Выбираем шаблон
  let basePrompt = PRESET_TEMPLATES[preset] || PRESET_TEMPLATES["standard"];
  
  // 2. Инъекция переменных
  basePrompt = basePrompt
    .replace(/\{market\}/g, p.labelRu)
    .replace(/\{trend_name\}/g, trendName)
    .replace(/\{trend_tension\}/g, trendTension)
    .replace(/\{original_text\}/g, text);

  const customClause = customPrompt?.trim() ? `\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ: ${customPrompt.trim()}\n` : "";

  // 3. Форсируем JSON структуру
  return `
${basePrompt}
${customClause}

ИСХОДНЫЙ ТЕКСТ / ОФФЕР:
"""${text}"""

СИСТЕМНОЕ ОГРАНИЧЕНИЕ (КРИТИЧЕСКИ ВАЖНО):
Независимо от инструкций выше, ты ОБЯЗАН вернуть результат СТРОГО в формате JSON.
Готовый переписанный текст (с соблюдением выбранного формата и Markdown) помести в поле "improved_local".

Ответь ТОЛЬКО JSON:
{
  "improved_text": "Полная улучшенная версия на EN",
  "improved_local": "Финальная версия текста на ${p.language}",
  "changes": [
    { "what": "Что изменено (RU)", "why": "Почему работает лучше для рынка (RU)" }
  ],
  "tone_achieved": "Описание итогового тона (RU)"
}
  `.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// Роуты API
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
      const prompt = buildEvaluatePrompt(text, market, trendContext, customPrompts?.evaluate);
      const data   = await callAI(prompt);
      return NextResponse.json(data);
    }

    if (action === "improve") {
      if (!text?.trim()) return NextResponse.json({ error: "Текст не передан." }, { status: 400 });
      // Используем preset (например "icebreaker") и trendContext (целиком объект)
      const prompt = buildImprovePrompt(text, market, preset || "standard", trendContext, customPrompts?.improve);
      const data   = await callAI(prompt);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });

  } catch (error: any) {
    console.error("❌ POST Error:", error.message);
    return NextResponse.json({ error: "Все ИИ-провайдеры недоступны.", details: error.message }, { status: 503 });
  }
}

async function handleSearch(market: string, keyword?: string, customPrompt?: string): Promise<NextResponse> {
  const { today, ninetyDaysAgo } = getDateRange();
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;

  const realNews    = await fetchRealNews(market, profile.searchQueries, keyword);
  const newsContext = formatNewsForPrompt(realNews);
  const prompt      = buildSearchPrompt(market, newsContext, today, ninetyDaysAgo, keyword, customPrompt);

  try {
    const data = await callAI(prompt);
    let items = data?.items ?? (Array.isArray(data) ? data : []);
    items = items.map((item: any) => ({ ...item, topic: item.topic || item.category || "Общее" }));

    return NextResponse.json({ market: profile.label, generated_at: today, keyword_focus: keyword || "", items });
  } catch (error: any) {
    return NextResponse.json({
      market: profile.label, generated_at: today, keyword_focus: keyword || "",
      items: [{ headline: "Ошибка загрузки трендов", topic: "Система", category: "Ошибка", summary: error.message, business_impact: "Попробуйте ещё раз.", resonance_score: 0 }]
    }, { status: 200 });
  }
}
