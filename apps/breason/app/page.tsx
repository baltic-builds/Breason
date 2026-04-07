"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey    = "germany" | "poland" | "brazil";
type StepKey      = "search" | "evaluate" | "improve";
type VerdictType  = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode    = "text" | "url";
type StyleModifier = "none" | "friendly" | "professional" | "concise";

interface NewsItem      { headline: string; category: string; summary: string; business_impact: string; resonance_score: number; }
interface ToneMap       { formal_casual: number; bold_cautious: number; technical_benefit: number; abstract_concrete: number; global_native: number; }
interface Rewrite       { block: string; original: string; suggested: string; suggested_local: string; reason: string; }
interface EvaluateResult { verdict: VerdictType; verdict_reason: string; genericness_score: number; generic_phrases: string[]; tone_map: ToneMap; missing_trust_signals: string[]; trend_context: string; rewrites: Rewrite[]; brief_text: string; }
interface ImproveResult  { improved_text: string; improved_local: string; changes: { what: string; why: string }[]; tone_achieved: string; }

// ── Константы ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { labelRu: string; flag: string; desc: string }> = {
  germany: { labelRu: "Германия",  flag: "🇩🇪", desc: "Формальный · Точный · Процессный" },
  poland:  { labelRu: "Польша",    flag: "🇵🇱", desc: "Прямой · Фактический · Прозрачный" },
  brazil:  { labelRu: "Бразилия",  flag: "🇧🇷", desc: "Тёплый · Человечный · Доверительный" },
};

const STEPS: Record<StepKey, { num: string; label: string }> = {
  search:   { num: "01", label: "Поиск трендов" },
  evaluate: { num: "02", label: "Оценка контента" },
  improve:  { num: "03", label: "Улучшение (AI)" },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально" },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как перевод" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Чужеродный контент" },
};

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Смотрим рынок...", "Опрашиваем экспертов...", "Звоним инсайдерам...", "Готовим ответ..."],
  evaluate: ["Анализируем культурный код...", "Ищем сигналы доверия...", "Считаем индекс клише...", "Генерируем советы..."],
  improve:  ["Применяем профиль рынка...", "Переписываем текст...", "Полируем нативный тон..."],
};

const FUNNY_QUOTES = [
  "Работайте на скупого, он платит дважды",
  "Встречайтесь со стоматологом. Это выгодно",
  "Не хватает на отпуск? Отдыхайте на работе",
  "Если хотите удвоить деньги, то сложите их пополам",
  "Зарабатывайте больше, и доход вырастет",
  "Если на карте нет денег, то платите наличными",
  "Тратьте деньги с умом: сначала чужие, а только потом – свои",
];

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet: #7C3AED; --violet-d: #6D28D9; --violet-a: rgba(124,58,237,0.1);
  --lime: #84CC16; --lime-a: rgba(132,204,22,0.12); --lime-d: #65A30D;
  --orange: #F97316; --orange-d: #EA6C0A; --orange-a: rgba(249,115,22,0.1);
  --red: #EF4444; --sky-a: rgba(14,165,233,0.08); --sky-b: rgba(14,165,233,0.2);
  --bg: #F1F5F9; --surface: #FFFFFF; --t1: #0F172A; --t2: #475569; --t3: #94A3B8;
  --border: rgba(15,23,42,0.1); --border-xs: rgba(15,23,42,0.05);
  --r: 14px; --r-sm: 10px;
  --sidebar-w: 220px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { height: 100%; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--t1); line-height: 1.5; min-height: 100%; }

/* ── SHELL ── */
.shell { display: flex; min-height: 100vh; }

/* ── SIDEBAR ── */
.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 50;
  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
