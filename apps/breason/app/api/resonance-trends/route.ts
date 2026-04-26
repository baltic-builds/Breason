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

    console.log(`✅ Gemini model selected: ${bestModel} (из ${flashModels.length} доступных flash-моделей)`);
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

// Надёжный парсер: находит первый сбалансированный JSON-блок в тексте.
// Решает проблему "Unexpected non-whitespace character after JSON" —
// модель иногда добавляет пояснения после закрывающей скобки.
function extractFirstJsonBlock(text: string): string {
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const startObj = clean.indexOf('{');
  const startArr = clean.indexOf('[');

  const start =
    startObj === -1 ? startArr :
    startArr === -1 ? startObj :
    Math.min(startObj, startArr);

  if (start === -1) throw new Error("No JSON object found in AI response");

  const openChar = clean[start];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];

    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) return clean.slice(start, i + 1);
    }
  }

  throw new Error("Unbalanced JSON object in AI response");
}

function parseJson(text: string): any {
  const jsonText = extractFirstJsonBlock(text);
  return JSON.parse(jsonText);
}

function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Serper: реальный Google-поиск новостей ────────────────────────────────────
interface SerperNewsItem { title: string; snippet: string; source: string; date?: string; link: string; type?: string; }

// Маппинг market → Serper geo-параметры
const SERPER_LOCALE: Record<string, { gl: string; hl: string }> = {
  germany: { gl: "de", hl: "en" },
  poland:  { gl: "pl", hl: "en" },
  brazil:  { gl: "br", hl: "en" },
};

