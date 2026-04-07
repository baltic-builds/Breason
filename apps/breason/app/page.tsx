"use client";

import { useState, useEffect, useCallback } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey   = "germany" | "poland" | "brazil";
type StepKey     = "search" | "evaluate" | "improve";
type VerdictType = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode   = "text" | "url";

interface NewsItem { headline: string; category: string; summary: string; business_impact: string; resonance_score: number; }
interface ToneMap { formal_casual: number; bold_cautious: number; technical_benefit: number; abstract_concrete: number; global_native: number; }
interface Rewrite { block: string; original: string; suggested: string; suggested_local: string; reason: string; }
interface EvaluateResult { verdict: VerdictType; verdict_reason: string; genericness_score: number; generic_phrases: string[]; tone_map: ToneMap; missing_trust_signals: string[]; trend_context: string; rewrites: Rewrite[]; brief_text: string; }
interface ImproveResult { improved_text: string; improved_local: string; changes: { what: string; why: string }[]; tone_achieved: string; }

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

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string; }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально" },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как перевод" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Чужеродный контент" },
};

// Конфиг пресетов
const PRESETS = [
  { id: "icebreaker", icon: "🧊", label: "Icebreaker", desc: "Холодное письмо / LinkedIn" },
  { id: "thought_leader", icon: "💡", label: "Thought Leader", desc: "Вовлекающий пост" },
  { id: "landing_page", icon: "📄", label: "Landing Page", desc: "Блок для сайта" },
  { id: "follow_up", icon: "👋", label: "Gentle Nudge", desc: "Фоллоу-ап после встречи" },
  { id: "standard", icon: "🪄", label: "Стандартная редактура", desc: "Улучшить тон по профилю" }
];

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Смотрим рынок...", "Опрашиваем экспертов...", "Звоним инсайдерам...", "Готовим ответ..."],
  evaluate: ["Анализируем культурный код...", "Ищем сигналы доверия...", "Считаем индекс клише...", "Генерируем советы..."],
  improve:  ["Применяем профиль рынка...", "Вплетаем тренды...", "Переписываем текст...", "Полируем нативный тон..."],
};

const FUNNY_QUOTES = [
  "Работайте на скупого, он платит дважды",
  "Встречайтесь со стоматологом. Это выгодно",
  "Не хватает на отпуск? Отдыхайте на работе",
  "Если хотите удвоить деньги, то сложите их пополам",
  "Зарабатывайте больше, и доход вырастет",
  "Если на карте нет денег, то платите наличными",
  "Тратьте деньги с умом: сначала чужие, а только потом – свои"
];

