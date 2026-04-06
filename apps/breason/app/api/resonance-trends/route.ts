import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  // ИСПОЛЬЗУЕМ 1.5 FLASH (у неё больше лимитов для Free Tier)
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    tools: [{ googleSearch: {} }] 
  });

  const systemPrompt = `
    Ты — эксперт по B2B маркетингу в регионе ${targetMarket}. Сегодня апрель 2026 года.
    Используй Google Search, чтобы найти РЕАЛЬНЫЕ тренды в B2B за последние 90 дней.
    
    ОТВЕТЬ СТРОГО В ФОРМАТЕ JSON:
    {
      "market": "${targetMarket}",
      "year": 2026,
      "analyst_note": "Краткий инсайт о рынке.",
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
    
    ВЕСЬ ТЕКСТ ВНУТРИ JSON ДОЛЖЕН БЫТЬ НА РУССКОМ ЯЗЫКЕ.
  `;

  try {
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    // Очистка JSON от маркдауна
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error: any) {
    console.error("Ошибка API:", error);
    
    // Если квота превышена, возвращаем понятную ошибку клиенту
    if (error.status === 429) {
      return NextResponse.json(
        { error: "Превышена квота запросов к ИИ. Попробуйте через минуту." }, 
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
