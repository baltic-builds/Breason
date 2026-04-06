import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = {
  GEMINI: "gemini-3.1-flash-lite-preview",
  GROQ: "llama-3.3-70b-versatile",
  OPENROUTER: "google/gemini-2.0-flash-lite-preview-02-05:free"
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';

  const marketNames: Record<string, string> = {
    brazil: "Бразилия (Brazil)",
    poland: "Польша (Poland)",
    germany: "Германия (Germany)"
  };

  const targetMarket = marketNames[market] || market;
  const systemPrompt = `
    Ты эксперт по B2B трендам в ${targetMarket}. Сегодня апрель 2026 года.
    Найди 3 свежих тренда за последние 90 дней.
    ОТВЕТЬ СТРОГО В JSON:
    {
      "market": "${targetMarket}",
      "trends": [
        {
          "trend_name": "Название",
          "narrative_hook": "Инсайт",
          "market_tension": "Проблема",
          "why_now": "Актуальность",
          "resonance_score": 95
        }
      ]
    }
    Весь текст на русском.
  `;

  // ПОПЫТКА 1: Gemini с поиском
  try {
    const model = genAI.getGenerativeModel({ model: MODELS.GEMINI, tools: [{ googleSearch: {} }] });
    const result = await model.generateContent(systemPrompt);
    return NextResponse.json(parseJson(result.response.text()));
  } catch (err: any) {
    console.error("Gemini + Search failed, switching to Groq...");

    // ПОПЫТКА 2: Groq (Llama 3.3 70B) — Самая быстрая альтернатива
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: MODELS.GROQ,
            messages: [{ role: "user", content: systemPrompt }],
            response_format: { type: "json_object" }
          })
        });
        const groqData = await groqRes.json();
        return NextResponse.json(JSON.parse(groqData.choices[0].message.content));
      } catch (groqErr) {
        console.error("Groq failed, switching to OpenRouter...");

        // ПОПЫТКА 3: OpenRouter
        return await handleOpenRouterFallback(systemPrompt);
      }
    }
    return NextResponse.json({ error: "No fallback available" }, { status: 503 });
  }
}

async function handleOpenRouterFallback(prompt: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODELS.OPENROUTER,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    return NextResponse.json(parseJson(data.choices[0].message.content));
  } catch {
    return NextResponse.json({ error: "All providers failed" }, { status: 503 });
  }
}

function parseJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid JSON response");
  return JSON.parse(match[0]);
}
