"use client";

import { useState } from "react";

type Step = "search" | "evaluate" | "improve";

const MARKETS: Record<string, { label: string; flag: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷" },
  poland:  { label: "Польша",    flag: "🇵🇱" },
  germany: { label: "Германия",  flag: "🇩🇪" },
};

const STYLE = `
:root {
  --purple: #7C3AED; --blue: #0EA5E9; --metal: #475569;
  --white: #FFFFFF; --orange: #F97316; --lime: #84CC16;
}

body { font-family: 'Inter', sans-serif; background: var(--white); color: var(--metal); margin: 0; }

.app-container { display: flex; min-height: 100vh; flex-direction: row; }

/* Sidebar & Mobile Nav */
.sidebar { width: 260px; border-right: 1px solid #eee; padding: 24px; background: white; flex-shrink: 0; }
.main-content { flex-grow: 1; padding: 40px; max-width: 1000px; margin: 0 auto; }

.logo { display: flex; align-items: center; gap: 12px; cursor: pointer; margin-bottom: 40px; }
.logo-icon { background: var(--lime); color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.logo-text { color: var(--purple); font-weight: 800; font-size: 22px; }

.step-item { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; cursor: pointer; margin-bottom: 8px; color: var(--metal); font-weight: 600; transition: 0.2s; }
.step-item.active { background: rgba(132, 204, 22, 0.15); color: var(--lime); }
.step-num { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid currentColor; }

/* UI Elements */
.btn-primary { background: var(--orange); color: white; border: none; padding: 14px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; }
.btn-primary:hover { background: var(--purple); }
.input-area { width: 100%; min-height: 150px; padding: 16px; border: 2px solid #f1f5f9; border-radius: 16px; font-size: 16px; margin-bottom: 16px; outline: none; }
.input-area:focus { border-color: var(--blue); }

.card { border-left: 6px solid var(--lime); background: #f9fafb; padding: 24px; border-radius: 16px; margin-top: 20px; }

/* Mobile Adaptivity */
@media (max-width: 768px) {
  .app-container { flex-direction: column; }
  .sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid #eee; padding: 16px; position: sticky; top: 0; z-index: 100; }
  .logo { margin-bottom: 16px; }
  .main-content { padding: 20px; margin-left: 0; }
  .sb-nav { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
  .step-item { padding: 8px 12px; margin-bottom: 0; flex-shrink: 0; }
}
`;

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [textToProcess, setTextToProcess] = useState("");

  const resetToHome = () => setStep("search");

  // --- РАЗДЕЛ 1: ПОИСК ---
  const SearchStep = () => {
    const [market, setMarket] = useState("brazil");
    const handleSearch = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/resonance-trends?market=${market}`);
        const data = await res.json();
        setTrends(data.trends || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };

    return (
      <div>
        <h2 style={{ color: "var(--purple)" }}>Тренды рынка</h2>
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexDirection: "column" }}>
          <select value={market} onChange={(e) => setMarket(e.target.value)} className="input-area" style={{minHeight: "50px"}}>
            {Object.entries(MARKETS).map(([id, m]) => <option key={id} value={id}>{m.flag} {m.label}</option>)}
          </select>
          <button className="btn-primary" onClick={handleSearch}>{loading ? "Анализ..." : "Найти тренды"}</button>
        </div>
        {trends.map((t, i) => (
          <div key={i} className="card">
             <span style={{ color: "var(--blue)", fontWeight: "bold", fontSize: "12px" }}>#{i+1} РЕЗОНАНС {t.resonanceScore}%</span>
             <h3 style={{marginTop: "8px"}}>{t.title}</h3>
             <p>{t.insight}</p>
             <button onClick={() => { setTextToProcess(t.narrative_hook); setStep("evaluate"); }} style={{background: "none", border: "1px solid var(--blue)", color: "var(--blue)", padding: "8px", borderRadius: "8px", cursor: "pointer"}}>Проверить этот хук</button>
          </div>
        ))}
      </div>
    );
  };

  // --- РАЗДЕЛ 2: ПРОВЕРКА ---
  const EvaluateStep = () => (
    <div>
      <h2 style={{ color: "var(--purple)" }}>Проверка резонанса</h2>
      <textarea className="input-area" placeholder="Вставьте ваш текст или хук..." value={textToProcess} onChange={(e) => setTextToProcess(e.target.value)} />
      <button className="btn-primary">Запустить анализ текста</button>
      <p style={{marginTop: "20px", color: "var(--metal)", fontSize: "14px"}}>Здесь AI проверит ваш текст на соответствие культурным кодам рынка.</p>
    </div>
  );

  // --- РАЗДЕЛ 3: УЛУЧШЕНИЕ ---
  const ImproveStep = () => (
    <div>
      <h2 style={{ color: "var(--purple)" }}>Сделать красиво</h2>
      <textarea className="input-area" placeholder="Что мы улучшаем?" value={textToProcess} onChange={(e) => setTextToProcess(e.target.value)} />
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
        <button className="btn-primary" style={{background: "var(--blue)"}}>Добавить эмоций</button>
        <button className="btn-primary">Убрать лишнее</button>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <style>{STYLE}</style>
      
      <aside className="sidebar">
        <div className="logo" onClick={resetToHome}>
          <div className="logo-icon">B</div>
          <span className="logo-text">Breason</span>
        </div>

        <nav className="sb-nav">
          {(["search", "evaluate", "improve"] as Step[]).map((s, i) => (
            <div key={s} className={`step-item ${step === s ? 'active' : ''}`} onClick={() => setStep(s)}>
              <div className="step-num">{i + 1}</div>
              {s === "search" ? "Искать" : s === "evaluate" ? "Проверять" : "Улучшать"}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <div style={{marginBottom: "20px", fontSize: "14px", color: "var(--blue)", fontWeight: "bold"}}>
          {step.toUpperCase()} MODE
        </div>
        {step === "search" && <SearchStep />}
        {step === "evaluate" && <EvaluateStep />}
        {step === "improve" && <ImproveStep />}
      </main>
    </div>
  );
}
