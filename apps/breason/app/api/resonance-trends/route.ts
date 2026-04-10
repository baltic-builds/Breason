import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  MARKET_PROFILES, 
  TARGET_TOPICS, 
  SYSTEM_PROMPT_TEMPLATES,
  buildSearchPrompt, 
  buildEvaluatePrompt, 
  buildImprovePrompt 
} from "@breason/prompts";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

// ── Утилиты ──────────────────────────────────────────────────────────────────

function parseJson(text: string): any {
  try {
    const clean = text.replace(/```(json)?\n?/g, '').replace(/```\n?/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON found in response");
    return JSON.parse(match[0]);
  } catch (e: any) {
    console.error("❌ JSON Parse Error:", text.slice(0, 300));
    throw new Error(`Invalid JSON: ${e.message}`);
  }
}

function getDateRange(): { today: string; ninetyDaysAgo: string } {
  const now = new Date();
  const ago = new Date();
  ago.setDate(ago.getDate() - 90);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return { today: fmt(now), ninetyDaysAgo: fmt(ago) };
}

// ── Serper API ────────────────────────────────────────────────────────────────

interface SerperNewsItem { title: string; snippet: string; source: string; date?: string; link: string; }

async function fetchRealNews(market: string, queries: string[], keyword?: string): Promise<SerperNewsItem[]> {
  if (!process.env.SERPER_API_KEY) return [];

  const baseQuery = queries.slice(0, 2).join(" OR ");
  const combinedQuery = keyword ? `(${baseQuery}) ${keyword}` : baseQuery;

  try {
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: combinedQuery,
        gl: market === "germany" ? "de" : market === "poland" ? "pl" : "br",
        hl: market === "germany" ? "de" : market === "poland" ? "pl" : "pt",
        num: 15, tbs: "qdr:m3",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Serper ${res.status}`);
    const data = await res.json();
    const news: SerperNewsItem[] = (data.news || []).map((item: any) => ({
      title: item.title || "", snippet: item.snippet || "",
      source: item.source || "", date: item.date || "", link: item.link || "",
    }));
    const seen = new Set<string>();
    return news.filter(item => {
      if (!item.title || seen.has(item.title)) return false;
      seen.add(item.title); return true;
    }).slice(0, 20);
  } catch (e: any) {
    console.warn(`⚠️ Serper failed: ${e.message}`);
    return [];
  }
}

function formatNewsForPrompt(news: SerperNewsItem[]): string {
  if (!news.length) return "Реальные новости недоступны — используй свои знания рынка.";
  return news.map((item, i) =>
    `[${i + 1}] ${item.title}\nИсточник: ${item.source}${item.date ? ` · ${item.date}` : ""}\n${item.snippet}`
  ).join("\n\n");
}

// ── Провайдеры ─────────────────────────────────────────────────────────────

async function groqFallback(prompt: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("No GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAI(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return parseJson(result.response.text());
  } catch (e: any) {
    console.warn(`⚠️ Gemini failed: ${e.message}`);
  }
  try {
    const raw = await groqFallback(prompt);
    return parseJson(raw);
  } catch (e: any) {
    console.warn(`⚠️ Groq failed: ${e.message}`);
    throw new Error("All providers failed.");
  }
}

function normalizeTrends(items: any[]): any[] {
  const grouped: Record<string, any[]> = {};
  TARGET_TOPICS.forEach(t => grouped[t] = []);

  items.forEach(item => {
    let topic = item.topic || "IT и Разработка";
    const matched = TARGET_TOPICS.find(t => t.toLowerCase().includes(topic.toLowerCase().split(' ')[0])) || "IT и Разработка";
    grouped[matched].push(item);
  });

  const finalItems: any[] = [];
  TARGET_TOPICS.forEach(t => {
    const topicItems = grouped[t];
    while (topicItems.length < 3) {
      topicItems.push({
        headline: `Адаптация процессов в секторе ${t.split(' ')[0]}`,
        topic: t, category: "Оптимизация",
        summary: "Индустрия адаптируется к новым экономическим реалиям.",
        business_impact: "Требует пересмотра текущих стратегий."
      });
    }
    finalItems.push(...topicItems.slice(0, 3));
  });
  return finalItems;
}

// ════════════════════════════════════════════════════════════════════════════
// Роуты API
// ════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'prompts') {
    return NextResponse.json({
      prompts: SYSTEM_PROMPT_TEMPLATES,
      promptKeys: Object.keys(SYSTEM_PROMPT_TEMPLATES),
    });
  }

  return handleSearch(searchParams.get('market') || 'germany', searchParams.get('keyword') || '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, market = 'germany', keyword, text, trendContext, preset, customPrompts } = body;

    if (!market || !(market in MARKET_PROFILES)) {
      return NextResponse.json({ error: "Некорректный рынок." }, { status: 400 });
    }

    if (action === "search") {
      return handleSearch(market, keyword, customPrompts?.search);
    }

    if (action === "evaluate") {
      if (!text?.trim()) return NextResponse.json({ error: "Текст не передан." }, { status: 400 });
      const prompt = buildEvaluatePrompt(text, market, trendContext?.headline, customPrompts?.evaluate);
      const data   = await callAI(prompt);
      return NextResponse.json(data);
    }

    if (action === "improve") {
      if (!text?.trim()) return NextResponse.json({ error: "Текст не передан." }, { status: 400 });
      const prompt = buildImprovePrompt(text, market, preset || "standard", trendContext, customPrompts?.improve);
      const data   = await callAI(prompt);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });

  } catch (error: any) {
    console.error("❌ POST Error:", error.message);
    return NextResponse.json(
      { error: "Сервисы генерации временно недоступны.", details: error.message },
      { status: 503 },
    );
  }
}

async function handleSearch(market: string, keyword?: string, userPrompt?: string): Promise<NextResponse> {
  const { today, ninetyDaysAgo } = getDateRange();
  const profile = MARKET_PROFILES[market] || MARKET_PROFILES.germany;

  const realNews    = await fetchRealNews(market, profile.searchQueries, keyword);
  const newsContext = formatNewsForPrompt(realNews);
  const prompt      = buildSearchPrompt(market, newsContext, today, ninetyDaysAgo, keyword, userPrompt);

  try {
    const data            = await callAI(prompt);
    const items           = data?.items ?? (Array.isArray(data) ? data : []);
    const normalizedItems = normalizeTrends(items);

    return NextResponse.json({
      market: profile.label,
      generated_at: today,
      keyword_focus: keyword || "",
      items: normalizedItems,
    });

  } catch (error: any) {
    return NextResponse.json({
      market: profile.label, generated_at: today, keyword_focus: keyword || "",
      items: normalizeTrends([]),
    }, { status: 200 });
  }
}
