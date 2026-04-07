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
interface UrlStatus { type: "success" | "error"; message: string; domain?: string; charCount?: number; truncated?: boolean; }

// ── Константы ─────────────────────────────────────────────────────────────────
const MARKETS: Record<MarketKey, { labelRu: string; flag: string; desc: string }> = {
  germany: { labelRu: "Германия",  flag: "🇩🇪", desc: "Формальный · Точный · Процессный" },
  poland:  { labelRu: "Польша",    flag: "🇵🇱", desc: "Прямой · Фактический · Прозрачный" },
  brazil:  { labelRu: "Бразилия",  flag: "🇧🇷", desc: "Тёплый · Человечный · Доверительный" },
};

const STEPS: Record<StepKey, { num: string; label: string }> = {
  search:   { num: "01", label: "Поиск" },
  evaluate: { num: "02", label: "Проверка" },
  improve:  { num: "03", label: "Улучшение" },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string; }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально" },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как импорт" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Звучит чужеродно" },
};

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Сканирую деловые СМИ...", "Анализирую сигналы через RAG...", "Формирую дайджест..."],
  evaluate: ["Проверяю культурный код...", "Ищу сигналы доверия...", "Считаю индекс шаблонности...", "Генерирую правки..."],
  improve:  ["Применяю профиль рынка...", "Переписываю под аудиторию...", "Полирую нативный тон..."],
};