// Один Serper-запрос. gl/hl всегда en чтобы заголовки шли на английском.
async function serperRequest(
  query: string, locale: { gl: string; hl: string },
  type: "news" | "search", tbs = "qdr:w", num = 5
): Promise<SerperNewsItem[]> {
  const endpoint = type === "news"
    ? "https://google.serper.dev/news"
    : "https://google.serper.dev/search";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: locale.gl, hl: "en", num, tbs }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}`);
  const data = await res.json();

  // news endpoint → data.news; search endpoint → data.organic
  const items = type === "news" ? (data.news || []) : (data.organic || []);
  return items.map((item: any) => ({
    title:   item.title   || "",
    snippet: item.snippet || "",
    source:  item.source  || item.displayLink || "",
    date:    item.date    || "",
    link:    item.link    || "",
  }));
}

async function fetchRealNews(market: string, queries: string[]): Promise<SerperNewsItem[]> {
  if (!process.env.SERPER_API_KEY) return [];

  const locale = SERPER_LOCALE[market] || { gl: "us", hl: "en" };
  const allResults: SerperNewsItem[] = [];

  // ── 1. Основные новости (последняя неделя, приоритет свежести) ────────────
  await Promise.allSettled(
    queries.slice(0, 3).map(async (q) => {
      try {
        const items = await serperRequest(q, locale, "news", "qdr:w", 5);
        allResults.push(...items);
        console.log(`✅ News week [${q}]: ${items.length} results`);
      } catch (e: any) {
        // Fallback: последний месяц если за неделю пусто
        try {
          const items = await serperRequest(q, locale, "news", "qdr:m", 4);
          allResults.push(...items);
          console.log(`✅ News month fallback [${q}]: ${items.length} results`);
        } catch { console.warn(`⚠️ News failed [${q}]: ${e.message}`); }
      }
    })
  );

  // ── 2. YouTube — обсуждения и тренды в деловом сегменте ──────────────────
  const ytQuery = `site:youtube.com B2B ${queries[0]?.split(" ").slice(0, 4).join(" ") || market} 2025`;
  try {
    const ytItems = await serperRequest(ytQuery, { gl: locale.gl, hl: "en" }, "search", "qdr:m", 4);
    const filtered = ytItems.filter(i => i.link?.includes("youtube.com") || i.source?.includes("YouTube"));
    if (filtered.length > 0) {
      allResults.push(...filtered.map(i => ({ ...i, source: `YouTube · ${i.source || "видео"}` })));
      console.log(`✅ YouTube: ${filtered.length} results`);
    }
  } catch (e: any) { console.warn(`⚠️ YouTube search failed: ${e.message}`); }

  // ── 3. X/Twitter — live-обсуждения в профессиональных кругах ─────────────
  const xQuery = `site:x.com OR site:twitter.com B2B ${queries[0]?.split(" ").slice(0, 3).join(" ") || market}`;
  try {
    const xItems = await serperRequest(xQuery, { gl: locale.gl, hl: "en" }, "search", "qdr:w", 4);
    const filtered = xItems.filter(i => i.link?.includes("x.com") || i.link?.includes("twitter.com") || i.source?.toLowerCase().includes("x.com") || i.source?.toLowerCase().includes("twitter"));
    if (filtered.length > 0) {
      allResults.push(...filtered.map(i => ({ ...i, source: `X (Twitter) · ${i.source || "пост"}` })));
      console.log(`✅ X/Twitter: ${filtered.length} results`);
    }
  } catch (e: any) { console.warn(`⚠️ X search failed: ${e.message}`); }

  // Дедупликация по заголовку
  const seen = new Set<string>();
  return allResults
    .filter(item => {
      if (!item.title || seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    })
    .slice(0, 25);
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
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(25000),
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
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }]
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  return parseJson((await res.json()).choices[0].message.content);
}

async function callAI(prompt: string): Promise<any> {

  // ── Шаг 1: Gemini ──────────────────────────────────────────────────────────
  try {
    const modelName = await getBestGeminiModel();
    console.log(`🤖 Trying Gemini: ${modelName}`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout 20s")), 20000)
      )
    ]);

    const parsed = parseJson(result.response.text());
    console.log(`✅ Gemini success: ${modelName}`);
    return parsed;

  } catch (e: any) {
    const msg = e.message || "";
    const isModelError =
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('does not exist');

    if (isModelError) {
      cachedGeminiModel = null;
      console.warn(`⚠️ Gemini model not found, cache cleared: ${msg}`);
    } else {
      console.warn(`⚠️ Gemini failed (503/timeout/etc), cache kept: ${msg}`);
    }
  }

  // ── Шаг 2: Groq ────────────────────────────────────────────────────────────
  try {
    console.log(`🔄 Trying Groq: ${GROQ_MODEL}`);
    const parsed = parseJson(await groqFallback(prompt));
    console.log(`✅ Groq success`);
    return parsed;
  } catch (e: any) {
    console.warn(`⚠️ Groq failed: ${e.message}`);
  }

  // ── Шаг 3: OpenRouter ──────────────────────────────────────────────────────
  try {
    console.log(`🔄 Trying OpenRouter: ${OPENROUTER_MODEL}`);
    const parsed = await openRouterFallback(prompt);
    console.log(`✅ OpenRouter success`);
    return parsed;
  } catch (e: any) {
    console.warn(`⚠️ OpenRouter failed: ${e.message}`);
  }

  throw new Error("Все AI-провайдеры недоступны");
}

// ════════════════════════════════════════════════════════════════════════════
// 📌 ПРОМПТЫ
// ════════════════════════════════════════════════════════════════════════════

const MARKET_PROFILES: Record<string, {
  label: string; labelRu: string; language: string; searchLang: string;
  mediaSources: string; searchQueries: string[];
  tone: string; trust: string[]; redFlags: string[]; cta: string;
  buyerPsyche: string;
  decisionLogic: string;
  culturalSubtext: string;
  fewShotPass: string;
  fewShotFail: string;
  localAnchors: string[];
  powerPhrases: string[];
  idealToneProfile: string;
}> = {
  germany: {
    label: "Germany (DACH)", labelRu: "Германия", language: "Немецкий", searchLang: "de",
    mediaSources: "Handelsblatt, Manager Magazin, Wirtschaftswoche, t3n, Gründerszene",
    searchQueries: [
      "B2B software trends Germany DACH 2025",
      "German Mittelstand digitalization news",
      "SaaS market Germany enterprise technology",
      "AI business tools Germany B2B",
    ],
    tone: "Формальный, точный, ориентированный на процессы, глубоко скептичный к хайпу",
    trust: ["соответствие GDPR/DSGVO", "сертификаты ISO", "хранение данных в ЕС", "прозрачность SLA", "стандарты безопасности"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta: "Мягкий, необязывающий: 'Demo anfragen', 'Unverbindlich beraten lassen'",
    buyerPsyche: `Типичный покупатель в регионе DACH — это ИТ-директор или уполномоченный представитель в компании среднего бизнеса (50–500 сотрудников). Он несёт личную ответственность за решение перед советом директоров. Страх провала важнее желания выиграть: он не купит «лучшее» — он купит «самое безопасное для карьеры». Решение принимается коллегиально, от трёх до шести месяцев, через тендерный процесс. К моменту, когда он читает твой текст, он уже изучил четыре конкурентных предложения.`.trim(),
    decisionLogic: `Формула покупки: (Доказанный возврат инвестиций + Нулевой регуляторный риск + Репутация поставщика) превышает стоимость внедрения. Без конкретных цифр — разговора нет. Без ответа на вопрос «что произойдёт с нашими данными» — сделки нет. Без рекомендации от немецкой или австрийской компании — высокое недоверие.`.trim(),
    culturalSubtext: `Немецкий деловой текст говорит о процессе, а не о результате — покупатель сам сделает вывод о выгоде. «Мы оптимизируем ваши процессы» звучит органично. «Мы трансформируем ваш бизнес» — красный флаг иностранца. Развёрнутость воспринимается как основательность, если речь идёт о технических деталях. Маркетинговая лёгкость читается как несерьёзность.`.trim(),
    fewShotPass: `ХОРОШИЙ ПРИМЕР: «Решение сертифицировано по стандарту ISO 27001, все данные хранятся исключительно в немецких центрах обработки данных. Более 120 компаний среднего бизнеса в регионе DACH используют платформу — среднее время внедрения шесть недель. Запросить демонстрацию без обязательств.» Почему работает: сертификат → место хранения данных → конкретная цифра → срок → мягкий призыв.`.trim(),
    fewShotFail: `ПЛОХОЙ ПРИМЕР: «Our revolutionary all-in-one platform seamlessly unlocks your team's potential. Join thousands of happy customers and transform your workflow today!» Почему провал: хайп без данных, нет немецких референсов, давление в призыве к действию.`.trim(),
    localAnchors: [
      "Средний бизнес как профессиональная идентичность",
      "Защита данных как ценность, а не функция",
      "Качество немецкого или европейского производства",
      "Долгосрочное партнёрство важнее сиюминутной скидки",
      "Соответствие нормативам на первом месте",
    ],
    powerPhrases: [
      "соответствует требованиям законодательства ЕС",
      "данные хранятся в Германии",
      "демонстрация без обязательств",
      "доказано на практике",
      "сертифицировано",
      "проверено в среднем бизнесе",
      "прозрачная стоимость",
      "персональный менеджер",
    ],
    idealToneProfile: "официальный: −3, смелый: −2, акцент на выгоду: −1, конкретность: +3, локальность: +4",
  },

  poland: {
    label: "Poland", labelRu: "Польша", language: "Польский", searchLang: "pl",
    mediaSources: "Rzeczpospolita, Puls Biznesu, Spider's Web, Business Insider Polska",
    searchQueries: [
      "B2B technology trends Poland 2025",
      "SaaS market Poland enterprise software",
      "digital transformation companies Poland",
      "AI tools business Poland news",
    ],
    tone: "Прямой и опирающийся на факты, ценит конкретные цифры и прозрачное ценообразование",
    trust: ["конкретные показатели возврата инвестиций", "прозрачная модель ценообразования", "технические характеристики", "сроки внедрения", "кейсы с реальными цифрами"],
    redFlags: ["хайп без данных", "размытые обещания", "скрытое ценообразование", "абстрактные преимущества"],
    cta: "Прямой и конкретный: 'Umów demo (15 min)', 'Zobacz jak to działa'",
    buyerPsyche: `Польский покупатель — прагматик с установкой «покажи цифры или не трать моё время». Это часто операционный директор или финансовый директор в быстрорастущей компании (20–200 сотрудников). Первый вопрос всегда: «А это точно работает для польского рынка? Есть польские клиенты?» Решения принимаются быстрее, чем в Германии, но с жёстким торгом по цене.`.trim(),
    decisionLogic: `Формула покупки: (Конкретный возврат инвестиций + Польские референсы + Прозрачная цена) превышает всё остальное. Срок окупаемости должен быть явным. Бесплатный пробный период или пилотный проект резко снижают барьер входа.`.trim(),
    culturalSubtext: `Польский рынок — высокая экспертиза, европейские стандарты, но без немецкой тяжеловесности. Текст должен уважать интеллект читателя. Прямолинейность ценится: если ты лучше конкурента — скажи прямо и докажи данными. Скептицизм к хайпу вокруг ИИ — нужно приземлять в конкретику.`.trim(),
    fewShotPass: `ХОРОШИЙ ПРИМЕР: «Наше решение сократило время отчётности на 60% в таких компаниях, как [польская компания]. Внедрение занимает в среднем три недели. Стоимость от 299 злотых в месяц — без скрытых платежей. Бесплатная демонстрация (15 минут).» Почему работает: процент → польский референс → срок → цена → короткий формат демо.`.trim(),
    fewShotFail: `ПЛОХОЙ ПРИМЕР: «Transform your business with our cutting-edge AI-powered platform. Trusted by businesses worldwide!» Почему провал: нет цифр, нет польских клиентов, нет цены, хайп без доказательств.`.trim(),
    localAnchors: [
      "Конкретные цифры — проявление уважения",
      "Локализация — обязательное требование",
      "Быстрый возврат инвестиций",
      "Никаких скрытых платежей",
      "Польские компании в качестве референсов",
    ],
    powerPhrases: [
      "без скрытых платежей",
      "возврат инвестиций за N месяцев",
      "польские компании",
      "бесплатная демонстрация",
      "внедрение за N недель",
      "проверенное решение",
      "конкретные результаты",
    ],
    idealToneProfile: "официальный: −1, смелый: +1, акцент на выгоду: +1, конкретность: +4, локальность: +3",
  },

  brazil: {
    label: "Brazil", labelRu: "Бразилия", language: "Бразильский португальский", searchLang: "br",
    mediaSources: "Exame, Valor Econômico, Startups.com.br, Pequenas Empresas Grandes Negócios",
    searchQueries: [
      "B2B technology trends Brazil 2025",
      "SaaS market Brazil startups news",
      "digital transformation Brazil companies",
      "AI business tools Brazil enterprise",
    ],
    tone: "Тёплый, человечный, отношения на первом месте, минимум трений, разговорный португальский",
    trust: ["поддержка на португальском языке", "бразильские кейсы", "контакт через мессенджер", "формат без обязательств", "соответствие бразильскому законодательству о данных"],
    redFlags: ["холодный корпоративный тон", "агрессивные продажи", "поддержка только на английском", "формальная жёсткость"],
    cta: "Человечный и без трений: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",
    buyerPsyche: `Бразильский покупатель принимает решения через отношения и доверие, а не через документы. Это часто генеральный директор или коммерческий директор (50–500 сотрудников), который сначала оценивает человека, потом продукт. «Мне понравился этот человек» — реальный аргумент. Скорость важна: решения могут приниматься за неделю. Бюрократия и сложность интеграции — главные страхи.`.trim(),
    decisionLogic: `Формула покупки: (Доверие к команде поставщика + Простота внедрения + Работа с бразильской спецификой) превышает цену. Бесплатный пробный период плюс поддержка через мессенджер резко повышают конверсию. Кейс бразильской компании из той же отрасли — на вес золота.`.trim(),
    culturalSubtext: `Тёплый тон — это деловая стратегия в Бразилии. Текст на официальном португальском воспринимается как холодность. Неформальное обращение работает лучше в большинстве деловых контекстов. Обращение к росту и совместному успеху — культурный код, а не клише. Прямые продажи без установления контакта — серьёзная ошибка.`.trim(),
    fewShotPass: `ХОРОШИЙ ПРИМЕР: «Привет! Мы знаем, что управлять [процессом] в Бразилии непросто. Уже помогли более 80 бразильским компаниям сократить время на [задачу] на 40%. Всё на португальском, поддержка через мессенджер. Короткий разговор на 20 минут? Без обязательств.» Почему работает: приветствие → понимание боли → бразильские кейсы → португальский + мессенджер → лёгкий призыв.`.trim(),
    fewShotFail: `ПЛОХОЙ ПРИМЕР: «Dear Sir/Madam, I am reaching out to present our enterprise solution that leverages cutting-edge technology. Please review the attached proposal.» Почему провал: английский язык, формальное обращение, нет тепла, нет отношений.`.trim(),
    localAnchors: [
      "Интеграция с бразильской налоговой системой",
      "Поддержка на португальском языке — обязательное условие",
      "Мессенджер как основной канал коммуникации",
      "Бразильские компании в качестве референсов",
      "Совместный рост как ключевой нарратив",
    ],
    powerPhrases: [
      "без обязательств",
      "на португальском языке",
      "поддержка в мессенджере",
      "бразильские компании",
      "легко внедрить",
      "короткий разговор",
      "бесплатный пробный период",
      "расти вместе",
    ],
    idealToneProfile: "официальный: +3, смелый: +1, акцент на выгоду: +2, конкретность: +2, локальность: +4",
  },
};

