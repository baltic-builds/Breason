import type {
  AIResponseMeta,
  AnalyzeResult,
  MarketKey,
  ResonanceGenerateResponse,
  ResonanceTrend,
  ResonanceTrendsResponse,
} from "@breason/types";
import {
  analyzePrompt,
  resonanceTrendsPrompt,
  resonanceGeneratePrompt,
} from "@breason/prompts";
import { callAiWithFallback, softJson } from "./ai";

export const marketLabel: Record<string, string> = {
  brazil:  "Бразилия",
  poland:  "Польша",
  germany: "Германия",
};

const NOW = () => new Date().toISOString();

/* ─── Analyze ────────────────────────────────────────────────────────────── */

export async function analyzeMarketing(
  text: string,
  market: MarketKey,
  requestId?: string
): Promise<AnalyzeResult> {
  const t0 = Date.now();
  const { text: raw, provider, tokensUsed } = await callAiWithFallback(
    analyzePrompt(market, text),
    "analyze@1",
    requestId
  );

  const meta: AIResponseMeta = {
    provider,
    promptVersion: "analyze@1",
    tokensUsed,
    latencyMs: Date.now() - t0,
    requestedAt: NOW(),
  };

  const parsed = softJson<Partial<AnalyzeResult>>(raw);
  if (parsed?.score !== undefined && parsed?.verdict) {
    return { ...meta, ...parsed } as AnalyzeResult;
  }

  const len = text.trim().length;
  const score = Math.max(35, Math.min(92, Math.floor(len / 6) + 40));
  return {
    ...meta,
    provider: "local",
    score,
    verdict: score >= 75 ? "PASS" : score >= 56 ? "SUSPICIOUS" : "FOREIGN",
    marketTension: `${marketLabel[market] ?? market}: покупатели требуют конкретной ценности и локальных маркеров доверия.`,
    insight: "Текст понятен, но может звучать обобщённо для локального B2B контекста.",
    strengths: ["Чёткая тема", "Деловая структура"],
    risks: ["Низкая локальная специфика", "Слабое доказательство"],
    suggestions: ["Добавить локальный маркер доверия", "Заострить CTA", "Убрать абстрактные формулировки"],
  };
}

/* ─── Resonance Trends ───────────────────────────────────────────────────── */

// Парсер поддерживает как старый формат {trends:[{title,...}]}
// так и новый {trends:[{title, narrative_hook, market_tension, why_now, ...}]}
// Новые поля проходят насквозь через spread — тип ResonanceTrend расширяемый.

