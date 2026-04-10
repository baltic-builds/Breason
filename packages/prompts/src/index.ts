import type { MarketKey, CustomPrompts, PromptKey } from "@breason/types";

export const MARKET_PROFILES: Record<string, {
  label: string; labelRu: string; flag: string; language: string;
  searchQueries: string[];
  tone: string; trust: string[]; redFlags: string[];
}> = {
  germany: {
    label: "Germany", labelRu: "Германия", flag: "🇩🇪", language: "German",
    searchQueries: ["B2B Software Trends Deutschland 2025", "Digitalisierung Mittelstand"],
    tone: "Формальный, точный, ориентированный на процессы, скептичный к хайпу",
    trust: ["GDPR", "ISO", "SLA", "Локальный хостинг"],
    redFlags: ["revolutionary", "game-changer", "seamless"],
  },
  poland: {
    label: "Poland", labelRu: "Польша", flag: "🇵🇱", language: "Polish",
    searchQueries: ["trendy B2B Polska 2025", "SaaS rynek Polska"],
    tone: "Прямой, прагматичный, ценит цифры и прозрачность",
    trust: ["Кейсы", "ROI", "Прозрачные цены"],
    redFlags: ["empty promises", "vague benefits"],
  },
  brazil: {
    label: "Brazil", labelRu: "Бразилия", flag: "🇧🇷", language: "Portuguese",
    searchQueries: ["tendências B2B Brasil 2025"],
    tone: "Теплый, человечный, акцент на отношениях",
    trust: ["Поддержка на португальском", "WhatsApp", "LGPD"],
    redFlags: ["холодный корпоративный тон"],
  },
};

export const SYSTEM_PROMPT_TEMPLATES: Record<PromptKey, string> = {
  search: `Ты — аналитик B2B-рынков. Составь дайджест для рынка {{MARKET}}.
ЗАДАЧА: Сгенерируй 12 B2B-трендов (по 3 на каждую тему: Продажи, Финансы, Ритейл, IT).
{{NEWS_CONTEXT}}
{{CUSTOM_INSTRUCTIONS}}
Ответь ТОЛЬКО JSON: { "items": [{ "headline": "", "topic": "", "summary": "", "business_impact": "" }] }`,

  evaluate: `Ты — аудитор локализации для {{MARKET}}. 
Проанализируй текст на соответствие тону: {{TONE}}.
ТЕКСТ: """{{TEXT}}"""
Ответь ТОЛЬКО JSON с вердиктом и вариантами переписывания (suggested_local на {{LANGUAGE}}).`,

  improve_icebreaker: `Ты — B2B копирайтер в {{MARKET}}. Перепиши это как холодное письмо (Icebreaker). Использовать {{LANGUAGE}}.`,
  improve_thought_leader: `Ты — эксперт в {{MARKET}}. Сделай из этого экспертный пост. Использовать {{LANGUAGE}}.`,
  improve_landing_page: `Ты — маркетолог в {{MARKET}}. Сделай текст для лендинга. Использовать {{LANGUAGE}}.`,
  improve_follow_up: `Ты — менеджер в {{MARKET}}. Напиши мягкое напоминание (Follow-up). Использовать {{LANGUAGE}}.`,
  improve_social: `Ты — SMM-стратег для рынка {{MARKET}}. 
ЗАДАЧА: Преврати этот текст в виральный B2B пост для социальных сетей (LinkedIn/X). 
ИСПОЛЬЗУЙ: Эмодзи (умеренно), хэштеги, вовлекающий вопрос в конце.
ЯЗЫК: {{LANGUAGE}}. 
{{CUSTOM_INSTRUCTIONS}}
ТЕКСТ: """{{TEXT}}"""`,
  improve_standard: `Ты — редактор в {{MARKET}}. Сделай текст нативным на {{LANGUAGE}}.`,
};

export function buildSearchPrompt(market: string, newsContext: string, today: string, ninetyDaysAgo: string, keyword?: string, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  return SYSTEM_PROMPT_TEMPLATES.search
    .replace('{{MARKET}}', p.labelRu)
    .replace('{{NEWS_CONTEXT}}', newsContext)
    .replace('{{CUSTOM_INSTRUCTIONS}}', userPrompt || "");
}

export function buildEvaluatePrompt(text: string, market: string, trend?: string, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  return SYSTEM_PROMPT_TEMPLATES.evaluate
    .replace('{{MARKET}}', p.labelRu)
    .replace('{{TONE}}', p.tone)
    .replace('{{LANGUAGE}}', p.language)
    .replace('{{TEXT}}', text);
}

export function buildImprovePrompt(text: string, market: string, preset: string, trend?: any, userPrompt?: string): string {
  const p = MARKET_PROFILES[market] || MARKET_PROFILES.germany;
  const key = `improve_${preset}` as PromptKey;
  const template = SYSTEM_PROMPT_TEMPLATES[key] || SYSTEM_PROMPT_TEMPLATES.improve_standard;
  return template
    .replace('{{MARKET}}', p.labelRu)
    .replace('{{LANGUAGE}}', p.language)
    .replace('{{TEXT}}', text)
    .replace('{{CUSTOM_INSTRUCTIONS}}', userPrompt || "");
}
