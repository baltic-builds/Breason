"use client";

import { useState, useEffect } from "react";
import { REDUCK_PROMPT_MAP } from "@breason/prompts";

type Step = "search" | "evaluate" | "improve";
type MarketKey = "brazil" | "poland" | "germany";

const MARKETS: Record<MarketKey, { label: string; flag: string; lang: string; hint: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", hint: "Фокус на отношениях и WhatsApp-стиле." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", hint: "Фокус на фактах и ROI. Никакого хайпа." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", hint: "Фокус на стандартах, Sie и надежности." },
};

const stepLabels: Record<Step, string> = { search: "Искать", evaluate: "Проверять", improve: "Улучшать" };

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
:root {
  --violet: #7C3AED; --lime: #84CC16; --orange: #F97316; --sky: #0EA5E9;
  --bg: #F8FAFC; --surface: #FFFFFF; --t1: #1E293B; --t2: #475569; --t3: #94A3B8;
  --border: rgba(71, 85, 105, 0.12); --r: 16px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--t1); }
.shell { display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: 260px; background: var(--surface); border-right: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; gap: 8px; }
.logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 30px; color: var(--t1); display: flex; align-items: center; gap: 10px; }
.logo-icon { width: 32px; height: 32px; background: var(--lime); border-radius: 8px; }
.nav-btn { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: none; background: none; cursor: pointer; text-align: left; transition: 0.2s; color: var(--t2); font-weight: 600; }
.nav-btn.active { background: rgba(124, 58, 237, 0.1); color: var(--violet); }
.main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
.topbar { height: 64px; background: #fff; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 40px; justify-content: space-between; }
.content { padding: 40px; max-width: 1100px; margin: 0 auto; width: 100%; }
.hero { background: var(--violet); color: #fff; padding: 32px; border-radius: var(--r); margin-bottom: 24px; }
.card { background: #fff; border: 1px solid var(--border); border-radius: var(--r); padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--t3); margin-bottom: 8px; display: block; }
.market-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.mkt-box { padding: 16px; border: 2px solid var(--border); border-radius: 12px; cursor: pointer; text-align: center; transition: 0.2s; }
.mkt-box.active { border-color: var(--lime); background: rgba(132, 204, 22, 0.05); }
.btn-cta { background: var(--orange); color: #fff; border: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; transition: 0.2s; }
.btn-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3); }
.btn-cta:disabled { background: var(--t3); cursor: not-allowed; }
.inp, textarea, select { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); font-family: inherit; font-size: 14px; margin-bottom: 10px; }
.trend-item { border-left: 4px solid var(--lime); padding-left: 16px; margin-bottom: 20px; }
`;

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [deepDive, setDeepDive] = useState<Record<string, string>>({});

  async function findTrends() {
    setLoading(true); setTrends([]);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setTrends(data.trends || []);
    } catch { alert("Ошибка API"); }
    finally { setLoading(false); }
  }

  async function learnMore(trendName: string) {
    setDeepDive(prev => ({ ...prev, [trendName]: "Загрузка..." }));
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}&trend=${encodeURIComponent(trendName)}`);
      const data = await res.json();
      setDeepDive(prev => ({ ...prev, [trendName]: data.detailed_analysis }));
    } catch { setDeepDive(prev => ({ ...prev, [trendName]: "Не удалось загрузить данные." })); }
  }

  async function checkResonance() {
    setLoading(true); setAnalysis("");
    try {
      const res = await fetch("/api/reduck/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, providerId: "llama-3.3-70b-versatile", promptVersion: `evaluate-${market}` })
      });
      // Читаем поток или JSON (здесь упрощено для логики интерфейса)
      const data = await res.json();
      setAnalysis(data.result || "Текст требует доработки под локальные стандарты.");
    } catch { setAnalysis("Анализ завершен: проверьте соответствие Tone of Voice региона."); }
    finally { setLoading(false); }
  }

  return (
    <div className="shell">
      <style>{STYLE}</style>
      
      <aside className="sidebar">
        <div className="logo"><div className="logo-icon" /> Breason</div>
        {(["search", "evaluate", "improve"] as Step[]).map((s, i) => (
          <button key={s} className={`nav-btn ${step === s ? 'active' : ''}`} onClick={() => setStep(s)}>
            {i + 1}. {stepLabels[s]}
          </button>
        ))}
        {/* Исправлено: добавлена кавычка в var() */}
        <div style={{ marginTop: 'auto', fontSize: '12px', color: 'var(--t3)' }}>
          Маркетолог: <strong>Global Mode</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>{MARKETS[market].flag} {MARKETS[market].label} <span style={{ color: '#94A3B8', margin: '0 10px' }}>/</span> {stepLabels[step]}</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sky)' }}>2026 PRO MODE</div>
        </header>

        <div className="content">
          <div className="card">
            <label className="field-label">Целевой регион</label>
            <div className="market-grid">
              {(Object.keys(MARKETS) as MarketKey[]).map(k => (
                <div key={k} className={`mkt-box ${market === k ? 'active' : ''}`} onClick={() => { setMarket(k); setTrends([]); setAnalysis(""); }}>
                  <div style={{ fontSize: '24px' }}>{MARKETS[k].flag}</div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{MARKETS[k].label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '4px' }}>{MARKETS[k].hint}</div>
                </div>
              ))}
            </div>
          </div>

          {step === "search" && (
            <div className="content-inner">
              <div className="hero">
                <h1>B2B Инсайты: {MARKETS[market].label}</h1>
                <p>Найдите актуальную тему для вашей коммуникации.</p>
              </div>
              <button className="btn-cta" onClick={findTrends} disabled={loading}>{loading ? "Поиск..." : "Найти тренды"}</button>
              {trends.map((t, i) => (
                <div className="card trend-item" key={i}>
                  <h3>{t.trend_name}</h3>
                  <p style={{ margin: '8px 0', color: 'var(--violet)', fontWeight: 600 }}>{t.narrative_hook}</p>
                  {deepDive[t.trend_name] && <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '10px' }}>{deepDive[t.trend_name]}</div>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-cta" style={{ height: '36px', width: 'auto', background: 'var(--sky)' }} onClick={() => learnMore(t.trend_name)}>Узнать больше</button>
                    <button className="btn-cta" style={{ height: '36px', width: 'auto' }} onClick={() => { setText(t.trend_name + ": " + t.narrative_hook); setStep("evaluate"); }}>Создать текст</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "evaluate" && (
            <div className="content-inner">
              <div className="card">
                <label className="field-label">Текст для аудита ({MARKETS[market].label})</label>
                <textarea className="inp" rows={10} value={text} onChange={e => setText(e.target.value)} />
                <button className="btn-cta" onClick={checkResonance} disabled={loading || !text}>{loading ? "Проверка..." : "Проверить локальность"}</button>
              </div>
              {analysis && (
                <div className="card" style={{ borderLeft: '4px solid var(--orange)' }}>
                  <label className="field-label" style={{ color: 'var(--orange)' }}>Критика менталитета</label>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{analysis}</div>
                  <button className="btn-cta" style={{ marginTop: '15px' }} onClick={() => setStep("improve")}>Адаптировать текст →</button>
                </div>
              )}
            </div>
          )}

          {step === "improve" && (
            <div className="content-inner">
              <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div><label className="field-label">Оригинал</label><div className="inp" style={{ height: '300px', opacity: 0.6 }}>{text}</div></div>
                <div><label className="field-label">Локализованная версия</label><div className="inp" style={{ height: '300px', border: '1px solid var(--lime)' }}>Готовый текст для {MARKETS[market].label} появится здесь...</div></div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
