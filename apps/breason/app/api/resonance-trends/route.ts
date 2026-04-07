import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// Исправлена модель на 3.1
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
  if (!process.env.SERPER_API_KEY) {
    console.warn("⚠️ SERPER_API_KEY not set, skipping real news fetch");
    return [];
  }

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
    console.log(`🤖 Calling Gemini: ${GEMINI_MODEL}`);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: "application/json" } });
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
function buildEvaluatePrompt(text: string, market: string, trendContext?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  return `
Ты старший аудитор B2B-локализации. Проанализируй текст для рынка ${p.label}.
ПРОФИЛЬ РЫНКА: Тон: ${p.tone} | Сигналы доверия: ${p.trust.join(", ")} | Красные флаги: ${p.redFlags.join(", ")}
${trendContext ? `\nАКТУАЛЬНЫЙ ТРЕНД РЫНКА (учитывай при анализе): ${trendContext}` : ""}

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

function buildImprovePrompt(text: string, market: string, context?: string, styleModifier?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  let styleInstruction = "";
  
  if (styleModifier === "friendly") styleInstruction = "Сделай текст более теплым, дружелюбным и располагающим к диалогу.";
  if (styleModifier === "professional") styleInstruction = "Сделай текст максимально строгим, экспертным и опирающимся на факты.";
  if (styleModifier === "concise") styleInstruction = "Сделай текст коротким, убрав всю 'воду' и оставив только самую суть (bullet points).";

  return `
Ты эксперт B2B-копирайтер для рынка ${p.label}. Перепиши текст так, чтобы он звучал нативно.
ПРОФИЛЬ РЫНКА: Тон: ${p.tone} | Сигналы доверия: ${p.trust.join(", ")} | Избегать: ${p.redFlags.join(", ")}
${context ? `КОНТЕКСТ/ТРЕНДЫ: ${context}` : ""}
${styleInstruction ? `\nЗАДАЧА ПО СТИЛЮ (REDUCK): ${styleInstruction}` : ""}

ИСХОДНЫЙ ТЕКСТ:
"""${text}"""

Ответь ТОЛЬКО JSON:
{
  "improved_text": "Полная улучшенная версия на EN",
  "improved_local": "Полная улучшенная версия на ${p.language}",
  "changes": [
    { "what": "Что изменено (RU)", "why": "Почему это работает лучше для ${p.label} (RU)" }
  ],
  "tone_achieved": "Описание итогового тона (RU)"
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

export async function POST(request: Request) {
  try {
    const { action, text, market, context, trendContext, styleModifier } = await request.json();

    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json({ error: "Некорректный рынок." }, { status: 400 });
    }

    let prompt = "";
    if (action === "improve") {
      prompt = buildImprovePrompt(text, market, context, styleModifier);
    } else if (action === "evaluate") {
      prompt = buildEvaluatePrompt(text, market, trendContext);
    } else if (action === "deep_dive") {
      prompt = buildDeepDivePrompt(trendContext, market);
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
