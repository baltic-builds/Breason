import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60; // Vercel Serverless Function Timeout

// ── Вшитые профили и промпты ──

const MARKET_PROFILES_API: Record<string, { label: string; language: string; tone: string; trust: string[]; redFlags: string[]; newsSources: string }> = {
  germany: {
    label: "Германия (DACH)", language: "German",
    tone: "Формальный, точный, процессный, без пустых обещаний",
    trust: ["GDPR", "ISO", "Локальный хостинг", "SLA"],
    redFlags: ["revolutionary", "game-changer", "seamless", "all-in-one"],
    newsSources: "site:handelsblatt.com OR site:wiwo.de OR site:manager-magazin.de"
  },
  poland: {
    label: "Польша", language: "Polish",
    tone: "Прагматичный, прямой, ориентированный на ROI и конкретику",
    trust: ["Кейсы", "ROI", "Прозрачные цены"],
    redFlags: ["empty promises", "vague benefits", "marketing fluff"],
    newsSources: "site:pb.pl OR site:forbes.pl OR site:rp.pl"
  },
  brazil: {
    label: "Бразилия", language: "Portuguese",
    tone: "Теплый, человекоцентричный, акцент на отношениях",
    trust: ["Поддержка на португальском", "WhatsApp", "LGPD"],
    redFlags: ["холодный корпоративный тон", "агрессивные продажи"],
    newsSources: "site:valor.globo.com OR site:exame.com OR site:infomoney.com.br"
  }
};

const SYSTEM_PROMPT_TEMPLATES: Record<string, string> = {
  search: `Ты — B2B аналитик. Рынок: {{MARKET}}. 
Составь 12 актуальных бизнес-трендов на основе предоставленных новостей из ключевых деловых медиа.
ОБЯЗАТЕЛЬНО для каждого тренда в поле 'business_impact' напиши: "Как B2B SaaS бизнес может использовать этот тренд для продаж или маркетинга".
{{NEWS_CONTEXT}}
{{CUSTOM_INSTRUCTIONS}}
Ответь ТОЛЬКО в JSON: { "items": [{ "headline": "", "topic": "Продажи, Финансы, Ритейл или IT", "category": "", "summary": "", "business_impact": "" }] }`,

  evaluate: `Ты — эксперт по локализации для рынка {{MARKET}}. Оцени текст.
ТОН: {{TONE}}. ДОВЕРИЕ: {{TRUST}}. ИЗБЕГАТЬ: {{RED_FLAGS}}.
{{TREND_CONTEXT}}
{{CUSTOM_INSTRUCTIONS}}
Верни JSON: { "verdict": "PASS"|"SUSPICIOUS"|"FOREIGN", "verdict_reason": "на русском", "genericness_score": 0, "generic_phrases": [], "tone_map": { "formal_casual": 0, "bold_cautious": 0, "technical_benefit": 0, "abstract_concrete": 0, "global_native": 0 }, "missing_trust_signals": [], "rewrites": [{"block":"", "original":"", "suggested":"", "suggested_local":"", "reason":""}] }
ТЕКСТ: {{TEXT}}`,

  improve_icebreaker: `Ты — B2B копирайтер. Перепиши как холодное письмо (Icebreaker) для {{MARKET}} на языке {{LANGUAGE}}. Сделай его коротким и бьющим в цель. {{TREND_CONTEXT}} {{CUSTOM_INSTRUCTIONS}} ТЕКСТ: {{TEXT}}`,
  improve_thought_leader: `Ты — B2B эксперт. Перепиши как пост эксперта (Thought Leader) для {{MARKET}} на языке {{LANGUAGE}}. Добавь глубины и авторитетности. {{TREND_CONTEXT}} {{CUSTOM_INSTRUCTIONS}} ТЕКСТ: {{TEXT}}`,
  improve_landing_page: `Ты — маркетолог. Перепиши как текст для лендинга для {{MARKET}} на языке {{LANGUAGE}}. Фокус на конверсии и выгодах. {{TREND_CONTEXT}} {{CUSTOM_INSTRUCTIONS}} ТЕКСТ: {{TEXT}}`,
  improve_follow_up: `Напиши мягкое напоминание (Follow-up) для {{MARKET}} на языке {{LANGUAGE}}. Без давления. {{TREND_CONTEXT}} {{CUSTOM_INSTRUCTIONS}} ТЕКСТ: {{TEXT}}`,
  improve_social: `Ты — SMM-стратег для рынка {{MARKET}}. 
ЗАДАЧА: Преврати этот текст в виральный B2B пост для социальных сетей (LinkedIn/X). 
СТРУКТУРА: Провокационный старт → Боль рынка → Инсайт с трендом → Вопрос к аудитории → Хэштеги. 
ПРАВИЛА: Запрещен скучный корпоративный язык. Добавь 2-4 эмодзи для ритма. 
ЯЗЫК: {{LANGUAGE}}. 
{{TREND_CONTEXT}} 
{{CUSTOM_INSTRUCTIONS}} 
ТЕКСТ: {{TEXT}}`,
  improve_standard: `Сделай текст нативным для {{MARKET}} на языке {{LANGUAGE}}. Убери "переводной" налет. {{TREND_CONTEXT}} {{CUSTOM_INSTRUCTIONS}} ТЕКСТ: {{TEXT}}`,
};

