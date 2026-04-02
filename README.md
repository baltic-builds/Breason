# Breason

**AI-powered marketing resonance & evaluation platform**

**Resonance → Evaluate → ReDuck**

Оценивает маркетинговый текст на соответствие рынку, находит резонансные тренды и помогает быстро улучшать копирайтинг через ReDuck.

## Технологии

- **Monorepo**: Turborepo + Next.js 15 (App Router)
- **AI**: Gemini 2.5 Flash (primary) + Groq + OpenRouter + OpenAI + Anthropic + fallback-цепочка
- **Streaming**: SSE + EventSource
- **Rate limiting**: middleware (20 req/min для AI)
- **Промпты**: версионирование + A/B-тестирование (`packages/prompts`)
- **ReDuck**: полностью встроен как `/reduck` внутри Breason (без отдельного приложения)

## Быстрый старт

```bash
git clone https://github.com/baltic-builds/Breason.git
cd Breason
npm install
cp .env.example .env.local
# заполни ключи в .env.local
npm run dev:breason
Открывай: http://localhost:3000
Структура
textapps/breason/          ← основное приложение (Evaluate + Resonance + ReDuck)
packages/
  ├── prompts/         ← все промпты с версиями и A/B
  ├── shared/          ← ai.ts (retry + circuit breaker), logger, domain
  ├── types/           ← общие типы (AIResponseMeta и т.д.)
  └── ui/              ← общие компоненты
Основные страницы

/ — Evaluate (анализ текста)
/resonance — Resonance (тренды + генерация)
/reduck — ReDuck (refine с 5 провайдерами + streaming)

Лицензия
MIT
text### 3. Упоминания `breason-app`

**Найдено только в одном месте:**

- Файл: `package.json` (строка `"dev:breason": "npm run dev --workspace=breason-app"`)
