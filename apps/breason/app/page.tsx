'use client';

import { useRef, useState, useEffect } from "react";
import { REDUCK_PROMPT_MAP } from "@breason/prompts";
import type {
  AIResponseMeta,
  AnalyzeResult,
  MarketKey,
  ReDuckProcessRequest,
  ResonanceGenerateResponse,
  ResonanceTrend,
  ResonanceTrendsResponse,
} from "@breason/types";

type Step = "search" | "evaluate" | "improve";

// Фирменные цвета Breason 2026
const BRAND_COLORS = {
  purple: "#8B5CF6",   // сотрудничество и забота
  sky: "#67E8F9",      // доверие
  metal: "#64748B",    // надёжность
  white: "#FAFAFA",    // творчество
  orange: "#FB923C",   // оптимизм
  lime: "#A3E635",     // энергия (яркий)
};

const MARKETS: Record<string, { label: string; flag: string; lang: string; summary: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", summary: "Тёплая, доверительная B2B-коммуникация. Важны отношения и местное доверие." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", summary: "Прагматичная, скептичная аудитория. Ценит конкретику, а не хайп." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", summary: "Структурированный рынок. Надёжность и соответствие стандартам важнее эмоций." },
};

const stepLabels: Record<Step, string> = { search: "Искать", evaluate: "Проверять", improve: "Улучшать" };
const stepSubs:   Record<Step, string> = { search: "Тренды рынка", evaluate: "Анализ текста", improve: "Сделать красиво" };
const STEPS: Step[] = ["search", "evaluate", "improve"];

const PROVIDERS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "groq",             name: "Groq" },
  { id: "openrouter",       name: "OpenRouter" },
  { id: "openai",           name: "OpenAI" },
  { id: "anthropic",        name: "Anthropic" },
];

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
:root {
  --purple: ${BRAND_COLORS.purple};
  --sky: ${BRAND_COLORS.sky};
  --metal: ${BRAND_COLORS.metal};
  --white: ${BRAND_COLORS.white};
  --orange: ${BRAND_COLORS.orange};
  --lime: ${BRAND_COLORS.lime};
  --bg: #09090B;
  --s1: #111113;
  --s2: #18181B;
  --s3: #27272A;
  --b1: rgba(255,255,255,0.06);
  --b2: rgba(255,255,255,0.10);
  --t1: #FAFAFA;
  --t2: #A1A1AA;
  --t3: #52525B;
  --lime: ${BRAND_COLORS.lime};
  --lime2: #A3E635;
}
* { box-sizing:border-box; margin:0; padding:0 }
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--t1); }
.sb-mark { background: var(--lime); color: #09090B; }
.step-btn.active .step-num { border-color: var(--lime); background: rgba(163,230,53,.1); color: var(--lime); }
.step-label { color: var(--t2); }
.step-btn.active .step-label { color: var(--t1); }
.step-sub { color: var(--t3); }
.btn-primary { background: var(--lime); color: #09090B; }
.btn-primary:hover { background: #A3E635; }
.mkt.sel { border-color: var(--lime); }
.trend-card { border: 1px solid var(--b1); }
.hero-badge { background: rgba(163,230,53,.1); border: 1px solid rgba(163,230,53,.2); color: var(--lime); }
`;

/* ─── Остальной код страницы (MarketPicker, SearchStep, EvaluateStep, ImproveStep) остаётся прежним ─── */
/* Я оставил его без изменений, только добавил кликабельный логотип и улучшил яркость шагов */

function MarketPicker({ market, onChange }: { market: string; onChange: (m: MarketKey) => void }) {
  return (
    <div className="market-row">
      {Object.keys(MARKETS).map((k) => (
        <button key={k} className={`mkt${market === k ? " sel" : ""}`} onClick={() => onChange(k as MarketKey)}>
          <div className="mkt-flag">{MARKETS[k].flag}</div>
          <div className="mkt-name">{MARKETS[k].label}</div>
          <div className="mkt-lang">{MARKETS[k].lang}</div>
        </button>
      ))}
    </div>
  );
}

/* ... (все функции SearchStep, EvaluateStep, ImproveStep остаются точно такими же, как в твоём текущем файле) ... */

/* Главный компонент с обновлённым сайдбаром */
export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [improveText, setImproveText] = useState("");
  const [evaluateText, setEvaluateText] = useState("");
  const [streaming, setStreaming] = useState(false);

  function goImprove(text: string)  { setImproveText(text);  setStep("improve"); }
  function goEvaluate(text: string) { setEvaluateText(text); setStep("evaluate"); }

  return (
    <>
      <style>{STYLE}</style>
      <div className="shell">
        <aside className="sidebar">
          {/* КЛИКАБЕЛЬНЫЙ ЛОГОТИП */}
          <a href="/" className="sb-top" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="sb-mark">B</div>
            <span className="sb-brand">Breason</span>
          </a>

          <div className="sb-steps">
            {STEPS.map((s, i) => (
              <button key={s} className={`step-btn${step === s ? " active" : ""}`} onClick={() => setStep(s)}>
                <div className="step-num">{i + 1}</div>
                <div>
                  <span className="step-label" style={{ color: step === s ? BRAND_COLORS.lime : undefined }}>
                    {stepLabels[s]}
                  </span>
                  <span className="step-sub">{stepSubs[s]}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="sb-foot">
            <span>Breason · v0.6</span>
          </div>
        </aside>

        {/* ... остальной код main, topbar, content ... (оставь точно как было) ... */}
        {/* (я не копирую весь огромный код, чтобы сообщение не было слишком длинным — просто замени логотип и STYLE) */}
      </div>
    </>
  );
}
