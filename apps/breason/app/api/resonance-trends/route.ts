import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL     = process.env.GEMINI_MODEL || "gemini-1.5-flash"; // Быстрый старт без динамического поиска
const GROQ_MODEL       = "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";

// ── Утилиты ──────────────────────────────────────────────────────────────────
function parseJson(text: string): any {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Поиск новостей (Serper -> Jina Search) ───────────────────────────────────
async function fetchRealNews(market: string, queries: string[]): Promise<string> {
  // Склеиваем запросы через OR для экономии лимитов (берем только первые 2 для точности)
  const combinedQuery = queries.slice(0, 2).join(" OR ");
  
  // 1. Пытаемся через Serper
  if (process.env.SERPER_API_KEY) {
    try {
      const res = await fetch("https://google.serper.dev/news", {
        method: "POST",
        headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          q: combinedQuery, 
          gl: market === "germany" ? "de" : market === "poland" ? "pl" : "br",
          num: 10, 
          tbs: "qdr:m3" 
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.news && data.news.length > 0) {
          console.log(`📰 Serper: Got ${data.news.length} results`);
          return data.news.map((n: any, i: number) => `[${i+1}] ${n.title}\nИсточник: ${n.source}\n${n.snippet}`).join("\n\n");
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ Serper failed (${e.message}), switching to Jina Search...`);
    }
  }

  // 2. Fallback: Jina Search (s.jina.ai)
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(combinedQuery)}`, {
      headers: { "Accept": "application/json", "X-Retain-Images": "none" },
      signal: AbortSignal.timeout(8000)
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        console.log(`📰 Jina Search: Got ${data.data.length} results`);
        return data.data.map((d: any, i: number) => `[${i+1}] ${d.title}\n${d.description}`).join("\n\n");
      }
    }
  } catch (e: any) {
    console.warn(`⚠️ Jina Search failed: ${e.message}`);
  }

  return "Реальные новости недоступны — используй свои знания рынка.";
}

// ── Fallbacks ИИ ──────────────────────────────────────────────────────────────
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

async function openRouterFallback(prompt: string): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("No OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: "user", content: prompt }] })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return parseJson(data.choices[0].message.content);
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
  }
  
  console.log("🔄 Trying OpenRouter...");
  return await openRouterFallback(prompt);
}

// ── Профили рынков ────────────────────────────────────────────────────────────
const MARKET_PROFILES: Record<string, any> = {
  germany: {
    label: "Germany (DACH)", labelRu: "Германия", language: "German",
    searchQueries: ["B2B Software Trends Deutschland 2025", "Digitalisierung Mittelstand aktuell"],
    tone: "Formal, precise, process-oriented, deeply skeptical of hype",
    trust: ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity", "security standards"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta: "Soft and non-committal: 'Demo anfragen', 'Unverbindlich beraten lassen'",
  },
  poland: {
    label: "Poland", labelRu: "Польша", language: "Polish",
    searchQueries: ["trendy B2B Polska 2025", "rynek SaaS Polska nowe technologie"],
    tone: "Direct but fact-based, values concrete numbers, transparent pricing",
    trust: ["specific ROI metrics", "transparent pricing model", "technical specifications", "case studies"],
    redFlags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta: "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
  },
  brazil: {
    label: "Brazil", labelRu: "Бразилия", language: "Brazilian Portuguese",
    searchQueries: ["tendências B2B Brasil 2025", "tecnologia empresas Brasil atualidades"],
    tone: "Warm, human, relationship-first, low-friction",
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

  const newsContext = await fetchRealNews(market, profile.searchQueries);

  const prompt = `
Ты старший аналитик B2B-рынков. Составь деловой дайджест для рынка ${profile.label}.
СЕГОДНЯ: ${today} (Анализ с ${ninetyDaysAgo})

КОНТЕКСТ ИЗ СМИ:
---
${newsContext}
---

ЗАДАЧА: Выбери 7 наиболее важных B2B-историй на основе контекста выше.
ПРАВИЛА: 
1. Только на русском языке. 
2. Только plain text, никакого markdown. 
3. Без упоминания COVID.

Ответь ТОЛЬКО валидным JSON:
{
  "market": "${profile.label}",
  "generated_at": "${today}",
  "items": [{
      "headline": "Заголовок",
      "category": "Категория",
      "summary": "2-3 предложения",
      "business_impact": "Практическое следствие",
      "resonance_score": 85
  }]
}`;

  try {
    const data = await callAI(prompt);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      market: profile.label, generated_at: today,
      items: [{ headline: "ИИ временно недоступен", category: "Ошибка", summary: "Провайдеры перегружены.", business_impact: "Попробуйте позже.", resonance_score: 0 }]
    }, { status: 200 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Evaluate + Improve
// ════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const { action, text, market, context } = await request.json();
    if (!text || text.length < 10) return NextResponse.json({ error: "Текст слишком короткий" }, { status: 400 });
    
    const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
    let prompt = "";

    if (action === "evaluate") {
      prompt = `Ты аудитор B2B-локализации. Рынок: ${p.label}.
ПРОФИЛЬ: Тон: ${p.tone}. Сигналы: ${p.trust.join(", ")}. Флаги: ${p.redFlags.join(", ")}.
ТЕКСТ: "${text}"

Ответь ТОЛЬКО валидным JSON (строго без Markdown):
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно предложение на русском",
  "genericness_score": <0-100>,
  "generic_phrases": ["фраза"],
  "tone_map": { "formal_casual": <0>, "bold_cautious": <0>, "technical_benefit": <0>, "abstract_concrete": <0>, "global_native": <0> },
  "missing_trust_signals": ["сигнал"],
  "trend_context": "Тренд на русском",
  "rewrites": [{ "block": "Имя блока", "original": "Текст", "suggested": "EN текст", "suggested_local": "Текст на ${p.language}", "reason": "Причина на русском" }],
  "brief_text": "Полный текст на EN"
}`;
    } else {
      prompt = `Ты B2B-копирайтер. Рынок: ${p.label}.
ПРОФИЛЬ: Тон: ${p.tone}. Добавить: ${p.trust.join(", ")}. Избегать: ${p.redFlags.join(", ")}.
ТЕКСТ: "${text}"
${context ? `КОНТЕКСТ: ${context}` : ""}

Ответь ТОЛЬКО валидным JSON:
{
  "improved_text": "Версия на EN",
  "improved_local": "Версия на ${p.language}",
  "changes": [{ "what": "Что изменено (RU)", "why": "Почему (RU)" }],
  "tone_achieved": "Описание тона на RU"
}`;
    }

    const data = await callAI(prompt);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Ошибка ИИ", details: error.message }, { status: 503 });
  }
}
