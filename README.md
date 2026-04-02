# Breason

**AI-powered marketing resonance & evaluation platform**

**Resonance → Evaluate → ReDuck**

Помогает маркетологам быстро оценивать тексты на соответствие рынку и улучшать их с помощью ReDuck.

## Стек

- Turborepo + Next.js 15 App Router
- ReDuck встроен как `/reduck` (native page)
- Мульти-провайдеры AI + fallback + retry + circuit breaker
- Streaming ответов (SSE + EventSource)
- Версионированные промпты + A/B-тестирование
- Rate limiting

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev:breason
Открывай http://localhost:3000/reduck
Структура

apps/breason/ — основное приложение
packages/prompts/ — все промпты с версиями
packages/shared/ — ai-утилиты, logger, domain
packages/types/ — общие типы