// ── Стили (сжаты для удобства) ────────────────────────────────────────────────
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
:root { --violet:#7C3AED; --violet-d:#6D28D9; --violet-a:rgba(124,58,237,0.1); --lime:#84CC16; --lime-a:rgba(132,204,22,0.12); --lime-d:#65A30D; --orange:#F97316; --orange-d:#EA6C0A; --orange-a:rgba(249,115,22,0.1); --red:#EF4444; --sky-a:rgba(14,165,233,0.08); --sky-b:rgba(14,165,233,0.2); --bg:#F1F5F9; --surface:#FFFFFF; --t1:#0F172A; --t2:#475569; --t3:#94A3B8; --border:rgba(15,23,42,0.1); --border-xs:rgba(15,23,42,0.05); --r:14px; --r-sm:10px; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--t1); -webkit-font-smoothing: antialiased; }
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 200px; background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
.logo { display: flex; align-items: center; gap: 9px; font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; margin-bottom: 28px; }
.logo-mark { width: 26px; height: 26px; background: var(--lime); border-radius: 6px; display: grid; place-items: center; font-size: 13px; color: #1a2e05; }
.sb-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--t3); margin-bottom: 6px; padding-left: 2px; }
.nav-btn { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border: none; border-radius: 9px; background: transparent; cursor: pointer; width: 100%; text-align: left; transition: 0.15s; }
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); color: var(--violet); }
.nav-num { width: 20px; height: 20px; border-radius: 5px; background: var(--bg); font-size: 9px; font-weight: 800; display: grid; place-items: center; font-family: 'Syne'; }
.nav-btn.active .nav-num { background: var(--violet); color: white; }
.nav-label { font-size: 12px; font-weight: 600; color: var(--t2); }
.nav-btn.active .nav-label { font-weight: 700; color: var(--violet); }
.sb-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-xs); font-size: 10px; color: var(--t3); }
.main { flex: 1; display: flex; flex-direction: column; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; position: sticky; top: 0; z-index: 20; }
.tab-pills { display: flex; gap: 4px; background: var(--bg); padding: 3px; border-radius: 10px; }
.tab-pill { display: flex; gap: 6px; padding: 6px 12px; border: none; border-radius: 7px; background: transparent; font-size: 12px; font-weight: 600; color: var(--t3); cursor: pointer; }
.tab-pill.active { background: var(--surface); color: var(--violet); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.tab-pill-num { width: 16px; height: 16px; border-radius: 4px; background: var(--bg); font-size: 8px; font-weight: 800; display: grid; place-items: center; }
.tab-pill.active .tab-pill-num { background: var(--violet); color: white; }
.page { padding: 28px 28px 40px; max-width: 1100px; margin: 0 auto; width: 100%; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
.field-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--t3); margin-bottom: 10px; display: block; }
.market-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.market-card { padding: 16px; border: 2px solid var(--border-xs); border-radius: var(--r); background: var(--surface); cursor: pointer; text-align: center; transition: 0.15s; }
.market-card:hover { border-color: var(--border); transform: translateY(-2px); }
.market-card.active { border-color: var(--lime); background: var(--lime-a); }
.market-card-flag { font-size: 32px; display: block; }
.market-card-name { font-family: 'Syne'; font-size: 15px; font-weight: 700; margin-top: 8px; }
.market-card-desc { font-size: 11px; color: var(--t3); }
.btn-search { width: 100%; padding: 15px; background: var(--orange); color: #fff; border: none; border-radius: var(--r-sm); font-size: 15px; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; }
.btn-search:hover:not(:disabled) { background: var(--orange-d); }
.btn-primary { width: 100%; padding: 13px; background: var(--violet); color: #fff; border: none; border-radius: var(--r-sm); font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 14px; display: flex; justify-content: center; align-items: center; gap: 8px; }
.btn-ghost { padding: 8px 14px; border: 1px solid var(--border); background: transparent; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--t2); cursor: pointer; }
.news-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 28px; }
.news-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.news-category { padding: 3px 9px; background: var(--violet-a); color: var(--violet); font-size: 10px; font-weight: 700; border-radius: 5px; text-transform: uppercase; }
.news-headline { font-family: 'Syne'; font-size: 14px; font-weight: 700; }
.news-summary { font-size: 12px; color: var(--t2); flex: 1; }
.news-impact { font-size: 12px; background: var(--bg); border-left: 3px solid var(--orange); padding: 9px 12px; border-radius: 8px; }
.split { display: grid; gap: 24px; grid-template-columns: 340px 1fr; align-items: start; }
.inp { width: 100%; padding: 13px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 13px; outline: none; }
.loader { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; gap: 14px; color: var(--t2); }
.spinner { width: 30px; height: 30px; border: 3px solid var(--border); border-top-color: var(--violet); border-radius: 50%; animation: spin 0.75s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; text-align: center; color: var(--t3); }
.mode-tabs { display: flex; background: var(--bg); padding: 4px; border-radius: var(--r-sm); margin-bottom: 14px; }
.mode-tab { flex: 1; padding: 7px; border: none; background: transparent; font-size: 12px; font-weight: 600; color: var(--t3); cursor: pointer; }
.mode-tab.active { background: var(--surface); color: var(--t1); box-shadow: 0 1px 4px rgba(0,0,0,0.08); border-radius: 7px; }
.url-inp { width: 100%; padding: 11px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-size: 13px; }
.verdict-banner { display: flex; gap: 14px; padding: 15px; border-radius: var(--r); border: 1.5px solid; margin-bottom: 14px; align-items: center; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tone-row { display: flex; flex-direction: column; margin-bottom: 12px; }
.tone-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: var(--t2); text-transform: uppercase; }
.tone-track { height: 5px; background: var(--bg); position: relative; border-radius: 9px; margin-top: 4px; }
.tone-dot { position: absolute; width: 12px; height: 12px; background: var(--violet); border-radius: 50%; top: -3.5px; border: 2px solid #fff; }
.rw-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; }
.improve-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.improve-tab { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); background: transparent; font-size: 12px; font-weight: 600; cursor: pointer; }
.improve-tab.active { background: var(--violet); color: #fff; border-color: var(--violet); }
`;

export default function BreasonApp() {
  const [step, setStep] = useState<StepKey>("search");
  const [market, setMarket] = useState<MarketKey>("germany");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [newsItems, setNewsItems] = useState<NewsItem[] | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);

  const [evalText, setEvalText] = useState(DEFAULT_COPY);
  const [improveText, setImproveText] = useState("");
  const [improveCtx, setImproveCtx] = useState("");
  const [improveTab, setImproveTab] = useState<"en" | "local">("local");

  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadMsg(m => (m + 1) % LOADING_MSGS[step].length), 2200);
    return () => clearInterval(id);
  }, [loading, step]);

  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    try {
      const res = await fetch("/api/fetch-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data.text) setEvalText(data.text);
      else alert(data.error || "Ошибка парсинга");
    } catch {
      alert("Сетевая ошибка при парсинге.");
    } finally { setUrlLoading(false); }
  }, [urlInput]);

  const handleSearch = useCallback(async () => {
    setLoading(true); setLoadMsg(0); setError(null);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setNewsItems(data.items || []);
    } catch { setError("Ошибка сети."); }
    finally { setLoading(false); }
  }, [market]);

  const handleEvaluate = useCallback(async () => {
    if (!evalText.trim()) return;
    setLoading(true); setLoadMsg(0); setError(null);
    try {
      const res = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", text: evalText.trim(), market }),
      });
      const data = await res.json();
      if (data.verdict) setEvalResult(data);
      else setError("Некорректный ответ ИИ.");
    } catch { setError("Ошибка сети."); }
    finally { setLoading(false); }
  }, [evalText, market]);

  const handleImprove = useCallback(async () => {
    const src = improveText.trim() || evalText.trim();
    if (!src) return;
    setLoading(true); setLoadMsg(0); setError(null);
    try {
      const res = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "improve", text: src, market, context: improveCtx }),
      });
      const data = await res.json();
      if (data.improved_text) setImproveResult(data);
      else setError("Некорректный ответ ИИ.");
    } catch { setError("Ошибка сети."); }
    finally { setLoading(false); }
  }, [improveText, improveCtx, evalText, market]);

  const renderToneBar = (labelL: string, labelR: string, val: number) => (
    <div className="tone-row">
      <div className="tone-labels"><span>{labelL}</span><span>{labelR}</span></div>
      <div className="tone-track">
        <div style={{ position: 'absolute', left: '50%', height: '100%', width: 1, background: 'var(--border)' }} />
        <div className="tone-dot" style={{ left: `${((val + 5) / 10) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="shell">
      <style>{STYLE}</style>

      <aside className="sidebar">
        <div className="logo"><div className="logo-mark">B</div> Breason</div>
        <p className="sb-label">Навигация</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => { setStep(key); setError(null); }}>
              <div className="nav-num">{s.num}</div>
              <div className="nav-label">{s.label}</div>
            </button>
          ))}
        </div>
        <div className="sb-footer">v2.1<br/><span style={{ opacity: 0.5 }}>from pavel with love</span></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="tab-pills">
            {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
              <button key={key} className={`tab-pill ${step === key ? "active" : ""}`} onClick={() => setStep(key)}>
                <span className="tab-pill-num">{s.num}</span>{s.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>{MARKETS[market].flag} {MARKETS[market].labelRu}</div>
        </header>

        <main className="page">
          {step === "search" && (
            <div>
              <div className="market-selector">
                {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
                  <button key={key} className={`market-card ${market === key ? "active" : ""}`} onClick={() => setMarket(key)}>
                    <span className="market-card-flag">{m.flag}</span>
                    <div className="market-card-name">{m.labelRu}</div>
                    <div className="market-card-desc">{m.desc}</div>
                  </button>
                ))}
              </div>
              <button className="btn-search" onClick={handleSearch} disabled={loading}>
                {loading ? "Формирование дайджеста..." : `Получить инсайты — ${MARKETS[market].labelRu}`}
              </button>
              {loading && <div className="loader"><div className="spinner" />{LOADING_MSGS.search[loadMsg]}</div>}
              {!loading && newsItems && (
                <div className="news-grid">
                  {newsItems.map((item, i) => (
                    <div className="news-card" key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="news-category">{item.category}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lime-d)' }}>Резонанс: {item.resonance_score}</span>
                      </div>
                      <div className="news-headline">{item.headline}</div>
                      <div className="news-summary">{item.summary}</div>
                      <div className="news-impact"><strong>B2B Влияние:</strong><br/>{item.business_impact}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "evaluate" && (
            <div className="split">
              <div className="card" style={{ position: 'sticky', top: 60 }}>
                <div className="mode-tabs">
                  <button className={`mode-tab ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")}>Текст</button>
                  <button className={`mode-tab ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")}>URL</button>
                </div>
                {inputMode === "url" && (
                  <div style={{ marginBottom: 14 }}>
                    <p className="field-label">Адрес страницы</p>
                    <input className="url-inp" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://..." />
                    <button className="btn-ghost" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={handleFetchUrl} disabled={urlLoading}>
                      {urlLoading ? "Извлекаю..." : "Извлечь контент"}
                    </button>
                  </div>
                )}
                <p className="field-label">Ваш текст</p>
                <textarea className="inp" rows={9} value={evalText} onChange={e => setEvalText(e.target.value)} />
                <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !evalText}>
                  {loading ? "Аудит..." : `Проверить для ${MARKETS[market].labelRu}`}
                </button>
                {evalResult && <button className="btn-ghost" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }} onClick={() => setStep("improve")}>Улучшить текст →</button>}
              </div>

              <div>
                {loading && <div className="loader"><div className="spinner" />{LOADING_MSGS.evaluate[loadMsg]}</div>}
                {!loading && evalResult && (() => {
                  const vc = VERDICT_CFG[evalResult.verdict];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="verdict-banner" style={{ background: vc.bg, borderColor: vc.border, color: vc.color }}>
                        <div style={{ fontSize: 24 }}>{vc.icon}</div>
                        <div>
                          <h3 style={{ fontFamily: 'Syne', margin: 0 }}>{evalResult.verdict}</h3>
                          <p style={{ margin: 0, fontSize: 14 }}>{evalResult.verdict_reason}</p>
                        </div>
                      </div>
                      <div className="grid2">
                        <div className="card" style={{ margin: 0 }}>
                          <p className="field-label">Карта тона</p>
                          {renderToneBar("Форм.", "Неформ.", evalResult.tone_map.formal_casual)}
                          {renderToneBar("Дерзкий", "Осторож.", evalResult.tone_map.bold_cautious)}
                          {renderToneBar("Тех.", "Польза", evalResult.tone_map.technical_benefit)}
                          {renderToneBar("Абстр.", "Конкр.", evalResult.tone_map.abstract_concrete)}
                          {renderToneBar("Импорт", "Натив", evalResult.tone_map.global_native)}
                        </div>
                        <div className="card" style={{ margin: 0 }}>
                          <p className="field-label">Индекс клише: {evalResult.genericness_score}/100</p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                            {evalResult.generic_phrases.map((p, i) => <span key={i} style={{ background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{p}</span>)}
                          </div>
                          <p className="field-label">Пропущено доверие</p>
                          <ul style={{ listStyle: 'none', fontSize: 12, color: 'var(--t2)', padding: 0 }}>
                            {evalResult.missing_trust_signals.map((s, i) => <li key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-xs)' }}>✕ {s}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div>
                        <p className="field-label">Рекомендации по замене</p>
                        {evalResult.rewrites.map((rw, i) => (
                          <div className="rw-card" key={i}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', marginBottom: 8 }}>{rw.block}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <div style={{ background: 'var(--surface)', padding: 10, borderRadius: 6, fontSize: 13, border: '1px solid var(--border)' }}>{rw.original}</div>
                              <div style={{ background: 'var(--violet-a)', padding: 10, borderRadius: 6, fontSize: 13, border: '1px solid rgba(124,58,237,0.2)', color: 'var(--violet)' }}>{rw.suggested_local}</div>
                            </div>
                            <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--t3)', marginTop: 8 }}>💡 {rw.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {step === "improve" && (
            <div className="split">
              <div className="card" style={{ position: 'sticky', top: 60 }}>
                <p className="field-label">Текст</p>
                <textarea className="inp" rows={7} value={improveText || evalText} onChange={e => setImproveText(e.target.value)} />
                <p className="field-label" style={{ marginTop: 14 }}>Контекст</p>
                <textarea className="inp" rows={3} value={improveCtx} onChange={e => setImproveCtx(e.target.value)} />
                <button className="btn-primary" onClick={handleImprove} disabled={loading || !evalText}>
                  {loading ? "Переписываю..." : `Адаптировать под ${MARKETS[market].labelRu}`}
                </button>
              </div>

              <div>
                {loading && <div className="loader"><div className="spinner" />{LOADING_MSGS.improve[loadMsg]}</div>}
                {!loading && improveResult && (
                  <div>
                    <div style={{ background: 'rgba(132,204,22,0.1)', color: '#3F6212', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'inline-block', marginBottom: 16 }}>✓ {improveResult.tone_achieved}</div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div className="improve-tabs" style={{ padding: '16px 16px 0', marginBottom: 0 }}>
                        <button className={`improve-tab ${improveTab === "local" ? "active" : ""}`} onClick={() => setImproveTab("local")}>{MARKETS[market].flag} Локально</button>
                        <button className={`improve-tab ${improveTab === "en" ? "active" : ""}`} onClick={() => setImproveTab("en")}>Английский</button>
                      </div>
                      <div style={{ padding: 20, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {improveTab === "local" ? improveResult.improved_local : improveResult.improved_text}
                      </div>
                    </div>
                    <div style={{ marginTop: 24 }}>
                      <p className="field-label">Лог изменений</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {improveResult.changes.map((c, i) => (
                          <div key={i} style={{ background: 'var(--surface)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--violet)', borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{c.what}</div>
                            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>{c.why}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
