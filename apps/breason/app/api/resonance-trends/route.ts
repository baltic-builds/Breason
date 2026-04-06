import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Инициализация API
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

  // ИСПОЛЬЗУЕМ НОВУЮ МОДЕЛЬ: gemini-3-flash-preview
  // Она быстрее и эффективнее работает с инструментами поиска
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    tools: [{ googleSearch: {} }] 
  });

  const systemPrompt = `
    Ты — ведущий аналитик B2B трендов. Сегодня апрель 2026 года.
    Используй Google Search, чтобы найти РЕАЛЬНЫЕ изменения на рынке ${targetMarket} за последние 3 месяца.
    
    ОТВЕТЬ СТРОГО В ФОРМАТЕ JSON (без лишнего текста):
    {
      "market": "${targetMarket}",
      "year": 2026,
      "analyst_note": "Твой краткий профессиональный инсайт.",
      "trends": [
        {
          "trend_name": "Название тренда",
          "narrative_hook": "Почему об этом говорят",
          "market_tension": "Главная проблема/конфликт",
          "why_now": "Почему это важно именно в 2026 году",
          "resonance_score": 90
        }
      ]
    }
    
    ВЕСЬ ТЕКСТ ВНУТРИ JSON ДОЛЖЕН БЫТЬ НА РУССКОМ ЯЗЫКЕ.
  `;

  try {
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    // Улучшенная очистка JSON (убирает блоки кода ```json ... ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Модель не вернула валидный JSON");
    }
    
    const cleanJson = JSON.parse(jsonMatch[0]);
    return NextResponse.json(cleanJson);

  } catch (error: any) {
    console.error("Ошибка API Gemini:", error);

    // Обработка лимитов (429)
    if (error.status === 429 || error.message?.includes("quota")) {
      return NextResponse.json(
        { error: "Лимиты API исчерпаны. Попробуйте модель gemini-3.1-flash-lite-preview или подождите 60 секунд." }, 
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Не удалось получить тренды. Проверьте GEMINI_API_KEY в настройках Vercel." }, 
      { status: 500 }
    );
  }
}