// ── Стили ─────────────────────────────────────────────────────────────────────
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
:root { --violet: #7C3AED; --violet-d: #6D28D9; --violet-a: rgba(124,58,237,0.1); --lime: #84CC16; --lime-a: rgba(132,204,22,0.12); --lime-d: #65A30D; --orange: #F97316; --orange-d: #EA6C0A; --orange-a: rgba(249,115,22,0.1); --red: #EF4444; --sky-a: rgba(14,165,233,0.08); --sky-b: rgba(14,165,233,0.2); --bg: #F1F5F9; --surface: #FFFFFF; --t1: #0F172A; --t2: #475569; --t3: #94A3B8; --border: rgba(15,23,42,0.1); --border-xs: rgba(15,23,42,0.05); --r: 14px; --r-sm: 10px; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--t1); line-height: 1.5; }
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 10; }
.logo { display: flex; align-items: center; gap: 9px; font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; color: var(--t1); margin-bottom: 28px; cursor: pointer; transition: opacity 0.2s; }
.logo:hover { opacity: 0.8; }
.logo-mark { width: 26px; height: 26px; background: var(--lime); border-radius: 6px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #1a2e05; }
.nav-btn { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border: none; border-radius: 9px; background: transparent; cursor: pointer; width: 100%; text-align: left; font-family: inherit; transition: 0.15s; margin-bottom: 4px; }
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }
.nav-num { width: 20px; height: 20px; border-radius: 5px; background: var(--bg); font-size: 9px; font-weight: 800; color: var(--t3); display: grid; place-items: center; font-family: 'Syne', sans-serif; }
.nav-btn.active .nav-num { background: var(--violet); color: white; }
.nav-label { font-size: 12px; font-weight: 600; color: var(--t2); }
.nav-btn.active .nav-label { color: var(--violet); font-weight: 700; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 56px; display: flex; align-items: center; padding: 0 28px; position: sticky; top: 0; z-index: 20; justify-content: space-between; }
.page { flex: 1; padding: 28px; max-width: 1200px; width: 100%; margin: 0 auto; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
.field-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); margin-bottom: 10px; }
.market-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.market-card { padding: 16px; border: 2px solid var(--border-xs); border-radius: var(--r); background: var(--surface); cursor: pointer; text-align: center; transition: 0.15s; font-family: inherit; }
.market-card:hover { border-color: var(--border); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.market-card.active { border-color: var(--lime); background: var(--lime-a); box-shadow: 0 4px 16px rgba(132,204,22,0.15); }
.market-card-flag { font-size: 32px; display: block; margin-bottom: 8px; }
.market-card-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--t1); margin-bottom: 4px; }
.market-card-desc { font-size: 11px; color: var(--t3); line-height: 1.4; }
.btn-primary { width: 100%; padding: 14px; background: var(--orange); color: #fff; border: none; border-radius: var(--r-sm); font-size: 14px; font-weight: 700; cursor: pointer; transition: 0.15s; display: flex; justify-content: center; align-items: center; gap: 8px; }
.btn-primary:hover:not(:disabled) { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,0.25); }
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; }
.btn-action { padding: 12px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--t1); cursor: pointer; transition: 0.15s; }
.btn-action:hover { background: var(--bg); border-color: var(--violet); color: var(--violet); }
.btn-action.active { background: var(--violet-a); color: var(--violet); border-color: var(--violet); }
.inp { width: 100%; padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 13px; line-height: 1.65; color: var(--t1); resize: vertical; outline: none; transition: 0.15s; min-height: 100px; }
.inp:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px var(--violet-a); }
.split { display: grid; gap: 24px; grid-template-columns: 380px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.news-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; display: flex; flex-direction: column; gap: 12px; transition: 0.2s; }
.news-card:hover { border-color: var(--violet); box-shadow: 0 8px 24px rgba(124,58,237,0.08); }
.news-headline { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--t1); line-height: 1.3; }
.news-summary { font-size: 13px; color: var(--t2); line-height: 1.6; }
.context-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--lime-a); border: 1px solid var(--lime); color: var(--lime-d); border-radius: 99px; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
.sticky-footer { position: sticky; bottom: 0; padding: 16px 0; background: linear-gradient(transparent, var(--bg) 20%); margin-top: 24px; display: flex; justify-content: flex-end; z-index: 10; }
.btn-sticky { background: var(--t1); color: #fff; padding: 14px 28px; border-radius: 99px; font-weight: 700; font-size: 14px; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.2); transition: 0.2s; display: flex; align-items: center; gap: 8px; }
.btn-sticky:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }

