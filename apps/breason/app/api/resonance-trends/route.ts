import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Инициализируем API (ключ возьмем из переменных окружения)
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

  // 1. Инициализируем модель с поддержкой ПОИСКА (Google Search)
  // Это ключевой момент, чтобы данные были свежими
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    tools: [{ googleSearch: {} }] 
  });

  const systemPrompt = `
    Ты — ведущий B2B стратег в регионе ${targetMarket}. 
    Твоя задача: найти РЕАЛЬНЫЕ свежие тренды за последние 3 месяца на основе данных Google Trends и локальных бизнес-новостей.
    
    ИНСТРУКЦИЯ ПО ПОИСКУ:
    1. Сначала найди растущие поисковые запросы в ${targetMarket} в категориях "Бизнес", "Технологии" и "Маркетинг".
    2. Выдели 3-5 аномалий (необычный рост интереса к конкретной теме).
    3. Напиши глубокий бриф на РУССКОМ языке.
    
    ПРАВИЛА:
    - Никакой "цифровизации" и "инноваций". Пиши конкретное "мясо".
    - Поле market_tension: это конфликт. Сила А против Силы Б.
    - JSON должен быть СТРОГИМ, без лишних символов.

    ОТВЕТЬ В ФОРМАТЕ JSON:
    {
      "market": "${targetMarket}",
      "year": 2026,
      "analyst_note": "Одна фраза о реальном настроении рынка сегодня.",
      "trends": [
        {
          "trend_name": "Название",
          "narrative_hook": "Зацепка с конфликтом",
          "market_tension": "Конкретный конфликт сил",
          "why_now": "Почему это взлетело (ссылка на событие или данные Trends)",
          "resonance_score": 95
        }
      ]
    }
  `;

  try {
    // 2. Отправляем запрос
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();

    // Очищаем от возможных markdown-кавычек, если ИИ их добавит
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("Ошибка API:", error);
    // Если что-то упало, возвращаем твой старый мок как запасной вариант
    return NextResponse.json({ error: "Не удалось получить свежие данные" }, { status: 500 });
  }
}
