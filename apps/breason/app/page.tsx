"use client";

import { useState, useEffect, useRef } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey     = "germany" | "poland" | "brazil";
type StepKey       = "search" | "evaluate" | "improve";
type VerdictType   = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode     = "text" | "url";

interface NewsItem {
  headline:        string;
  topic:           string;
  category:        string;
  summary:         string;
  business_impact: string;
}

interface ToneMap        { formal_casual: number; bold_cautious: number; technical_benefit: number; abstract_concrete: number; global_native: number; }
interface Rewrite        { block: string; original: string; suggested: string; suggested_local: string; reason: string; }
interface EvaluateResult { verdict: VerdictType; verdict_reason: string; genericness_score: number; generic_phrases: string[]; tone_map: ToneMap; missing_trust_signals: string[]; rewrites: Rewrite[]; }
interface ImproveResult  { improved_text: string; improved_local: string; changes: { what: string; why: string }[]; tone_achieved: string; }

interface CustomPrompts { search: string; evaluate: string; improve: string; }
const DEFAULT_PROMPTS: CustomPrompts = { search: "", evaluate: "", improve: "" };

// ── Константы ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { labelRu: string; flag: string; desc: string }> = {
  germany: { labelRu: "Германия",  flag: "🇩🇪", desc: "Формальный · Точный · Процессный" },
  poland:  { labelRu: "Польша",    flag: "🇵🇱", desc: "Прямой · Фактический · Прозрачный" },
  brazil:  { labelRu: "Бразилия",  flag: "🇧🇷", desc: "Тёплый · Человечный · Доверительный" },
};

const STEPS: Record<StepKey, { num: string; label: string }> = {
  search:   { num: "01", label: "Поиск трендов" },
  evaluate: { num: "02", label: "Оценка контента" },
  improve:  { num: "03", label: "Улучшение" },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально"    },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как перевод" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Чужеродный контент" },
};

const PRESETS = [
  { id: "icebreaker", icon: "🧊", label: "Icebreaker", desc: "Холодное письмо / LinkedIn" },
  { id: "thought_leader", icon: "💡", label: "Thought Leader", desc: "Вовлекающий пост" },
  { id: "landing_page", icon: "📄", label: "Landing Page", desc: "Блок для сайта" },
  { id: "follow_up", icon: "👋", label: "Gentle Nudge", desc: "Фоллоу-ап после встречи" },
  { id: "standard", icon: "🪄", label: "Стандартная правка", desc: "Улучшение по профилю" }
];

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Смотрим рынок...", "Опрашиваем экспертов...", "Звоним инсайдерам...", "Готовим отчет..."],
  evaluate: ["Синхронизируем культурный код...", "Ищем сигналы доверия...", "Считаем индекс клише...", "Генерируем советы..."],
  improve:  ["Применяем профиль рынка...", "Вплетаем тренды...", "Переписываем текст...", "Полируем нативный тон..."],
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

const PROMPT_LABELS: Record<keyof CustomPrompts, string> = { search: "Поиск трендов", evaluate: "Оценка контента", improve: "Улучшение текста" };
const PROMPT_PLACEHOLDERS: Record<keyof CustomPrompts, string> = {
  search:   "Пример: Фокусируйся только на стартапах...",
  evaluate: "Пример: Дополнительно проверяй наличие кейсов...",
  improve:  "Пример: Текст должен звучать как письмо от CEO...",
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet: #7C3AED; --violet-d: #6D28D9; --violet-a: rgba(124,58,237,0.1);
  --lime: #84CC16; --lime-a: rgba(132,204,22,0.12); --lime-d: #65A30D;
  --orange: #F97316; --orange-d: #EA6C0A; --orange-a: rgba(249,115,22,0.1);
  --red: #EF4444;
  --bg: #F1F5F9; --surface: #FFFFFF;
  --t1: #0F172A; --t2: #475569; --t3: #94A3B8;
  --border: rgba(15,23,42,0.1); --border-xs: rgba(15,23,42,0.05);
  --r: 14px; --r-sm: 10px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--t1); line-height: 1.5; }