// ── Пресеты улучшения ─────────────────────────────────────────────────────────
interface PresetConfig {
  label: string;
  icon: string;
  desc: string;
  buildPrompt: (text: string, market: string, trendName: string, trendTension: string, context?: string) => string;
}

const JSON_TAIL = (language: string, labelRu: string) => `
КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. improved_local пиши на ${language}.
2. improved_text пиши на английском.
3. Поля what и why — ТОЛЬКО на русском, без иностранных слов.
4. tone_achieved — одно предложение на русском.
5. Только обычный текст — никакого markdown, звёздочек, решёток.
6. Никакого текста до или после JSON.

Ответь ТОЛЬКО валидным JSON:
{
  "improved_text": "Полная версия на английском. Только обычный текст.",
  "improved_local": "Полная версия на ${language}. Только обычный текст.",
  "changes": [
    { "what": "Что изменено — только на русском", "why": "Почему это работает лучше для ${labelRu} — только на русском" }
  ],
  "tone_achieved": "Одно предложение на русском о тоне нового текста"
}`.trim();

const MARKET_HINTS: Record<string, Record<string, string>> = {
  germany: {
    zero_click:   "Структурированно, упор на снижение рисков, никаких пустых обещаний.",
    anti_ai:      "Прямолинейно, но уважительно. Например: «заметил, как [тренд] бьёт по маржинальности. мы в [компания] решили это так...»",
    strong_pov:   "Оспаривай технические стандарты или неэффективность процессов.",
    thread:       "Факты, данные, ссылка на регуляторику или отраслевой стандарт в зачине.",
    re_engage:    "Официально, но не холодно. Без давления.",
    data_story:   "Ссылайся на немецкие или общеевропейские исследования. Точные цифры.",
    community:    "Профессионально-коллегиальный тон. Обращение к коллективному опыту отрасли.",
  },
  brazil: {
    zero_click:   "Сторителлинг, фокус на партнёрство и преодоление бюрократии.",
    anti_ai:      "Чуть больше эмоций, но всё равно коротко. Например: «привет! видел, что творится из-за [тренд]. мы тут придумали кое-что...»",
    strong_pov:   "Оспаривай медлительность корпораций и устаревший менеджмент.",
    thread:       "Эмоциональная история в зачине.",
    re_engage:    "Тепло, как со старым знакомым.",
    data_story:   "Сравни с ростом или падением местного рынка. Подчеркни возможность.",
    community:    "Открыто, с юмором, как в переписке со старыми коллегами.",
  },
  poland: {
    zero_click:   "Прагматично, фокус на оптимизацию бюджетов и европейские стандарты.",
    anti_ai:      "Чётко про деньги и время. Например: «привет. [тренд] сейчас сжигает бюджеты. мы собрали решение...»",
    strong_pov:   "Оспаривай раздутые бюджеты и неработающие модные решения.",
    thread:       "Прямой расчёт потерь в злотых или евро в зачине.",
    re_engage:    "По-деловому, уважение ко времени. Сразу ценность, потом вопрос.",
    data_story:   "Сравни с соседними рынками ЕС. Фокус на отставание и потенциал.",
    community:    "Конкретный кейс плюс вопрос «как у вас?» без лишних слов.",
  },
};

