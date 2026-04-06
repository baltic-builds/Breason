import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';

  const marketNames: Record<string, string> = {
    brazil: "Бразилия",
    poland: "Польша",
    germany: "Германия"
  };

  const targetMarket = marketNames[market] || market;
  
  // Промпт с жестким требованием к структуре
  const systemPrompt = `Ты эксперт по B2B трендам в ${targetMarket}. Сегодня апрель 2026 года.
    Найди 3 свежих тренда за последние 90 дней.
    ОТВЕТЬ СТРОГО В JSON (без лишних слов и разметки):
    {
      "trends": [
        {
          "trend_name": "Название",
          "narrative_hook": "Инсайт",
          "market_tension": "Проблема",
          "why_now": "Актуальность",
          "resonance_score": 95
        }
      ]
    }`;

  try {
    // Используем стабильную модель 1.5 Flash для поиска
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      // Временно отключаем поиск, если он вызывает 500, 
      // либо используем правильный синтаксис:
      tools: [{ googleSearch: {} }] 
    } as any);

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();
    
    // Очистка от маркдауна ```json ... ```
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    
    return NextResponse.json(JSON.parse(cleanJson));
  } catch (err: any) {
    console.error("Gemini Error:", err);
    
    // Fallback на случай ошибки Gemini - возвращаем заглушку, чтобы фронт не падал
    return NextResponse.json({ 
      trends: [
        {
          trend_name: "Ошибка получения данных",
          narrative_hook: "Сервис временно недоступен",
          market_tension: "Проверьте API ключ или настройки провайдера",
          why_now: "Ошибка 500",
          resonance_score: 0
        }
      ] 
    }, { status: 200 }); // Возвращаем 200 с ошибкой внутри, чтобы UI обработал это красиво
  }
}

// Не забудь добавить POST для других действий (Deep Dive и т.д.)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Тут твоя логика для deep_dive, evaluate, improve
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Post failed" }, { status: 500 });
  }
}