.shell { display: flex; min-height: 100vh; overflow-x: hidden; }
.sidebar { width: 240px; background: var(--surface); border-right: 1px solid var(--border); padding: 24px 16px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 100; transition: transform 0.3s ease; }
.logo { display: flex; align-items: center; gap: 10px; font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; color: var(--t1); margin-bottom: 32px; cursor: pointer; background: none; border: none; padding: 0 4px; }
.logo-mark { width: 28px; height: 28px; background: var(--lime); border-radius: 6px; display: grid; place-items: center; font-size: 14px; font-weight: 800; color: #1a2e05; flex-shrink: 0; }
.nav-btn { display: flex; align-items: center; gap: 10px; padding: 12px; border: none; border-radius: 10px; background: transparent; cursor: pointer; width: 100%; text-align: left; font-family: inherit; transition: 0.15s; margin-bottom: 6px; }
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }
.nav-num { width: 24px; height: 24px; border-radius: 6px; background: var(--bg); font-size: 10px; font-weight: 800; color: var(--t3); display: grid; place-items: center; font-family: 'Syne', sans-serif; flex-shrink: 0; }
.nav-btn.active .nav-num { background: var(--violet); color: white; }
.nav-label { font-size: 13px; font-weight: 600; color: var(--t2); white-space: nowrap; }
.nav-btn.active .nav-label { color: var(--violet); font-weight: 700; }

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 60px; display: flex; align-items: center; padding: 0 28px; position: sticky; top: 0; z-index: 40; justify-content: space-between; gap: 16px; }
.topbar-left { display: flex; align-items: center; gap: 12px; }
.hamburger { display: none; background: transparent; border: none; font-size: 24px; cursor: pointer; padding: 4px; color: var(--t2); }
.topbar-title { font-size: 14px; font-weight: 600; color: var(--t2); white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 10px; }

.market-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; color: var(--t1); transition: 0.15s; }
.market-btn:hover { background: var(--bg); }
.settings-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--t2); cursor: pointer; transition: 0.15s; }
.settings-btn:hover { background: var(--bg); color: var(--violet); }

/* DROPDOWN */
.market-dropdown-wrap { position: relative; }
.market-dropdown { position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 8px; box-shadow: 0 12px 40px rgba(0,0,0,0.12); min-width: 220px; z-index: 100; animation: dropIn 0.15s ease-out; }
@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.market-option { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer; border: none; background: transparent; width: 100%; text-align: left; font-family: inherit; transition: 0.1s; }
.market-option:hover { background: var(--bg); }
.market-option.active { background: var(--orange-a); }

/* BUTTONS */
.btn-primary { width: 100%; padding: 15px; background: var(--orange); color: #fff; border: none; border-radius: var(--r-sm); font-size: 15px; font-weight: 700; cursor: pointer; transition: 0.15s; display: flex; justify-content: center; align-items: center; font-family: inherit; }
.btn-primary:hover:not(:disabled) { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,0.25); }
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }
.btn-action { padding: 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--t1); cursor: pointer; transition: 0.15s; font-family: inherit; }
.btn-action:hover { background: var(--bg); border-color: var(--orange); color: var(--orange); }
.btn-action.active { background: var(--orange); color: #fff; border-color: var(--orange); }
.btn-use-trend { width: 100%; padding: 12px; margin-top: auto; background: var(--orange); color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.15s; }
.btn-use-trend:hover { background: var(--orange-d); }
.btn-sticky { background: var(--orange); color: #fff; padding: 15px 32px; border-radius: 99px; font-weight: 700; font-size: 15px; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(249,115,22,0.3); transition: 0.2s; }
.btn-sticky:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(249,115,22,0.4); }

/* INPUTS & CARDS */
.page { flex: 1; padding: 32px; max-width: 1200px; width: 100%; margin: 0 auto; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; }
.field-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--t3); margin-bottom: 12px; }
.inp { width: 100%; padding: 16px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 14px; line-height: 1.6; color: var(--t1); resize: vertical; outline: none; transition: 0.15s; min-height: 80px; }
.inp:focus { border-color: var(--orange); background: var(--surface); box-shadow: 0 0 0 3px var(--orange-a); }
input.inp { min-height: auto; resize: none; padding: 12px 16px; }

/* LAYOUT */
.split { display: grid; gap: 32px; grid-template-columns: 420px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stack { display: flex; flex-direction: column; gap: 20px; }

/* TOPIC GROUPS */
.topic-section { margin-bottom: 32px; }
.topic-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.topic-label { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800; text-transform: uppercase; color: var(--t3); }
.topic-line { flex: 1; height: 1px; background: var(--border-xs); }
.news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.news-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; display: flex; flex-direction: column; gap: 12px; transition: 0.2s; }
.news-card:hover { border-color: var(--orange); box-shadow: 0 8px 24px rgba(249,115,22,0.08); transform: translateY(-2px); }
.news-headline { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--t1); line-height: 1.35; }

