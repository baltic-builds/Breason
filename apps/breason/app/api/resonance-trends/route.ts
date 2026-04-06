import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = {
  GEMINI: "gemini-3.1-flash-lite-preview",
  GROQ: "llama-3.3-70b-versatile",
  OPENROUTER: "google/gemini-2.0-flash-lite-preview-02-05:free"
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';
  const trendName = searchParams.get('trend'); // Для глубокого анализа конкретного тренда

  const marketContext: Record<string, string> = {
    brazil: "Бразилия. Важны личные связи (relacionamento), теплота, WhatsApp как основной канал.",
    poland: "Польша. Высокий скептицизм к маркетингу, ценят конкретные цифры и кейсы из ЕС.",
    germany: "Германия. Формальность (Sie), сертификация, надежность, долгосрочное планирование."
  };

  const prompt = trendName 
    ? `Сделай глубокий анализ тренда "${trendName}" для рынка ${market}. 
       Учти контекст: ${marketContext[market]}.
       Расскажи про: 1. Статистику (если есть), 2. Ключевых игроков, 3. Риски для B2B.
       Ответь СТРОГО в JSON: {"detailed_analysis": "текст на 2-3 абзаца", "key_stats": ["факт 1", "факт 2"]}`
    : `Ты ведущий B2B аналитик. Найди 3 РЕАЛЬНЫХ и свежих тренда для рынка ${market} (2026 год).
       Ответь СТРОГО в JSON: {"market": "${market}", "trends": [
         {"trend_name": "...", "narrative_hook": "...", "market_tension": "...", "why_now": "...", "resonance_score": 90}
       ]}`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: MODELS.GEMINI, 
      tools: [{ googleSearch: {} }] 
    });
    const result = await model.generateContent(prompt);
    return NextResponse.json(JSON.parse(result.response.text().match(/\{[\s\S]*\}/)![0]));
  } catch (err) {
    // Fallback на Groq с усиленным промптом (чтобы не было скудно)
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS.GROQ,
        messages: [
          { role: "system", content: "Ты эксперт-аналитик с глубокими знаниями локальных рынков. Твои ответы всегда развернуты и содержат специфические детали региона." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });
    const data = await groqRes.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  }
}
