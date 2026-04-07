import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const GROQ_MODEL       = "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";

// ── Авто-выбор самой свежей Gemini Flash модели ──────────────────────────────
let cachedGeminiModel: string | null = null;

async function getBestGeminiModel(): Promise<string> {
  if (cachedGeminiModel) return cachedGeminiModel;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`ListModels ${res.status}`);
    const data = await res.json();
    const models: { name: string; supportedGenerationMethods?: string[] }[] = data.models || [];

    const flashModels = models
      .filter(m =>
        m.name.includes('flash') &&
        !m.name.includes('thinking') &&
        (m.supportedGenerationMethods || []).includes('generateContent')
      )
      .map(m => m.name.replace('models/', ''))
      .sort((a, b) => {
        const parseVer = (s: string) => {
          const match = s.match(/gemini-(\d+)\.?(\d*)/);
          if (!match) return [0, 0];
          return [parseInt(match[1] || '0'), parseInt(match[2] || '0')];
        };
        const [aMaj, aMin] = parseVer(a);
        const [bMaj, bMin] = parseVer(b);
        if (bMaj !== aMaj) return bMaj - aMaj;
        return bMin - aMin;
      });

    console.log('📋 Available Gemini flash models:', flashModels);
    const liteModel = flashModels.find(m => m.includes('lite'));
    const bestModel = liteModel || flashModels[0];
    if (!bestModel) throw new Error("No suitable flash model found");

    console.log(`✅ Selected Gemini model: ${bestModel}`);
    cachedGeminiModel = bestModel;
    return bestModel;
  } catch (e: any) {
    const fallbackModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
    console.warn(`⚠️ ListModels failed (${e.message}), using fallback: ${fallbackModel}`);
    cachedGeminiModel = fallbackModel;
    return fallbackModel;
  }
}

