# Breason Monorepo

Premium Grok × Bitrix24 styled workspace for **Evaluate**, **Resonance**, and **ReDuck** flows.

## What is included

- `apps/breason` — Evaluate (`/`) and Resonance (`/resonance`) — Next.js, port 3000
- `apps/reduck` — ReDuck rewrite workspace — Vite + React + MUI + Vercel Serverless Functions, port 3001
- `packages/shared` — prompts + AI fallback chain
- `packages/types` — shared TS contracts
- `packages/ui` — minimal shared primitives

## Local development

### Quick start (all apps in parallel)
```bash
npm install
npm run dev
```

- Breason: http://localhost:3000
- ReDuck frontend: http://localhost:3001
- ReDuck API (vercel dev): http://localhost:3002

### Individual apps
```bash
npm run dev:breason        # breason only
npm run dev:reduck         # reduck vite + vercel dev together
npm run dev:reduck:vite    # reduck frontend only
npm run dev:reduck:api     # reduck vercel functions only
```

## Environment variables

Copy `.env.example` → `.env.local` at root (breason reads it).
Copy `apps/reduck/.env.local` and fill keys (vercel dev reads it from there).

| Variable | Used by | Notes |
|---|---|---|
| `GEMINI_API_KEY` | breason + reduck | Free at aistudio.google.com |
| `OPENROUTER_API_KEY` | breason + reduck | Optional fallback |
| `GROQ_API_KEY` | breason + reduck | Optional fallback |
| `TAVILY_API_KEY` | breason resonance | Optional |
| `OPENAI_API_KEY` | reduck only | Optional |
| `ANTHROPIC_API_KEY` | reduck only | Optional |
| `NEXT_PUBLIC_REDUCK_URL` | breason → reduck link | Default: `http://localhost:3001` |

## ReDuck review modes

| Mode | Description |
|---|---|
| 🧲 Lead Magnet Review | Brazilian PT-BR editorial cleanup |
| 📰 Articles Review | Journalistic style (Folha de S.Paulo) |
| 🏆 Editorial Consultant & Scorer | 10-point scorecard + HBR-style critique |
| 🌎 Localization PT-BR | Bitrix24 SaaS marketing localization |

## ReDuck AI providers

ReDuck auto-shows only providers with configured keys:
Gemini · Groq · OpenRouter · OpenAI · Anthropic. Falls back to Demo mode if none set.

## Build & checks

```bash
npm run type-check
npm run build
```

## Extending ReDuck

**Add a review mode:** append to `PROMPTS` in `apps/reduck/src/App.tsx`.

**Add an AI provider:**
1. `apps/reduck/api/models.ts` — add to `ALL_PROVIDERS` + `ENV_KEYS`
2. `apps/reduck/api/process.ts` — add dispatch branch
3. `apps/reduck/api/_providers.ts` — add API helper if format differs
