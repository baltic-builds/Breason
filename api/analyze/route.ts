import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MARKET_PROFILES, MarketProfileKey } from "@breason/prompts"; // Убедитесь, что импорт настроен, или скопируйте константу сюда

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function POST(request: Request) {
  try {
    const { text, market } = await request.json();
    const marketKey = market as MarketProfileKey;
    const profile = MARKET_PROFILES[marketKey] || MARKET_PROFILES.germany;

    const systemPrompt = `
      You are an expert B2B localization auditor. Analyze the following marketing text for the ${market} market.
      Use this specific market profile to guide your analysis:
      - Expected Tone: ${profile.tone_baseline}
      - Required Trust Markers: ${profile.trust_markers.join(", ")}
      - Red Flags (Do not use): ${profile.red_flags.join(", ")}
      - CTA Style: ${profile.cta_style}

      Text to analyze: "${text}"

      YOU MUST RESPOND ONLY WITH VALID JSON. NO MARKDOWN. NO HEADERS.
      {
        "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
        "verdict_reason": "One concise sentence explaining the verdict.",
        "genericness_score": <number 0-100, where 100 is pure cliche>,
        "generic_phrases": ["phrase1", "phrase2"],
        "tone_map": {
          "formal_casual": <number -5 (very formal) to +5 (very casual)>,
          "bold_cautious": <number -5 (very bold) to +5 (very cautious)>,
          "technical_benefit": <number -5 (pure tech) to +5 (pure benefit)>,
          "abstract_concrete": <number -5 (abstract) to +5 (concrete)>,
          "global_native": <number -5 (sounds translated) to +5 (sounds 100% local)>
        },
        "missing_trust_signals": ["signal1", "signal2"],
        "rewrites": [
          { 
            "block": "Headline or CTA", 
            "original": "original text snippet", 
            "suggested": "English rewrite", 
            "suggested_local": "Rewrite in the local language of ${market}", 
            "reason": "Why this works better" 
          }
        ],
        "trend_context": "One short sentence about a current B2B trend in ${market} relevant to this text.",
        "brief_text": "A full, localized, and polished version of the entire text ready for use."
      }
    `;

    try {
      console.log(`🤖 Requesting Gemini: ${GEMINI_MODEL}`);
      const model = genAI.getGenerativeModel({ 
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: "application/json" } // Гарантирует строгий JSON
      });
      const result = await model.generateContent(systemPrompt);
      const cleanJson = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return NextResponse.json(JSON.parse(cleanJson));

    } catch (geminiError: any) {
      console.warn("⚠️ Gemini Error, switching to Groq:", geminiError.message);
      
      if (process.env.GROQ_API_KEY) {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: systemPrompt }],
            response_format: { type: "json_object" }
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          return NextResponse.json(JSON.parse(groqData.choices[0].message.content));
        }
      }
      throw new Error("All AI providers failed.");
    }

  } catch (error: any) {
    console.error("API POST Error:", error);
    return NextResponse.json({ error: "Analysis failed", details: error.message }, { status: 500 });
  }
}