.logo { display: flex; align-items: center; gap: 9px; font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; color: var(--t1); margin-bottom: 28px; cursor: pointer; transition: opacity 0.2s; text-decoration: none; }
.logo:hover { opacity: 0.8; }
.logo-mark { width: 26px; height: 26px; background: var(--lime); border-radius: 6px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #1a2e05; flex-shrink: 0; }
.nav-btn { display: flex; align-items: center; gap: 9px; padding: 10px; border: none; border-radius: 9px; background: transparent; cursor: pointer; width: 100%; text-align: left; font-family: inherit; transition: 0.15s; margin-bottom: 4px; }
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }
.nav-num { width: 22px; height: 22px; border-radius: 5px; background: var(--bg); font-size: 9px; font-weight: 800; color: var(--t3); display: grid; place-items: center; font-family: 'Syne', sans-serif; flex-shrink: 0; }
.nav-btn.active .nav-num { background: var(--violet); color: white; }
.nav-label { font-size: 12px; font-weight: 600; color: var(--t2); white-space: nowrap; }
.nav-btn.active .nav-label { color: var(--violet); font-weight: 700; }
.sb-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-xs); font-size: 10px; color: var(--t3); line-height: 1.7; }

/* ── MAIN ── */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

/* ── TOPBAR ── */
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 56px; display: flex; align-items: center; padding: 0 24px; position: sticky; top: 0; z-index: 40; justify-content: space-between; gap: 12px; }
.topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.topbar-title { font-size: 13px; font-weight: 600; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar-sep { color: var(--border); margin: 0 4px; }

/* ── HAMBURGER ── */
.hamburger { display: none; align-items: center; justify-content: center; width: 36px; height: 36px; border: none; border-radius: 8px; background: transparent; cursor: pointer; color: var(--t2); flex-shrink: 0; transition: background 0.15s; }
.hamburger:hover { background: var(--bg); }
.hamburger svg { display: block; }

/* ── MARKET PICKER BUTTON (topbar) ── */
.market-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  background: var(--orange); color: #fff;
  border: none; border-radius: 8px;
  font-family: inherit; font-size: 12px; font-weight: 700;
  cursor: pointer; transition: 0.15s;
  white-space: nowrap; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(249,115,22,0.25);
}
.market-btn:hover { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(249,115,22,0.35); }
.market-btn-flag { font-size: 15px; }
.market-btn-caret { font-size: 9px; opacity: 0.8; margin-left: 2px; }

/* ── MARKET PICKER DROPDOWN ── */
.market-dropdown-wrap { position: relative; }
.market-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r); padding: 6px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.12);
  min-width: 200px; z-index: 100;
  animation: dropIn 0.15s ease-out;
}
@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.market-option {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  cursor: pointer; border: none; background: transparent;
  width: 100%; text-align: left; font-family: inherit;
  transition: background 0.12s;
}
.market-option:hover { background: var(--bg); }
.market-option.active { background: var(--orange-a); }
.market-option-flag { font-size: 20px; }
.market-option-info { display: flex; flex-direction: column; }
.market-option-name { font-size: 13px; font-weight: 700; color: var(--t1); }
.market-option-desc { font-size: 11px; color: var(--t3); margin-top: 1px; }
.market-option-check { margin-left: auto; color: var(--orange); font-weight: 800; font-size: 14px; }

/* ── OVERLAY (mobile) ── */
.overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 45; }

/* ── PAGE ── */
.page { flex: 1; padding: 28px; max-width: 1200px; width: 100%; margin: 0 auto; }

/* ── CARDS / LAYOUT ── */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
.field-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); margin-bottom: 10px; }
.split { display: grid; gap: 24px; grid-template-columns: 380px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 8px; }

/* ── MARKET SELECTOR (Search step) ── */
.market-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.market-card { padding: 16px; border: 2px solid var(--border-xs); border-radius: var(--r); background: var(--surface); cursor: pointer; text-align: center; transition: 0.15s; font-family: inherit; }
.market-card:hover { border-color: var(--border); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.market-card.active { border-color: var(--lime); background: var(--lime-a); box-shadow: 0 4px 16px rgba(132,204,22,0.15); }
.market-card-flag { font-size: 32px; display: block; margin-bottom: 8px; }
.market-card-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--t1); margin-bottom: 4px; }
.market-card-desc { font-size: 11px; color: var(--t3); line-height: 1.4; }

