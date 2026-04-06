import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Берём модель из env — легко менять без деплоя кода
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Профили рынков — дублируем здесь до настройки монорепо
const MARKET_PROFILES = {
  germany: {
    tone_baseline: "Formal, precise, process-oriented, deeply skeptical of hype and vague promises",
    trust_markers: ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity", "security standards"],
    red_flags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta_style: "Soft and non-committal: 'Demo anfragen', 'Unverbindlich beraten lassen'",
    generic_cliches: ["seamless", "next-gen", "AI-powered", "best-in-class", "unlock efficiency"]
  },
  poland: {
    tone_baseline: "Direct but fact-based, values concrete numbers, transparent pricing and technical specifics",
    trust_markers: ["specific ROI metrics", "transparent pricing model", "technical specifications", "implementation timeline", "case studies with numbers"],
    red_flags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta_style: "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
    generic_cliches: ["all-in-one", "unlock efficiency", "transform your business", "enterprise-grade"]
  },
  brazil: {
    tone_baseline: "Warm, human, relationship-first, low-friction, conversational Portuguese expected",
    trust_markers: ["Portuguese language support", "local Brazilian case studies", "WhatsApp or fast human contact", "sem compromisso framing", "LGPD compliance"],
    red_flags: ["cold corporate tone", "aggressive sales push", "English-only support signals", "formal stiffness"],
    cta_style: "Human and frictionless: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
    generic_cliches: ["efficiency", "productivity", "enterprise-grade", "leverage", "synergy"]
  }
} as const;

type MarketKey = keyof typeof MARKET_PROFILES;

// Единая функция вызова ИИ с фоллбэком
async function callAI(prompt: string): Promise<string> {
  // Попытка 1: Gemini
  try {
    console.log(`🤖 Gemini model: ${GEMINI_MODEL}`);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (geminiError: any) {
    console.warn(`⚠️ Gemini failed (${geminiError.message}), switching to Groq...`);
  }

  // Попытка 2: Groq
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Gemini failed and GROQ_API_KEY is not set.");
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    }),
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    throw new Error(`Groq failed: ${groqRes.status} — ${errText}`);
  }

  const groqData = await groqRes.json();
  return groqData.choices[0].message.content;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, market } = body;

    // Валидация входных данных
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Text is required and must be at least 10 characters." },
        { status: 400 }
      );
    }
    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json(
        { error: "Invalid market. Use: germany, poland, or brazil." },
        { status: 400 }
      );
    }

    const profile = MARKET_PROFILES[market as MarketKey];
    const marketLabel = { germany: "Germany (DACH)", poland: "Poland", brazil: "Brazil" }[market as MarketKey];

    const prompt = `
You are an expert B2B localization auditor specializing in European and Brazilian SaaS markets.

Analyze the following B2B marketing text for the "${marketLabel}" market.

MARKET PROFILE FOR "${marketLabel}":
- Expected Tone: ${profile.tone_baseline}
- Required Trust Markers: ${profile.trust_markers.join(", ")}
- Hard Red Flags (phrases that kill trust): ${profile.red_flags.join(", ")}
- Local CTA Style: ${profile.cta_style}
- Common Generic Clichés to avoid: ${profile.generic_cliches.join(", ")}

TEXT TO ANALYZE:
"""
${text.trim()}
"""

INSTRUCTIONS:
- Be specific and critical. Do not be generous with PASS verdicts.
- Base ALL analysis strictly on the market profile above.
- For rewrites, provide exactly 3 suggestions: Headline, CTA, and Proof/Trust block.
- suggested_local must be written in the native language: German for Germany, Polish for Poland, Portuguese (pt-BR) for Brazil.
- genericness_score: 0 = completely original and local, 100 = pure US SaaS clichés.
- tone_map values range from -5 to +5 exactly.
- brief_text should be a polished, complete rewrite of the entire text for the target market.

RESPOND WITH ONLY VALID JSON. NO MARKDOWN. NO EXTRA TEXT. NO CODE BLOCKS.

{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "One precise sentence explaining the verdict.",
  "genericness_score": <integer 0-100>,
  "generic_phrases": ["exact phrase from text", "another phrase"],
  "tone_map": {
    "formal_casual": <integer -5 to 5>,
    "bold_cautious": <integer -5 to 5>,
    "technical_benefit": <integer -5 to 5>,
    "abstract_concrete": <integer -5 to 5>,
    "global_native": <integer -5 to 5>
  },
  "missing_trust_signals": ["specific missing signal", "another signal"],
  "trend_context": "One sentence about a current B2B trend in ${marketLabel} relevant to this text.",
  "rewrites": [
    {
      "block": "Headline",
      "original": "exact snippet from input text",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in local language",
      "reason": "Specific reason why this works better for this market"
    },
    {
      "block": "CTA",
      "original": "exact snippet from input text",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in local language",
      "reason": "Specific reason why this works better for this market"
    },
    {
      "block": "Proof / Trust",
      "original": "exact snippet from input text",
      "suggested": "English rewrite with trust signals",
      "suggested_local": "Rewrite in local language with trust signals",
      "reason": "Specific reason why this works better for this market"
    }
  ],
  "brief_text": "Full polished rewrite of the entire text in English, localized for ${marketLabel}."
}
`;

    const rawResponse = await callAI(prompt);

    // Безопасный парсинг — на случай если ИИ всё равно добавил маркдаун
    const cleanJson = rawResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    // Валидация структуры ответа
    const requiredFields = ['verdict', 'verdict_reason', 'genericness_score', 'generic_phrases', 'tone_map', 'missing_trust_signals', 'rewrites', 'trend_context', 'brief_text'];
    const missingFields = requiredFields.filter(f => !(f in parsed));

    if (missingFields.length > 0) {
      console.error("AI returned incomplete JSON. Missing:", missingFields);
      return NextResponse.json(
        { error: "AI returned incomplete analysis. Please try again.", missing: missingFields },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("❌ POST /api/analyze Error:", error.message);

    // Отдаём понятную ошибку клиенту
    return NextResponse.json(
      { error: "Analysis failed. All AI providers are unavailable or limits exceeded.", details: error.message },
      { status: 503 }
    );
  }
}