const IMPROVE_PRESETS: Record<string, PresetConfig> = {
  zero_click: {
    label: "Zero-Click Пост", icon: "🕳️", desc: "Удержание в ленте без перехода по ссылке",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.zero_click || "";
      return `
Ты — ведущий автор деловых публикаций для рынка ${p.labelRu}.
Возьми исходный текст и тренд «${trendName}» (боль: «${trendTension}») и напиши пост для деловой социальной сети, который не требует перехода по ссылке. Вся ценность — внутри поста.

ПРАВИЛА АДАПТАЦИИ (${p.labelRu}): ${hint}

СТРУКТУРА:
1. Зачин (одна строка) — неочевидный факт о тренде «${trendName}».
2. Разрыв шаблона — почему старые методы решения боли «${trendTension}» больше не работают.
3. Суть — выжимка пользы из исходного текста в виде трёх коротких тезисов.
4. Вывод — одна сильная мысль, оставляющая послевкусие.
5. НИКАКИХ ПРИЗЫВОВ ПЕРЕЙТИ ПО ССЫЛКЕ.

Пиши ёмко. Без корпоративного жаргона.

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
Ты — руководитель стартапа. Бежишь на рейс и печатаешь сообщение потенциальному клиенту в ${p.labelRu} с телефона.
Перепиши исходный текст, используя контекст тренда «${trendName}».

ПРАВИЛА:
- Текст короткий и простой для чтения.
- Пиши с маленькой буквы в начале предложений.
- Никаких долгих вступлений. Сразу к делу.

КУЛЬТУРНЫЙ НЮАНС (${p.labelRu}): ${hint}

Пиши строго от первого лица.

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
Ты — независимый деловой эксперт. Твоя цель — поляризовать аудиторию на рынке ${p.labelRu}.
Возьми исходный текст и тренд «${trendName}», выдай жёсткое аргументированное мнение, противоречащее привычному положению дел.

АДАПТАЦИЯ ПОД ${p.labelRu}: ${hint}

СТРУКТУРА:
1. «Непопулярное мнение: [резкое заявление о тренде]».
2. «Все говорят, что нужно делать X, но на самом деле это убивает [показатель]».
3. Решение из исходного текста как единственно верный путь.
4. Открытый провокационный вопрос в конце.

Стиль: хлёсткий, уверенный, без оправданий.

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  thread_starter: {
    label: "Виральный тред", icon: "🧵", desc: "Тред из 5 частей для деловых социальных сетей",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.thread || "";
      return `
Ты — автор вирусных деловых публикаций на рынке ${p.labelRu}.
Возьми исходный текст и тренд «${trendName}» и напиши тред из пяти частей, каждая — удар по боли «${trendTension}».

ПРАВИЛА:
- Часть 1 (зачин): одно предложение. Цифра или неожиданный факт. Никаких «привет, сегодня поговорим о...».
- Части 2–4: один аргумент, короткий абзац (3–4 строки). Нумерация: 2/, 3/, 4/
- Часть 5 (финал): вывод из исходного текста + вопрос, провоцирующий ответ.

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
Ты — менеджер по работе с ключевыми клиентами с показателем повторной конверсии выше 30% на рынке ${p.labelRu}.
Напиши короткое сообщение контакту, который пропал или отказал три-шесть месяцев назад.

МЕХАНИКА: используй тренд «${trendName}» как внешний повод для контакта.
Не упоминай, что они отказали. Начни как будто продолжаешь обычный разговор.

СТРУКТУРА (не более пяти предложений):
1. «${trendName} сейчас меняет правила для таких компаний, как ваша.»
2. «Помню, тогда мы говорили про [контекст из исходного текста] — думаю, картина поменялась.»
3. Новая ценность.
4. Мягкий призыв: не звонок, не демо. («Актуально ли это для вас сейчас?»)

ТОНАЛЬНОСТЬ (${p.labelRu}): ${hint}

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  data_story: {
    label: "Data Story", icon: "📊", desc: "Инсайт на основе данных — в три раза больше репостов",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.data_story || "";
      return `
Ты — деловой аналитик, специализирующийся на рынке ${p.labelRu}.
Возьми исходный текст и тренд «${trendName}» и сделай публикацию-инсайт, которая выглядит как краткое исследование.

ПРАВИЛА:
- Начни с цифры или процента.
- Покажи неочевидную связь между «${trendName}» и болью «${trendTension}».
- Дай один практический вывод, применимый сегодня.
- Заверши провокационным прогнозом («К концу 2026 года компании, которые не...»).

АДАПТАЦИЯ (${p.labelRu}): ${hint}

Формат: один связный текст без списков — как аналитическая публикация в деловой социальной сети.

ИСХОДНЫЙ ТЕКСТ:
"""
${text}
"""

${JSON_TAIL(p.language, p.labelRu)}`.trim();
    }
  },

  community_drop: {
    label: "Community Drop", icon: "🫂", desc: "Пост в закрытое сообщество — без рекламы",
    buildPrompt: (text, market, trendName, trendTension) => {
      const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
      const hint = MARKET_HINTS[market]?.community || "";
      return `
Ты — активный участник профессионального сообщества в ${p.labelRu}. Не продавец. Свой среди своих.
Напиши пост для закрытой группы, замаскированный под органичный обмен опытом.

МЕХАНИКА:
1. Начни с личного наблюдения о тренде «${trendName}» (личный опыт, не новость).
2. Задай открытый вопрос («как вы справляетесь с ${trendTension}?»).
3. Органично упомяни подход из исходного текста как «то, что попробовали мы».
4. Заверши просьбой поделиться опытом. Без призыва к действию и ссылок.

ЖЁСТКИЕ ПРАВИЛА:
- Не используй слова: решение, продукт, сервис, платформа, инструмент.
- Говори: «мы попробовали», «нам помогло», «у нас сработало».
- Не более 150 слов.

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
// Латинские ключи JSON — фронтенд ожидает именно их.
// Промпт сжат до ~1800 токенов — меньше риск обрезки ответа моделью.
function buildEvaluatePrompt(text: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today } = getDateRange();

  return `
Ты — старший аудитор деловой локализации на рынке ${p.labelRu}.
Думай как реальный покупатель из этого рынка. Отвечай строго на русском языке.
Никакого текста до или после JSON. Никакого markdown.
Сегодня: ${today}.

ПРОФИЛЬ ПОКУПАТЕЛЯ:
${p.buyerPsyche}

ЛОГИКА ПОКУПКИ:
${p.decisionLogic}

КУЛЬТУРНЫЙ КОД:
${p.culturalSubtext}

${p.fewShotPass}

${p.fewShotFail}

ЯКОРЯ ДОВЕРИЯ: ${p.localAnchors.join(' | ')}
СИЛЬНЫЕ ФОРМУЛИРОВКИ: ${p.powerPhrases.join(' | ')}
ИДЕАЛЬНЫЙ ТОН: ${p.idealToneProfile}
АВТОРИТЕТНЫЕ ИСТОЧНИКИ: ${p.mediaSources}
ОЖИДАЕМЫЙ ПРИЗЫВ К ДЕЙСТВИЮ: ${p.cta}

ТЕКСТ ДЛЯ ПРОВЕРКИ:
"""
${text}
"""

ПОРЯДОК РАБОТЫ:
1. Прочитай текст глазами покупателя из профиля выше.
2. Найди шаблонные фразы и упущенные якоря доверия.
3. Поставь вердикт: PASS / SUSPICIOUS / FOREIGN.
4. Напиши 3 точечные правки: Заголовок, Призыв к действию, Доверие и доказательства.
5. Верни только JSON без пояснений.

ПРАВИЛА ПОЛЕЙ:
- Все поля — на русском, кроме suggested (английский) и suggested_local (${p.language}).
- Числа тона — целые от -5 до 5.
- genericness_score — целое от 0 до 100.
- PASS — только если текст звучит как написанный местным автором.

Ответь ТОЛЬКО валидным JSON:
{
  "verdict": "PASS" | "SUSPICIOUS" | "FOREIGN",
  "verdict_reason": "Одно предложение на русском — почему этот вердикт",
  "buyer_reaction": "Два-три предложения на русском от лица реального покупателя",
  "genericness_score": 0,
  "generic_phrases": ["точная фраза из текста"],
  "missed_anchors": ["упущенный якорь доверия"],
  "tone_map": {
    "formal_casual": 0,
    "bold_cautious": 0,
    "technical_benefit": 0,
    "abstract_concrete": 0,
    "global_native": 0
  },
  "tone_gap": "Одно предложение на русском — разрыв между текущим и идеальным тоном",
  "missing_trust_signals": ["чего не хватает"],
  "trend_context": "Одно предложение на русском о текущем контексте рынка",
  "rewrites": [
    {
      "block": "Заголовок",
      "original": "точный фрагмент из исходного текста",
      "problem": "Конкретная проблема для ${p.labelRu} на русском",
      "suggested": "Rewrite in English with local anchors",
      "suggested_local": "Rewrite in ${p.language} with power phrases",
      "reason": "Почему новый вариант работает лучше — на русском"
    },
    {
      "block": "Призыв к действию",
      "original": "точный фрагмент из исходного текста",
      "problem": "Конкретная проблема для ${p.labelRu} на русском",
      "suggested": "Rewrite CTA in English",
      "suggested_local": "Rewrite CTA in ${p.language}",
      "reason": "Почему новый вариант работает лучше — на русском"
    },
    {
      "block": "Доверие и доказательства",
      "original": "точный фрагмент из исходного текста",
      "problem": "Конкретная проблема для ${p.labelRu} на русском",
      "suggested": "Rewrite in English with trust signals",
      "suggested_local": "Rewrite in ${p.language} with trust signals",
      "reason": "Почему новый вариант убеждает лучше — на русском"
    }
  ],
  "brief_text": "Полная переработанная версия на английском, нативная для ${p.labelRu}. Только обычный текст.",
  "brief_local": "Полная переработанная версия на ${p.language}. Только обычный текст."
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

КРИТИЧЕСКИЕ ПРАВИЛА — НАРУШЕНИЕ КАЖДОГО НЕДОПУСТИМО:
1. ВЕСЬ текст — ТОЛЬКО на русском языке. Абсолютно каждое слово в каждом поле JSON.
2. ЗАПРЕЩЕНЫ любые иностранные слова на любом языке. Примеры замен:
   — «Mittelstand» → «немецкий средний бизнес»
   — «Bundesbank» → «Центральный банк Германии»
   — «Digitalisierung» → «цифровизация»
   — «AI» → «ИИ», «startup» → «стартап», «fintech» → «финтех»
   — «giełda» → «биржа», «Receita Federal» → «Налоговая служба Бразилии»
   Допустимые аббревиатуры (только они): ИИ, B2B, B2C, CRM, ERP, API, IT, HR, SaaS, ЕС, GDPR, IPO, GDP, ВВП
3. Только plain text — никакого markdown (никаких * # ** и т.д.).
4. Не упоминай COVID как актуальный фактор.
5. Не пиши общие фразы. Будь конкретным — цифры, компании, события.
6. Все события — не ранее ${ninetyDaysAgo}.
7. Никакого текста до или после JSON.
8. Источники в разделе НОВОСТИ — на иностранных языках. Это нормально. Твои ответы — только на русском.

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


// ── Пост-обработка: замена иностранных терминов на русские эквиваленты ───────
// Второй уровень защиты после промпта — на случай если модель всё же пропустит
const FOREIGN_REPLACEMENTS: [RegExp, string][] = [
  // Немецкие
  [/Mittelstand/gi, "немецкий средний бизнес"],
  [/Bundesbank/gi, "Центральный банк Германии"],
  [/Bundestag/gi, "Бундестаг"],
  [/Digitalisierung/gi, "цифровизация"],
  [/GmbH/g, "ООО"],
  [/AG(?=\s|,|\.)/g, "АО"],
  // Польские
  [/giełda/gi, "биржа"],
  [/PKB/g, "ВВП"],
  // Английские (не аббревиатуры)
  [/startup(s)?/gi, "стартап$1"],
  [/fintech/gi, "финтех"],
  [/edtech/gi, "образовательные технологии"],
  [/healthtech/gi, "медицинские технологии"],
  [/proptech/gi, "технологии недвижимости"],
  [/martech/gi, "маркетинговые технологии"],
  [/cloud/gi, "облачные решения"],
  [/outbound/gi, "исходящие продажи"],
  [/inbound/gi, "входящий маркетинг"],
  [/pipeline/gi, "воронка продаж"],
  [/lead(s)?/gi, "лид$1"],
  [/churn/gi, "отток клиентов"],
  [/ARR/g, "годовая выручка"],
  [/MRR/g, "ежемесячная выручка"],
  [/CAC/g, "стоимость привлечения клиента"],
  [/LTV/g, "жизненная ценность клиента"],
  [/NPS/g, "индекс лояльности"],
  [/ROI/g, "рентабельность инвестиций"],
  [/scaleup/gi, "масштабируемый стартап"],
  [/Deal(s)?/gi, "сделк$1"],
  // Португальские
  [/Receita Federal/gi, "Налоговая служба Бразилии"],
  [/SELIC/g, "ключевая ставка"],
  [/Nota Fiscal/gi, "налоговая накладная"],
];

function sanitizeForRussian(text: string): string {
  let result = text;
  for (const [pattern, replacement] of FOREIGN_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function sanitizeNewsItems(items: any[]): any[] {
  return items.map(item => ({
    ...item,
    headline:        sanitizeForRussian(item.headline       || ""),
    summary:         sanitizeForRussian(item.summary        || ""),
    business_impact: sanitizeForRussian(item.business_impact || ""),
    category:        sanitizeForRussian(item.category       || ""),
  }));
}

// ════════════════════════════════════════════════════════════════════════════
// GET — Дайджест новостей
// ════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'germany';
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today, ninetyDaysAgo } = getDateRange();

  const realNews = await fetchRealNews(market, profile.searchQueries);
  const newsContext = formatNewsForPrompt(realNews);
  const prompt = buildSearchPrompt(profile, newsContext, realNews.length > 0, today, ninetyDaysAgo);

  try {
    const data = await callAI(prompt);
    // Пост-обработка: убираем иностранные слова, которые модель могла пропустить
    if (data?.items && Array.isArray(data.items)) {
      data.items = sanitizeNewsItems(data.items);
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("❌ GET /api/resonance-trends:", error.message);
    return NextResponse.json({
      market: profile.label, generated_at: today,
      items: [{
        headline: "Провайдеры временно недоступны",
        category: "Ошибка",
        summary: "Проверьте API-ключи в настройках Vercel.",
        business_impact: "Попробуйте через минуту.",
        resonance_score: 0
      }]
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