/* ── BUTTONS ── */
.btn-primary { width: 100%; padding: 14px; background: var(--orange); color: #fff; border: none; border-radius: var(--r-sm); font-size: 14px; font-weight: 700; cursor: pointer; transition: 0.15s; display: flex; justify-content: center; align-items: center; gap: 8px; font-family: inherit; }
.btn-primary:hover:not(:disabled) { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,0.25); }
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }
.btn-action { padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--t1); cursor: pointer; transition: 0.15s; font-family: inherit; }
.btn-action:hover { background: var(--bg); border-color: var(--violet); color: var(--violet); }
.btn-action.active { background: var(--violet); color: #fff; border-color: var(--violet); }
.btn-sticky { background: var(--t1); color: #fff; padding: 14px 28px; border-radius: 99px; font-weight: 700; font-size: 14px; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.2); transition: 0.2s; display: flex; align-items: center; gap: 8px; font-family: inherit; }
.btn-sticky:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }

/* ── INPUTS ── */
.inp { width: 100%; padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 13px; line-height: 1.65; color: var(--t1); resize: vertical; outline: none; transition: 0.15s; min-height: 100px; }
.inp:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px var(--violet-a); }
input.inp { min-height: auto; resize: none; }

/* ── NEWS CARD ── */
.news-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: 0.2s; }
.news-card:hover { border-color: var(--violet); box-shadow: 0 8px 24px rgba(124,58,237,0.08); }
.news-headline { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--t1); line-height: 1.3; }
.news-summary { font-size: 12px; color: var(--t2); line-height: 1.6; flex: 1; }
.news-category { font-size: 10px; font-weight: 700; color: var(--violet); background: var(--violet-a); padding: 3px 8px; border-radius: 4px; text-transform: uppercase; display: inline-block; }
.news-score { font-size: 11px; font-weight: 700; color: var(--lime-d); }

/* ── CONTEXT PILL ── */
.context-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--lime-a); border: 1px solid var(--lime); color: var(--lime-d); border-radius: 99px; font-size: 11px; font-weight: 700; margin-bottom: 12px; }

/* ── STICKY FOOTER ── */
.sticky-footer { position: sticky; bottom: 0; padding: 16px 0; background: linear-gradient(transparent, var(--bg) 20%); margin-top: 24px; display: flex; justify-content: flex-end; z-index: 10; }

/* ── LOADER ── */
.stream-loader { font-family: monospace; font-size: 13px; color: var(--violet); background: var(--violet-a); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
.stream-line { display: flex; align-items: center; gap: 8px; animation: fadeIn 0.3s ease-out; }
.blink { animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

/* ── EVALUATE ── */
.tone-row { margin-bottom: 12px; }
.tone-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--t2); margin-bottom: 5px; }
.tone-track { position: relative; height: 6px; background: var(--bg); border-radius: 99px; }
.tone-mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: var(--border); }
.tone-dot { position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%; background: var(--violet); border: 2px solid white; transform: translate(-50%, -50%); box-shadow: 0 2px 6px rgba(124,58,237,0.4); transition: left 0.6s cubic-bezier(0.34,1.56,0.64,1); }
.badge { padding: 4px 10px; background: #FEE2E2; color: #B91C1C; font-size: 11px; font-weight: 600; border-radius: 6px; margin: 0 6px 6px 0; display: inline-block; }
.trust-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; background: var(--bg); border-radius: 8px; font-size: 12px; color: var(--t2); border-left: 3px solid var(--red); line-height: 1.4; margin-bottom: 8px; }
.rw-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.rw-block { padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.5; border: 1px solid var(--border); background: var(--surface); color: var(--t2); margin-bottom: 8px; }
.rw-block.local { background: var(--violet-a); border-color: rgba(124,58,237,0.2); color: var(--violet); font-weight: 500; }

/* ── MOBILE ─────────────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  /* Сайдбар уходит за экран */
  .sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    transform: translateX(-100%);
    box-shadow: 4px 0 24px rgba(0,0,0,0.08);
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .overlay.show { display: block; }
  .hamburger { display: flex; }

  /* Топбар компактнее */
  .topbar { padding: 0 16px; height: 52px; }
  .topbar-title { font-size: 12px; }

  /* Страница */
  .page { padding: 16px 16px 32px; }

  /* Поиск — market cards в столбик */
  .market-selector { grid-template-columns: 1fr; gap: 8px; }
  .market-card { display: flex; align-items: center; gap: 14px; text-align: left; padding: 14px; }
  .market-card-flag { font-size: 26px; margin-bottom: 0; flex-shrink: 0; }

  /* Новости — 2 колонки на tablet, 1 на phone */
  .news-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }

  /* Split → вертикально */
  .split { grid-template-columns: 1fr; gap: 16px; }

  /* Sticky panel перестаёт быть sticky */
  .split > div:first-child { position: static !important; }

  /* 2-col grid → 1 col */
  .grid2 { grid-template-columns: 1fr; }

  /* Кнопки действий в строку */
  .news-actions { flex-wrap: wrap; }
}

