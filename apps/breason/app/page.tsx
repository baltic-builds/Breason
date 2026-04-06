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

/* ─── СТИЛИ (Полная версия) ────────────────────────────────────────────── */
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
.badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: var(--bg); margin-right: 8px; }
`;

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState("");
  const [deepDive, setDeepDive] = useState<Record<string, string>>({});

  /* ─── LOGIC: STEP 1 (SEARCH) ─── */
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
    setDeepDive(prev => ({ ...prev, [trendName]: "Загрузка глубокой аналитики..." }));
    const res = await fetch(`/api/resonance-trends?market=${market}&trend=${encodeURIComponent(trendName)}`);
    const data = await res.json();
    setDeepDive(prev => ({ ...prev, [trendName]: data.detailed_analysis }));
  }

  /* ─── LOGIC: STEP 2 (EVALUATE) ─── */
  async function checkResonance() {
    setLoading(true); setAnalysis("");
    // Используем промпт "критики" для выбранного региона
    try {
      const res = await fetch("/api/reduck/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          providerId: "llama-3.3-70b-versatile", // Groq для скорости критики
          promptVersion: `evaluate-${market}` 
        })
      });
      // В реальном API тут будет стриминг, здесь упрощено
      setAnalysis("Этот текст звучит слишком официально для Бразилии. Добавьте личное приветствие и сократите абзацы.");
    } catch { setAnalysis("Ошибка анализа."); }
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
        <div style={{ marginTop: 'auto', fontSize: '12px', color: var('--t3') }}>
          Маркетолог: <strong>Global Mode</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>{MARKETS[market].flag} {MARKETS[market].label} <span style={{ color: '#94A3B8', margin: '0 10px' }}>/</span> {stepLabels[step]}</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sky)' }}>2026 PRO MODE</div>
        </header>

        <div className="content">
          {/* ГЛОБАЛЬНЫЙ ПЕРЕКЛЮЧАТЕЛЬ РЕГИОНОВ (Прессеты) */}
          <div className="card">
            <label className="field-label">Выберите регион для адаптации</label>
            <div className="market-grid">
              {(Object.keys(MARKETS) as MarketKey[]).map(k => (
                <div key={k} className={`mkt-box ${market === k ? 'active' : ''}`} onClick={() => setMarket(k)}>
                  <div style={{ fontSize: '24px' }}>{MARKETS[k].flag}</div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{MARKETS[k].label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '4px' }}>{MARKETS[k].hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* КОНТЕНТ ШАГОВ */}
          {step === "search" && (
            <div className="content-inner">
              <div className="hero">
                <h1>Тренды: {MARKETS[market].label} 2026</h1>
                <p>Ищем, о чем сейчас говорят в B2B секторе региона.</p>
              </div>
              <button className="btn-cta" onClick={findTrends} disabled={loading}>
                {loading ? "Сканируем рынок..." : "Найти свежие тренды"}
              </button>
              
              {trends.map((t, i) => (
                <div className="card trend-item" key={i}>
                  <h3>{t.trend_name}</h3>
                  <p style={{ margin: '8px 0', color: 'var(--violet)', fontWeight: 600 }}>{t.narrative_hook}</p>
                  <p style={{ fontSize: '14px', color: 'var(--t2)' }}>{t.market_tension}</p>
                  
                  {deepDive[t.trend_name] && (
                    <div style={{ marginTop: '15px', padding: '12px', background: '#F1F5F9', borderRadius: '8px', fontSize: '13px' }}>
                      <strong>Глубокий анализ:</strong><br/>{deepDive[t.trend_name]}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="btn-cta" style={{ height: '36px', padding: '0 15px', fontSize: '12px', background: 'var(--sky)' }} onClick={() => learnMore(t.trend_name)}>Узнать больше</button>
                    <button className="btn-cta" style={{ height: '36px', padding: '0 15px', fontSize: '12px', background: 'var(--violet)' }} onClick={() => { setText(t.trend_name); setStep("evaluate"); }}>Создать рассылку</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "evaluate" && (
            <div className="content-inner">
              <div className="hero" style={{ background: 'var(--sky)' }}>
                <h1>Проверка на Resonance</h1>
                <p>Насколько ваш текст звучит "своим" для рынка {MARKETS[market].label}?</p>
              </div>
              <div className="card">
                <label className="field-label">Ваш черновик (или текст из тренда)</label>
                <textarea className="inp" rows={10} value={text} onChange={e => setText(e.target.value)} placeholder="Вставьте текст или URL..." />
                <button className="btn-cta" onClick={checkResonance} disabled={loading || !text}>
                  {loading ? "Анализируем культурный код..." : "Проверить локальность"}
                </button>
              </div>

              {analysis && (
                <div className="card" style={{ borderLeft: '4px solid var(--orange)' }}>
                  <label className="field-label" style={{ color: 'var(--orange)' }}>Критика ({MARKETS[market].label})</label>
                  <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{analysis}</div>
                  <button className="btn-cta" style={{ marginTop: '20px' }} onClick={() => setStep("improve")}>Исправить всё автоматически</button>
                </div>
              )}
            </div>
          )}

          {step === "improve" && (
            <div className="content-inner">
               <div className="hero" style={{ background: 'var(--lime)', color: '#1a2e05' }}>
                <h1>Адаптация и Улучшение</h1>
                <p>Применяем культурные фильтры {MARKETS[market].label} к вашему тексту.</p>
              </div>
              <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="field-label">Было (Черновик)</label>
                  <div className="inp" style={{ height: '300px', overflowY: 'auto', fontSize: '13px', opacity: 0.7 }}>{text}</div>
                </div>
                <div>
                  <label className="field-label">Стало (Локализовано)</label>
                  <div className="inp" style={{ height: '300px', overflowY: 'auto', fontSize: '14px', border: '1px solid var(--lime)' }}>
                    {loading ? "Трансформируем..." : "Здесь появится финальный текст, адаптированный под менталитет " + MARKETS[market].label + "..."}
                  </div>
                </div>
              </div>
              <button className="btn-cta">Копировать готовый текст</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
