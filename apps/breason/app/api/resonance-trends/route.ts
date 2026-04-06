import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 1. Обработка GET (Загрузка трендов)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';

  const marketNames: Record<string, string> = {
    brazil: "Бразилия",
    poland: "Польша",
    germany: "Германия"
  };

  const targetMarket = marketNames[market] || market;
  const prompt = `Ты эксперт по B2B трендам в ${targetMarket}. Сегодня апрель 2026 года.
    Найди 3 свежих тренда за последние 90 дней.
    ОТВЕТЬ СТРОГО В JSON:
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
    }
    Весь текст на русском.`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}

// 2. Обработка POST (Deep Dive, Проверка, Улучшение)
export async function POST(request: Request) {
  try {
    const { action, market, trendTitle, url, text } = await request.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    if (action === "deep_dive") {
      const prompt = `Дай глубокую B2B аналитику по тренду "${trendTitle}" для рынка ${market}. 
      Сфокусируйся на культурном коде и маркетинговых советах. Кратко, на русском.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ analysis: result.response.text() });
    }

    if (action === "evaluate") {
      const source = url ? `контента по ссылке ${url}` : `текста: ${text}`;
      const prompt = `Проанализируй соответствие ${source} культурному коду рынка ${market}. 
      Выдели ошибки и дай вердикт. На русском.`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ result: result.response.text() });
    }

    if (action === "improve") {
      const prompt = `Адаптируй этот текст под B2B рынок ${market}, сделав его более резонирующим: ${text}`;
      const result = await model.generateContent(prompt);
      return NextResponse.json({ improvedText: result.response.text() });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
