import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GROQ_MODEL       = "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";

// ── Авто-выбор модели Gemini ─────────────────────────────────────────────────
let cachedGeminiModel: string | null = null;

async function getBestGeminiModel(): Promise<string> {
  if (cachedGeminiModel) return cachedGeminiModel;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`ListModels ${res.status}`);
    const data = await res.json();
    const models: { name: string; supportedGenerationMethods?: string[] }[] = data.models || [];
    const flashModels = models
      .filter(m =>
        m.name.includes('flash') &&
        !m.name.includes('thinking') &&
        (m.supportedGenerationMethods || []).includes('generateContent')
      )
      .map(m => m.name.replace('models/', ''))
      .sort((a, b) => {
        const parseVer = (s: string) => {
          const match = s.match(/gemini-(\d+)\.?(\d*)/);
          if (!match) return [0, 0];
          return [parseInt(match[1] || '0'), parseInt(match[2] || '0')];
        };
        const [aMaj, aMin] = parseVer(a);
        const [bMaj, bMin] = parseVer(b);
        if (bMaj !== aMaj) return bMaj - aMaj;
        return bMin - aMin;
      });
    console.log('📋 Available Gemini flash models:', flashModels);
    const liteModel = flashModels.find(m => m.includes('lite'));
    const bestModel = liteModel || flashModels[0];
    if (!bestModel) throw new Error("No suitable flash model found");
    console.log(`✅ Selected Gemini model: ${bestModel}`);
    cachedGeminiModel = bestModel;
    return bestModel;
  } catch (e: any) {
    const fallbackModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
    console.warn(`⚠️ ListModels failed (${e.message}), using fallback: ${fallbackModel}`);
    cachedGeminiModel = fallbackModel;
    return fallbackModel;
  }
}

