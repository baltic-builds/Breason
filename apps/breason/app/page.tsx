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

/* ─── STYLES ─── */
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
.logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 32px; color: var(--t1); display: flex; align-items: center; gap: 12px; text-decoration: none; }
.logo-icon { width: 32px; height: 32px; background: var(--lime); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 800; }
.nav-btn { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: none; background: none; cursor: pointer; text-align: left; transition: 0.2s; color: var(--t2); font-weight: 600; width: 100%; margin-bottom: 4px; }
.nav-btn:hover { background: rgba(0,0,0,0.03); }
.nav-btn.active { background: rgba(124, 58, 237, 0.08); color: var(--violet); }
.nav-num { font-size: 11px; opacity: 0.5; width: 16px; }
.main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: var(--bg); position: relative; }
.topbar { height: 64px; background: #fff; border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 40px; position: sticky; top: 0; z-index: 5; }
.content { padding: 40px; max-width: 1000px; margin: 0 auto; width: 100%; }
.card { background: #fff; border: 1px solid var(--border); border-radius: var(--r); padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
.field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--t3); margin-bottom: 12px; display: block; letter-spacing: 0.5px; }
.market-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px; }
.mkt-box { padding: 16px; border: 2px solid var(--border); border-radius: 12px; cursor: pointer; text-align: center; transition: 0.2s; background: #fff; }
.mkt-box:hover { border-color: var(--t3); }
.mkt-box.active { border-color: var(--lime); background: rgba(132, 204, 22, 0.04); }
.btn-cta { background: var(--orange); color: #fff; border: none; padding: 14px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s; font-size: 14px; border: 1px solid transparent; text-decoration: none; }
.btn-cta:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2); }
.btn-cta:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }
.inp { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); font-family: inherit; font-size: 14px; outline: none; transition: 0.2s; }
.inp:focus { border-color: var(--violet); background: #fff; }
.footer-info { margin-top: auto; padding-top: 20px; font-size: 11px; color: var(--t3); line-height: 1.6; }
.trend-card { border-left: 4px solid var(--lime); }
.analysis-box { background: var(--bg); padding: 16px; border-radius: 12px; border: 1px dashed var(--border); margin: 16px 0; font-size: 14px; line-height: 1.6; color: var(--t2); }
`;

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [loading, setLoading] = useState(false);
  
  const [trends, setTrends] = useState<any[]>([]);
  const [deepDive, setDeepDive] = useState<Record<string, string>>({});
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const findTrends = async () => {
    setLoading(true);
    setTrends([]);
    try {
      await new Promise(r => setTimeout(r, 1000));
      setTrends([
        { 
          id: 1,
          title: "Цифровизация в отрасли сельского хозяйства", 
          desc: "Повышение эффективности и производительности за счет внедрения технологий",
          conflict: "Неэффективное использование ресурсов",
          why: "Государственные субсидии"
        }
      ]);
    } finally { setLoading(false); }
  };

  const loadMore = async (title: string) => {
    setDeepDive(prev => ({ ...prev, [title]: "Загрузка детальной аналитики..." }));
    await new Promise(r => setTimeout(r, 800));
    setDeepDive(prev => ({ 
      ...prev, 
      [title]: `Инсайт для региона ${MARKETS[market].label}: Компании активно переходят на системы мониторинга в реальном времени.` 
    }));
  };

  const handleParse = async () => {
    if (!url) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setText("Контент извлечен из " + url + ". Готов к анализу.");
    setLoading(false);
  };

  return (
    <div className="shell">
      <style>{STYLE}</style>
      
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">B</div> Breason
        </div>
        
        {STEPS.map((s, i) => (
          <button key={s} className={`nav-btn ${step === s ? 'active' : ''}`} onClick={() => setStep(s)}>
            <span className="nav-num">0{i + 1}</span> {stepLabels[s]}
          </button>
        ))}

        <div className="footer-info">
          v 0.5.3<br/>
          <span style={{ opacity: 0.5 }}>from pavel with love</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--t3)' }}>Breason</span>
            <span style={{ color: 'var(--border)', fontSize: 18 }}>/</span>
            <span>{stepLabels[step]}</span>
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
              <button className="btn-cta" style={{ width: 'auto', marginBottom: 24 }} onClick={findTrends} disabled={loading}>
                {loading ? "Поиск..." : "Найти тренды региона"}
              </button>

              {trends.map((t) => (
                <div className="card trend-card" key={t.id}>
                  <h2 style={{ fontSize: 18, marginBottom: 12 }}>{t.title}</h2>
                  <p style={{ color: 'var(--t2)', fontSize: 15, marginBottom: 16 }}>{t.desc}</p>
                  
                  {deepDive[t.title] && (
                    <div className="analysis-box">
                      {deepDive[t.title]}
                    </div>
                  )}

                  <button className="btn-cta" 
                    style={{ width: 'auto', padding: '10px 20px', height: 'auto', fontSize: 12 }} 
                    onClick={() => loadMore(t.title)}>
                    Узнать больше
                  </button>
                </div>
              ))}
            </div>
          )}

          {step === "evaluate" && (
            <div className="step-ui">
              <div className="card">
                <label className="field-label">Парсинг контента</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="inp" placeholder="Вставьте URL статьи..." value={url} onChange={e => setUrl(e.target.value)} />
                  <button className="btn-cta" style={{ width: 120 }} onClick={handleParse} disabled={loading}>
                    Парсить
                  </button>
                </div>
              </div>

              <div className="card">
                <label className="field-label">Текст для проверки</label>
                <textarea 
                  className="inp" 
                  rows={10} 
                  style={{ resize: 'none', marginBottom: 20 }} 
                  value={text} 
                  onChange={e => setText(e.target.value)}
                  placeholder="Текст для адаптации..."
                />
                <button className="btn-cta" onClick={() => setStep("improve")} disabled={!text}>
                  К улучшению
                </button>
              </div>
            </div>
          )}

          {step === "improve" && (
            <div className="step-ui">
              <div className="card" style={{ background: 'var(--violet)', color: '#fff', border: 'none' }}>
                <h2 style={{ fontFamily: 'Syne', marginBottom: 8 }}>Улучшение</h2>
                <p style={{ opacity: 0.9, fontSize: 14 }}>Адаптация: {MARKETS[market].label}</p>
              </div>
              
              <div className="card">
                <label className="field-label">Редактор</label>
                <textarea className="inp" rows={15} value={text} onChange={e => setText(e.target.value)} />
                <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                  <button className="btn-cta">Применить магию ИИ</button>
                  {/* ИСПРАВЛЕНО: Кавычки вокруг переменных 'var(...)' */}
                  <button className="btn-cta" style={{ background: 'var(--bg)', color: 'var(--t1)', border: '1px solid var(--border)' }}>
                    Копировать
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