// ── Утилита парсинга JSON ────────────────────────────────────────────────────
function parseJson(text: string): any {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

// ── Fallbacks ────────────────────────────────────────────────────────────────
async function groqFallback(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function openRouterFallback(prompt: string): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("No OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://breason.vercel.app",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return parseJson(data.choices[0].message.content);
}

async function callAI(prompt: string): Promise<any> {
  try {
    const modelName = await getBestGeminiModel();
    console.log(`🤖 Calling Gemini: ${modelName}`);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    return parseJson(result.response.text());
  } catch (e: any) {
    cachedGeminiModel = null;
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

// ── Профили рынков ───────────────────────────────────────────────────────────
const MARKET_PROFILES: Record<string, {
  label: string;
  mediaSources: string;
  tone: string;
  trust: string[];
  redFlags: string[];
  cta: string;
  language: string;
}> = {
  germany: {
    label: "Germany (DACH)",
    mediaSources: "Handelsblatt, Manager Magazin, Wirtschaftswoche, t3n, Deutsche Startups, Gründerszene",
    tone: "Formal, precise, process-oriented, deeply skeptical of hype and vague promises",
    trust: ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity", "security standards"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen", "AI-powered"],
    cta: "Soft and non-committal: 'Demo anfragen', 'Unverbindlich beraten lassen'",
    language: "German"
  },
  poland: {
    label: "Poland",
    mediaSources: "Rzeczpospolita, Puls Biznesu, Spider's Web, No Fluff Jobs blog, Antyweb, Business Insider Polska",
    tone: "Direct but fact-based, values concrete numbers, transparent pricing and technical specifics",
    trust: ["specific ROI metrics", "transparent pricing model", "technical specifications", "implementation timeline", "case studies with real numbers"],
    redFlags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta: "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
    language: "Polish"
  },
  brazil: {
    label: "Brazil",
    mediaSources: "Exame, Valor Econômico, Startups.com.br, Pequenas Empresas Grandes Negócios, TechCrunch Brasil, MIT Technology Review Brasil",
    tone: "Warm, human, relationship-first, low-friction, conversational Portuguese expected",
    trust: ["Portuguese language support", "local Brazilian case studies", "WhatsApp or fast human contact", "sem compromisso framing", "LGPD compliance"],
    redFlags: ["cold corporate tone", "aggressive sales push", "English-only support signals", "formal stiffness"],
    cta: "Human and frictionless: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
    language: "Brazilian Portuguese"
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET — Поиск новостей и трендов рынка
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market  = searchParams.get('market') || 'germany';
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;

  const prompt = `
You are a senior B2B market intelligence analyst specializing in ${profile.label}.

Your task: compile a news digest of 7 most important and fresh B2B business stories and trends 
from the last 60 days in ${profile.label}.

Base your analysis on the type of content typically published by these leading local business media:
${profile.mediaSources}

For each news item provide:
- A clear, specific headline (not generic)
- The source category (e.g. "Деловые СМИ", "Технологии", "Регулирование", "Стартапы", "Финансы", "Рынок труда", "ИИ и автоматизация")
- A 2-3 sentence summary explaining what happened and why it matters for B2B companies
- The business impact: what does this mean for sales, marketing, or product teams
- A resonance score (0-100) showing how strongly this affects B2B decision-makers

CRITICAL REQUIREMENTS:
- Write ALL text values in Russian. Plain text only — no markdown, no bullet points, no asterisks, no symbols.
- Be specific: mention real company names, real numbers, real market dynamics where possible.
- Do NOT make up fake news. If unsure about specifics, describe the trend pattern instead.
- Return exactly 7 items.

Respond ONLY with valid JSON:
{
  "market": "${profile.label}",
  "items": [
    {
      "headline": "Конкретный заголовок новости на русском",
      "category": "Категория на русском",
      "summary": "2-3 предложения о сути новости и почему это важно для B2B",
      "business_impact": "Что это означает для продаж и маркетинга B2B-компаний",
      "resonance_score": 85
    }
  ]
}
  `.trim();

  try {
    const data = await callAI(prompt);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ GET /api/resonance-trends:", error.message);
    return NextResponse.json({
      market: profile.label,
      items: [{
        headline: "Провайдеры временно недоступны",
        category: "Ошибка",
        summary: "Все три ИИ-провайдера вернули ошибку. Проверьте API-ключи в настройках Vercel.",
        business_impact: "Попробуйте через минуту.",
        resonance_score: 0
      }]
    }, { status: 200 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Evaluate + Improve
// ════════════════════════════════════════════════════════════════════════════
function buildEvaluatePrompt(text: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  return `
You are a senior B2B localization auditor. Analyze this marketing text for the ${p.label} market.

MARKET PROFILE FOR ${p.label}:
- Expected tone: ${p.tone}
- Required trust markers: ${p.trust.join(", ")}
- Red flags (destroy trust): ${p.redFlags.join(", ")}
- CTA style: ${p.cta}

TEXT TO ANALYZE:
"""
${text}
"""

INSTRUCTIONS:
- Be critical. Only give PASS if the text genuinely sounds like it was written by a local.
- Write ALL text values in Russian. Use plain text only — no markdown, no bullet points, no asterisks, no formatting symbols.
- For suggested_local write in ${p.language}.
- Provide exactly 3 rewrites: Headline, CTA, Proof/Trust block.
- genericness_score: 0 = fully original and local, 100 = pure US SaaS clichés.
- All tone_map values must be integers from -5 to +5.

Respond ONLY with valid JSON:
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно точное предложение на русском объясняющее вердикт",
  "genericness_score": <integer 0-100>,
  "generic_phrases": ["точная фраза из текста", "ещё фраза"],
  "tone_map": {
    "formal_casual": <integer -5 to 5>,
    "bold_cautious": <integer -5 to 5>,
    "technical_benefit": <integer -5 to 5>,
    "abstract_concrete": <integer -5 to 5>,
    "global_native": <integer -5 to 5>
  },
  "missing_trust_signals": ["сигнал на русском", "ещё сигнал на русском"],
  "trend_context": "Одно предложение на русском о текущем B2B-тренде в ${p.label} релевантном для этого текста",
  "rewrites": [
    {
      "block": "Заголовок",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Объяснение на русском почему это работает лучше для ${p.label}"
    },
    {
      "block": "Призыв к действию",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Объяснение на русском почему это работает лучше для ${p.label}"
    },
    {
      "block": "Доверие и доказательства",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite with trust signals",
      "suggested_local": "Rewrite in ${p.language} with trust signals",
      "reason": "Объяснение на русском почему это работает лучше для ${p.label}"
    }
  ],
  "brief_text": "Полная переработанная версия всего текста на английском, локализованная для ${p.label}. Только plain text."
}
  `.trim();
}

function buildImprovePrompt(text: string, market: string, context?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  return `
You are an expert B2B copywriter specializing in ${p.label} market.
Rewrite the following marketing text so it sounds completely native and compelling for ${p.label}.

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

INSTRUCTIONS:
- Write ALL text values in Russian. Use plain text only — no markdown, no bullet points, no asterisks, no formatting symbols.
- improved_local must be written in ${p.language}.
- changes array must have 3 to 5 items.
- tone_achieved: one short sentence in Russian.

Respond ONLY with valid JSON:
{
  "improved_text": "Полная улучшенная версия на английском. Только plain text.",
  "improved_local": "Полная улучшенная версия на ${p.language}. Только plain text.",
  "changes": [
    {
      "what": "Что изменено — на русском",
      "why": "Почему это работает лучше для ${p.label} — на русском"
    }
  ],
  "tone_achieved": "Одно предложение на русском описывающее тон нового текста"
}
  `.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, text, market, context } = body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Текст обязателен (минимум 10 символов)" },
        { status: 400 }
      );
    }
    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json(
        { error: "Некорректный рынок. Допустимые значения: germany, poland, brazil" },
        { status: 400 }
      );
    }

    const prompt = action === "improve"
      ? buildImprovePrompt(text.trim(), market, context)
      : buildEvaluatePrompt(text.trim(), market);

    console.log(`📋 POST action=${action} market=${market}`);

    const data = await callAI(prompt);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ POST /api/resonance-trends:", error.message);
    return NextResponse.json(
      { error: "Все ИИ-провайдеры недоступны. Попробуйте позже.", details: error.message },
      { status: 503 }
    );
  }
}
