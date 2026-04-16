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
//   MARKET_PROFILES     — тональность, сигналы доверия, психография по рынкам
//   IMPROVE_PRESETS     — промпты пресетов раздела "Улучшение" (7 форматов)
//   buildEvaluatePrompt — промпт раздела "Проверка" (культурный аудит)
//   buildSearchPrompt   — промпт раздела "Поиск трендов"
// ════════════════════════════════════════════════════════════════════════════

// ── Профили рынков ────────────────────────────────────────────────────────────
// ИЗМЕНЕНИЕ 1 из 2: расширены профили рынков — добавлена психография покупателя,
// логика принятия решений, культурный подтекст и примеры текстов (few-shot).
// Вся инфраструктура ниже НЕ затронута.
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
      "B2B Software Trends Deutschland 2025",
      "Digitalisierung Mittelstand aktuell",
      "SaaS Markt Deutschland neue Entwicklungen",
      "KI Unternehmen Deutschland B2B",
    ],
    tone: "Формальный, точный, ориентированный на процессы, глубоко скептичный к хайпу и размытым обещаниям",
    trust: ["соответствие GDPR/DSGVO", "сертификаты ISO", "хранение данных в ЕС", "прозрачность SLA", "стандарты безопасности"],
    redFlags: ["unlock", "revolutionary", "game-changer", "all-in-one", "seamless", "next-gen"],
    cta: "Мягкий, необязывающий: 'Demo anfragen', 'Unverbindlich beraten lassen'",

    buyerPsyche: `
Типичный покупатель в регионе DACH — это ИТ-директор или уполномоченный представитель в компании среднего бизнеса (50–500 сотрудников).
Он несёт личную ответственность за решение перед советом директоров.
Страх провала важнее желания выиграть: он не купит «лучшее» — он купит «самое безопасное для карьеры».
Решение принимается коллегиально, от трёх до шести месяцев, через тендерный процесс.
К моменту, когда он читает твой текст, он уже изучил четыре конкурентных предложения и видит насквозь все маркетинговые приёмы.
    `.trim(),

    decisionLogic: `
Формула покупки: (Доказанный возврат инвестиций + Нулевой регуляторный риск + Репутация поставщика) превышает стоимость внедрения.
Без конкретных цифр — разговора нет.
Без ответа на вопрос «что произойдёт с нашими данными» — сделки нет.
Без рекомендации от немецкой или австрийской компании — высокое недоверие.
    `.trim(),

    culturalSubtext: `
Немецкий деловой текст говорит о процессе, а не о результате — покупатель сам сделает вывод о выгоде.
«Мы оптимизируем ваши процессы» звучит органично. «Мы трансформируем ваш бизнес» — красный флаг иностранца.
Развёрнутость воспринимается как основательность, если речь идёт о технических деталях.
Маркетинговая лёгкость и дружелюбие читаются как несерьёзность.
    `.trim(),

    fewShotPass: `
ПРИМЕР ТЕКСТА, КОТОРЫЙ ПРОЙДЁТ ПРОВЕРКУ (немецкий покупатель скажет «это написано для нас»):
«Решение сертифицировано по стандарту ISO 27001, все данные хранятся исключительно в немецких центрах обработки данных.
Более 120 компаний среднего бизнеса в регионе DACH используют платформу — среднее время внедрения составляет шесть недель. Запросить демонстрацию без обязательств.»
Почему работает: сертификат → место хранения данных → конкретная цифра по референсам → срок → мягкий призыв к действию.
    `.trim(),

    fewShotFail: `
ПРИМЕР ТЕКСТА, КОТОРЫЙ ПРОВАЛИТСЯ (немецкий покупатель закроет страницу):
«Our revolutionary all-in-one platform seamlessly unlocks your team's potential and game-changes how you do business. Join thousands of happy customers and transform your workflow today!»
Почему провал: слова «revolutionary», «seamlessly», «game-changes» — хайп без данных.
«Thousands of happy customers» — ни одного немецкого референса. «Transform today» — давление и нереалистичность.
    `.trim(),

    localAnchors: [
      "Средний бизнес как профессиональная идентичность (Mittelstand)",
      "Защита данных как ценность, а не функция (Datenschutz)",
      "Качество немецкого или европейского производства",
      "Долгосрочное партнёрство важнее сиюминутной скидки",
      "Соответствие нормативам на первом месте, всё остальное — потом",
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

    idealToneProfile: "официальный тон: −3, смелость: −2, акцент на выгоду: −1, конкретность: +3, локальность: +4",
  },

  poland: {
    label: "Poland", labelRu: "Польша", language: "Польский", searchLang: "pl",
    mediaSources: "Rzeczpospolita, Puls Biznesu, Spider's Web, Business Insider Polska",
    searchQueries: [
      "trendy B2B Polska 2025",
      "rynek SaaS Polska nowe technologie",
      "cyfryzacja firm Polska aktualne",
      "sztuczna inteligencja biznes Polska",
    ],
    tone: "Прямой и опирающийся на факты, ценит конкретные цифры, прозрачное ценообразование и технические детали",
    trust: ["конкретные показатели возврата инвестиций", "прозрачная модель ценообразования", "технические характеристики", "сроки внедрения", "кейсы с реальными цифрами"],
    redFlags: ["хайп без данных", "размытые обещания", "скрытое ценообразование", "абстрактные преимущества"],
    cta: "Прямой и конкретный: 'Umów demo (15 min)', 'Zobacz jak to działa'",

    buyerPsyche: `
Польский покупатель — прагматик с установкой «покажи цифры или не трать моё время».
Это часто операционный директор или финансовый директор в быстрорастущей компании (20–200 сотрудников), которая активно смотрит на западные рынки.
Он привык к тому, что иностранные поставщики его недооценивают или предлагают урезанный продукт.
Поэтому первый вопрос всегда: «А это точно работает для польского рынка? Есть польские клиенты?»
Решения принимаются быстрее, чем в Германии, но с жёстким торгом по цене.
    `.trim(),

    decisionLogic: `
Формула покупки: (Конкретный возврат инвестиций в злотых или процентах + Польские референсы + Прозрачная цена) превышает всё остальное.
Сравнение с конкурентами обязательно — если ты не сделал это сам, он сделает.
Срок окупаемости должен быть явным: «возврат инвестиций за четыре месяца» работает.
Бесплатный пробный период или пилотный проект резко снижают барьер входа.
    `.trim(),

    culturalSubtext: `
Польский рынок — это «новая Германия»: высокая экспертиза, европейские стандарты, но без немецкой бюрократической тяжеловесности.
Текст должен уважать интеллект читателя — никакого разжёвывания очевидного.
Прямолинейность ценится: если ты лучше конкурента — скажи прямо и докажи данными.
Лёгкий скептицизм по отношению к западному хайпу вокруг искусственного интеллекта и цифровой трансформации — нужно приземлять в конкретику: «что это даст нашей компании в злотых».
    `.trim(),

    fewShotPass: `
ПРИМЕР ТЕКСТА, КОТОРЫЙ ПРОЙДЁТ ПРОВЕРКУ (польский покупатель скажет «это серьёзные ребята»):
«Наше решение сократило время отчётности на 60% в таких компаниях, как [польская компания]. Внедрение занимает в среднем три недели. Стоимость от 299 злотых в месяц — без скрытых платежей. Запишитесь на бесплатную демонстрацию (15 минут) и проверьте, подходит ли это для вашей отрасли.»
Почему работает: конкретный процент → польский референс → срок внедрения → прозрачная цена → короткий формат демо.
    `.trim(),

    fewShotFail: `
ПРИМЕР ТЕКСТА, КОТОРЫЙ ПРОВАЛИТСЯ (польский покупатель отправит в спам):
«Transform your business with our cutting-edge AI-powered platform. Join the digital revolution and unlock unlimited growth potential. Trusted by businesses worldwide — schedule a call today!»
Почему провал: нет цифр, нет польских клиентов, нет цены. «Cutting-edge/revolution/unlimited» — хайп без доказательств. «Businesses worldwide» звучит как «не для Польши».
    `.trim(),

    localAnchors: [
      "Конкретные цифры — это проявление уважения",
      "Локализация — не дополнительная опция, а обязательное требование",
      "Быстрый возврат инвестиций",
      "Никаких скрытых платежей — прозрачность как доверие",
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

    idealToneProfile: "официальный тон: −1, смелость: +1, акцент на выгоду: +1, конкретность: +4, локальность: +3",
  },

  brazil: {
    label: "Brazil", labelRu: "Бразилия", language: "Бразильский португальский", searchLang: "br",
    mediaSources: "Exame, Valor Econômico, Startups.com.br, Pequenas Empresas Grandes Negócios",
    searchQueries: [
      "tendências B2B Brasil 2025",
      "mercado SaaS Brasil novidades",
      "tecnologia empresas Brasil atualidades",
      "inteligência artificial negócios Brasil",
    ],
    tone: "Тёплый, человечный, отношения на первом месте, минимум трений, ожидается разговорный португальский",
    trust: ["поддержка на португальском языке", "бразильские кейсы", "контакт через мессенджер", "формат без обязательств", "соответствие бразильскому законодательству о данных"],
    redFlags: ["холодный корпоративный тон", "агрессивные продажи", "поддержка только на английском", "формальная жёсткость"],
    cta: "Человечный и без трений: 'Agende uma demonstração', 'Teste grátis — sem compromisso'",

    buyerPsyche: `
Бразильский покупатель принимает решения через отношения и доверие, а не через документы.
Это часто генеральный директор или коммерческий директор в компании среднего размера (50–500 сотрудников), который сначала оценивает человека, потом продукт.
«Мне понравился этот человек» — реальный аргумент в пользу сделки.
Скорость важна: длинные тендеры — исключение, решения могут приниматься за неделю.
Бюрократия и сложность интеграции — главные страхи. «Работает с бразильской электронной накладной?» — первый технический вопрос.
    `.trim(),

    decisionLogic: `
Формула покупки: (Доверие к команде поставщика + Простота внедрения + Работа с бразильской спецификой) превышает цену.
Цена важна, но отношения важнее — дорогой знакомый выигрывает у дешёвого незнакомца.
Бесплатный пробный период плюс поддержка через мессенджер резко повышают конверсию.
Кейс бразильской компании из той же отрасли — на вес золота.
Соответствие бразильскому закону о персональных данных упоминается, но не является стоп-фактором (в отличие от немецкого регулирования).
    `.trim(),

    culturalSubtext: `
Тёплый тон — это не вежливость, это деловая стратегия в Бразилии.
Текст на официальном португальском воспринимается как холодность и дистанция.
Неформальное обращение «вы» работает лучше в большинстве деловых контекстов.
Обращение к росту, возможностям и совместному успеху — это не клише, а культурный код.
Прямые продажи без установления контакта — серьёзная ошибка.
    `.trim(),

    fewShotPass: `
ПРИМЕР ТЕКСТА, КОТОРЫЙ ПРОЙДЁТ ПРОВЕРКУ (бразильский покупатель ответит «расскажи подробнее!»):
«Привет! Мы знаем, что управлять [процессом] в Бразилии непросто — особенно с учётом постоянных изменений в законодательстве. Именно поэтому мы создали [продукт]: уже помогли более чем 80 бразильским компаниям сократить время на [задачу] на 40%. Всё на португальском, поддержка через мессенджер. Как насчёт короткого разговора на 20 минут? Без каких-либо обязательств.»
Почему работает: приветствие → понимание локальной боли → бразильские кейсы → португальский язык плюс поддержка в мессенджере → лёгкий призыв к действию без давления.
    `.trim(),

    fewShotFail: `
ПРИМЕР ТЕКСТА, КОТОРЫЙ ПРОВАЛИТСЯ (бразильский покупатель не ответит):
«Dear Sir/Madam, I am reaching out to present our enterprise solution that leverages cutting-edge technology to optimize your operational efficiency. Please review the attached proposal and revert at your earliest convenience.»
Почему провал: английский язык → формальное обращение → «enterprise/cutting-edge/revert» — язык иностранца, который не понимает Бразилию. Нет тепла, нет отношений, нет простоты.
    `.trim(),

    localAnchors: [
      "Интеграция с бразильской системой электронных накладных и налоговой службой",
      "Поддержка на португальском языке — обязательное условие",
      "Мессенджер как основной канал деловой коммуникации",
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

    idealToneProfile: "официальный тон: +3, смелость: +1, акцент на выгоду: +2, конкретность: +2, локальность: +4",
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
3. Поля what и why — ТОЛЬКО на русском, без иностранных слов.
4. tone_achieved — одно предложение на русском, без иностранных слов.
5. Только обычный текст — никакого форматирования, звёздочек, решёток.

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
    data_story:   "Ссылайся на немецкие или общеевропейские исследования. Точные цифры, никаких «около» и «примерно».",
    community:    "Профессионально-коллегиальный тон. Обращение к коллективному опыту отрасли.",
  },
  brazil: {
    zero_click:   "Сторителлинг, фокус на партнёрство и преодоление бюрократии.",
    anti_ai:      "Чуть больше эмоций, но всё равно коротко. Например: «привет! видел, что творится из-за [тренд]. мы тут придумали кое-что...»",
    strong_pov:   "Оспаривай медлительность корпораций и устаревший менеджмент.",
    thread:       "Эмоциональная история в зачине. Например: «один наш клиент потерял X из-за [тренд]...»",
    re_engage:    "Тепло, как со старым знакомым.",
    data_story:   "Сравни с ростом или падением местного рынка. Подчеркни возможность, а не угрозу.",
    community:    "Открыто, с юмором, как в переписке со старыми коллегами.",
  },
  poland: {
    zero_click:   "Прагматично, фокус на оптимизацию бюджетов и европейские стандарты.",
    anti_ai:      "Чётко про деньги и время. Например: «привет. [тренд] сейчас сжигает бюджеты. мы собрали решение...»",
    strong_pov:   "Оспаривай раздутые бюджеты и неработающие модные решения.",
    thread:       "Прямой расчёт потерь в злотых или евро в зачине.",
    re_engage:    "По-деловому, уважение ко времени. Сразу ценность, потом вопрос.",
    data_story:   "Сравни с соседними рынками Европейского союза. Фокус на отставание и потенциал.",
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
3. Суть (ценность) — выжимка пользы из исходного текста в виде трёх коротких тезисов.
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
4. Мягкий призыв к действию: не звонок, не демо. («Актуально ли это для вас сейчас?»)

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
// ИЗМЕНЕНИЕ 2 из 2: полный рефакторинг buildEvaluatePrompt.
// Добавлены: психография покупателя, примеры хорошего и плохого текста (few-shot),
// пошаговое мышление (chain-of-thought), идеальный профиль тона, поле buyer_reaction.
// Жёсткое требование: весь вывод строго на русском, без иностранных слов.
function buildEvaluatePrompt(text: string, market: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const { today } = getDateRange();

  return `
Ты — старший аудитор деловой локализации с пятнадцатилетним опытом работы на рынке ${p.labelRu}.
Ты лично провёл сотни переговоров в этой стране и знаешь, как думает местный покупатель изнутри.
Сегодня: ${today}.

ВАЖНО: Весь твой ответ — строго на русском языке. Никаких иностранных слов, терминов и аббревиатур в полях JSON, кроме полей improved_text и improved_local, которые требуют иностранного языка по условию задачи.

<профиль_покупателя>
КТО ЧИТАЕТ ЭТОТ ТЕКСТ И КАК ПРИНИМАЕТ РЕШЕНИЕ:
${p.buyerPsyche}

ЛОГИКА ПРИНЯТИЯ РЕШЕНИЯ О ПОКУПКЕ:
${p.decisionLogic}

КУЛЬТУРНЫЙ ПОДТЕКСТ — ЧТО РАБОТАЕТ И ПОЧЕМУ:
${p.culturalSubtext}
</профиль_покупателя>

<примеры_для_калибровки>
${p.fewShotPass}

${p.fewShotFail}
</примеры_для_калибровки>

<инструментарий_рынка>
КУЛЬТУРНЫЕ ЯКОРЯ — смыслы, которые резонируют с аудиторией:
${p.localAnchors.map((a, i) => `${i + 1}. ${a}`).join('\n')}

СИЛЬНЫЕ МЕСТНЫЕ ФОРМУЛИРОВКИ И ПАТТЕРНЫ:
${p.powerPhrases.join(' | ')}

АВТОРИТЕТНЫЕ ИСТОЧНИКИ РЫНКА:
${p.mediaSources}

ОЖИДАЕМЫЙ ПРИЗЫВ К ДЕЙСТВИЮ:
${p.cta}
</инструментарий_рынка>

<анализируемый_текст>
${text}
</анализируемый_текст>

<процесс_мышления>
ОБЯЗАТЕЛЬНЫЕ ШАГИ ПЕРЕД ФОРМИРОВАНИЕМ ОТВЕТА:

Шаг 1 — Взгляд покупателя:
Прочитай текст глазами реального покупателя из профиля выше.
Где возникает доверие? Где появляется скептицизм? Где хочется закрыть страницу?

Шаг 2 — Языковой аудит:
Найди фразы, которые звучат как дословный перевод с английского или как шаблон американского технологического маркетинга.
Что из культурных якорей и сильных формулировок использовано? Что упущено?

Шаг 3 — Структурный анализ:
Есть ли в тексте конкретные цифры? Местные референсы? Правильный призыв к действию?
Соответствует ли структура тому, как принимаются решения в этой стране?

Шаг 4 — Постановка диагноза:
ПРОШЁЛ — только если текст мог быть написан местным маркетологом без правок.
ПОДОЗРИТЕЛЬНЫЙ — есть проблемы, но текст не отталкивает сразу.
ЧУЖОЙ — текст выдаёт иностранца и снижает доверие.

Шаг 5 — Конкретные улучшения:
Сформулируй точечные правки для трёх ключевых блоков.
Каждая правка должна применять культурные якоря или сильные местные формулировки.
</процесс_мышления>

ШКАЛА ТОНА — значения от −5 до +5:
официальный_разговорный: −5 = как устав компании, +5 = как переписка с другом
смелый_осторожный: −5 = максимально осторожно, +5 = агрессивно смело
технический_выгодный: −5 = только технические детали, +5 = только про выгоду
абстрактный_конкретный: −5 = абстрактные идеи, +5 = конкретные цифры и факты
глобальный_местный: −5 = звучит как глобальный шаблон, +5 = написано местным для местных

ИДЕАЛЬНЫЙ ПРОФИЛЬ ТОНА ДЛЯ ${p.labelRu.toUpperCase()}:
${p.idealToneProfile}

КРИТИЧЕСКИЕ ПРАВИЛА ВЫВОДА — НАРУШЕНИЕ НЕДОПУСТИМО:
1. Все поля JSON — ТОЛЬКО на русском языке (кроме suggested и suggested_local).
2. suggested_local — строго на ${p.language}, не на русском.
3. suggested — строго на английском.
4. Только обычный текст — никакого форматирования, звёздочек, решёток.
5. Все значения тона — строго целые числа от −5 до +5.
6. Оценка шаблонности — строго целое число от 0 до 100.
7. Вердикт «ПРОШЁЛ» ставь только если текст действительно звучит как написанный местным автором.

Ответь ТОЛЬКО валидным JSON без каких-либо пояснений вне JSON:
{
  "вердикт": "ПРОШЁЛ" | "ПОДОЗРИТЕЛЬНЫЙ" | "ЧУЖОЙ",
  "причина_вердикта": "Одно точное предложение на русском — почему именно этот вердикт",
  "реакция_покупателя": "Два-три предложения на русском от лица реального покупателя из профиля — что он подумает, прочитав текст",
  "оценка_шаблонности": <целое число 0–100>,
  "шаблонные_фразы": ["точная фраза из текста", "ещё одна фраза"],
  "упущенные_якоря": ["якорь из культурных якорей, который упущен и мог бы усилить текст"],
  "тон": {
    "официальный_разговорный": <целое число от -5 до 5>,
    "смелый_осторожный": <целое число от -5 до 5>,
    "технический_выгодный": <целое число от -5 до 5>,
    "абстрактный_конкретный": <целое число от -5 до 5>,
    "глобальный_местный": <целое число от -5 до 5>
  },
  "разрыв_тона": "Одно предложение на русском — насколько текущий тон отличается от идеального для ${p.labelRu}",
  "недостающие_сигналы_доверия": ["чего не хватает для доверия — на русском"],
  "контекст_рынка": "Одно предложение на русском о том, какой текущий деловой контекст в ${p.labelRu} делает этот текст актуальным или устаревшим",
  "правки": [
    {
      "блок": "Заголовок",
      "оригинал": "точный фрагмент из исходного текста",
      "проблема": "Конкретная проблема этого блока для ${p.labelRu} — на русском",
      "suggested": "Переписанный блок на английском с применением культурных якорей",
      "suggested_local": "Переписанный блок на ${p.language} с сильными местными формулировками",
      "обоснование": "Почему новый вариант работает лучше для ${p.labelRu} — на русском"
    },
    {
      "блок": "Призыв к действию",
      "оригинал": "точный фрагмент из исходного текста",
      "проблема": "Конкретная проблема этого блока для ${p.labelRu} — на русском",
      "suggested": "Переписанный призыв к действию на английском",
      "suggested_local": "Переписанный призыв к действию на ${p.language}",
      "обоснование": "Почему новый вариант работает лучше для ${p.labelRu} — на русском"
    },
    {
      "блок": "Доверие и доказательства",
      "оригинал": "точный фрагмент из исходного текста",
      "проблема": "Конкретная проблема этого блока для ${p.labelRu} — на русском",
      "suggested": "Переписанный блок на английском с сигналами доверия",
      "suggested_local": "Переписанный блок на ${p.language} с сигналами доверия",
      "обоснование": "Почему новый вариант убеждает лучше для ${p.labelRu} — на русском"
    }
  ],
  "итоговый_текст": "Полная переработанная версия текста на английском, нативная для ${p.labelRu}. Только обычный текст без форматирования.",
  "итоговый_текст_локальный": "Полная переработанная версия на ${p.language}. Только обычный текст без форматирования."
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
