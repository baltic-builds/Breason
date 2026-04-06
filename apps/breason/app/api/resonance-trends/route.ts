// /apps/breason/app/api/resonance-trends/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Умная функция вызова: берет модель из Vercel ENV, либо использует самую свежую Lite по умолчанию
const getGeminiModelName = () => {
  return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
};

// Универсальная функция для вызова ИИ (Gemini -> Groq)
async function generateAIResponse(prompt: string, expectJson: boolean = false, useSearch: boolean = false) {
  const modelName = getGeminiModelName();
  
  try {
    console.log(`🤖 Using Gemini Model: ${modelName}`);
    
    // Настраиваем Gemini
    const modelConfig: any = { 
      model: modelName,
      generationConfig: expectJson ? { responseMimeType: "application/json" } : {}
    };

    // Включаем Google Search только там, где это реально нужно (например, для GET поиска трендов)
    if (useSearch) {
      modelConfig.tools = [{ googleSearch: {} }];
    }

    const model = genAI.getGenerativeModel(modelConfig);
    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (geminiError: any) {
    console.warn(`⚠️ Gemini (${modelName}) Error:`, geminiError.message);
    
    // === ПОПЫТКА 2: GROQ (Надежный Fallback) ===
    if (process.env.GROQ_API_KEY) {
      try {
        console.log("🔄 Falling back to Groq Llama 3.3...");
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: expectJson ? { type: "json_object" } : null
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          return groqData.choices[0].message.content;
        }
      } catch (groqError) {
        console.error("❌ Groq Error:", groqError);
      }
    }
    
    throw new Error("All AI providers failed or limits exceeded");
  }
}

// ==========================================
// GET: ПОИСК ТРЕНДОВ (Используем Google Search)
// ==========================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';
  const marketNames: Record<string, string> = { brazil: "Бразилия", poland: "Польша", germany: "Германия" };
  const targetMarket = marketNames[market] || market;
  
  const systemPrompt = `Ты B2B аналитик. Рынок: ${targetMarket}. Сегодня текущий месяц.
    Используй поиск, чтобы найти 3 самых свежих бизнес-тренда за последние 90 дней.
    ОТВЕТЬ СТРОГО В ФОРМАТЕ JSON:
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
    // передаем true (ждем JSON) и true (включаем googleSearch для актуальности)
    const responseText = await generateAIResponse(systemPrompt, true, true); 
    
    // Очистка на всякий случай, если Groq вдруг отдаст с маркдауном
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return NextResponse.json(JSON.parse(cleanJson));
    
  } catch (error) {
    return NextResponse.json({ 
      trends: [{
        trend_name: "ИИ временно недоступен",
        narrative_hook: "Провайдеры перегружены (Ошибка 429) или исчерпан лимит",
        market_tension: "Мы уже чиним это",
        why_now: "Попробуйте через минуту",
        resonance_score: 0
      }] 
    }, { status: 200 });
  }
}

// ==========================================
// POST: DEEP DIVE, EVALUATE, IMPROVE (Без поиска, для скорости)
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, trend, market, text } = body;

    let prompt = "";

    switch (action) {
      case "deep_dive":
        prompt = `Действуй как эксперт по B2B-продажам. 
        Разбери тренд "${trend || 'этот тренд'}" для рынка ${market || 'указанного региона'}. 
        Напиши подробный анализ (Deep Dive): 
        1. Суть тренда. 
        2. Как B2B-компании могут это использовать. 
        3. Чего стоит избегать (культурные особенности). 
        Отформатируй ответ красиво с помощью Markdown (заголовки, списки).`;
        break;
        
      case "evaluate":
        prompt = `Оцени этот текст для рынка ${market}. 
        Укажи на культурные несоответствия, ошибки в тональности и дай советы по улучшению. 
        Текст: "${text}". Ответь в формате Markdown.`;
        break;

      case "improve":
        prompt = `Перепиши этот текст для рынка ${market}, чтобы он звучал максимально нативно для B2B сегмента.
        Текст: "${text}". Выведи только улучшенный готовый текст.`;
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Передаем false (ждем обычный Markdown/текст) и false (поиск тут не нужен, экономим лимиты и время)
    const responseText = await generateAIResponse(prompt, false, false);

    return NextResponse.json({ 
      success: true, 
      result: responseText 
    });

  } catch (error: any) {
    console.error("POST Error:", error);
    return NextResponse.json({ 
      error: "Failed to process request",
      result: "Произошла ошибка при генерации ответа. Возможно, превышены лимиты бесплатного тарифа." 
    }, { status: 500 });
  }
}