function buildPrompt(action: string, marketKey: string, text: string = "", trendContext: any = null, customPrompts: any = {}) {
  const p = MARKET_PROFILES_API[marketKey] || MARKET_PROFILES_API.germany;
  let template = customPrompts[action] || SYSTEM_PROMPT_TEMPLATES[action] || SYSTEM_PROMPT_TEMPLATES.improve_standard;

  let trendStr = "";
  if (trendContext && trendContext.headline) {
      trendStr = `\nУЧИТЫВАЙ ТРЕНД: ${trendContext.headline} (Боль: ${trendContext.business_impact})\n`;
  }

  let prompt = template
      .replace(/{{MARKET}}/g, p.label)
      .replace(/{{LANGUAGE}}/g, p.language)
      .replace(/{{TONE}}/g, p.tone)
      .replace(/{{TRUST}}/g, p.trust.join(', '))
      .replace(/{{RED_FLAGS}}/g, p.redFlags.join(', '))
      .replace(/{{TREND_CONTEXT}}/g, trendStr)
      .replace(/{{CUSTOM_INSTRUCTIONS}}/g, "")
      .replace(/{{TEXT}}/g, text);

  if (action.startsWith('improve')) {
      prompt += `\nВАЖНО: СОХРАНИ ПОЛНЫЙ ОБЪЕМ ИСХОДНОГО ТЕКСТА И ВСЕ СМЫСЛОВЫЕ БЛОКИ. Не сокращай текст, только улучшай его стиль.\nРезультат верни СТРОГО в JSON: { "improved_text": "полная версия на английском", "improved_local": "полная версия на ${p.language}", "tone_achieved": "описание тона на русском", "changes": [{"what": "что изменили (RU)", "why": "почему (RU)"}] }`;
  }

  return prompt;
}

// ── Каскадный парсер URL (Fetch → Jina → Microlink) ──

async function fetchUrlWithCascade(url: string): Promise<string> {
  let lastError = "";

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const rawText = (bodyMatch ? bodyMatch[1] : html)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ').trim();
      if (rawText.length > 200) return rawText;
    }
  } catch (e: any) { lastError = e.message; }

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "User-Agent": "BreasonBot" },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 100) return text;
    }
  } catch (e: any) { lastError = e.message; }

  try {
    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const content = [json.data.title, json.data.description].filter(Boolean).join("\n\n");
        if (content.length > 50) return content;
      }
    }
  } catch (e: any) { lastError = e.message; }

  throw new Error("Сайт защищен от автоматического чтения. Пожалуйста, скопируйте текст со страницы вручную.");
}

// ── Вызов ИИ (Тройной Каскад с защитой от зависания Vercel) ──

