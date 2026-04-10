import { MarketKey, PromptKey } from "@breason/types";

export const MARKET_PROFILES: Record<MarketKey, { labelRu: string; flag: string; lang: string; tone: string; queries: string[] }> = {
  germany: {
    labelRu: "Германия", flag: "🇩🇪", lang: "German",
    tone: "Формальный, точный, процессный, без пустых обещаний",
    queries: ["B2B Software Trends Germany 2025", "Mittelstand digitalization news"]
  },
  poland: {
    labelRu: "Польша", flag: "🇵🇱", lang: "Polish",
    tone: "Прагматичный, прямой, ориентированный на ROI и конкретику",
    queries: ["B2B trends Poland 2025", "Polish SaaS market news"]
  },
  brazil: {
    labelRu: "Бразилия", flag: "🇧🇷", lang: "Portuguese",
    tone: "Теплый, человекоцентричный, акцент на долгосрочных отношениях",
    queries: ["B2B trends Brazil 2025", "LatAm digital transformation"]
  }
};

export const SYSTEM_PROMPT_TEMPLATES: Record<PromptKey, string> = {
  search: `Ты — B2B аналитик. Рынок: {{MARKET}}. Составь 8 актуальных трендов.
Ответь ТОЛЬКО в JSON: { "items": [{ "headline": "", "topic": "", "summary": "", "business_impact": "" }] }`,

  evaluate: `Ты — эксперт по локализации для рынка {{MARKET}}. Оцени текст. 
Верни JSON: { "verdict": "PASS|SUSPICIOUS|FOREIGN", "verdict_reason": "на русском", "rewrites": [{"block":"", "original":"", "suggested":"", "suggested_local":"", "reason":""}] }
ТЕКСТ: {{TEXT}}`,

  improve_icebreaker: `Перепиши как холодное письмо (Icebreaker) для {{MARKET}} на языке {{LANG}}.`,
  improve_thought_leader: `Перепиши как экспертный пост (Thought Leader) для {{MARKET}} на языке {{LANG}}.`,
  improve_landing_page: `Перепиши как продающий текст для лендинга для {{MARKET}} на языке {{LANG}}.`,
  improve_follow_up: `Напиши мягкое напоминание (Follow-up) для {{MARKET}} на языке {{LANG}}.`,
  improve_social: `Напиши вовлекающий пост для соцсетей для {{MARKET}} на языке {{LANG}}. Используй эмодзи.`,
  improve_standard: `Сделай текст нативным для {{MARKET}} на языке {{LANG}}.`,
};

export function buildPrompt(key: PromptKey, market: MarketKey, text?: string): string {
  const m = MARKET_PROFILES[market];
  const template = SYSTEM_PROMPT_TEMPLATES[key] || SYSTEM_PROMPT_TEMPLATES.improve_standard;
  let p = template.replace(/{{MARKET}}/g, m.labelRu).replace(/{{LANG}}/g, m.lang);
  if (text) p += `\n\nТЕКСТ ДЛЯ ОБРАБОТКИ:\n${text}`;
  
  // Для улучшения добавляем требование к JSON-ответу, если это не чистый текст
  if (key.startsWith('improve')) {
    p += `\nВерни JSON: { "improved_local": "текст на ${m.lang}", "tone_achieved": "описание тона на русском", "changes": [{"what": "", "why": ""}] }`;
  }
  return p;
}
