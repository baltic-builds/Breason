import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL     = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview"; 
const GROQ_MODEL       = "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";

// ── Утилиты ──────────────────────────────────────────────────────────────────
function parseJson(text: string): any {
  try {
    const clean = text.replace(/```(json)?\n?/g, '').replace(/```\n?/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON object found in AI response");
    return JSON.parse(match[0]);
  } catch (e: any) {
    console.error("JSON Parse Error on string:", text);
    throw new Error(`Invalid JSON format: ${e.message}`);
  }
}

function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Serper API ───────────────────────────────────────────────────────────────
interface SerperNewsItem { title: string; snippet: string; source: string; date?: string; link: string; }

async function fetchRealNews(market: string, queries: string[]): Promise<SerperNewsItem[]> {
  if (!process.env.SERPER_API_KEY) return [];
  const allResults: SerperNewsItem[] = [];
  const combinedQuery = queries.slice(0, 2).join(" OR ");

  try {
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: combinedQuery,
        gl: market === "germany" ? "de" : market === "poland" ? "pl" : "br",
        hl: market === "germany" ? "de" : market === "poland" ? "pl" : "pt",
        num: 10,
        tbs: "qdr:m3",
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Serper ${res.status}`);
    const data = await res.json();
    const news: SerperNewsItem[] = (data.news || []).map((item: any) => ({
      title: item.title || "", snippet: item.snippet || "", source: item.source || "", date: item.date || "", link: item.link || "",
    }));
    allResults.push(...news);
  } catch (e: any) {
    console.warn(`⚠️ Serper query failed: ${e.message}`);
  }

  const seen = new Set<string>();
  return allResults.filter(item => {
    if (!item.title || seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 15);
}

function formatNewsForPrompt(news: SerperNewsItem[]): string {
  if (!news.length) return "Реальные новости недоступны — используй свои знания рынка.";
  return news.map((item, i) => `[${i + 1}] ${item.title}\nИсточник: ${item.source}${item.date ? ` · ${item.date}` : ""}\n${item.snippet}`).join("\n\n");
}

// ── Fallbacks ─────────────────────────────────────────────────────────────────
async function groqFallback(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAI(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: "application/json" } });
    const result = await model.generateContent(prompt);
    return parseJson(result.response.text());
  } catch (e: any) {
    console.warn(`⚠️ Gemini failed: ${e.message}`);
  }
  try {
    const raw = await groqFallback(prompt);
    return parseJson(raw);
  } catch (e: any) {
    throw new Error("All AI providers failed.");
  }
}

// ── Профили рынков ────────────────────────────────────────────────────────────
const MARKET_PROFILES: Record<string, any> = {
  germany: {
    label: "Germany (DACH)", labelRu: "Германия", language: "German", searchLang: "de",
    searchQueries: ["B2B Software Trends Deutschland 2025", "Digitalisierung Mittelstand aktuell"],
    tone: "Formal, precise, process-oriented, deeply skeptical of hype and vague promises",
    trust: ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta: "Soft and non-committal: 'Demo anfragen', 'Unverbindlich beraten lassen'",
  },
  poland: {
    label: "Poland", labelRu: "Польша", language: "Polish", searchLang: "pl",
    searchQueries: ["trendy B2B Polska 2025", "rynek SaaS Polska nowe technologie"],
    tone: "Direct but fact-based, values concrete numbers, transparent pricing and technical specifics",
    trust: ["specific ROI metrics", "transparent pricing model", "technical specifications", "implementation timeline"],
    redFlags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta: "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
  },
  brazil: {
    label: "Brazil", labelRu: "Бразилия", language: "Brazilian Portuguese", searchLang: "br",
    searchQueries: ["tendências B2B Brasil 2025", "mercado SaaS Brasil novidades"],
    tone: "Warm, human, relationship-first, low-friction, conversational Portuguese expected",
    trust: ["Portuguese language support", "local Brazilian case studies", "WhatsApp contact", "LGPD compliance"],
    redFlags: ["cold corporate tone", "aggressive sales push", "English-only support signals"],
    cta: "Human and frictionless: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// GET — Дайджест новостей
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market  = searchParams.get('market') || 'germany';
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today, ninetyDaysAgo } = getDateRange();

  const realNews = await fetchRealNews(market, profile.searchQueries);
  const newsContext = formatNewsForPrompt(realNews);

  const prompt = `
Ты старший аналитик B2B-рынков. Составь деловой дайджест для рынка ${profile.label}.
СЕГОДНЯШНЯЯ ДАТА: ${today}. Период: с ${ninetyDaysAgo}.

КОНТЕКСТ ИЗ СМИ:
---
${newsContext}
---

ЗАДАЧА: Выбери 5-7 наиболее важных B2B-историй.
КРИТИЧЕСКИЕ ПРАВИЛА:
1. Весь текст ТОЛЬКО на русском языке.
2. Только plain text. Не упоминай COVID. Будь конкретным.

Ответь ТОЛЬКО валидным JSON:
{
  "market": "${profile.label}",
  "generated_at": "${today}",
  "items": [
    {
      "headline": "Заголовок на русском",
      "category": "Технологии / Финансы / ИИ / и т.д.",
      "summary": "2-3 предложения суть",
      "business_impact": "Практическое следствие для B2B продаж/маркетинга",
      "resonance_score": <число 0-100>
    }
  ]
}
  `.trim();

  try {
    const data = await callAI(prompt);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      market: profile.label, generated_at: today,
      items: [{ headline: "Ошибка анализа", category: "Система", summary: error.message, business_impact: "Попробуйте позже.", resonance_score: 0 }]
    }, { status: 200 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Evaluate + Improve + Deep Dive
// ════════════════════════════════════════════════════════════════════════════
function buildEvaluatePrompt(text: string, market: string, trendContext?: any): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const trendName = trendContext?.headline || "";
  
  return `
Ты старший аудитор B2B-локализации. Проанализируй текст для рынка ${p.label}.
ПРОФИЛЬ РЫНКА: Тон: ${p.tone} | Сигналы доверия: ${p.trust.join(", ")} | Красные флаги: ${p.redFlags.join(", ")}
${trendName ? `\nАКТУАЛЬНЫЙ ТРЕНД РЫНКА (учитывай при анализе): ${trendName}` : ""}

ТЕКСТ:
"""${text}"""

КРИТИЧЕСКИЕ ПРАВИЛА JSON:
1. Ключ "generic_phrases" должен содержать массив строк.
2. Объект "tone_map" ДОЛЖЕН содержать только целые числа от -5 до 5. НИКАКИХ СТРОК ИЛИ КОММЕНТАРИЕВ!
3. suggested_local на ${p.language}, остальное на русском (кроме suggested).

Ответь ТОЛЬКО JSON:
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно предложение (RU)",
  "genericness_score": <число 0-100>,
  "generic_phrases": ["фраза 1", "фраза 2"],
  "tone_map": {
    "formal_casual": <число -5 до 5>,
    "bold_cautious": <число -5 до 5>,
    "technical_benefit": <число -5 до 5>,
    "abstract_concrete": <число -5 до 5>,
    "global_native": <число -5 до 5>
  },
  "missing_trust_signals": ["сигнал 1 (RU)"],
  "trend_context": "Связь текста с трендами рынка (RU)",
  "rewrites": [
    {
      "block": "Заголовок/CTA (RU)",
      "original": "фрагмент исходника",
      "suggested": "EN rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Почему это лучше (RU)"
    }
  ],
  "brief_text": "Полный переписанный текст на EN"
}
  `.trim();
}

function buildDeepDivePrompt(trendTitle: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  return `
Ты эксперт по B2B-рынкам. Опиши подробнее тренд "${trendTitle}" для региона ${p.label}.
Объясни, как B2B компаниям адаптировать свои продажи под этот тренд. 
Отвечай ТОЛЬКО на русском языке, в 3-4 предложения. 
ОТВЕТЬ СТРОГО В JSON:
{
  "analysis": "Твой детальный инсайт (plain text)"
}
  `.trim();
}

// ФАБРИКА ПРЕСЕТОВ
function buildImprovePrompt(text: string, market: string, preset: string, trendContext?: any): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const trendName = trendContext?.headline || "Общий рыночный тренд";
  const trendTension = trendContext?.business_impact || "Необходимость оптимизации процессов";

  const RAW_PROMPTS: Record<string, string> = {
    icebreaker: `
Ты — Senior B2B Copywriter и эксперт по локальным продажам на рынке: {market}. 
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
2. Hook (Хук): 1 предложение. Привязка к тренду {trend_name}.
3. Value (Ценность): 2 предложения. Как наш оффер решает {trend_tension}.
4. Social Proof (Пруф): 1 предложение из оригинального текста.
5. CTA (Призыв): Мягкий, без давления.

ОГРАНИЧЕНИЯ:
Не используй слова "инновационный", "революционный". Пиши как живой человек.
    `,
    thought_leader: `
Ты — топовый B2B Influencer и стратег на рынке: {market}.
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
- Строки 3-5: Раскрытие проблемы ({trend_tension}).
- Строки 6-8: Наше решение (адаптировано из оригинального текста).
- Последняя строка: Открытый вопрос к аудитории для стимуляции комментариев.

ОГРАНИЧЕНИЯ ДЛЯ ИИ:
Избегай корпоративного булшита. Пиши ритмично: чередуй короткие и длинные предложения.
    `,
    landing_page: `
Ты — продуктовый маркетолог (PMM) экстра-класса, специализирующийся на локализации SaaS/B2B продуктов для рынка: {market}.
Твоя задача — переписать описание продукта так, чтобы оно резонировало с местным менталитетом, опираясь на тренд: "{trend_name}".

ПРАВИЛА ЛОКАЛИЗАЦИИ:
- Germany: Делай упор на соответствие GDPR, стабильность, предсказуемость затрат.
- Brazil: Делай упор на скорость интеграции, гибкость, обход бюрократии и масштабирование.
- Poland: Делай упор на оптимизацию ресурсов, интеграцию с локальными ERP и быстрый ROI.

ТРЕБУЕМЫЙ ФОРМАТ ВЫДАЧИ:
# [H1: Главное обещание + привязка к тренду, до 8 слов]
### [H2: Раскрытие того, как мы решаем боль "{trend_tension}", до 15 слов]
**Почему это работает здесь:**
- [Буллит 1: Прагматичная выгода из исходного текста]
- [Буллит 2: Адаптация под местный контекст]
- [Буллит 3: Ключевая фича продукта]

ОГРАНИЧЕНИЯ:
Пиши емко. Без воды. Только результат по структуре выше.
    `,
    follow_up: `
Ты — деликатный и опытный Account Executive, работающий на рынке: {market}.
Твоя задача — написать фоллоу-ап (напоминание) на основе предоставленного текста.

ПСИХОЛОГИЯ ПИСЬМА:
Вместо банального "Just checking in", мы используем метод "Value-add Follow-up". 
Используй тренд "{trend_name}" как причину для контакта. Покажи, как решение устраняет боль "{trend_tension}".

КУЛЬТУРНЫЕ НОРМЫ:
- Germany: Извинитесь за беспокойство, дайте сухую ссылку на материал/кейс, не требуйте немедленного ответа.
- Brazil: Спросите, как дела у команды, будьте неформальны, предложите созвониться на кофе.
- Poland: Будьте кратки, уважительны, сразу переходите к сути пользы.

ФОРМАТ:
1 абзац. Максимум 4-5 предложений. Идеально для ответа в старой ветке писем.
    `,
    standard: `
Ты эксперт B2B-копирайтер для рынка {market}. Перепиши текст так, чтобы он звучал нативно.
ПРОФИЛЬ РЫНКА: Сигналы доверия: ${p.trust.join(", ")} | Избегать: ${p.redFlags.join(", ")}
КОНТЕКСТ/ТРЕНДЫ: {trend_name}
    `
  };

  let baseInstruction = RAW_PROMPTS[preset] || RAW_PROMPTS["standard"];
  
  baseInstruction = baseInstruction
    .replace(/\{market\}/g, p.labelRu)
    .replace(/\{trend_name\}/g, trendName)
    .replace(/\{trend_tension\}/g, trendTension)
    .replace(/\{original_text\}/g, text);

  return `
${baseInstruction}

ИСХОДНЫЙ ТЕКСТ:
"""${text}"""

КРИТИЧЕСКИЕ ПРАВИЛА ФОРМАТА (СИСТЕМНОЕ ОГРАНИЧЕНИЕ):
Независимо от инструкций выше, ты ДОЛЖЕН вернуть результат СТРОГО в формате JSON. Твой финальный сгенерированный текст (по запрошенной структуре) должен быть помещен в поле "improved_local". Перевод на английский — в "improved_text".
{
  "improved_text": "Твоя улучшенная версия на EN",
  "improved_local": "Твоя улучшенная версия на ${p.language} (с соблюдением запрошенного формата, хуков и структуры)",
  "changes": [
    { "what": "Что изменено в тексте (RU)", "why": "Почему это работает лучше для ${p.labelRu} (RU)" }
  ],
  "tone_achieved": "Краткое описание итогового тона (RU)"
}
  `.trim();
}

export async function POST(request: Request) {
  try {
    const { action, text, market, trendContext, preset } = await request.json();

    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json({ error: "Некорректный рынок." }, { status: 400 });
    }

    let prompt = "";
    if (action === "improve") {
      prompt = buildImprovePrompt(text, market, preset || "standard", trendContext);
    } else if (action === "evaluate") {
      prompt = buildEvaluatePrompt(text, market, trendContext);
    } else if (action === "deep_dive") {
      prompt = buildDeepDivePrompt(trendContext?.headline || text, market);
    } else {
      return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
    }

    const data = await callAI(prompt);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ POST Error:", error.message);
    return NextResponse.json({ error: "Все ИИ-провайдеры недоступны.", details: error.message }, { status: 503 });
  }
}