async function callAI(prompt: string, modelsConfig?: { primary: string; fallback: string }): Promise<any> {
  const primaryModel = modelsConfig?.primary || "gemini-3.1-flash-lite-preview";
  const fallbackModel = modelsConfig?.fallback || "llama-3.3-70b-versatile";

  const groqModelMap: Record<string, string> = {
    "llama-3.3-70b": "llama-3.3-70b-versatile",
    "llama-4-scout": "llama-3.3-70b-versatile", 
    "gpt-oss-120b": "llama-3.3-70b-versatile", 
    "gpt-oss-20b": "gemma2-9b-it", 
    "qwen-3-32b": "gemma2-9b-it" 
  };
  const resolvedFallback = groqModelMap[fallbackModel] || fallbackModel;
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

  // Попытка 1: Выбранная Gemini модель
  try {
    const model = genAI.getGenerativeModel({
      model: primaryModel,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```(json)?\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(text);
  } catch (e1: any) {
    console.warn(`[Gemini Primary Failed] (${primaryModel}) ${e1.message}. Trying Groq (${resolvedFallback})...`);
    
    // Попытка 2: Groq Fallback с жестким таймаутом
    try {
      if (!process.env.GROQ_API_KEY) throw new Error("No Groq API Key");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 секунд макс на Groq

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: resolvedFallback,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const groqErr = await res.text();
        throw new Error(`Groq HTTP error: ${groqErr}`);
      }
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e2: any) {
        console.warn(`[Groq Fallback Failed] ${e2.message}. Trying Gemini Final Fallback...`);
        
        // Попытка 3: Экстренный стабильный Fallback
        try {
            const backupModel = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await backupModel.generateContent(prompt);
            const text = result.response.text().replace(/```(json)?\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(text);
        } catch (e3: any) {
            console.error("All AI fallbacks failed:", e3.message);
            throw new Error("Все нейросети временно недоступны из-за высокой нагрузки. Пожалуйста, попробуйте через пару минут.");
        }
    }
  }
}

// ── API Routes ──

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('action') === 'prompts') {
    return NextResponse.json({ prompts: SYSTEM_PROMPT_TEMPLATES });
  }
  return NextResponse.json({ error: "Invalid GET" }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, market, text, keyword, trendContext, preset, customPrompts, url, models } = body;

    if (action === "fetch-url") {
      if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });
      try {
        const fetchedText = await fetchUrlWithCascade(url);
        return NextResponse.json({ text: fetchedText });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 422 });
      }
    }

    if (!market) return NextResponse.json({ error: "Market required" }, { status: 400 });

    if (action === "search") {
       let newsContext = "Реальные новости недоступны. Сгенерируй тренды на основе своих знаний за 2026 год.";
       const pStr = MARKET_PROFILES_API[market] || MARKET_PROFILES_API.germany;
       
       if (process.env.SERPER_API_KEY) {
           try {
               const q = keyword ? `B2B ${keyword} (${pStr.newsSources})` : `B2B SaaS business trends (${pStr.newsSources})`;
               const res = await fetch("https://google.serper.dev/search", {
                   method: "POST",
                   headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
                   body: JSON.stringify({ q, num: 10, tbs: "qdr:m1" })
               });
               const data = await res.json();
               if (data.organic && data.organic.length > 0) {
                   newsContext = data.organic.map((n: any) => `[${n.title}] ${n.snippet}`).join('\n\n');
               }
           } catch (e) {
               console.warn("Serper Fetch Failed:", e);
           }
       }
       
       let prompt = customPrompts?.search || SYSTEM_PROMPT_TEMPLATES.search;
       prompt = prompt.replace('{{MARKET}}', pStr.label)
                      .replace('{{NEWS_CONTEXT}}', `ПОСЛЕДНИЕ ЗАГОЛОВКИ БИЗНЕС-СМИ:\n${newsContext}`)
                      .replace('{{CUSTOM_INSTRUCTIONS}}', keyword ? `ФОКУС НА: ${keyword}` : '');
       
       const data = await callAI(prompt, models);
       return NextResponse.json(data);
    }

    if (action === "evaluate") {
       const prompt = buildPrompt("evaluate", market, text, trendContext, customPrompts);
       const data = await callAI(prompt, models);
       return NextResponse.json(data);
    }

    if (action === "improve") {
       const promptKey = preset ? `improve_${preset}` : "improve_standard";
       const prompt = buildPrompt(promptKey, market, text, trendContext, customPrompts);
       const data = await callAI(prompt, models);
       return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("API POST Error:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера", details: error.message }, { status: 500 });
  }
}