/* Streaming Loader & Typography */
.stream-loader { font-family: monospace; font-size: 13px; color: var(--violet); background: var(--violet-a); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
.stream-line { display: flex; align-items: center; gap: 8px; animation: fadeIn 0.3s ease-out; }
.blink { animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }

/* Score & Tone Map */
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
`;

const ProgressStream = ({ steps, activeIdx, quoteIdx }: { steps: string[], activeIdx: number, quoteIdx: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
    <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: 13, color: 'var(--t3)' }}>
      💡 {FUNNY_QUOTES[quoteIdx]}
    </div>
  </div>
);

export default function BreasonApp() {
  const [step, setStep] = useState<StepKey>("search");
  const [market, setMarket] = useState<MarketKey>("germany");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  
  const [globalText, setGlobalText] = useState(DEFAULT_COPY);
  
  // Храним весь объект тренда для передачи в промпты
  const [selectedTrend, setSelectedTrend] = useState<NewsItem | null>(null);
  const [presetAction, setPresetAction] = useState<string>("standard");

  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [newsItems, setNewsItems] = useState<NewsItem[] | null>(null);
  const [deepDiveData, setDeepDiveData] = useState<Record<string, string>>({});
  
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => {
    let loaderInterval: any;
    let quoteInterval: any;
    
    if (loading) {
      setLoadingStepIdx(0);
      setQuoteIdx(Math.floor(Math.random() * FUNNY_QUOTES.length));
      
      loaderInterval = setInterval(() => {
        setLoadingStepIdx((prev) => Math.min(prev + 1, 3));
      }, 1500);

      quoteInterval = setInterval(() => {
        setQuoteIdx((prev) => (prev + 1) % FUNNY_QUOTES.length);
      }, 4000);
    }
    return () => { clearInterval(loaderInterval); clearInterval(quoteInterval); }
  }, [loading]);

  const resetToHome = () => {
    setStep("search");
    setNewsItems(null);
    setEvalResult(null);
    setImproveResult(null);
    setSelectedTrend(null);
    setGlobalText(DEFAULT_COPY);
  };

  const handleFetchUrl = async () => {
    if (!urlInput) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await res.json();
      if (data.text) setGlobalText(data.text);
      else alert(data.error || "Ошибка парсинга URL");
    } catch { alert("Ошибка сети"); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setNewsItems(data.items || []);
    } catch { setError("Не удалось загрузить тренды."); }
    finally { setLoading(false); }
  };

  const handleDeepDive = async (headline: string) => {
    setDeepDiveData(prev => ({ ...prev, [headline]: "Изучаем инсайды..." }));
    try {
      const res = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deep_dive", market, trendContext: { headline } })
      });
      const data = await res.json();
      if (data.analysis) setDeepDiveData(prev => ({ ...prev, [headline]: data.analysis }));
    } catch { setDeepDiveData(prev => ({ ...prev, [headline]: "Ошибка соединения." })); }
  };

  const handleUseTrend = (item: NewsItem) => {
    setSelectedTrend(item);
    setStep("evaluate");
  };

  const handleEvaluate = async () => {
    if (!globalText.trim()) return;
    setLoading(true); setError(null); setEvalResult(null);
    try {
      const res = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", text: globalText, market, trendContext: selectedTrend }),
      });
      const data = await res.json();
      if (data.verdict) setEvalResult(data);
      else setError("ИИ вернул неполные данные.");
    } catch { setError("Ошибка при анализе контента."); }
    finally { setLoading(false); }
  };

  const handleProceedToImprove = () => {
    setStep("improve");
  };

  const handleImprove = async () => {
    setLoading(true); setError(null); setImproveResult(null);
    try {
      const res = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "improve", 
          text: globalText, 
          market, 
          trendContext: selectedTrend,
          preset: presetAction
        }),
      });
      const data = await res.json();
      if (data.improved_text) setImproveResult(data);
      else setError("Не удалось сгенерировать текст. Возможно, превышен лимит API.");
    } catch { setError("Ошибка генерации."); }
    finally { setLoading(false); }
  };

  const handleCheckAgain = () => {
    if (improveResult?.improved_local) {
      setGlobalText(improveResult.improved_local);
      setImproveResult(null);
      setEvalResult(null);
      setStep("evaluate");
    }
  };

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

  const renderStepSearch = () => (
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
          {loading ? "Анализ рынка..." : `Собрать инсайты — ${MARKETS[market].labelRu}`}
        </button>
      </div>

      {loading && <ProgressStream steps={LOADING_MSGS.search} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
      {!loading && error && <div style={{ color: 'var(--red)' }}>{error}</div>}

      {!loading && newsItems && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {newsItems.map((item, i) => (
            <div className="news-card" key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--violet)', background: 'var(--violet-a)', padding: '4px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{item.category}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lime-d)' }}>Резонанс: {item.resonance_score}/100</span>
              </div>
              <h3 className="news-headline">{item.headline}</h3>
              <p className="news-summary">{item.summary}</p>
              
              {deepDiveData[item.headline] && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--t2)', borderLeft: '3px solid var(--violet)' }}>
                  {deepDiveData[item.headline]}
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-xs)', display: 'flex', gap: 8 }}>
                <button className="btn-action" style={{ flex: 1, padding: '10px 8px', fontSize: 11 }} onClick={() => handleUseTrend(item)}>
                  → Мой текст под тренд
                </button>
                <button className="btn-action" style={{ flex: 1, padding: '10px 8px', fontSize: 11 }} onClick={() => handleDeepDive(item.headline)}>
                  🔍 Узнать больше
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStepEvaluate = () => (
    <div className="split">
      <div className="stack" style={{ position: 'sticky', top: 80 }}>
        <div className="card">
          <p className="field-label">Контекст проверки</p>
          {selectedTrend ? (
            <div className="context-pill">🎯 Тренд: {selectedTrend.headline.length > 30 ? selectedTrend.headline.slice(0,30) + "..." : selectedTrend.headline} <span style={{cursor:'pointer', marginLeft: 4}} onClick={()=>setSelectedTrend(null)}>✕</span></div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>Без привязки к тренду. Общая оценка.</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className={`btn-action ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")} style={{ flex: 1 }}>Текст</button>
            <button className={`btn-action ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")} style={{ flex: 1 }}>URL</button>
          </div>

          {inputMode === "url" && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="inp" style={{ minHeight: 'auto', padding: '10px', flex: 1, margin: 0 }} placeholder="https://" value={urlInput} onChange={e=>setUrlInput(e.target.value)} />
              <button className="btn-action" onClick={handleFetchUrl} disabled={loading}>Парсить</button>
            </div>
          )}

          <p className="field-label">Ваш маркетинговый контент</p>
          <textarea className="inp" value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="Вставьте текст для проверки..." />
          
          <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !globalText.trim()} style={{ marginTop: 16 }}>
            {loading ? "Аудит контента..." : `Оценить для ${MARKETS[market].labelRu}`}
          </button>
        </div>
      </div>

      <div className="stack">
        {loading && <ProgressStream steps={LOADING_MSGS.evaluate} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
        {!loading && error && <div style={{ color: 'var(--red)' }}>{error}</div>}
        
        {!loading && !evalResult && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }}>◈</div>
            <p>Вставьте текст слева и нажмите «Оценить», чтобы увидеть детальный аудит по рынку {MARKETS[market].labelRu}.</p>
          </div>
        )}

        {!loading && evalResult && (() => {
          const vc = VERDICT_CFG[evalResult.verdict];
          return (
            <>
              <div className="card" style={{ background: vc.bg, borderColor: vc.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', display: 'grid', placeItems: 'center', fontSize: 24, color: vc.color, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>{vc.icon}</div>
                  <div>
                    <h2 style={{ fontFamily: 'Syne', fontSize: 22, color: vc.color, margin: 0, lineHeight: 1 }}>{evalResult.verdict}</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{evalResult.verdict_reason}</p>
                  </div>
                </div>
              </div>

              <div className="grid2">
                <div className="card">
                  <p className="field-label">Карта тона (Tone Map)</p>
                  {renderToneBar("Формальный", "Кэжуал", evalResult.tone_map.formal_casual)}
                  {renderToneBar("Дерзкий", "Осторожный", evalResult.tone_map.bold_cautious)}
                  {renderToneBar("Технический", "Про пользу", evalResult.tone_map.technical_benefit)}
                  {renderToneBar("Абстрактный", "Конкретный", evalResult.tone_map.abstract_concrete)}
                  {renderToneBar("Перевод", "Нативный", evalResult.tone_map.global_native)}
                </div>

                <div className="stack">
                  <div className="card">
                    <p className="field-label">Индекс клише (Genericness)</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: evalResult.genericness_score > 60 ? 'var(--red)' : 'var(--lime-d)' }}>{evalResult.genericness_score}</span>
                      <span style={{ fontSize: 14, color: 'var(--t3)' }}>/100</span>
                    </div>
                    <div>
                      {evalResult.generic_phrases?.map((p, i) => <span key={i} className="badge">"{p}"</span>)}
                    </div>
                  </div>

                  <div className="card">
                    <p className="field-label">Красные флаги & Доверие</p>
                    {evalResult.missing_trust_signals?.map((s, i) => (
                      <div key={i} className="trust-item">✕ {s}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="field-label">Точечные рекомендации (Rewrites)</p>
                {evalResult.rewrites?.map((rw, i) => (
                  <div key={i} className="rw-card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{rw.block}</div>
                    <div className="grid2" style={{ gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Оригинал</div>
                        <div className="rw-block">{rw.original}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--violet)', fontWeight: 700, marginBottom: 4 }}>Локально ({MARKETS[market].flag})</div>
                        <div className="rw-block local">{rw.suggested_local}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--t2)', fontStyle: 'italic', marginTop: 8 }}>💡 {rw.reason}</div>
                  </div>
                ))}
              </div>

              <div className="sticky-footer">
                <button className="btn-sticky" onClick={handleProceedToImprove}>
                  ✨ Улучшить с учётом этих правок →
                </button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  const renderStepImprove = () => (
    <div className="split">
      <div className="stack" style={{ position: 'sticky', top: 80 }}>
        <div className="card">
          <p className="field-label">Целевой формат (Пресеты)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {PRESETS.map(p => (
              <button 
                key={p.id} 
                className={`btn-action ${presetAction === p.id ? "active" : ""}`} 
                onClick={() => setPresetAction(p.id)} 
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, height: '100%', padding: '10px' }}
              >
                <div style={{ fontWeight: 700 }}>{p.icon} {p.label}</div>
                <div style={{ fontSize: 10, opacity: presetAction === p.id ? 0.9 : 0.6 }}>{p.desc}</div>
              </button>
            ))}
          </div>

          <p className="field-label">Текст для ИИ-редактуры</p>
          <textarea className="inp" rows={8} value={globalText} onChange={e => setGlobalText(e.target.value)} />
          
          <button className="btn-primary" onClick={handleImprove} disabled={loading || !globalText.trim()} style={{ marginTop: 16 }}>
            {loading ? "Генерация..." : "🪄 Применить магию ИИ"}
          </button>
        </div>
      </div>

      <div className="stack">
        {loading && <ProgressStream steps={LOADING_MSGS.improve} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
        {!loading && error && <div style={{ color: 'var(--red)' }}>{error}</div>}
        
        {!loading && !improveResult && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 16 }}>✨</div>
            <p>Выберите формат и нажмите кнопку. ИИ перепишет ваш текст, вплетая в него инсайты рынка.</p>
          </div>
        )}

        {!loading && improveResult && (
          <>
            <div className="card" style={{ background: 'var(--surface)', borderLeft: '4px solid var(--lime)' }}>
              <div style={{ display: 'inline-flex', padding: '6px 12px', background: 'var(--lime-a)', color: 'var(--lime-d)', borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                ✓ {improveResult.tone_achieved}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.7, color: 'var(--t1)' }}>
                {improveResult.improved_local}
              </div>
            </div>

            <div className="card">
              <p className="field-label">Лог изменений (Self-Healing)</p>
              <div className="stack">
                {improveResult.changes?.map((change, i) => (
                  <div key={i} style={{ padding: 16, background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--violet)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{change.what}</div>
                    <div style={{ fontSize: 13, color: 'var(--t2)' }}>{change.why}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky-footer">
              <button className="btn-sticky" style={{ background: 'var(--surface)', color: 'var(--t1)', border: '1px solid var(--border)' }} onClick={handleCheckAgain}>
                ↻ Проверить заново (Увидеть прогресс)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="shell">
      <style>{STYLE}</style>
      
      <aside className="sidebar">
        <div className="logo" onClick={resetToHome}>
          <div className="logo-mark">B</div> Breason
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => setStep(key)}>
              <div className="nav-num">{s.num}</div>
              <div className="nav-label">{s.label}</div>
            </button>
          ))}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
            Breason <span style={{ margin: '0 8px', color: 'var(--border)' }}>/</span> {STEPS[step].label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
            <span style={{ fontSize: 18 }}>{MARKETS[market].flag}</span> {MARKETS[market].labelRu}
          </div>
        </header>

        <main className="page">
          {step === "search" && renderStepSearch()}
          {step === "evaluate" && renderStepEvaluate()}
          {step === "improve" && renderStepImprove()}
        </main>
      </div>
    </div>
  );
}
