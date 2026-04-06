import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { market, action, trendTitle, url, text } = await request.json();

    const marketNames: Record<string, string> = {
      brazil: "Бразилия",
      poland: "Польша",
      germany: "Германия"
    };
    const targetMarket = marketNames[market as string] || market;

    // Промпт для поиска трендов
    if (action === "fetch_trends") {
      const prompt = `Ты ведущий B2B аналитик. Сейчас апрель 2026 года. 
      Найди 3 самых актуальных бизнес-тренда для рынка ${targetMarket} за последние 90 дней.
      ОТВЕТЬ СТРОГО В JSON:
      {
        "trends": [
          {
            "trend_name": "Название",
            "narrative_hook": "Цепляющий инсайт",
            "market_tension": "В чем боль рынка",
            "why_now": "Почему актуально сейчас",
            "resonance_score": 92
          }
        ]
      }`;
      
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return NextResponse.json(JSON.parse(result.response.text().replace(/```json|```/g, "")));
    }

    // Промпт для "Узнать больше" (Deep Dive)
    if (action === "deep_dive") {
      const prompt = `Дай глубокую B2B аналитику по тренду "${trendTitle}" для региона ${targetMarket}. 
      Сфокусируйся на цифрах, культурном коде и конкретных рекомендациях для маркетинга. 
      Ответ должен быть на русском языке, профессиональным и сжатым.`;
      
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return NextResponse.json({ analysis: result.response.text() });
    }

    // Логика для раздела "Проверить" (Evaluate)
    if (action === "evaluate") {
      const source = url ? `страницы по ссылке ${url}` : `следующего текста: ${text}`;
      const prompt = `Проведи критический анализ ${source} на соответствие рынку ${targetMarket}. 
      Выяви культурные несоответствия и ошибки в позиционировании. Дай краткий вердикт.`;
      
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
