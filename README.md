<div align="center">

<img src="https://img.shields.io/badge/Breason-v2.0-84CC16?style=for-the-badge&labelColor=0D1117" alt="Breason v2.0" />

# Breason

**Культурная локализация B2B-маркетинга на базе ИИ**

Не перевод — резонанс.

[🚀 Попробовать](https://breason.vercel.app) · [📋 Документация](#how-it-works) · [🐛 Сообщить о баге](https://github.com/baltic-builds/Breason/issues)

<br />

![Breason Screenshot](https://via.placeholder.com/900x500/0D1117/F97316?text=Breason+—+Cultural+Marketing+Intelligence)

</div>

---

## Что это

Breason — SaaS-инструмент для международных B2B-команд, которые хотят, чтобы их контент звучал по-настоящему локально, а не как машинный перевод.

**Три шага за 60 секунд:**

1. **Тренды** — получите живой дайджест B2B-новостей выбранного рынка из реальных источников (включая YouTube и X)
2. **Аудит** — вставьте любой текст и узнайте, насколько нативно он звучит для местного покупателя: вердикт, карта тона, индекс клише
3. **Улучшение** — переработайте текст в один из 7 форматов под культурный профиль рынка

---

## Поддерживаемые рынки

| Рынок | Язык | Специфика |
|-------|------|-----------|
| 🇩🇪 Германия (DACH) | Немецкий | Строгость, соответствие GDPR, без хайпа |
| 🇵🇱 Польша | Польский | Конкретность, ROI, прозрачное ценообразование |
| 🇧🇷 Бразилия | Португальский | Отношения, тепло, поддержка через мессенджер |
| 🌎 LATAM | Испанский | Рост, личный контакт, локальные референсы |
| 🌐 COM | Английский | Данные, прямолинейность, быстрый time-to-value |

---

## Форматы контента

| Пресет | Назначение |
|--------|-----------|
| 🕳️ Пост без перехода | Zero-click контент — вся ценность внутри поста |
| 📱 «На бегу» | Живой Anti-AI текст, похожий на человеческий |
| 🔥 Провокационное мнение | Острая позиция, которую хочется оспорить |
| 🧵 Виральный тред | 5 постов — один виральный нарратив |
| ♻️ Реанимация лидов | Возобновляем диалог с холодной базой |
| 📊 История с данными | Цифры + инсайт = доверие и охват |
| 🫂 Пост в комьюнити | Нативно в закрытые профессиональные группы |

---

## Стек

```
apps/
  breason/                   — Next.js 14 (App Router)
    app/
      page.tsx               — Единый SPA-интерфейс (React, CSS-in-JS)
      api/
        resonance-trends/    — Основной API: поиск трендов, аудит, улучшение
        fetch-url/           — Парсинг URL через Jina AI
packages/
  types/                     — Общие TypeScript-типы
  shared/                    — Circuit breaker, AI fallback chain
```

### Технологии

| Категория | Технология |
|-----------|-----------|
| **Фреймворк** | [Next.js 14](https://nextjs.org) + App Router |
| **Монорепо** | [Turborepo](https://turbo.build) |
| **Язык** | TypeScript (strict) |
| **Стили** | CSS-in-JS (inline `<style>` тег) |
| **Деплой** | [Vercel](https://vercel.com) |
| **ИИ (основной)** | [Google Gemini Flash](https://deepmind.google/technologies/gemini/) — авто-выбор лучшей модели |
| **ИИ (fallback 1)** | [Groq](https://groq.com) — Llama 3.3 70B |
| **ИИ (fallback 2)** | [OpenRouter](https://openrouter.ai) — Gemini Flash Lite |
| **Поиск новостей** | [Serper API](https://serper.dev) — Google News + YouTube + X |
| **Парсинг URL** | [Jina AI Reader](https://jina.ai) |

---

## Быстрый старт

### Требования

- Node.js 18+
- npm 9+

### Установка

```bash
git clone https://github.com/baltic-builds/Breason.git
cd Breason
npm install
```

### Переменные окружения

Создайте `.env.local` в `apps/breason/`:

```env
# Обязательно
GEMINI_API_KEY=your_gemini_api_key

# Опционально (fallback-провайдеры — рекомендуется)
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Опционально (для реальных новостей из Google/YouTube/X)
SERPER_API_KEY=your_serper_api_key

# Опционально (для парсинга URL)
JINA_API_KEY=your_jina_api_key

# Опционально (переопределить авто-выбор модели)
GEMINI_MODEL=gemini-2.0-flash-lite
```

### Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

---

## Архитектура AI

Breason использует каскадный fallback между тремя провайдерами:

```
Запрос
   │
   ▼
Gemini Flash (авто-выбор лучшей модели через ListModels API)
   │ ошибка / таймаут 20с
   ▼
Groq — Llama 3.3 70B Versatile
   │ ошибка
   ▼
OpenRouter — Gemini Flash Lite (free tier)
   │ ошибка
   ▼
503 с информативным сообщением
```

Модель Gemini выбирается динамически при каждом cold start через `ListModels API` — приложение всегда использует актуальную flash-модель без обновления кода.

---

## Источники новостей

При поиске трендов Breason собирает данные из трёх источников параллельно:

1. **Google News** — деловые новости за последнюю неделю (fallback: месяц)
2. **YouTube** — актуальные деловые видео и дискуссии по теме
3. **X (Twitter)** — live-обсуждения в профессиональных кругах

Все заголовки из внешних источников нормализуются через двухуровневую защиту:
- Промпт с явными правилами и примерами транслитерации
- Серверный sanitizer с таблицей замен (немецкий / польский / португальский → русский)

---

## Деплой на Vercel

```bash
npm i -g vercel
vercel --prod
```

Добавьте переменные окружения в Vercel Dashboard → Settings → Environment Variables.

Рекомендуемые настройки:
- **Region:** `fra1` (Frankfurt) — ближе к целевым рынкам EU
- **Function timeout:** 60s (для AI-запросов)

---

## Структура промптов

Все промпты хранятся в одном файле:

```
apps/breason/app/api/resonance-trends/route.ts
```

| Объект | Назначение |
|--------|-----------|
| `MARKET_PROFILES` | Культурные профили рынков: тон, сигналы доверия, красные флаги, психология покупателя |
| `MARKET_HINTS` | Культурные подсказки для каждого пресета по каждому рынку |
| `IMPROVE_PRESETS` | 7 пресетов формата улучшения контента |
| `buildEvaluatePrompt()` | Промпт культурного аудита |
| `buildSearchPrompt()` | Промпт поиска и анализа трендов |

---

## Лицензия

MIT © [Baltic Builds](https://github.com/baltic-builds)

---

<div align="center">

Сделано с ❤️ для международных B2B-команд

**[breason.vercel.app](https://breason.vercel.app)**

</div>
