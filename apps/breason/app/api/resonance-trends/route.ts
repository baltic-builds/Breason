import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GROQ_MODEL = "llama-3.3-70b-versatile";
const OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-preview-02-05:free";

// ── Авто-выбор модели Gemini ──────────────────────────────────────────────────
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
        return bMaj !== aMaj ? bMaj - aMaj : bMin - aMin;
      });
    const bestModel = flashModels.find(m => m.includes('lite')) || flashModels[0];
    if (!bestModel) throw new Error("No suitable flash model found");
    cachedGeminiModel = bestModel;
    return bestModel;
  } catch (e: any) {
    const fallback = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
    console.warn(`⚠️ ListModels failed (${e.message}), fallback: ${fallback}`);
    cachedGeminiModel = fallback;
    return fallback;
  }
}

// ── Утилиты ───────────────────────────────────────────────────────────────────
function parseJson(text: string): any {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Serper: реальный Google-поиск новостей ────────────────────────────────────
interface SerperNewsItem { title: string; snippet: string; source: string; date?: string; link: string; }

async function fetchRealNews(market: string, queries: string[]): Promise<SerperNewsItem[]> {
  if (!process.env.SERPER_API_KEY) return [];

  const allResults: SerperNewsItem[] = [];
  await Promise.allSettled(
    queries.map(async (q) => {
      try {
        const res = await fetch("https://google.serper.dev/news", {
          method: "POST",
          headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({
            q,
            gl: market === "germany" ? "de" : market === "poland" ? "pl" : "br",
            hl: market === "germany" ? "de" : market === "poland" ? "pl" : "pt",
            num: 5,
            tbs: "qdr:m3",
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`Serper ${res.status}`);
        const data = await res.json();
        allResults.push(...(data.news || []).map((item: any) => ({
          title: item.title || "", snippet: item.snippet || "",
          source: item.source || "", date: item.date || "", link: item.link || "",
        })));
      } catch (e: any) {
        console.warn(`⚠️ Serper query failed for "${q}": ${e.message}`);
      }
    })
  );

  const seen = new Set<string>();
  return allResults
    .filter(item => {
      if (!item.title || seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    })
    .slice(0, 20);
}

function formatNewsForPrompt(news: SerperNewsItem[]): string {
  if (!news.length) return "Реальные новости недоступны — используй свои знания.";
  return news.map((item, i) =>
    `[${i + 1}] ${item.title}\nИсточник: ${item.source}${item.date ? ` · ${item.date}` : ""}\n${item.snippet}`
  ).join("\n\n");
}

// ── AI fallbacks ──────────────────────────────────────────────────────────────
async function groqFallback(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" } })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  return (await res.json()).choices[0].message.content;
}

async function openRouterFallback(prompt: string): Promise<any> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("No OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://breason.vercel.app",
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: "user", content: prompt }] })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  return parseJson((await res.json()).choices[0].message.content);
}

async function callAI(prompt: string): Promise<any> {
  try {
    const modelName = await getBestGeminiModel();
    const model = genAI.getGenerativeModel({
      model: modelName,
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
    return parseJson(await groqFallback(prompt));
  } catch (e: any) {
    console.warn(`⚠️ Groq failed: ${e.message}`);
  }
  console.log("🔄 Trying OpenRouter...");
  return await openRouterFallback(prompt);
}

// ════════════════════════════════════════════════════════════════════════════
// 📌 ПРОМПТЫ — ВСЕ ПРОМПТЫ ПРОЕКТА НАХОДЯТСЯ В ЭТОМ ФАЙЛЕ
//
// Где что редактировать:
//   MARKET_PROFILES     — тональность, сигналы доверия, красные флаги по рынкам
//   IMPROVE_PRESETS     — промпты пресетов раздела "Улучшение" (7 форматов)
//   buildEvaluatePrompt — промпт раздела "Проверка" (культурный аудит)
//   buildSearchPrompt   — промпт раздела "Поиск трендов"
// ════════════════════════════════════════════════════════════════════════════

// ── Профили рынков ────────────────────────────────────────────────────────────
const MARKET_PROFILES: Record<string, {
  label: string; labelRu: string; language: string; searchLang: string;
  mediaSources: string; searchQueries: string[];
  tone: string; trust: string[]; redFlags: string[]; cta: string;
}> = {
  germany: {
    label: "Germany (DACH)", labelRu: "Германия", language: "German", searchLang: "de",
    mediaSources: "Handelsblatt, Manager Magazin, Wirtschaftswoche, t3n, Gründerszene",
    searchQueries: [
      "B2B Software Trends Deutschland 2025",
      "Digitalisierung Mittelstand aktuell",
      "SaaS Markt Deutschland neue Entwicklungen",
      "KI Unternehmen Deutschland B2B",
    ],
    tone: "Formal, precise, process-oriented, deeply skeptical of hype and vague promises",
    trust: ["GDPR/DSGVO compliance", "ISO certifications", "EU data residency", "SLA clarity", "security standards"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta: "Soft and non-committal: 'Demo anfragen', 'Unverbindlich beraten lassen'",
  },
  poland: {
    label: "Poland", labelRu: "Польша", language: "Polish", searchLang: "pl",
    mediaSources: "Rzeczpospolita, Puls Biznesu, Spider's Web, Business Insider Polska",
    searchQueries: [
      "trendy B2B Polska 2025",
      "rynek SaaS Polska nowe technologie",
      "cyfryzacja firm Polska aktualne",
      "sztuczna inteligencja biznes Polska",
    ],
    tone: "Direct but fact-based, values concrete numbers, transparent pricing and technical specifics",
    trust: ["specific ROI metrics", "transparent pricing model", "technical specifications", "implementation timeline", "case studies with real numbers"],
    redFlags: ["hype without data", "vague promises", "hidden pricing", "abstract benefits"],
    cta: "Direct with specifics: 'Umów demo (15 min)', 'Zobacz jak to działa'",
  },
  brazil: {
    label: "Brazil", labelRu: "Бразилия", language: "Brazilian Portuguese", searchLang: "br",
    mediaSources: "Exame, Valor Econômico, Startups.com.br, Pequenas Empresas Grandes Negócios",
    searchQueries: [
      "tendências B2B Brasil 2025",
      "mercado SaaS Brasil novidades",
      "tecnologia empresas Brasil atualidades",
      "inteligência artificial negócios Brasil",
    ],
    tone: "Warm, human, relationship-first, low-friction, conversational Portuguese expected",
    trust: ["Portuguese language support", "local Brazilian case studies", "WhatsApp contact", "sem compromisso framing", "LGPD compliance"],
    redFlags: ["cold corporate tone", "aggressive sales push", "English-only support signals", "formal stiffness"],
    cta: "Human and frictionless: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
  },
};

// ── Пресеты улучшения ─────────────────────────────────────────────────────────
interface PresetConfig {
  label: string;
  icon: string;
  desc: string;
  buildPrompt: (text: string, market: string, trendName: string, trendTension: string, context?: string) => string;
}

// Общий JSON-хвост для всех пресетов, чтобы не дублировать
const JSON_TAIL = (language: string, labelRu: string) => `
КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. improved_local пиши на ${language}.
2. improved_text пиши на английском.
3. Поля what и why — ТОЛЬКО на русском.
4. tone_achieved — одно предложение на русском.
5. Только plain text — никакого markdown, звёздочек, решёток.

Ответь ТОЛЬКО валидным JSON:
{
  "improved_text": "Полная версия на английском. Только plain text.",
  "improved_local": "Полная версия на ${language}. Только plain text.",
  "changes": [
    { "what": "Что изменено — только на русском", "why": "Почему это работает лучше для ${labelRu} — только на русском" }
  ],
  "tone_achieved": "Одно предложение на русском о тоне нового текста"
}`.trim();

const MARKET_HINTS: Record<string, Record<string, string>> = {
  germany: {
    zero_click:   "Структурированно, упор на снижение рисков, никаких пустых обещаний.",
    anti_ai:      'Прямолинейно, но уважительно. ("заметил как [тренд] бьёт по маржинальности. мы в [компания] решили это так...")',
    strong_pov:   "Оспаривай технические стандарты или неэффективность процессов.",
    thread:       "Факты, данные, ссылка на регуляторику или отраслевой стандарт в хуке.",
    re_engage:    "Формально, но не холодно. Без давления.",
    data_story:   'Ссылайся на немецкие или EU-исследования. Точные цифры, никаких "около" и "примерно".',
    community:    "Профессионально-коллегиальный тон. Апелляция к коллективному опыту отрасли.",
  },
  brazil: {
    zero_click:   "Сторителлинг, фокус на партнёрство и обход бюрократии.",
    anti_ai:      'Чуть больше эмоций, но всё равно коротко ("привет! видел хаос из-за [тренд]. мы тут сделали штуку...")',
    strong_pov:   "Оспаривай медлительность корпораций и устаревший менеджмент.",
    thread:       'Эмоциональная история в хуке ("один наш клиент потерял X из-за [тренд]...").',
    re_engage:    'Тепло, как старый знакомый. Можно начать с "Tudo bem?".',
    data_story:   "Сравни с ростом/падением local market. Подчеркни возможность, а не угрозу.",
    community:    "Открыто, с юмором, как в WhatsApp-чате старых коллег.",
  },
  poland: {
    zero_click:   "Прагматично, фокус на оптимизацию бюджетов и евро-стандарты.",
    anti_ai:      'Чётко про деньги/время ("привет. [тренд] сейчас жжёт бюджеты. мы тут собрали решение...")',
    strong_pov:   'Оспаривай раздутые бюджеты и неработающие "модные" решения.',
    thread:       "Прямой расчёт потерь в злотых/евро в хуке.",
    re_engage:    "Деловито, уважение ко времени. Сразу ценность, потом вопрос.",
    data_story:   "Сравни с соседними EU-рынками (Германия, Чехия). Фокус на отставание и потенциал.",
    community:    'Конкретный кейс + вопрос "как у вас?" без лишних слов.',
  },
};

const IMPROVE_PRESETS: Record<string, PresetConfig> = {
  zero_click: {
    label: "Zero-Click Пост", icon: "🕳️", desc: "Удержание в ленте без перехода по ссылке",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.zero_click || "";
      return `
Ты — топовый B2B-автор 2026 года. Специализация — Zero-Click Content для рынка: ${p.labelRu}.
Возьми исходный текст и тренд "${trendName}" (Боль: "${trendTension}") и напиши пост для LinkedIn/X, который не требует перехода по ссылке. Вся ценность внутри.

ПРАВИЛА АДАПТАЦИИ (${p.labelRu}): ${hint}

СТРУКТУРА:
1. Хук (1 строка) — неочевидный факт о тренде "${trendName}".
2. Разрыв шаблона — почему старые методы решения боли "${trendTension}" больше не работают.
3. Мясо (Value) — выжимка пользы из исходного текста в виде 3 коротких тезисов.
4. Вывод — одна мощная мысль, оставляющая послевкусие.
5. НИКАКИХ ПРИЗЫВОВ ПЕРЕЙТИ ПО ССЫЛКЕ.

Пиши ёмко. Без корпоративного жаргона — никаких "синергий" и "инноваций".

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  anti_ai: {
    label: "Anti-AI", icon: "📱", desc: "Живой текст, написанный «на бегу»",
    buildPrompt: (text, market, trendName) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.anti_ai || "";
      return `
Ты — CEO стартапа. Бежишь на рейс и печатаешь сообщение потенциальному клиенту в ${p.labelRu} с телефона.
Перепиши исходный текст, используя контекст тренда "${trendName}".

ПРАВИЛА ANTI-AI:
- Текст короткий и простой для чтения.
- Убери все заглавные буквы в начале предложений (пиши с маленькой).
- Никаких долгих вступлений. Сразу к делу.

КУЛЬТУРНЫЙ НЮАНС (${p.labelRu}): ${hint}

Пиши СТРОГО от первого лица.

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  strong_pov: {
    label: "Провокационное мнение", icon: "🔥", desc: "Жёсткая позиция, которую хочется оспорить",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.strong_pov || "";
      return `
Ты — B2B Challenger. Цель — поляризовать аудиторию на рынке: ${p.labelRu}.
Возьми исходный текст и тренд "${trendName}", выдай жёсткое аргументированное мнение, противоречащее status quo.

АДАПТАЦИЯ ПОД ${p.labelRu}: ${hint}

СТРУКТУРА:
1. "Непопулярное мнение: [Резкое заявление о тренде]".
2. "Все говорят, что нужно делать X, но на самом деле это убивает [метрику]".
3. Внедрение продукта из исходного текста как единственно верного пути.
4. Открытый агрессивный вопрос в конце.

Стиль: хлёсткий, уверенный, без извинений.

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  thread_starter: {
    label: "Виральный тред", icon: "🧵", desc: "Тред из 5 частей для LinkedIn / X",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.thread || "";
      return `
Ты — автор вирусных B2B-тредов на рынке: ${p.labelRu}.
Возьми исходный текст и тренд "${trendName}" и напиши тред из 5 частей, каждая — удар по боли "${trendTension}".

ПРАВИЛА:
- Часть 1 (Хук): Одно предложение. Цифра или шок-факт. Никаких "привет, сегодня поговорим о...".
- Части 2-4: Один аргумент. Короткий абзац (3-4 строки). Пронумеровано: 2/, 3/, 4/
- Часть 5 (Финал): Вывод из исходного текста + вопрос, провоцирующий ответ.

АДАПТАЦИЯ (${p.labelRu}): ${hint}

Пиши как живой человек, не как контент-менеджер.

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  re_engage: {
    label: "Реанимация лидов", icon: "♻️", desc: "Пишем лидам, которые сказали «не сейчас»",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.re_engage || "";
      return `
Ты — Account Executive с конверсией реанимации лидов выше 30% на рынке: ${p.labelRu}.
Напиши короткое сообщение лиду, который пропал или отказал 3-6 месяцев назад.

МЕХАНИКА: Используй тренд "${trendName}" как внешний триггер.
Не упоминай, что они отказали. Начни как будто продолжаешь обычный разговор.

СТРУКТУРА (максимум 5 предложений):
1. "${trendName} сейчас меняет правила для таких компаний, как ваша."
2. "Помню, тогда мы говорили про [контекст из исходного текста] — думаю, картина поменялась."
3. Новая ценность.
4. Ультра-мягкий CTA: Не звонок. Не демо. ("Актуально ли это для вас сейчас?")

ТОНАЛЬНОСТЬ (${p.labelRu}): ${hint}

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  data_story: {
    label: "Data Story", icon: "📊", desc: "Инсайт на основе данных — 3x больше репостов",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.data_story || "";
      return `
Ты — Data Journalist, специализирующийся на B2B рынке: ${p.labelRu}.
Возьми исходный текст и тренд "${trendName}" и сделай пост-инсайт, который выглядит как мини-исследование.

ПРАВИЛА:
- Начни с цифры или процента.
- Покажи неочевидную связь между "${trendName}" и болью "${trendTension}".
- Дай 1 практический вывод, применимый сегодня.
- Заверши провокационным прогнозом ("К концу 2026 года компании, которые не...").

АДАПТАЦИЯ (${p.labelRu}): ${hint}

Формат: один связный пост, без буллитов, как аналитический LinkedIn-пост.

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  community_drop: {
    label: "Community Drop", icon: "🫂", desc: "Пост в нишевое комьюнити — без рекламы",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.community || "";
      return `
Ты — активный участник профессионального комьюнити в: ${p.labelRu}. Не продавец. Свой среди своих.
Напиши пост для закрытой группы, замаскированный под органичный обмен опытом.

МЕХАНИКА:
1. Начни с личного наблюдения о тренде "${trendName}" (личный опыт, не новость).
2. Задай открытый вопрос ("как вы справляетесь с ${trendTension}?").
3. Органично упомяни решение из исходного текста как "то, что попробовали мы".
4. Заверши просьбой поделиться опытом. Без CTA и ссылок.

ЖЁСТКИЕ ПРАВИЛА:
- Никаких слов: "решение", "продукт", "сервис", "платформа", "инструмент".
- "мы попробовали", "нам помогло", "у нас сработало".
- Максимум 150 слов.

ТОНАЛЬНОСТЬ (${p.labelRu}): ${hint}

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },
};

// ── Промпт evaluate ───────────────────────────────────────────────────────────
function buildEvaluatePrompt(text: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today } = getDateRange();
  return `
Ты — старший аудитор B2B-локализации. Выступи как местный B2B-покупатель на рынке ${p.label} и честно оцени нативность текста.
Сегодня: ${today}.

<market_profile>
Рынок: ${p.label}
Ожидаемый тон: ${p.tone}
Обязательные сигналы доверия: ${p.trust.join(", ")}
Красные флаги: ${p.redFlags.join(", ")}
Стиль CTA: ${p.cta}
</market_profile>

<text_to_evaluate>
${text}
</text_to_evaluate>

<instructions>
Шаг 1 (думай про себя): Прочитай текст как местный B2B-покупатель. Отметь, что режет слух.
Шаг 2 (думай про себя): Определи 2-3 фрагмента, которые звучат как перевод с английского.
Шаг 3: Выдай финальный JSON.

PASS ставь ТОЛЬКО если текст действительно звучит как написанный местным автором.
suggested_local пиши СТРОГО на ${p.language}.
Дай ровно 3 варианта переписи: Заголовок, Призыв к действию, Блок доверия.
genericness_score: 0 = оригинальный, 100 = чистые US SaaS клише.
Все значения tone_map — целые числа от -5 до +5.
</instructions>

КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. Все текстовые поля JSON — ТОЛЬКО на русском (кроме suggested и suggested_local).
2. suggested_local — на ${p.language}, НЕ на русском.
3. suggested — на английском.
4. Только plain text — никакого markdown.

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
  "missing_trust_signals": ["сигнал на русском"],
  "trend_context": "Одно предложение на русском о текущем B2B-тренде в ${p.label}",
  "rewrites": [
    {
      "block": "Заголовок",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Объяснение на русском — почему лучше для ${p.label}"
    },
    {
      "block": "Призыв к действию",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite",
      "suggested_local": "Rewrite in ${p.language}",
      "reason": "Объяснение на русском — почему лучше для ${p.label}"
    },
    {
      "block": "Доверие и доказательства",
      "original": "точный фрагмент из исходного текста",
      "suggested": "English rewrite with trust signals",
      "suggested_local": "Rewrite in ${p.language} with trust signals",
      "reason": "Объяснение на русском — почему лучше для ${p.label}"
    }
  ],
  "brief_text": "Полная переработанная версия на английском, локализованная для ${p.label}. Только plain text."
}
  `.trim();
}

// ── Промпт search ─────────────────────────────────────────────────────────────
function buildSearchPrompt(
  profile: typeof MARKET_PROFILES[string],
  newsContext: string,
  hasRealNews: boolean,
  today: string,
  ninetyDaysAgo: string
): string {
  return `
Ты — старший аналитик B2B-рынков. Составь деловой дайджест для рынка ${profile.label}.

СЕГОДНЯШНЯЯ ДАТА: ${today}
ПЕРИОД АНАЛИЗА: с ${ninetyDaysAgo} по ${today}

${hasRealNews
  ? `РЕАЛЬНЫЕ НОВОСТИ из открытых источников за последние 90 дней:\n---\n${newsContext}\n---\nВАЖНО: Анализируй только то, что выше. Не придумывай новости.`
  : `Реальные новости недоступны. Опиши актуальные тренды рынка ${profile.label} на основе своих знаний, но НЕ упоминай события старше 2024 года.`
}

ЗАДАЧА: 7 наиболее важных и актуальных B2B-историй для ${profile.label}.

ДЛЯ КАЖДОЙ:
- headline: конкретный информативный заголовок
- category: одно из — Технологии, Регулирование, Финансы, Рынок труда, ИИ и автоматизация, Стартапы, Деловая среда, Экспорт, Ритейл
- summary: 2-3 предложения
- business_impact: конкретное следствие для B2B продаж/маркетинга
- resonance_score: 0-100

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Весь текст ТОЛЬКО на русском языке.
2. Только plain text — никакого markdown.
3. Не упоминай COVID как актуальный фактор.
4. Не пиши общие фразы. Будь конкретным.
5. Все события — не ранее ${ninetyDaysAgo}.

Ответь ТОЛЬКО валидным JSON:
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
}

// ════════════════════════════════════════════════════════════════════════════
// GET — Дайджест новостей
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market  = searchParams.get('market') || 'germany';
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today, ninetyDaysAgo } = getDateRange();

  const realNews    = await fetchRealNews(market, profile.searchQueries);
  const newsContext = formatNewsForPrompt(realNews);
  const prompt      = buildSearchPrompt(profile, newsContext, realNews.length > 0, today, ninetyDaysAgo);

  try {
    const data = await callAI(prompt);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ GET /api/resonance-trends:", error.message);
    return NextResponse.json({
      market: profile.label, generated_at: today,
      items: [{ headline: "Провайдеры временно недоступны", category: "Ошибка", summary: "Проверьте API-ключи в настройках Vercel.", business_impact: "Попробуйте через минуту.", resonance_score: 0 }]
    }, { status: 200 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// POST — Evaluate + Improve
// ════════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, text, market, context, preset, trendName, trendTension } = body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json({ error: "Текст обязателен (минимум 10 символов)" }, { status: 400 });
    }
    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json({ error: "Некорректный рынок. Допустимые значения: germany, poland, brazil" }, { status: 400 });
    }

    let prompt: string;
    if (action === "improve") {
      const presetConfig = IMPROVE_PRESETS[preset] || IMPROVE_PRESETS.zero_click;
      prompt = presetConfig.buildPrompt(
        text.trim(),
        market,
        trendName || "текущий тренд рынка",
        trendTension || "давление на маркетинговые бюджеты",
        context
      );
    } else {
      prompt = buildEvaluatePrompt(text.trim(), market);
    }

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

// Экспорт метаданных пресетов для фронтенда
export const PRESETS_META = Object.entries(IMPROVE_PRESETS).map(([id, p]) => ({
  id, label: p.label, icon: p.icon, desc: p.desc,
}));