@media (max-width: 560px) {
  .news-grid { grid-template-columns: 1fr; }
  .topbar-sep { display: none; }
  .topbar-title { display: none; }
}
`;

// ── Компонент: лоадер ─────────────────────────────────────────────────────────

const ProgressStream = ({ steps, activeIdx, quoteIdx }: { steps: string[]; activeIdx: number; quoteIdx: number }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="stream-loader">
      {steps.map((s, i) => {
        if (i > activeIdx) return null;
        const isCurrent = i === activeIdx;
        return (
          <div key={i} className="stream-line" style={{ opacity: isCurrent ? 1 : 0.5 }}>
            <span>{isCurrent ? <span className="blink">▶</span> : "✓"}</span>
            <span>{s}</span>
          </div>
        );
      })}
    </div>
    <div style={{ textAlign: "center", fontStyle: "italic", fontSize: 13, color: "var(--t3)" }}>
      💡 {FUNNY_QUOTES[quoteIdx]}
    </div>
  </div>
);

// ── Компонент: маркет-пикер ───────────────────────────────────────────────────

const MarketPicker = ({ market, onChange }: { market: MarketKey; onChange: (m: MarketKey) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрываем при клике снаружи
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (key: MarketKey) => { onChange(key); setOpen(false); };
  const m = MARKETS[market];

  return (
    <div className="market-dropdown-wrap" ref={ref}>
      <button className="market-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="market-btn-flag">{m.flag}</span>
        <span>{m.labelRu}</span>
        <span className="market-btn-caret">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="market-dropdown">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, data]) => (
            <button key={key} className={`market-option ${key === market ? "active" : ""}`} onClick={() => select(key)}>
              <span className="market-option-flag">{data.flag}</span>
              <div className="market-option-info">
                <span className="market-option-name">{data.labelRu}</span>
                <span className="market-option-desc">{data.desc}</span>
              </div>
              {key === market && <span className="market-option-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Главный компонент ─────────────────────────────────────────────────────────

export default function BreasonApp() {
  const [step,          setStep]          = useState<StepKey>("search");
  const [market,        setMarket]        = useState<MarketKey>("germany");
  const [inputMode,     setInputMode]     = useState<InputMode>("text");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);

  const [globalText,     setGlobalText]     = useState(DEFAULT_COPY);
  const [selectedTrend,  setSelectedTrend]  = useState("");
  const [styleModifier,  setStyleModifier]  = useState<StyleModifier>("none");

  const [loading,        setLoading]        = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [quoteIdx,       setQuoteIdx]       = useState(0);
  const [error,          setError]          = useState<string | null>(null);

  const [newsItems,     setNewsItems]     = useState<NewsItem[] | null>(null);
  const [deepDiveData,  setDeepDiveData]  = useState<Record<string, string>>({});
  const [evalResult,    setEvalResult]    = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);

  const [urlInput, setUrlInput] = useState("");

  // ── Лоадер-таймеры ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading) return;
    setLoadingStepIdx(0);
    setQuoteIdx(Math.floor(Math.random() * FUNNY_QUOTES.length));
    const li = setInterval(() => setLoadingStepIdx((p) => Math.min(p + 1, 3)), 1500);
    const qi = setInterval(() => setQuoteIdx((p) => (p + 1) % FUNNY_QUOTES.length), 4000);
    return () => { clearInterval(li); clearInterval(qi); };
  }, [loading]);

  // ── Закрываем sidebar при смене шага на мобилке ──────────────────────────
  const switchStep = (s: StepKey) => {
    setStep(s);
    setSidebarOpen(false);
  };

  const resetToHome = () => {
    setStep("search"); setNewsItems(null); setEvalResult(null);
    setImproveResult(null); setSelectedTrend(""); setGlobalText(DEFAULT_COPY);
    setSidebarOpen(false);
  };

  // ── API-хендлеры ──────────────────────────────────────────────────────────
  const handleFetchUrl = async () => {
    if (!urlInput) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/fetch-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput }) });
      const data = await res.json();
      if (data.text) setGlobalText(data.text);
      else setError(data.error || "Ошибка парсинга URL");
    } catch { setError("Ошибка сети"); }
    finally   { setLoading(false); }
  };

  const handleSearch = async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setNewsItems(data.items || []);
    } catch { setError("Не удалось загрузить тренды."); }
    finally   { setLoading(false); }
  };

  const handleDeepDive = async (headline: string) => {
    setDeepDiveData((p) => ({ ...p, [headline]: "Изучаем инсайды..." }));
    try {
      const res  = await fetch("/api/resonance-trends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deep_dive", market, trendContext: headline }) });
      const data = await res.json();
      setDeepDiveData((p) => ({ ...p, [headline]: data.analysis || "Ошибка формирования аналитики." }));
    } catch {
      setDeepDiveData((p) => ({ ...p, [headline]: "Ошибка соединения." }));
    }
  };

  const handleUseTrend = (headline: string) => { setSelectedTrend(headline); switchStep("evaluate"); };

  const handleEvaluate = async () => {
    if (!globalText.trim()) return;
    setLoading(true); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "evaluate", text: globalText, market, trendContext: selectedTrend }) });
      const data = await res.json();
      if (data.verdict) setEvalResult(data);
      else setError("ИИ вернул неполные данные.");
    } catch { setError("Ошибка при анализе контента."); }
    finally   { setLoading(false); }
  };

  const handleImprove = async () => {
    setLoading(true); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "improve", text: globalText, market, context: selectedTrend, styleModifier }) });
      const data = await res.json();
      if (data.improved_text) setImproveResult(data);
      else setError("Не удалось сгенерировать улучшенный текст.");
    } catch { setError("Ошибка генерации."); }
    finally   { setLoading(false); }
  };

  const handleCheckAgain = () => {
    if (improveResult?.improved_text) {
      setGlobalText(improveResult.improved_text);
      setImproveResult(null); setEvalResult(null); switchStep("evaluate");
    }
  };

  // ── Tone bar ──────────────────────────────────────────────────────────────
  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = Math.max(0, Math.min(100, ((val + 5) / 10) * 100));
    return (
      <div className="tone-row">
        <div className="tone-labels"><span>{labelL}</span><span>{labelR}</span></div>
        <div className="tone-track">
          <div className="tone-mid" />
          <div className="tone-dot" style={{ left: `${pct}%` }} />
        </div>
      </div>
    );
  };

  // ── ШАГ 1: Поиск ─────────────────────────────────────────────────────────
  const renderSearch = () => (
    <div className="stack">
      <div className="card">
        <p className="field-label">1. Выберите целевой рынок</p>
        <div className="market-selector">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
            <button key={key} className={`market-card ${market === key ? "active" : ""}`} onClick={() => setMarket(key)}>
              <span className="market-card-flag">{m.flag}</span>
              <div className="market-card-name">{m.labelRu}</div>
              <div className="market-card-desc">{m.desc}</div>
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "Анализ новостных сводок..." : `Собрать инсайты — ${MARKETS[market].labelRu}`}
        </button>
      </div>

      {loading && <ProgressStream steps={LOADING_MSGS.search} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
      {!loading && error && <div style={{ color: "var(--red)", padding: "12px 16px", background: "rgba(239,68,68,0.06)", borderRadius: 8 }}>{error}</div>}

      {!loading && newsItems && (
        <div className="news-grid">
          {newsItems.map((item, i) => (
            <div className="news-card" key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span className="news-category">{item.category}</span>
                <span className="news-score">↑ {item.resonance_score}</span>
              </div>
              <h3 className="news-headline">{item.headline}</h3>
              <p className="news-summary">{item.summary}</p>

              {deepDiveData[item.headline] && (
                <div style={{ padding: 12, background: "var(--bg)", borderRadius: 8, fontSize: 12, color: "var(--t2)", borderLeft: "3px solid var(--violet)", lineHeight: 1.6 }}>
                  {deepDiveData[item.headline]}
                </div>
              )}

              <div className="news-actions" style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--border-xs)", display: "flex", gap: 6 }}>
                <button className="btn-action" style={{ flex: 1, fontSize: 11 }} onClick={() => handleUseTrend(item.headline)}>
                  → Под тренд
                </button>
                <button className="btn-action" style={{ flex: 1, fontSize: 11 }} onClick={() => handleDeepDive(item.headline)}>
                  🔍 Подробнее
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── ШАГ 2: Оценка ────────────────────────────────────────────────────────
  const renderEvaluate = () => (
    <div className="split">
      {/* Левая колонка */}
      <div className="stack" style={{ position: "sticky", top: 68 }}>
        <div className="card">
          <p className="field-label">Контекст проверки</p>
          {selectedTrend ? (
            <div className="context-pill">
              🎯 {selectedTrend.length > 35 ? selectedTrend.slice(0, 35) + "…" : selectedTrend}
              <span style={{ cursor: "pointer", marginLeft: 6, opacity: 0.6 }} onClick={() => setSelectedTrend("")}>✕</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>Без привязки к тренду. Общая оценка.</div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={`btn-action ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")} style={{ flex: 1 }}>Текст</button>
            <button className={`btn-action ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")} style={{ flex: 1 }}>URL</button>
          </div>

          {inputMode === "url" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input className="inp" style={{ padding: "10px", flex: 1, margin: 0 }} placeholder="https://" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()} />
              <button className="btn-action" onClick={handleFetchUrl} disabled={loading}>Парсить</button>
            </div>
          )}

          <p className="field-label">Ваш маркетинговый контент</p>
          <textarea className="inp" rows={7} value={globalText} onChange={(e) => setGlobalText(e.target.value)} placeholder="Вставьте текст для проверки..." />

          <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !globalText.trim()} style={{ marginTop: 16 }}>
            {loading ? "Аудит контента..." : `Оценить для ${MARKETS[market].flag} ${MARKETS[market].labelRu}`}
          </button>
        </div>
      </div>

      {/* Правая колонка */}
      <div className="stack">
        {loading && <ProgressStream steps={LOADING_MSGS.evaluate} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
        {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
        {!loading && !evalResult && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>
            <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }}>◈</div>
            <p>Вставьте текст и нажмите «Оценить».</p>
          </div>
        )}

        {!loading && evalResult && (() => {
          const vc = VERDICT_CFG[evalResult.verdict];
          return (
            <>
              <div className="card" style={{ background: vc.bg, borderColor: vc.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 22, color: vc.color, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", flexShrink: 0 }}>
                    {vc.icon}
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 20, color: vc.color, margin: 0 }}>{evalResult.verdict} — {vc.label}</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--t1)" }}>{evalResult.verdict_reason}</p>
                  </div>
                </div>
              </div>

              <div className="grid2">
                <div className="card">
                  <p className="field-label">Карта тона</p>
                  {renderToneBar("Формальный", "Кэжуал", evalResult.tone_map.formal_casual)}
                  {renderToneBar("Дерзкий", "Осторожный", evalResult.tone_map.bold_cautious)}
                  {renderToneBar("Технический", "Про пользу", evalResult.tone_map.technical_benefit)}
                  {renderToneBar("Абстрактный", "Конкретный", evalResult.tone_map.abstract_concrete)}
                  {renderToneBar("Перевод", "Нативный", evalResult.tone_map.global_native)}
                </div>

                <div className="stack">
                  <div className="card">
                    <p className="field-label">Индекс клише</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 32, fontWeight: 800, color: evalResult.genericness_score > 60 ? "var(--red)" : "var(--lime-d)" }}>
                        {evalResult.genericness_score}
                      </span>
                      <span style={{ fontSize: 14, color: "var(--t3)" }}>/100</span>
                    </div>
                    <div>{evalResult.generic_phrases?.map((p, i) => <span key={i} className="badge">«{p}»</span>)}</div>
                  </div>

                  <div className="card">
                    <p className="field-label">Красные флаги</p>
                    {evalResult.missing_trust_signals?.map((s, i) => (
                      <div key={i} className="trust-item">✕ {s}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="field-label">Точечные рекомендации</p>
                {evalResult.rewrites?.map((rw, i) => (
                  <div key={i} className="rw-card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--violet)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{rw.block}</div>
                    <div className="grid2" style={{ gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>Оригинал</div>
                        <div className="rw-block">{rw.original}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--violet)", fontWeight: 700, marginBottom: 4 }}>Локально {MARKETS[market].flag}</div>
                        <div className="rw-block local">{rw.suggested_local}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t2)", fontStyle: "italic", marginTop: 8 }}>💡 {rw.reason}</div>
                  </div>
                ))}
              </div>

              <div className="sticky-footer">
                <button className="btn-sticky" onClick={() => switchStep("improve")}>✨ Улучшить с учётом правок →</button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  // ── ШАГ 3: Улучшение ──────────────────────────────────────────────────────
  const renderImprove = () => (
    <div className="split">
      <div className="stack" style={{ position: "sticky", top: 68 }}>
        <div className="card">
          <p className="field-label">Стиль</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {(["none", "friendly", "professional", "concise"] as StyleModifier[]).map((m) => (
              <button key={m} className={`btn-action ${styleModifier === m ? "active" : ""}`} onClick={() => setStyleModifier(m)}>
                {{ none: "Стандартно (по профилю)", friendly: "🤝 Сделать дружелюбнее", professional: "💼 Усилить экспертность", concise: "✂️ Лаконично (bullet points)" }[m]}
              </button>
            ))}
          </div>

          <p className="field-label">Текст для редактуры</p>
          <textarea className="inp" rows={7} value={globalText} onChange={(e) => setGlobalText(e.target.value)} />

          <button className="btn-primary" onClick={handleImprove} disabled={loading || !globalText.trim()} style={{ marginTop: 16 }}>
            {loading ? "Генерация..." : "🪄 Применить магию ИИ"}
          </button>
        </div>
      </div>

      <div className="stack">
        {loading && <ProgressStream steps={LOADING_MSGS.improve} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
        {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
        {!loading && !improveResult && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>
            <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }}>✨</div>
            <p>Выберите стиль и нажмите кнопку.</p>
          </div>
        )}

        {!loading && improveResult && (
          <>
            <div className="card" style={{ borderLeft: "4px solid var(--lime)" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", background: "var(--lime-a)", color: "var(--lime-d)", borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                ✓ {improveResult.tone_achieved}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, color: "var(--t1)" }}>{improveResult.improved_text}</div>
            </div>

            <div className="card">
              <p className="field-label">Лог изменений</p>
              <div className="stack">
                {improveResult.changes?.map((c, i) => (
                  <div key={i} style={{ padding: 16, background: "var(--bg)", borderRadius: 8, borderLeft: "3px solid var(--violet)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.what}</div>
                    <div style={{ fontSize: 13, color: "var(--t2)" }}>{c.why}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky-footer">
              <button className="btn-sticky" style={{ background: "var(--surface)", color: "var(--t1)", border: "1px solid var(--border)" }} onClick={handleCheckAgain}>
                ↻ Проверить заново
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <style>{STYLE}</style>

      {/* Overlay для мобильного сайдбара */}
      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="logo" onClick={resetToHome} style={{ background: "none", border: "none" }}>
          <div className="logo-mark">B</div>
          Breason
        </button>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => switchStep(key)}>
              <div className="nav-num">{s.num}</div>
              <div className="nav-label">{s.label}</div>
            </button>
          ))}
        </nav>

        <div className="sb-footer">
          Breason v2.1<br />
          <span style={{ opacity: 0.5 }}>Не перевод. Резонанс.</span>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            {/* Hamburger (только мобилка) */}
            <button className="hamburger" onClick={() => setSidebarOpen((o) => !o)} aria-label="Открыть меню">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect y="3"  width="18" height="2" rx="1" fill="currentColor"/>
                <rect y="8"  width="18" height="2" rx="1" fill="currentColor"/>
                <rect y="13" width="18" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>

            <span className="topbar-title">
              Breason <span className="topbar-sep">/</span> {STEPS[step].label}
            </span>
          </div>

          {/* Маркет-пикер — оранжевая кнопка */}
          <MarketPicker market={market} onChange={setMarket} />
        </header>

        <main className="page">
          {step === "search"   && renderSearch()}
          {step === "evaluate" && renderEvaluate()}
          {step === "improve"  && renderImprove()}
        </main>
      </div>
    </div>
  );
}
