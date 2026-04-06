import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// ЦЕНТРАЛЬНАЯ НАСТРОЙКА МОДЕЛИ
// Когда в AI Studio выйдет новая версия, просто поменяй эту строку здесь
const CURRENT_BEST_GEMINI = "gemini-3.1-flash-lite-preview";

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

  // Инициализация модели с поддержкой поиска
  const model = genAI.getGenerativeModel({ 
    model: CURRENT_BEST_GEMINI,
    tools: [{ googleSearch: {} }] 
  });

  const systemPrompt = `
    Ты — эксперт по B2B трендам. Регион: ${targetMarket}.
    Используй Google Search для поиска свежих данных за 2026 год.
    
    ОТВЕТЬ ТОЛЬКО В JSON:
    {
      "market": "${targetMarket}",
      "trends": [
        {
          "trend_name": "Название",
          "narrative_hook": "Инсайт",
          "market_tension": "Конфликт",
          "why_now": "Актуальность",
          "resonance_score": 95
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON");
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (error: any) {
    console.error("Gemini Error:", error);

    // ЛОГИКА FALLBACK (Если Gemini упал по квоте или ошибке)
    // Здесь можно вызвать функцию для Groq или OpenRouter
    return handleFallback(error, targetMarket);
  }
}

// ФУНКЦИЯ ЗАПАСНОГО ВАРИАНТА
async function handleFallback(originalError: any, market: string) {
  console.log("Запуск Fallback на OpenRouter...");
  
  // Пример вызова OpenRouter (бесплатная модель Llama 3.1)
  const FALLBACK_MODEL = "meta-llama/llama-3.1-8b-instruct:free";
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        messages: [{ role: "user", content: `Дай краткий B2B тренд для ${market} в формате JSON` }]
      })
    });

    const data = await response.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (e) {
    return NextResponse.json({ error: "Все провайдеры недоступны" }, { status: 503 });
  }
}