// ── Утилиты ──────────────────────────────────────────────────────────────────
function parseJson(text: string): any {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

// Текущая дата + дата 90 дней назад — прямо на сервере, без внешних сервисов
function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Serper: реальный Google-поиск новостей ───────────────────────────────────
interface SerperNewsItem {
  title:   string;
  snippet: string;
  source:  string;
  date?:   string;
  link:    string;
}

async function fetchRealNews(market: string, queries: string[]): Promise<SerperNewsItem[]> {
  if (!process.env.SERPER_API_KEY) {
    console.warn("⚠️ SERPER_API_KEY not set, skipping real news fetch");
    return [];
  }

  const allResults: SerperNewsItem[] = [];

  // Делаем параллельные запросы по всем поисковым запросам
  await Promise.allSettled(
    queries.map(async (q) => {
      try {
        const res = await fetch("https://google.serper.dev/news", {
          method: "POST",
          headers: {
            "X-API-KEY":    process.env.SERPER_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q,
            gl:  market === "germany" ? "de" : market === "poland" ? "pl" : "br",
            hl:  market === "germany" ? "de" : market === "poland" ? "pl" : "pt",
            num: 5,
            tbs: "qdr:m3", // последние 3 месяца (90 дней)
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) throw new Error(`Serper ${res.status}`);
        const data = await res.json();
        const news: SerperNewsItem[] = (data.news || []).map((item: any) => ({
          title:   item.title   || "",
          snippet: item.snippet || "",
          source:  item.source  || "",
          date:    item.date    || "",
          link:    item.link    || "",
        }));
        allResults.push(...news);
      } catch (e: any) {
        console.warn(`⚠️ Serper query failed for "${q}": ${e.message}`);
      }
    })
  );

  // Убираем дубли по заголовку и ограничиваем до 20 штук для промпта
  const seen = new Set<string>();
  return allResults
    .filter(item => {
      if (!item.title || seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    })
    .slice(0, 20);
}

// Форматируем новости для вставки в промпт
function formatNewsForPrompt(news: SerperNewsItem[]): string {
  if (!news.length) return "Реальные новости недоступны — используй свои знания.";
  return news
    .map((item, i) =>
      `[${i + 1}] ${item.title}\nИсточник: ${item.source}${item.date ? ` · ${item.date}` : ""}\n${item.snippet}`
    )
    .join("\n\n");
}

// ── Fallbacks ─────────────────────────────────────────────────────────────────
async function groqFallback(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type":  "application/json"
    },
    body: JSON.stringify({
      model:           GROQ_MODEL,
      messages:        [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function openRouterFallback(prompt: string): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("No OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type":  "application/json",
      "HTTP-Referer":  "https://breason.vercel.app",
    },
    body: JSON.stringify({
      model:    OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return parseJson(data.choices[0].message.content);
}

async function callAI(prompt: string): Promise<any> {
  try {
    const modelName = await getBestGeminiModel();
    console.log(`🤖 Calling Gemini: ${modelName}`);
    const model = genAI.getGenerativeModel({
      model:            modelName,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    return parseJson(result.response.text());
  } catch (e: any) {
    cachedGeminiModel = null;
    console.warn(`⚠️ Gemini failed: ${e.message}`);
  }
  try {
    console.log("🔄 Trying Groq...");
    const raw = await groqFallback(prompt);
    return parseJson(raw);
  } catch (e: any) {
    console.warn(`⚠️ Groq failed: ${e.message}`);
  }
  console.log("🔄 Trying OpenRouter...");
  return await openRouterFallback(prompt);
}

// ── Профили рынков ────────────────────────────────────────────────────────────
const MARKET_PROFILES: Record<string, {
  label:        string;
  labelRu:      string;
  language:     string;
  searchLang:   string;
  mediaSources: string;
  searchQueries: string[];
  tone:         string;
  trust:        string[];
  redFlags:     string[];
  cta:          string;
}> = {
  germany: {
    label:        "Germany (DACH)",
    labelRu:      "Германия",
    language:     "German",
    searchLang:   "de",
    mediaSources: "Handelsblatt, Manager Magazin, Wirtschaftswoche, t3n, Gründerszene",
    searchQueries: [
      "B2B Software Trends Deutschland 2025",
      "Digitalisierung Mittelstand aktuell",
      "SaaS Markt Deutschland neue Entwicklungen",
      "KI Unternehmen Deutschland B2B",
    ],
    tone:     "Formal, precise, process-oriented, deeply skeptical of hype and vague promises",
    trust:    ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity", "security standards"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta:      "Soft and non-committal: 'Demo anfragen', 'Unverbindlich beraten lassen'",
  },
  poland: {
    label:        "Poland",
    labelRu:      "Польша",
    language:     "Polish",
    searchLang:   "pl",
    mediaSources: "Rzeczpospolita, Puls Biznesu, Spider's Web, Business Insider Polska",
    searchQueries: [
      "trendy B2B Polska 2025",
      "rynek SaaS Polska nowe technologie",
      "cyfryzacja firm Polska aktualne",
      "sztuczna inteligencja biznes Polska",
    ],
    tone:     "Direct but fact-based, values concrete numbers, transparent pricing and technical specifics",
    trust:    ["specific ROI metrics", "transparent pricing model", "technical specifications", "implementation timeline", "case studies with real numbers"],
    redFlags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta:      "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
  },
  brazil: {
    label:        "Brazil",
    labelRu:      "Бразилия",
    language:     "Brazilian Portuguese",
    searchLang:   "br",
    mediaSources: "Exame, Valor Econômico, Startups.com.br, Pequenas Empresas Grandes Negócios",
    searchQueries: [
      "tendências B2B Brasil 2025",
      "mercado SaaS Brasil novidades",
      "tecnologia empresas Brasil atualidades",
      "inteligência artificial negócios Brasil",
    ],
    tone:     "Warm, human, relationship-first, low-friction, conversational Portuguese expected",
    trust:    ["Portuguese language support", "local Brazilian case studies", "WhatsApp contact", "sem compromisso framing", "LGPD compliance"],
    redFlags: ["cold corporate tone", "aggressive sales push", "English-only support signals", "formal stiffness"],
    cta:      "Human and frictionless: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// GET — Дайджест новостей рынка (на основе реальных данных через Serper)
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market  = searchParams.get('market') || 'germany';
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today, ninetyDaysAgo } = getDateRange();

  console.log(`🔍 Fetching news for ${market}, date range: ${ninetyDaysAgo} — ${today}`);

  // Шаг 1: Получаем реальные новости через Serper
  const realNews = await fetchRealNews(market, profile.searchQueries);
  const newsContext = formatNewsForPrompt(realNews);
  const hasRealNews = realNews.length > 0;

  console.log(`📰 Got ${realNews.length} real news items from Serper`);

  const prompt = `
Ты старший аналитик B2B-рынков. Твоя задача — составить деловой дайджест для рынка ${profile.label}.

СЕГОДНЯШНЯЯ ДАТА: ${today}
ПЕРИОД АНАЛИЗА: с ${ninetyDaysAgo} по ${today}

${hasRealNews
  ? `РЕАЛЬНЫЕ НОВОСТИ из открытых источников за последние 90 дней (используй их как основу):
---
${newsContext}
---
ВАЖНО: Анализируй только то, что написано выше. Не придумывай новости. Если новость из списка старая или нерелевантная — не включай её.`
  : `Реальные новости недоступны. Опиши актуальные структурные тренды рынка ${profile.label} на основе своих знаний, но НЕ упоминай события старше 2024 года. НЕ упоминай COVID как актуальный фактор.`
}

ЗАДАЧА: Выбери или сформулируй 7 наиболее важных и актуальных B2B-историй для ${profile.label}.

ДЛЯ КАЖДОЙ НОВОСТИ:
- headline: конкретный, информативный заголовок (не общий, не клише)
- category: одно из — Технологии, Регулирование, Финансы, Рынок труда, ИИ и автоматизация, Стартапы, Деловая среда, Экспорт, Ритейл
- summary: 2-3 предложения — что произошло и почему это важно для B2B-компаний
- business_impact: конкретное практическое следствие для отделов продаж или маркетинга
- resonance_score: число от 0 до 100, насколько сильно это влияет на B2B-решения

КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. Весь текст ТОЛЬКО на русском языке. Ни одного слова на английском, немецком, польском или португальском.
2. Только plain text — никакого markdown, никаких звёздочек, решёток, тире в начале строк.
3. Не упоминай пандемию COVID как актуальный фактор.
4. Не пиши общие фразы типа "компании продолжают цифровизацию". Будь конкретным.
5. Временной контекст: все события — не ранее ${ninetyDaysAgo}.

Ответь ТОЛЬКО валидным JSON без markdown и лишнего текста:
{
  "market": "${profile.label}",
  "generated_at": "${today}",
  "items": [
    {
      "headline": "Конкретный заголовок на русском",
      "category": "Категория",
      "summary": "2-3 предложения на русском",
      "business_impact": "Практическое следствие для B2B на русском",
      "resonance_score": 85
    }
  ]
}
  `.trim();

  try {
    const data = await callAI(prompt);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ GET /api/resonance-trends:", error.message);
    return NextResponse.json({
      market:       profile.label,
      generated_at: today,
      items: [{
        headline:        "Провайдеры временно недоступны",
        category:        "Ошибка",
        summary:         "Все три ИИ-провайдера вернули ошибку. Проверьте API-ключи в настройках Vercel.",
        business_impact: "Попробуйте через минуту.",
        resonance_score: 0
      }]
    }, { status: 200 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Evaluate + Improve
// ════════════════════════════════════════════════════════════════════════════
function buildEvaluatePrompt(text: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today } = getDateRange();
  return `
Ты старший аудитор B2B-локализации. Проанализируй маркетинговый текст для рынка ${p.label}.
Сегодня: ${today}.

ПРОФИЛЬ РЫНКА ${p.label}:
- Ожидаемый тон: ${p.tone}
- Обязательные сигналы доверия: ${p.trust.join(", ")}
- Красные флаги (убивают доверие): ${p.redFlags.join(", ")}
- Стиль CTA: ${p.cta}

АНАЛИЗИРУЕМЫЙ ТЕКСТ:
"""
${text}
"""

ИНСТРУКЦИИ:
- Будь критичным. PASS ставь только если текст действительно звучит как написанный местным автором.
- suggested_local пиши на ${p.language}.
- Дай ровно 3 варианта переписи: Заголовок, Призыв к действию, Блок доверия.
- genericness_score: 0 = полностью оригинальный и локальный, 100 = чистые US SaaS клише.
- Все значения tone_map — целые числа от -5 до +5.

КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. Все текстовые значения в JSON ТОЛЬКО на русском языке (кроме suggested и suggested_local).
2. suggested_local пиши на ${p.language} — не на русском.
3. suggested пиши на английском.
4. Только plain text — никакого markdown, звёздочек, решёток, списков с тире.
5. Ни одного английского слова в полях: verdict_reason, missing_trust_signals, trend_context, reason.

Ответь ТОЛЬКО валидным JSON:
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно точное предложение на русском",
  "genericness_score": <целое 0-100>,
  "generic_phrases": ["фраза из текста", "ещё фраза"],
  "tone_map": {
    "formal_casual": <целое -5 до 5>,
    "bold_cautious": <целое -5 до 5>,
    "technical_benefit": <целое -5 до 5>,
    "abstract_concrete": <целое -5 до 5>,
    "global_native": <целое -5 до 5>
  },
  "missing_trust_signals": ["сигнал на русском", "ещё сигнал на русском"],
  "trend_context": "Одно предложение на русском о текущем B2B-тренде в ${p.label}",
  "rewrites": [
    {
      "block": "Заголовок",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Объяснение на русском — почему это лучше для ${p.label}"
    },
    {
      "block": "Призыв к действию",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Объяснение на русском — почему это лучше для ${p.label}"
    },
    {
      "block": "Доверие и доказательства",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite with trust signals",
      "suggested_local": "Rewrite in ${p.language} with trust signals",
      "reason": "Объяснение на русском — почему это лучше для ${p.label}"
    }
  ],
  "brief_text": "Полная переработанная версия всего текста на английском, локализованная для ${p.label}. Только plain text."
}
  `.trim();
}

function buildImprovePrompt(text: string, market: string, context?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today } = getDateRange();
  return `
Ты эксперт B2B-копирайтер, специализирующийся на рынке ${p.label}.
Сегодня: ${today}.
Перепиши маркетинговый текст так, чтобы он звучал полностью нативно для ${p.label}.

ПРОФИЛЬ РЫНКА:
- Тон: ${p.tone}
- Сигналы доверия для включения: ${p.trust.join(", ")}
- Стиль CTA: ${p.cta}
- Избегать: ${p.redFlags.join(", ")}
${context ? `\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ: ${context}` : ""}

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. improved_local пиши на ${p.language}.
2. improved_text пиши на английском.
3. Поля what и why — ТОЛЬКО на русском языке.
4. tone_achieved — одно предложение на русском.
5. Только plain text — никакого markdown, звёздочек, решёток.
6. changes — от 3 до 5 пунктов.

Ответь ТОЛЬКО валидным JSON:
{
  "improved_text": "Полная улучшенная версия на английском. Только plain text.",
  "improved_local": "Полная улучшенная версия на ${p.language}. Только plain text.",
  "changes": [
    {
      "what": "Что изменено — только на русском",
      "why": "Почему это работает лучше для ${p.label} — только на русском"
    }
  ],
  "tone_achieved": "Одно предложение на русском о тоне нового текста"
}
  `.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, text, market, context } = body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Текст обязателен (минимум 10 символов)" },
        { status: 400 }
      );
    }
    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json(
        { error: "Некорректный рынок. Допустимые значения: germany, poland, brazil" },
        { status: 400 }
      );
    }

    const prompt = action === "improve"
      ? buildImprovePrompt(text.trim(), market, context)
      : buildEvaluatePrompt(text.trim(), market);

    console.log(`📋 POST action=${action} market=${market}`);

    const data = await callAI(prompt);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ POST /api/resonance-trends:", error.message);
    return NextResponse.json(
      { error: "Все ИИ-провайдеры недоступны. Попробуйте позже.", details: error.message },
      { status: 503 }
    );
  }
}