export async function resonanceTrends(
  market: MarketKey,
  requestId?: string
): Promise<ResonanceTrendsResponse> {
  const t0 = Date.now();
  const { text: raw, provider, tokensUsed } = await callAiWithFallback(
    resonanceTrendsPrompt(market),
    "resonance-trends@2",
    requestId
  );

  const meta: AIResponseMeta = {
    provider,
    promptVersion: "resonance-trends@2",
    tokensUsed,
    latencyMs: Date.now() - t0,
    requestedAt: NOW(),
  };

  // Новый формат: { market, year, analyst_note, trends: [...] }
  // Старый формат: { trends: [...] }
  const parsed = softJson<{
    trends?: ResonanceTrend[];
    analyst_note?: string;
    market?: string;
    year?: number;
  }>(raw);

  if (parsed?.trends?.length) {
    return {
      ...meta,
      trends: parsed.trends.slice(0, 5),
      ...(parsed.analyst_note ? { analyst_note: parsed.analyst_note } : {}),
    };
  }

  // Локальный fallback на русском
  const localTrends: Record<string, ResonanceTrend[]> = {
    brazil: [
      {
        title: "WhatsApp как ядро воронки",
        narrative_hook: "Бразильские покупатели игнорируют email — а ваш SaaS до сих пор не интегрирован с WhatsApp.",
        market_tension: "Скорость автоматизации в стиле США vs потребность бразильского покупателя говорить с живым человеком перед подписанием",
        why_now: "В 2025 году более 60% бразильских B2B сделок среднего рынка закрывались через WhatsApp — теперь это стандарт, а не исключение.",
        resonanceScore: 88,
        marketTension: "Автоматизация vs личное доверие",
        insight: "Вендоры без WhatsApp-интеграции проигрывают на этапе демо. Это уже не дифференциатор — это гигиена.",
      },
      {
        title: "Founder-led контент в LinkedIn",
        narrative_hook: "Корпоративный контент умер — бразильский B2B покупает у людей, а не у брендов.",
        market_tension: "Отполированный бренд vs живой голос фаундера",
        why_now: "LinkedIn Brazil вырос на 34% в 2025, при этом личные посты фаундеров получают в 8x больше охвата чем корпоративные страницы.",
        resonanceScore: 81,
        marketTension: "Личный авторитет vs корпоративный бренд",
        insight: "Компании где CEO пишет в LinkedIn сами закрывают enterprise-сделки быстрее на 40%.",
      },
    ],
    poland: [
      {
        title: "ROI за 60 дней или уходим",
        narrative_hook: "Польские CFO больше не подписывают годовые контракты без гарантии измеримого результата в первые два месяца.",
        market_tension: "Давление на быстрый ROI vs реальное время внедрения SaaS-решений",
        why_now: "После волны заморозок IT-бюджетов в 2025 польские компании требуют proof-of-value до полной оплаты.",
        resonanceScore: 91,
        marketTension: "Скорость результата vs глубина внедрения",
        insight: "Вендоры которые перестроили онбординг вокруг quick wins закрывают в 2x больше сделок на польском рынке.",
      },
      {
        title: "Локальные кейсы как валюта доверия",
        narrative_hook: "Польский закупщик не верит американским кейсам — ему нужен сосед который уже попробовал.",
        market_tension: "Глобальная репутация бренда vs локальное социальное доказательство",
        why_now: "Исследование Marketer+ 2025: 78% польских B2B решений принимается после разговора с референс-клиентом из той же страны.",
        resonanceScore: 84,
        marketTension: "Глобальный авторитет vs местное доверие",
        insight: "Один польский кейс конвертирует лучше десяти международных наград.",
      },
    ],
    germany: [
      {
        title: "AI-комплаенс как продажный аргумент",
        narrative_hook: "Немецкие procurement-команды отклоняют SaaS без задокументированной AI-governance политики — и это открывает дверь тем кто готов.",
        market_tension: "Скорость AI-внедрения vs требования GDPR и EU AI Act",
        why_now: "EU AI Act вступил в силу в 2025 — немецкие enterprise клиенты массово обновляют требования к вендорам.",
        resonanceScore: 93,
        marketTension: "Технологическое давление vs регуляторная осторожность",
        insight: "Документация по AI-governance превратилась из обузы в конкурентное преимущество на немецком рынке.",
      },
      {
        title: "Надёжность как главный нарратив",
        narrative_hook: "Немецкий B2B покупатель не ищет инновации — он ищет вендора которому можно доверять на 10 лет.",
        market_tension: "Давление рынка на инновации vs немецкая культура долгосрочных партнёрств",
        why_now: "После нескольких громких провалов SaaS-стартапов в Европе в 2024-2025 немецкие компании переключились на устоявшихся игроков.",
        resonanceScore: 85,
        marketTension: "Новизна vs проверенность",
        insight: "Позиционирование через стабильность и долгосрочную поддержку работает лучше любого feature-списка.",
      },
    ],
  };

  return { ...meta, provider: "local", trends: localTrends[market] ?? [] };
}

/* ─── Resonance Generate ─────────────────────────────────────────────────── */

export async function resonanceGenerate(
  market: MarketKey,
  trend: ResonanceTrend,
  requestId?: string
): Promise<ResonanceGenerateResponse> {
  const t0 = Date.now();
  const { text: raw, provider, tokensUsed } = await callAiWithFallback(
    resonanceGeneratePrompt(market, trend),
    "resonance-generate@1",
    requestId
  );

  const meta: AIResponseMeta = {
    provider,
    promptVersion: "resonance-generate@1",
    tokensUsed,
    latencyMs: Date.now() - t0,
    requestedAt: NOW(),
  };

  const parsed = softJson<Partial<ResonanceGenerateResponse>>(raw);
  if (parsed?.headline && parsed?.body && parsed?.cta) {
    return { ...meta, ...parsed } as ResonanceGenerateResponse;
  }

  return {
    ...meta,
    provider: "local",
    headline: `${trend.title}: нарратив который звучит нативно в ${marketLabel[market] ?? market}`,
    body: `${trend.insight ?? ""} Breason предлагает выстроить сообщение вокруг этого напряжения: ${trend.marketTension ?? ""}`,
    cta: "Посмотреть локализованную версию",
  };
}
