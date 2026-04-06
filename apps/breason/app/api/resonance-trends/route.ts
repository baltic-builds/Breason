import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// ЦЕНТРАЛЬНЫЙ КОНФИГ МОДЕЛЕЙ (обновляй здесь при выходе новых версий)
const MODELS = {
  GEMINI_PRIMARY: "gemini-3.1-flash-lite-preview",
  OPENROUTER_FREE: "google/gemini-2.0-flash-lite-preview-02-05:free" 
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
      "analyst_note": "Краткий инсайт.",
      "trends": [
        {
          "trend_name": "Название",
          "narrative_hook": "Зацепка",
          "market_tension": "Конфликт",
          "why_now": "Почему сейчас",
          "resonance_score": 95
        }
      ]
    }
    Весь текст внутри JSON на русском языке.
  `;

  // --- ПОПЫТКА 1: Gemini 3.1 Flash Lite с Google Search ---
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODELS.GEMINI_PRIMARY,
      tools: [{ googleSearch: {} }] 
    });
    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    return NextResponse.json(parseJsonSafe(text));
  } catch (error: any) {
    console.error("Gemini + Search failed, trying without Search...", error.status);
    
    // --- ПОПЫТКА 2: Gemini 3.1 Flash Lite БЕЗ поиска (обычно лимиты здесь свободнее) ---
    try {
      const basicModel = genAI.getGenerativeModel({ model: MODELS.GEMINI_PRIMARY });
      const result = await basicModel.generateContent(systemPrompt + " (Используй внутренние знания)");
      return NextResponse.json(parseJsonSafe(result.response.text()));
    } catch (basicError) {
      console.error("Gemini Basic failed, switching to OpenRouter...");
      
      // --- ПОПЫТКА 3: OpenRouter (Fallback) ---
      return await handleOpenRouterFallback(targetMarket, systemPrompt);
    }
  }
}

// Вспомогательная функция для OpenRouter
async function handleOpenRouterFallback(market: string, prompt: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "API ключи исчерпаны" }, { status: 503 });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODELS.OPENROUTER_FREE,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!res.ok) throw new Error("OpenRouter error");
    const data = await res.json();
    const content = data.choices[0].message.content;
    return NextResponse.json(parseJsonSafe(content));
  } catch (e) {
    return NextResponse.json({ error: "Сервисы временно недоступны" }, { status: 503 });
  }
}

// Парсер JSON, который не боится лишнего текста от ИИ
function parseJsonSafe(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  return JSON.parse(jsonMatch[0]);
}
