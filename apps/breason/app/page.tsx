"use client";

import { useState } from "react";

type Step = "search" | "evaluate" | "improve";

const MARKETS: Record<string, { label: string; flag: string; summary: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", summary: "Тёплая, доверительная B2B-коммуникация." },
  poland:  { label: "Польша",    flag: "🇵🇱", summary: "Прагматичная, скептичная аудитория." },
  germany: { label: "Германия",  flag: "🇩🇪", summary: "Структурированный рынок и надёжность." },
};

const STYLE = `
:root {
  --purple: #7C3AED;   /* Забота */
  --blue: #0EA5E9;     /* Доверие */
  --metal: #475569;    /* Надежность */
  --white: #FFFFFF;    /* Творчество */
  --orange: #F97316;   /* Оптимизм */
  --lime: #84CC16;     /* Энергия (ЯРКИЙ) */
}

body { font-family: sans-serif; background: var(--white); color: var(--metal); margin: 0; }

.sidebar { width: 260px; border-right: 1px solid #eee; height: 100vh; padding: 24px; position: fixed; }
.main-content { margin-left: 260px; padding: 40px; min-height: 100vh; }

.logo { display: flex; alignItems: center; gap: 12px; cursor: pointer; text-decoration: none; margin-bottom: 40px; }
.logo-icon { background: var(--lime); color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; }
.logo-text { color: var(--purple); font-weight: 800; font-size: 22px; }

/* Яркие лаймовые шаги */
.step-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; cursor: pointer; margin-bottom: 8px; transition: 0.2s; color: var(--metal); font-weight: 600; }
.step-item.active { background: rgba(132, 204, 22, 0.15); color: var(--lime); }
.step-num { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid currentColor; }

.btn-primary { background: var(--orange); color: white; border: none; padding: 14px 28px; border-radius: 14px; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-primary:hover { background: var(--purple); transform: translateY(-2px); }

.card { border-left: 6px solid var(--lime); background: #f9fafb; padding: 24px; border-radius: 16px; margin-top: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
.tag { background: rgba(14, 165, 233, 0.1); color: var(--blue); padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
`;

// --- Под-компоненты ---

function SearchStep() {
  const [market, setMarket] = useState("brazil");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setTrends(data.trends || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ color: "var(--purple)" }}>Поиск резонансных трендов</h2>
      <div style={{ display: "flex", gap: "12px", marginBottom: "30px" }}>
        <select 
          value={market} 
          onChange={(e) => setMarket(e.target.value)}
          style={{ padding: "12px", borderRadius: "12px", border: "1px solid #ddd", width: "200px" }}
        >
          {Object.entries(MARKETS).map(([id, m]) => (
            <option key={id} value={id}>{m.flag} {m.label}</option>
          ))}
        </select>
        <button className="btn-primary" onClick={fetchTrends} disabled={loading}>
          {loading ? "Анализ рынка..." : "Найти тренды →"}
        </button>
      </div>

      {loading && <div style={{ color: "var(--blue)", fontWeight: "bold", animation: "pulse 2s infinite" }}>AI изучает рынок {market}...</div>}

      {trends.map((t, i) => (
        <div key={i} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span className="tag">Trend #{i+1}</span>
            <span style={{ color: "var(--lime)", fontWeight: "900" }}>SCORE: {t.resonanceScore}</span>
          </div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "20px" }}>{t.title}</h3>
          <p style={{ color: "var(--metal)", lineHeight: "1.5" }}>{t.insight}</p>
          <div style={{ background: "white", padding: "12px", borderRadius: "8px", borderLeft: "4px solid var(--orange)", marginTop: "15px", fontStyle: "italic" }}>
            "{t.narrative_hook}"
          </div>
        </div>
      ))}
    </div>
  );
}

function EvaluateStep() {
  return <div style={{ padding: "20px", border: "2px dashed #ddd", borderRadius: "20px", textAlign: "center", color: "#999" }}>Инструмент проверки текста (в разработке)</div>;
}

function ImproveStep() {
  return <div style={{ padding: "20px", border: "2px dashed #ddd", borderRadius: "20px", textAlign: "center", color: "#999" }}>Инструмент улучшения (в разработке)</div>;
}

// --- Основной экран ---

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");

  const resetToHome = () => setStep("search");

  return (
    <div>
      <style>{STYLE}</style>
      
      <aside className="sidebar">
        <div className="logo" onClick={resetToHome}>
          <div className="logo-icon">B</div>
          <span className="logo-text">Breason</span>
        </div>

        <nav>
          {(["search", "evaluate", "improve"] as Step[]).map((s, i) => (
            <div 
              key={s} 
              className={`step-item ${step === s ? 'active' : ''}`}
              onClick={() => setStep(s)}
            >
              <div className="step-num">{i + 1}</div>
              {s === "search" ? "Искать" : s === "evaluate" ? "Проверять" : "Улучшать"}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
          <div style={{ color: "var(--purple)", fontWeight: "700" }}>
            Breason <span style={{ color: "#ddd", margin: "0 8px" }}>/</span> {step}
          </div>
          <div style={{ background: "var(--lime)", color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "800" }}>
            V0.5 PRO
          </div>
        </header>

        {step === "search" && <SearchStep />}
        {step === "evaluate" && <EvaluateStep />}
        {step === "improve" && <ImproveStep />}
      </main>
    </div>
  );
}
