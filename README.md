# Breason

**AI-powered marketing resonance & evaluation platform**

> Искать → Проверять → Улучшать

Помогает маркетологам, копирайтерам и агентствам быстро оценивать и улучшать маркетинговый текст под конкретную аудиторию и рынок. Фокус — рынки Латинской Америки (Бразилия и др.).

---

## Workflow

| Шаг | Название | Что делает |
|-----|----------|------------|
| 1 | **Искать** | Поиск живых B2B-трендов по рынку (Resonance) |
| 2 | **Проверять** | Глубокий анализ текста — соответствие рынку, tone of voice, слабые места |
| 3 | **Улучшать** | AI-рефайн текста с учётом рынка и промпт-стратегии (ReDuck) |

---

## Стек

- **Monorepo**: Turborepo
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **AI**: Мульти-провайдер с умным fallback и circuit breaker
  - Gemini 2.5 Flash (основной)
  - Groq, OpenRouter, OpenAI, Anthropic
- **Streaming**: SSE + ReadableStream
- **Rate limiting**: Middleware (in-memory sliding window)
- **Стили**: CSS-in-JS (inline `<style>` тег), Syne + DM Sans

---

## Структура

```
Breason/
├── apps/
│   └── breason/               # Next.js приложение
│       ├── app/
│       │   ├── api/
│       │   │   ├── analyze/           # POST — анализ текста
│       │   │   ├── reduck/process/    # POST — SSE стриминг улучшения
│       │   │   ├── resonance-trends/  # GET  — тренды рынка
│       │   │   ├── resonance-generate/# POST — генерация контента
│       │   │   └── flags/             # GET  — feature flags
│       │   ├── page.tsx           # Единое SPA (все 3 шага)
│       │   ├── layout.tsx
│       │   ├── error.tsx
│       │   └── loading.tsx
│       ├── data/
│       │   └── feature-flags.json
│       ├── lib/
│       │   └── flags.ts
│       └── middleware.ts          # Rate limiting
│
├── packages/
│   ├── prompts/    # Все промпты с версионированием
│   ├── shared/     # AI-слой (fallback, retry, circuit breaker, logger)
│   ├── types/      # Общие TypeScript-типы
│   └── ui/         # UI-компоненты (базовые)
│
├── package.json    # name: "breason-monorepo"
├── turbo.json
└── .env.example
```

---

## Быстрый старт

```bash
# 1. Клонировать
git clone https://github.com/baltic-builds/Breason.git
cd Breason

# 2. Установить зависимости
npm install

# 3. Настроить переменные окружения
cp .env.example .env.local
# Открыть .env.local и заполнить ключи

# 4. Запустить dev-сервер
npm run dev:breason
# → http://localhost:3000
```

---

## Environment Variables

```env
# Минимум — хотя бы один из AI-провайдеров
GEMINI_API_KEY=           # Основной провайдер (рекомендуется)
GROQ_API_KEY=             # Fallback #2
OPENROUTER_API_KEY=       # Fallback #3
OPENAI_API_KEY=           # Опционально
ANTHROPIC_API_KEY=        # Опционально

# Для шага "Искать" (Resonance)
TAVILY_API_KEY=           # Опционально — без него работает AI-fallback

# URL приложения
NEXT_PUBLIC_APP_URL=https://breason.vercel.app
```

---

## Деплой на Vercel

| Настройка | Значение |
|-----------|----------|
| Root Directory | `.` |
| Build Command | `npx turbo run build --filter=breason` |
| Output Directory | `apps/breason/.next` |
| Install Command | `npm install` |

**Важно:** Root Directory должен быть `.` (корень монорепо), не `apps/breason`.

---

## package.json — важные имена

| Файл | `name` |
|------|--------|
| `/package.json` (корень) | `breason-monorepo` |
| `/apps/breason/package.json` | `breason` |

Turbo фильтрует по имени пакета: `--filter=breason` находит `apps/breason`.

---

## Статус: MVP ✅

- [x] Единое SPA — три шага в одном роуте
- [x] AI с fallback (Gemini → Groq → OpenRouter)
- [x] SSE стриминг в шаге "Улучшать"
- [x] Rate limiting
- [x] Единая дизайн-система (тёмная тема, Syne + DM Sans)
- [x] Билд проходит на Vercel
- [x] Error и Loading страницы в едином стиле

### Следующие шаги (после MVP)
- [ ] Авторизация пользователей
- [ ] История анализов
- [ ] Больше рынков (Мексика, Аргентина, Колумбия)
- [ ] Экспорт результатов в PDF
- [ ] A/B тестирование промптов с метриками
