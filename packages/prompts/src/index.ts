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
  search: `Ты — B2B аналитик. Рынок: {{MARKET}}. Составь 8 актуальных трендов на основе последних событий. 
Используй текущую дату для контекста. Если указан конкретный топик, фокусируйся на нем.
Ответь ТОЛЬКО в JSON: { "items": [{ "headline": "Заголовок на русском", "topic": "Тема", "category": "Категория", "summary": "Суть на русском", "business_impact": "Влияние на бизнес" }] }`,

  evaluate: `Ты — эксперт по локализации для рынка {{MARKET}}. Оцени текст на предмет нативности.
Верни JSON: { "verdict": "PASS|SUSPICIOUS|FOREIGN", "verdict_reason": "Объяснение на русском", "rewrites": [] }`,

  improve_icebreaker: `Перепиши как холодное письмо (Icebreaker) для {{MARKET}} на языке {{LANG}}. Сделай его коротким и бьющим в цель.`,
  improve_thought_leader: `Перепиши как пост эксперта (Thought Leader) для {{MARKET}} на языке {{LANG}}. Добавь глубины и авторитетности.`,
  improve_landing_page: `Перепиши как текст для лендинга для {{MARKET}} на языке {{LANG}}. Фокус на конверсии и выгодах.`,
  improve_follow_up: `Напиши мягкое напоминание (Follow-up) для {{MARKET}} на языке {{LANG}}. Без давления.`,
  improve_social: `Напиши пост для соцсетей для {{MARKET}} на языке {{LANG}}. Живо, с эмодзи, но профессионально.`,
  improve_standard: `Сделай текст нативным для {{MARKET}} на языке {{LANG}}. Убери "переводной" налет.`,
};

export function buildPrompt(key: PromptKey, market: MarketKey, text?: string): string {
  const m = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const template = SYSTEM_PROMPT_TEMPLATES[key] || SYSTEM_PROMPT_TEMPLATES.improve_standard;
  let p = template.replace(/{{MARKET}}/g, m.labelRu).replace(/{{LANG}}/g, m.lang);
  if (text) p += `\n\nТЕКСТ ДЛЯ ОБРАБОТКИ:\n${text}`;
  
  if (key.includes('improve')) {
    p += `\nВАЖНО: Результат верни в JSON: { "improved_local": "текст на ${m.lang}", "tone_achieved": "описание тона на русском", "changes": [{"what": "что изменили", "why": "почему"}] }`;
  }
  return p;
}
