import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = {
  GEMINI: "gemini-3.1-flash-lite-preview",
  GROQ_BEST: "llama-3.3-70b-versatile", // Или "llama-4-scout", если доступна в API
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
  const prompt = `Действуй как B2B аналитик. Регион: ${targetMarket}. Найди 3 тренда на 2026 год. Ответь ТОЛЬКО в JSON: {"market": "${targetMarket}", "trends": [{"trend_name": "...", "resonance_score": 95}]}. Текст на русском.`;

  // --- УРОВЕНЬ 1: Gemini 3.1 (С поиском Google) ---
  try {
    const model = genAI.getGenerativeModel({ model: MODELS.GEMINI, tools: [{ googleSearch: {} }] });
    const result = await model.generateContent(prompt);
    return NextResponse.json(parseJson(result.response.text()));
  } catch (e) {
    console.log("Gemini упал, запуск УРОВНЯ 2 (Groq)...");

    // --- УРОВЕНЬ 2: Groq (Максимальная скорость и логика Llama 3.3/4) ---
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: MODELS.GROQ_BEST,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        const groqData = await groqRes.json();
        return NextResponse.json(JSON.parse(groqData.choices[0].message.content));
      } catch (groqErr) {
        console.log("Groq упал, запуск УРОВНЯ 3 (OpenRouter)...");
        
        // --- УРОВЕНЬ 3: OpenRouter (Финальный заслон) ---
        return await handleOpenRouter(prompt);
      }
    }
    return NextResponse.json({ error: "Сервисы недоступны" }, { status: 503 });
  }
}

async function handleOpenRouter(prompt: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: MODELS.OPENROUTER, messages: [{ role: "user", content: prompt }] })
    });
    const data = await res.json();
    return NextResponse.json(parseJson(data.choices[0].message.content));
  } catch {
    return NextResponse.json({ error: "Ошибка всех провайдеров" }, { status: 503 });
  }
}

function parseJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON");
  return JSON.parse(match[0]);
}
