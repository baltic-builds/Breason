import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODELS = {
  GEMINI: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  GROQ: "llama-3.3-70b-versatile",
  OPENROUTER: "google/gemini-2.0-flash-lite-preview-02-05:free"
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ── Утилита: вытащить JSON из любого ответа ──────────────────────────────────
function parseJson(text: string): any {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  return JSON.parse(match[0]);
}

// ── OpenRouter fallback ──────────────────────────────────────────────────────
async function openRouterFallback(prompt: string): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("No OpenRouter key");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://breason.vercel.app",
    },
    body: JSON.stringify({
      model: MODELS.OPENROUTER,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return parseJson(data.choices[0].message.content);
}

// ── Groq fallback ────────────────────────────────────────────────────────────
async function groqFallback(prompt: string, expectJson = true): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No Groq key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODELS.GROQ,
      messages: [{ role: "user", content: prompt }],
      ...(expectJson ? { response_format: { type: "json_object" } } : {})
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

// ════════════════════════════════════════════════════════════════════════════
// GET — Search: 3 тренда рынка
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'germany';

  const marketLabels: Record<string, string> = {
    brazil:  "Бразилия (Brazil)",
    poland:  "Польша (Poland)",
    germany: "Германия (Germany)"
  };
  const targetMarket = marketLabels[market] || market;

  const prompt = `
Ты эксперт по B2B-трендам. Рынок: ${targetMarket}.
Найди 3 актуальных B2B-тренда последних 90 дней.

ОТВЕТЬ СТРОГО ВАЛИДНЫМ JSON БЕЗ РАЗМЕТКИ:
{
  "market": "${targetMarket}",
  "trends": [
    {
      "trend_name": "Короткое название тренда",
      "narrative_hook": "Одно предложение — инсайт или провокационный факт",
      "market_tension": "Ключевая боль или противоречие на рынке",
      "why_now": "Почему тренд актуален именно сейчас",
      "resonance_score": 87
    }
  ]
}
Весь текст на русском. resonance_score от 0 до 100.
  `.trim();

  // Попытка 1: Gemini (без googleSearch — стабильнее на free tier)
  try {
    console.log(`🤖 GET trends via Gemini: ${MODELS.GEMINI}`);
    const model = genAI.getGenerativeModel({
      model: MODELS.GEMINI,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    return NextResponse.json(parseJson(result.response.text()));
  } catch (e: any) {
    console.warn("⚠️ Gemini GET failed:", e.message);
  }

  // Попытка 2: Groq
  try {
    console.log("🔄 GET trends via Groq...");
    const raw = await groqFallback(prompt, true);
    return NextResponse.json(parseJson(raw));
  } catch (e: any) {
    console.warn("⚠️ Groq GET failed:", e.message);
  }

  // Попытка 3: OpenRouter
  try {
    console.log("🔄 GET trends via OpenRouter...");
    const data = await openRouterFallback(prompt);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("❌ All providers failed:", e.message);
    return NextResponse.json({
      market: targetMarket,
      trends: [{
        trend_name: "Провайдеры временно недоступны",
        narrative_hook: "Все три ИИ-провайдера вернули ошибку",
        market_tension: "Проверьте API-ключи в Vercel Environment Variables",
        why_now: "Попробуйте через минуту",
        resonance_score: 0
      }]
    }, { status: 200 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Evaluate + Improve
// ════════════════════════════════════════════════════════════════════════════

const MARKET_PROFILES: Record<string, {
  tone: string;
  trust: string[];
  redFlags: string[];
  cta: string;
}> = {
  germany: {
    tone: "Formal, precise, process-oriented, deeply skeptical of hype",
    trust: ["GDPR/DSGVO", "ISO certifications", "EU data residency", "SLA clarity"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless"],
    cta: "Soft: 'Demo anfragen', 'Unverbindlich beraten lassen'"
  },
  poland: {
    tone: "Direct, fact-based, values concrete numbers and transparent pricing",
    trust: ["specific ROI metrics", "transparent pricing", "technical specs", "case studies"],
    redFlags: ["hype without data", "vague promises", "abstract benefits"],
    cta: "Specific: 'Umów demo (15 min)', 'Zobacz jak to działa'"
  },
  brazil: {
    tone: "Warm, human, relationship-first, low-friction, conversational",
    trust: ["Portuguese support", "local case studies", "WhatsApp contact", "LGPD compliance"],
    redFlags: ["cold corporate tone", "aggressive push", "English-only signals"],
    cta: "Human: 'Agende uma demonstração', 'Teste grátis — sem compromisso'"
  }
};

function buildEvaluatePrompt(text: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const label = { germany: "Germany (DACH)", poland: "Poland", brazil: "Brazil" }[market] || market;

  return `
You are a senior B2B localization auditor. Analyze this marketing text for the ${label} market.

MARKET PROFILE:
- Tone baseline: ${p.tone}
- Required trust markers: ${p.trust.join(", ")}
- Red flags to avoid: ${p.redFlags.join(", ")}
- CTA style: ${p.cta}

TEXT TO ANALYZE:
"""
${text}
"""

Be critical. Do not give PASS unless the text genuinely sounds local.
Respond ONLY with valid JSON, no markdown, no extra text:

{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "One precise sentence.",
  "genericness_score": <0-100>,
  "generic_phrases": ["phrase1", "phrase2"],
  "tone_map": {
    "formal_casual": <-5 to 5>,
    "bold_cautious": <-5 to 5>,
    "technical_benefit": <-5 to 5>,
    "abstract_concrete": <-5 to 5>,
    "global_native": <-5 to 5>
  },
  "missing_trust_signals": ["signal1", "signal2"],
  "trend_context": "One sentence on a current B2B trend in ${label} relevant to this text.",
  "rewrites": [
    {
      "block": "Headline",
      "original": "exact snippet",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in local language (de/pl/pt-BR)",
      "reason": "Why this works better"
    },
    {
      "block": "CTA",
      "original": "exact snippet",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in local language",
      "reason": "Why this works better"
    },
    {
      "block": "Proof / Trust",
      "original": "exact snippet",
      "suggested": "English rewrite with trust signals",
      "suggested_local": "Rewrite in local language",
      "reason": "Why this works better"
    }
  ],
  "brief_text": "Full polished rewrite of the entire text in English, localized for ${label}."
}
  `.trim();
}

function buildImprovePrompt(text: string, market: string, context?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const label = { germany: "Germany (DACH)", poland: "Poland", brazil: "Brazil" }[market] || market;

  return `
You are an expert B2B copywriter specializing in ${label} market.
Rewrite the following marketing text so it sounds completely native and compelling for ${label}.

MARKET PROFILE:
- Tone: ${p.tone}
- Trust markers to include: ${p.trust.join(", ")}
- CTA style: ${p.cta}
- Avoid: ${p.redFlags.join(", ")}
${context ? `\nADDITIONAL CONTEXT: ${context}` : ""}

ORIGINAL TEXT:
"""
${text}
"""

Respond ONLY with valid JSON, no markdown:
{
  "improved_text": "Full improved version in English",
  "improved_local": "Full improved version in local language (de/pl/pt-BR)",
  "changes": [
    { "what": "What was changed", "why": "Why it works better for ${label}" }
  ],
  "tone_achieved": "One sentence describing the tone of the new text"
}
  `.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, text, market, context } = body;

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: "Text is required (min 10 chars)" }, { status: 400 });
    }
    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json({ error: "Invalid market" }, { status: 400 });
    }

    const prompt = action === "improve"
      ? buildImprovePrompt(text, market, context)
      : buildEvaluatePrompt(text, market);

    console.log(`📋 POST action: ${action}, market: ${market}`);

    // Попытка 1: Gemini
    try {
      const model = genAI.getGenerativeModel({
        model: MODELS.GEMINI,
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return NextResponse.json(parseJson(result.response.text()));
    } catch (e: any) {
      console.warn("⚠️ Gemini POST failed:", e.message);
    }

    // Попытка 2: Groq
    try {
      const raw = await groqFallback(prompt, true);
      return NextResponse.json(parseJson(raw));
    } catch (e: any) {
      console.warn("⚠️ Groq POST failed:", e.message);
    }

    // Попытка 3: OpenRouter
    const data = await openRouterFallback(prompt);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ POST /api/resonance-trends:", error.message);
    return NextResponse.json(
      { error: "All AI providers failed", details: error.message },
      { status: 503 }
    );
  }
}
