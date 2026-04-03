export type ResonanceTrend = {
  /** Название/ключевая фраза тренда */
  title: string;

  /** Рынок/страна (например, BR) */
  market?: string;

  /** Язык тренда (например, pt-BR, es) */
  language?: string;

  /** Источник (tavily/google/etc), если нужно */
  source?: string;

  /** Насколько это релевантно запросу/аудитории (0..1 или 0..100 — на ваше усмотрение) */
  relevanceScore?: number;

  /** Доп. пояснение/контекст */
  description?: string;

  /** Любые метрики, если они есть */
  metrics?: Record<string, number | string>;
};