/* MODAL & PRESETS */
.preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.preset-card { padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); text-align: left; cursor: pointer; transition: 0.15s; font-family: inherit; }
.preset-card:hover { border-color: var(--orange); background: var(--bg); }
.preset-card.active { background: var(--orange-a); border-color: var(--orange); }

.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: var(--surface); border-radius: var(--r); padding: 32px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
.overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 90; }

/* MOBILE RESPONSIVENESS */
@media (max-width: 960px) {
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.1); }
  .sidebar.open { transform: translateX(0); }
  .overlay.show { display: block; }
  .hamburger { display: block; }
  .split { grid-template-columns: 1fr; }
  .split > div:first-child { position: static !important; }
  .news-grid { grid-template-columns: 1fr; }
  .topbar { padding: 0 16px; }
  .page { padding: 20px 16px 40px; }
}

/* OTHERS */
.stream-loader { font-family: monospace; font-size: 14px; color: var(--orange-d); background: var(--orange-a); padding: 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px; }
.stream-line { display: flex; align-items: center; gap: 8px; }
.blink { animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.sticky-footer { position: sticky; bottom: 0; padding: 20px 0; background: linear-gradient(transparent, var(--bg) 30%); margin-top: 24px; display: flex; justify-content: flex-end; z-index: 10; }
`;

const ProgressStream = ({ steps, activeIdx, quoteIdx }: { steps: string[]; activeIdx: number; quoteIdx: number }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="stream-loader">
      {steps.map((s, i) => {
        if (i > activeIdx) return null;
        return (
          <div key={i} className="stream-line" style={{ opacity: i === activeIdx ? 1 : 0.5 }}>
            <span>{i === activeIdx ? <span className="blink">▶</span> : "✓"}</span><span>{s}</span>
          </div>
        );
      })}
    </div>
    <div style={{ textAlign: "center", fontStyle: "italic", fontSize: 14, color: "var(--t3)" }}>💡 {FUNNY_QUOTES[quoteIdx]}</div>
  </div>
);

const MarketPicker = ({ market, onChange }: { market: MarketKey; onChange: (m: MarketKey) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const m = MARKETS[market];
  return (
    <div className="market-dropdown-wrap" ref={ref}>
      <button className="market-btn" onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 16 }}>{m.flag}</span> <span>{m.labelRu}</span> 
      </button>
      {open && (
        <div className="market-dropdown">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, data]) => (
            <button key={key} className={`market-option ${key === market ? "active" : ""}`} onClick={() => { onChange(key); setOpen(false); }}>
              <span style={{ fontSize: 20 }}>{data.flag}</span>
              <div><div style={{ fontSize: 14, fontWeight: 700 }}>{data.labelRu}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{data.desc}</div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SettingsModal = ({ prompts, onSave, onClose }: { prompts: CustomPrompts; onSave: (p: CustomPrompts) => void; onClose: () => void; }) => {
  const [local, setLocal] = useState<CustomPrompts>({ ...prompts });
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Syne', fontSize: 20 }}>⚙️ Настройки промптов</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 14, color: "var(--t3)", marginBottom: 24 }}>Добавьте инструкции. Оставьте пустыми для дефолта.</p>
        {(Object.keys(local) as (keyof CustomPrompts)[]).map(key => (
          <div key={key} style={{ marginBottom: 20 }}>
            <label className="field-label">{PROMPT_LABELS[key]}</label>
            <textarea className="inp" value={local[key]} onChange={e => setLocal(p => ({ ...p, [key]: e.target.value }))} placeholder={PROMPT_PLACEHOLDERS[key]} style={{ minHeight: 80 }} />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
          <button className="btn-action" onClick={() => setLocal(DEFAULT_PROMPTS)} style={{ marginRight: "auto" }}>Сбросить</button>
          <button className="btn-action" onClick={onClose}>Отмена</button>
          <button className="btn-action active" onClick={() => { onSave(local); onClose(); }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};

export default function BreasonApp() {
  const [step,         setStep]         = useState<StepKey>("search");
  const [market,       setMarket]       = useState<MarketKey>("germany");
  const [inputMode,    setInputMode]    = useState<InputMode>("text");
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [globalText,    setGlobalText]    = useState(""); // Пустой по умолчанию
  const [selectedTrend, setSelectedTrend] = useState<NewsItem | null>(null);
  const [presetAction,  setPresetAction]  = useState<string>("standard");
  const [keyword,       setKeyword]       = useState("");

  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>(DEFAULT_PROMPTS);
  useEffect(() => {
    try { const saved = localStorage.getItem("breason_prompts"); if (saved) setCustomPrompts(JSON.parse(saved)); } catch {}
  }, []);

  const savePrompts = (p: CustomPrompts) => { setCustomPrompts(p); try { localStorage.setItem("breason_prompts", JSON.stringify(p)); } catch {} };

  const [loading,        setLoading]        = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [quoteIdx,       setQuoteIdx]       = useState(0);
  const [error,          setError]          = useState<string | null>(null);

  const [newsItems,     setNewsItems]     = useState<NewsItem[] | null>(null);
  const [keywordFocus,  setKeywordFocus]  = useState("");
  const [evalResult,    setEvalResult]    = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const [urlInput,      setUrlInput]      = useState("");

  useEffect(() => {
    if (!loading) return;
    setLoadingStepIdx(0);
    setQuoteIdx(Math.floor(Math.random() * FUNNY_QUOTES.length));
    const li = setInterval(() => setLoadingStepIdx(p => Math.min(p + 1, 3)), 1500);
    const qi = setInterval(() => setQuoteIdx(p => (p + 1) % FUNNY_QUOTES.length), 4000);
    return () => { clearInterval(li); clearInterval(qi); };
  }, [loading]);

  const switchStep = (s: StepKey) => { setStep(s); setSidebarOpen(false); setError(null); };
  const resetToHome = () => {
    setStep("search"); setNewsItems(null); setEvalResult(null); setImproveResult(null);
    setSelectedTrend(null); setGlobalText(""); setSidebarOpen(false); setKeyword(""); setKeywordFocus("");
  };

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
    setLoading(true); setError(null); setNewsItems(null);
    const kw = keyword.trim();
    setKeywordFocus(kw);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", market, keyword: kw || undefined, customPrompts }),
      });
      const data = await res.json();
      setNewsItems(data.items || []);
    } catch { setError("Не удалось загрузить тренды."); }
    finally   { setLoading(false); }
  };

  const handleUseTrend = (item: NewsItem) => {
    setSelectedTrend(item);
    switchStep("evaluate");
  };

  const handleEvaluate = async () => {
    if (!globalText.trim()) return;
    setLoading(true); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", text: globalText, market, trendContext: selectedTrend, customPrompts }),
      });
      const data = await res.json();
      if (data.verdict) setEvalResult(data);
      else setError("Система вернула неполные данные.");
    } catch { setError("Ошибка при анализе."); }
    finally   { setLoading(false); }
  };

  const handleImprove = async () => {
    setLoading(true); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "improve", text: globalText, market, trendContext: selectedTrend, preset: presetAction, customPrompts }),
      });
      const data = await res.json();
      if (data.improved_local) setImproveResult(data);
      else setError("Не удалось сгенерировать текст.");
    } catch { setError("Ошибка генерации."); }
    finally   { setLoading(false); }
  };

  const groupedTrends = (newsItems || []).reduce<Record<string, NewsItem[]>>((acc, item) => {
    const key = item.topic || "Общее";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = Math.max(0, Math.min(100, ((val + 5) / 10) * 100));
    return (
      <div className="tone-row" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}><span>{labelL}</span><span>{labelR}</span></div>
        <div style={{ position: 'relative', height: 6, background: 'var(--bg)', borderRadius: 99 }}>
          <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 2, background: 'var(--border)' }} />
          <div style={{ position: 'absolute', top: '50%', width: 16, height: 16, borderRadius: '50%', background: 'var(--orange)', border: '2px solid white', transform: 'translate(-50%, -50%)', left: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="shell">
      <style>{STYLE}</style>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />
      {settingsOpen && <SettingsModal prompts={customPrompts} onSave={savePrompts} onClose={() => setSettingsOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="logo" onClick={resetToHome}><div className="logo-mark">B</div>Breason</button>
        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => switchStep(key)}>
              <div className="nav-num">{s.num}</div><div className="nav-label">{s.label}</div>
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="topbar-title">Breason / {STEPS[step].label}</span>
          </div>
          <div className="topbar-right">
            <button className="settings-btn" onClick={() => setSettingsOpen(true)}>⚙️ Промпты</button>
            <MarketPicker market={market} onChange={setMarket} />
          </div>
        </header>

        <main className="page">
          {step === "search" && (
            <div className="stack">
              <div className="card">
                <p className="field-label">1. Целевой рынок</p>
                <div className="market-selector">
                  {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
                    <button key={key} className={`market-card ${market === key ? "active" : ""}`} onClick={() => setMarket(key)}>
                      <span className="market-card-flag">{m.flag}</span>
                      <div className="market-card-name">{m.labelRu}</div>
                    </button>
                  ))}
                </div>
                <p className="field-label" style={{ marginTop: 24 }}>2. Фокус (необязательно)</p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <input className="inp" type="text" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && handleSearch()} placeholder="Например: AI, логистика..." />
                  {keyword && <button className="btn-action" onClick={() => setKeyword("")}>✕</button>}
                </div>
                <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                  {loading ? "Анализ рынка..." : `Найти тренды — ${MARKETS[market].labelRu}`}
                </button>
              </div>

              {loading && <ProgressStream steps={LOADING_MSGS.search} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
              {!loading && error && <div style={{ color: "var(--red)", padding: 16, background: "rgba(239,68,68,0.06)", borderRadius: 8 }}>{error}</div>}

              {!loading && newsItems && newsItems.length > 0 && (
                <div>
                  {keywordFocus && <div style={{ display: 'inline-flex', padding: '6px 16px', background: 'var(--orange-a)', color: 'var(--orange)', borderRadius: 99, fontSize: 13, fontWeight: 700, marginBottom: 24 }}>🔍 Фокус: «{keywordFocus}»</div>}
                  {Object.entries(groupedTrends).map(([topic, items]) => (
                    <div key={topic} className="topic-section">
                      <div className="topic-header"><span className="topic-label">{topic}</span><div className="topic-line" /><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)' }}>{items.length}</span></div>
                      <div className="news-grid">
                        {items.map((item, i) => (
                          <div className="news-card" key={i}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', background: 'var(--orange-a)', padding: '4px 8px', borderRadius: 6, display: 'inline-block', width: 'fit-content' }}>{item.category}</div>
                            <h3 className="news-headline">{item.headline}</h3>
                            <p style={{ fontSize: 13, color: 'var(--t2)', flex: 1, lineHeight: 1.5 }}>{item.summary}</p>
                            <p style={{ fontSize: 12, color: "var(--t3)", padding: "10px", background: "var(--bg)", borderRadius: 8, borderLeft: "3px solid var(--orange)", marginTop: 8 }}>{item.business_impact}</p>
                            <button className="btn-use-trend" onClick={() => handleUseTrend(item)}>Проверить текст под тренд →</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "evaluate" && (
            <div className="split">
              <div className="stack" style={{ position: "sticky", top: 84 }}>
                <div className="card">
                  <p className="field-label">Контекст</p>
                  {selectedTrend ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--lime-a)', color: 'var(--lime-d)', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                      🎯 {selectedTrend.headline.length > 35 ? selectedTrend.headline.slice(0, 35) + "…" : selectedTrend.headline} 
                      <span style={{ cursor: "pointer", marginLeft: 4, opacity: 0.6 }} onClick={() => setSelectedTrend(null)}>✕</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>Общая оценка (без тренда)</div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button className={`btn-action ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")} style={{ flex: 1 }}>Текст</button>
                    <button className={`btn-action ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")} style={{ flex: 1 }}>URL</button>
                  </div>

                  {inputMode === "url" && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <input className="inp" style={{ padding: "12px", flex: 1, margin: 0 }} placeholder="https://" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFetchUrl()} />
                      <button className="btn-action" onClick={handleFetchUrl} disabled={loading}>Парсить</button>
                    </div>
                  )}

                  <p className="field-label">Маркетинговый контент</p>
                  <textarea className="inp" rows={8} value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="Вставьте текст для анализа..." />
                  <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !globalText.trim()} style={{ marginTop: 24 }}>
                    {loading ? "Аудит..." : `Оценить для ${MARKETS[market].labelRu}`}
                  </button>
                </div>
              </div>

              <div className="stack">
                {loading && <ProgressStream steps={LOADING_MSGS.evaluate} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
                {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
                {!loading && !evalResult && !error && <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}><div style={{ fontSize: 40, opacity: 0.15, marginBottom: 16 }}>◈</div><p>Нажмите «Оценить».</p></div>}

                {!loading && evalResult && (() => {
                  const vc = VERDICT_CFG[evalResult.verdict];
                  return (
                    <>
                      <div className="card" style={{ background: vc.bg, borderColor: vc.border }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 26, color: vc.color, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", flexShrink: 0 }}>{vc.icon}</div>
                          <div><h2 style={{ fontFamily: "Syne", fontSize: 24, color: vc.color, margin: 0 }}>{evalResult.verdict} — {vc.label}</h2><p style={{ margin: "6px 0 0", fontSize: 15, color: 'var(--t1)' }}>{evalResult.verdict_reason}</p></div>
                        </div>
                      </div>
                      <div className="grid2">
                        <div className="card">
                          <p className="field-label" style={{ marginBottom: 20 }}>Карта тона</p>
                          {renderToneBar("Формальный", "Кэжуал", evalResult.tone_map.formal_casual)}
                          {renderToneBar("Дерзкий", "Осторожный", evalResult.tone_map.bold_cautious)}
                          {renderToneBar("Технический", "Про пользу", evalResult.tone_map.technical_benefit)}
                          {renderToneBar("Абстрактный", "Конкретный", evalResult.tone_map.abstract_concrete)}
                          {renderToneBar("Перевод", "Нативный", evalResult.tone_map.global_native)}
                        </div>
                        <div className="stack">
                          <div className="card">
                            <p className="field-label">Индекс клише</p>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}><span style={{ fontFamily: "Syne", fontSize: 40, fontWeight: 800, color: evalResult.genericness_score > 60 ? "var(--red)" : "var(--lime-d)" }}>{evalResult.genericness_score}</span><span style={{ fontSize: 15, color: "var(--t3)" }}>/100</span></div>
                            <div>{evalResult.generic_phrases?.map((p, i) => <span key={i} style={{ padding: "6px 12px", background: "#FEE2E2", color: "#B91C1C", fontSize: 12, fontWeight: 600, borderRadius: 8, margin: "0 8px 8px 0", display: "inline-block" }}>«{p}»</span>)}</div>
                          </div>
                          <div className="card">
                            <p className="field-label">Красные флаги</p>
                            {evalResult.missing_trust_signals?.map((s, i) => <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", background: "var(--bg)", borderRadius: 10, fontSize: 13, color: "var(--t2)", borderLeft: "4px solid var(--red)", marginBottom: 10 }}>✕ {s}</div>)}
                          </div>
                        </div>
                      </div>
                      <div className="sticky-footer"><button className="btn-sticky" onClick={() => switchStep("improve")}>✨ Улучшить с учётом правок →</button></div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {step === "improve" && (
            <div className="split">
              <div className="stack" style={{ position: "sticky", top: 84 }}>
                <div className="card">
                  <p className="field-label">1. Целевой формат (Пресеты)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                    {PRESETS.map(p => (
                      <button key={p.id} className={`btn-action ${presetAction === p.id ? "active" : ""}`} onClick={() => setPresetAction(p.id)} style={{ textAlign: "left", height: "100%", padding: 16 }}>
                        <div style={{ fontSize: 18, marginBottom: 8 }}>{p.icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>{p.desc}</div>
                      </button>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={handleImprove} disabled={loading || !globalText.trim()} style={{ marginBottom: 24 }}>
                    {loading ? "Генерация..." : "Сделать красиво"}
                  </button>
                  <p className="field-label">2. Исходный текст</p>
                  <textarea className="inp" rows={10} value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="Вставьте текст для обработки..." />
                </div>
              </div>

              <div className="stack">
                {loading && <ProgressStream steps={LOADING_MSGS.improve} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
                {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
                {!loading && !improveResult && !error && (
                  <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>
                    <div style={{ fontSize: 40, opacity: 0.15, marginBottom: 16 }}>✨</div>
                    <p>Выберите целевой формат и нажмите кнопку для применения профиля рынка.</p>
                  </div>
                )}

                {!loading && improveResult && (
                  <>
                    <div className="card" style={{ borderLeft: "5px solid var(--orange)", padding: 32 }}>
                      <div style={{ display: "inline-flex", padding: "8px 16px", background: "var(--orange-a)", color: "var(--orange-d)", borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
                        ✓ {improveResult.tone_achieved}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.8, color: "var(--t1)" }}>{improveResult.improved_local}</div>
                    </div>
                    <div className="card">
                      <p className="field-label">Лог изменений</p>
                      <div className="stack">
                        {improveResult.changes?.map((c, i) => (
                          <div key={i} style={{ padding: 16, background: "var(--bg)", borderRadius: 10, borderLeft: "4px solid var(--violet)" }}>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{c.what}</div>
                            <div style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.5 }}>{c.why}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
