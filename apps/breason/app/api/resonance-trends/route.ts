import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. ОТКЛЮЧАЕМ КЭШИРОВАНИЕ (Критично для Next.js App Router на Vercel)
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Максимальное время выполнения функции

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
  
  // Промпт (убрал "Апрель 2026", чтобы ИИ не галлюцинировал, лучше "Текущий месяц")
  const systemPrompt = `Ты эксперт по B2B трендам в ${targetMarket}. Сегодня текущий месяц.
    Найди 3 свежих бизнес-тренда за последние 90 дней.
    ОТВЕТЬ СТРОГО В ФОРМАТЕ JSON. Структура должна быть такой:
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
    // === ШАГ 1: ОСНОВНОЙ ДВИЖОК (GEMINI) ===
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        // Принудительно заставляем ИИ отдавать чистый JSON (без маркдауна)
        responseMimeType: "application/json", 
      }
      // ВАЖНО: googleSearch убран, так как он вызывает 500 ошибку на бесплатных ключах
    });

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();
    
    return NextResponse.json(JSON.parse(responseText));

  } catch (geminiError: any) {
    console.warn("⚠️ Gemini Error:", geminiError.message);
    
    // === ШАГ 2: ФОЛЛБЭК НА GROQ (Если Gemini упал или заблокирован) ===
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: systemPrompt }],
            response_format: { type: "json_object" }
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          return NextResponse.json(JSON.parse(groqData.choices[0].message.content));
        }
      } catch (groqError) {
        console.error("❌ Groq Error:", groqError);
      }
    }

    // === ШАГ 3: БЕЗОПАСНАЯ ЗАГЛУШКА ===
    // Если упали обе нейросети, возвращаем статус 200, но с сообщением об ошибке в самом тренде,
    // чтобы UI отрисовал карточку ошибки, а не ломался с белым экраном.
    return NextResponse.json({ 
      trends: [
        {
          trend_name: "Ошибка подключения к ИИ",
          narrative_hook: "Провайдеры временно недоступны или исчерпаны лимиты.",
          market_tension: `Техническая ошибка: ${geminiError.message || "500 Internal"}`,
          why_now: "Проверьте API-ключи в настройках Vercel.",
          resonance_score: 0
        }
      ] 
    }, { status: 200 });
  }
}

// Заглушка для будущих действий (Evaluate, Improve)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    
    // В будущем здесь будет switch(action) для вызова разных промптов
    return NextResponse.json({ success: true, action_received: action });
  } catch (e) {
    return NextResponse.json({ error: "Invalid POST body" }, { status: 400 });
  }
}
