import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Константы моделей для легкого обновления в будущем
const MODELS = {
  PRIMARY: "gemini-3.1-flash-lite-preview",
  SECONDARY: "gemini-3-flash-preview",
  FALLBACK_OPENROUTER: "google/gemini-2.0-flash-lite-preview-02-05:free"
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

  // 1. Попытка через основной Gemini
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODELS.PRIMARY,
      tools: [{ googleSearch: {} }] 
    });

    const systemPrompt = `Ты эксперт по B2B трендам в ${targetMarket}. Используй Google Search (2026). Ответь СТРОГО в JSON: {"market": "${targetMarket}", "trends": [{"trend_name": "...", "resonance_score": 95}]}. Весь текст на русском.`;

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("No JSON found");
    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (error: any) {
    console.error("Primary Model Error, switching to Fallback...", error.status);

    // 2. FALLBACK на OpenRouter (если основной Gemini перегружен)
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: MODELS.FALLBACK_OPENROUTER,
            messages: [{ role: "user", content: `Дай B2B тренды для ${targetMarket} в JSON формате. Русская локализация.` }]
          })
        });

        const orData = await orResponse.json();
        const content = orData.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      } catch (fallbackError) {
        return NextResponse.json({ error: "Все сервисы перегружены" }, { status: 503 });
      }
    }

    return NextResponse.json({ error: "Ошибка генерации" }, { status: 500 });
  }
}
