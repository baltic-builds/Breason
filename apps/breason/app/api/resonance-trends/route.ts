import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';

  // Маппинг рынков для промпта
  const marketNames: Record<string, string> = {
    brazil: "Бразилия (Brazil)",
    poland: "Польша (Poland)",
    germany: "Германия (Germany)"
  };

  const targetMarket = marketNames[market] || market;

  const systemPrompt = `
You are a B2B Marketing Strategist who has been working in ${targetMarket} for 12 years. It is 2026. 
You talk to CMOs and sales directors at mid-market companies every week.
Your task: Identify 5 B2B marketing narratives that are generating real traction in ${targetMarket} RIGHT NOW (last 90 days of 2026).

ОБЯЗАТЕЛЬНОЕ УСЛОВИЕ: Весь контент внутри JSON (названия, описания, примечания) должен быть на РУССКОМ ЯЗЫКЕ.

CRITICAL RULES:
Rule 1 — No generic categories. GOOD tells a specific story with a specific actor.
Rule 2 — market_tension is the most important field. It is a conflict between two real forces.
Rule 3 — resonance_score: 90-100 (urgent, last 3-6 months), 60-80 (growing).
Rule 4 — Banned phrases: "digital transformation", "AI solutions", "innovative", "disruption", "synergy", "leverage", "game-changer".
Rule 5 — narrative_hook: one sentence with tension or surprise.

OUTPUT STRICTLY VALID JSON. NO MARKDOWN. NO BACKTICKS.
{
  "market": "${targetMarket}",
  "year": 2026,
  "analyst_note": "Одна фраза о настроении рынка в 2026 году. Специфично, не общими словами.",
  "trends": [
    {
      "trend_name": "Краткое название (до 5 слов)",
      "narrative_hook": "Одно предложение. Содержит конфликт или сюрприз.",
      "market_tension": "Сила А (конкретная) против Силы Б (конкретная). Четкий конфликт.",
      "why_now": "Что конкретно произошло за последние 3 месяца, что сделало тему горячей.",
      "resonance_score": 0
    }
  ]
}
`;

  // Здесь в будущем будет вызов OpenAI/Anthropic/Gemini API
  // Пока возвращаем моковые данные, соответствующие вашему новому промпту:
  
  const mockData = {
    brazil: {
      market: "Бразилия",
      analyst_note: "В 2026 году в Бразилии доверие к 'личности' окончательно победило доверие к 'платформе' после волны ИИ-спама в WhatsApp.",
      trends: [
        {
          trend_name: "WhatsApp-голосовые от CEO",
          narrative_hook: "Ваш отдел закупок больше не открывает презентации, но они прослушают 15-секундное личное сообщение от вашего технического директора.",
          market_tension: "Масштабируемость ИИ-рассылок против физической невозможности подделать личную харизму в аудио.",
          why_now: "В начале 2026 года фильтры Meta начали блокировать 90% текстовых бизнес-рассылок, оставив канал только для 'человеческого' общения.",
          resonance_score: 98
        }
      ]
    },
    poland: {
      market: "Польша",
      analyst_note: "Польский B2B в 2026 году ушел в жесткую прагматику: 'покажи мне интеграцию с локальным банком или не трать мое время'.",
      trends: [
        {
          trend_name: "Локальный суверенитет данных",
          narrative_hook: "Польские компании готовы переплачивать 30%, лишь бы их данные не покидали дата-центры в Варшаве.",
          market_tension: "Экономическая выгода глобальных облаков против паранойи безопасности на фоне кибератак конца 2025 года.",
          why_now: "После серии взломов в октябре 2025-го, наличие лейбла 'Hosted in Poland' стало главным фильтром в тендерах.",
          resonance_score: 92
        }
      ]
    },
    germany: {
      market: "Германия",
      analyst_note: "В Германии 2026 года 'устойчивость' перестала быть маркетинговым лозунгом и стала юридическим блокером для входа в цепочки поставок.",
      trends: [
        {
          trend_name: "Паспорта углеродного следа",
          narrative_hook: "Вы не продадите ни одного станка в Баварии, если не докажете происхождение каждой гайки через блокчейн-реестр выбросов.",
          market_tension: "Традиционная немецкая секретность производства против требований полной прозрачности ESG-регуляторов.",
          why_now: "Вступление в силу закона Lieferkettengesetz 2.0 в январе 2026 года сделало отчетность автоматическим условием оплаты счета.",
          resonance_score: 95
        }
      ]
    }
  };

  return NextResponse.json(mockData[market as keyof typeof mockData] || mockData.brazil);
}
