"use client";

import { useState } from "react";

type Step = "search" | "evaluate" | "improve";
type MarketKey = "brazil" | "poland" | "germany";

const MARKETS: Record<MarketKey, { label: string; flag: string; hint: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", hint: "Фокус на личных отношениях и открытости." },
  poland:  { label: "Польша",    flag: "🇵🇱", hint: "Фокус на фактах и конкретных результатах." },
  germany: { label: "Германия",  flag: "🇩🇪", hint: "Фокус на надежности и официальном стиле." },
};

const STEPS: Step[] = ["search", "evaluate", "improve"];
const stepLabels: Record<Step, string> = { search: "Искать", evaluate: "Проверять", improve: "Улучшать" };

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;700&display=swap');
:root {
  --violet: #7C3AED; --lime: #84CC16; --orange: #F97316; --sky: #0EA5E9;
  --bg: #F8FAFC; --surface: #FFFFFF; --t1: #1E293B; --t2: #475569; --t3: #94A3B8;
  --border: rgba(71, 85, 105, 0.12); --r: 16px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--t1); -webkit-font-smoothing: antialiased; }
.shell { display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: 260px; background: var(--surface); border-right: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; z-index: 10; }
.logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 32px; color: var(--t1); display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 32px; height: 32px; background: var(--lime); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 800; }
.nav-btn { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: none; background: none; cursor: pointer; text-align: left; transition: 0.2s; color: var(--t2); font-weight: 600; width: 100%; margin-bottom: 4px; }
.nav-btn.active { background: rgba(124, 58, 237, 0.08); color: var(--violet); }
.main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
.topbar { height: 64px; background: #fff; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 40px; }
.content { padding: 40px; max-width: 900px; margin: 0 auto; width: 100%; }
.card { background: #fff; border: 1px solid var(--border); border-radius: var(--r); padding: 24px; margin-bottom: 24px; position: relative; }
.field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--t3); margin-bottom: 12px; display: block; letter-spacing: 0.5px; }
.market-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.mkt-box { padding: 16px; border: 2px solid var(--border); border-radius: 12px; cursor: pointer; text-align: center; transition: 0.2s; background: #fff; }
.mkt-box.active { border-color: var(--lime); background: rgba(132, 204, 22, 0.04); }
.btn-cta { background: var(--orange); color: #fff; border: none; padding: 14px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s; font-size: 14px; text-decoration: none; border: 1px solid transparent; width: 100%; }
.btn-cta:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-cta:disabled { background: var(--t3); cursor: not-allowed; }
.inp { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); font-family: inherit; font-size: 14px; outline: none; margin-bottom: 12px; }
.footer-info { margin-top: auto; padding-top: 20px; font-size: 11px; color: var(--t3); line-height: 1.6; }
.score-badge { position: absolute; top: 24px; right: 24px; background: rgba(132, 204, 22, 0.1); color: var(--lime); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
.trend-card { border-left: 4px solid var(--lime); }
`;

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setTrends(data.trends || []);
    } catch (e) {
      alert("Ошибка загрузки трендов");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell">
      <style>{STYLE}</style>
      
      <aside className="sidebar">
        <div className="logo"><div className="logo-icon">B</div> Breason</div>
        {STEPS.map((s, i) => (
          <button key={s} className={`nav-btn ${step === s ? 'active' : ''}`} onClick={() => setStep(s)}>
            <span style={{ fontSize: 11, opacity: 0.5, width: 20 }}>0{i + 1}</span> {stepLabels[s]}
          </button>
        ))}
        <div className="footer-info">
          v 0.5.4<br/><span style={{ opacity: 0.5 }}>from pavel with love</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
            Breason <span style={{ color: 'var(--border)', margin: '0 8px' }}>/</span> {stepLabels[step]}
          </div>
        </header>

        <div className="content">
          <div className="card">
            <label className="field-label">Целевой регион</label>
            <div className="market-grid">
              {(Object.keys(MARKETS) as MarketKey[]).map(k => (
                <div key={k} className={`mkt-box ${market === k ? 'active' : ''}`} onClick={() => setMarket(k)}>
                  <div style={{ fontSize: '20px' }}>{MARKETS[k].flag}</div>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginTop: '6px' }}>{MARKETS[k].label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '4px', lineHeight: 1.3 }}>{MARKETS[k].hint}</div>
                </div>
              ))}
            </div>
          </div>

          {step === "search" && (
            <div className="step-ui">
              <button className="btn-cta" style={{ width: 'auto', marginBottom: 24 }} onClick={fetchTrends} disabled={loading}>
                {loading ? "Поиск трендов..." : "Обновить тренды региона"}
              </button>

              {trends.map((t, i) => (
                <div className="card trend-card" key={i}>
                  <div className="score-badge">{t.resonance_score}% резонанса</div>
                  <h2 style={{ fontSize: 18, marginBottom: 8, paddingRight: 100 }}>{t.trend_name}</h2>
                  <p style={{ color: 'var(--violet)', fontWeight: 700, marginBottom: 16 }}>{t.narrative_hook}</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    <div>
                      <label className="field-label">Напряжение рынка</label>
                      <p style={{ fontSize: 13, color: 'var(--t2)' }}>{t.market_tension}</p>
                    </div>
                    <div>
                      <label className="field-label">Почему сейчас</label>
                      <p style={{ fontSize: 13, color: 'var(--t2)' }}>{t.why_now}</p>
                    </div>
                  </div>

                  <button className="btn-cta" style={{ width: 'auto', padding: '10px 20px', fontSize: 12 }}>
                    Узнать больше
                  </button>
                </div>
              ))}
            </div>
          )}

          {step === "evaluate" && (
            <div className="step-ui">
              <div className="card">
                <label className="field-label">Парсинг страницы</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="inp" placeholder="URL статьи..." value={url} onChange={e => setUrl(e.target.value)} />
                  <button className="btn-cta" style={{ width: 120, marginBottom: 12 }}>Парсить</button>
                </div>
              </div>
              <div className="card">
                <label className="field-label">Текст для проверки</label>
                <textarea className="inp" rows={10} value={text} onChange={e => setText(e.target.value)} placeholder="Вставьте текст..." />
                <button className="btn-cta" onClick={() => setStep("improve")}>К улучшению</button>
              </div>
            </div>
          )}

          {step === "improve" && (
            <div className="card">
               <label className="field-label">Адаптация текста</label>
               <textarea className="inp" rows={15} value={text} onChange={e => setText(e.target.value)} />
               <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                 <button className="btn-cta">Применить ИИ</button>
                 <button className="btn-cta" style={{ background: 'var(--bg)', color: 'var(--t1)', border: '1px solid var(--border)' }}>Копировать</button>
               </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
