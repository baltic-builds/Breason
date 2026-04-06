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
  --purple: #7C3AED;   /* Забота */
  --blue: #0EA5E9;     /* Доверие */
  --metal: #475569;    /* Надежность */
  --white: #FFFFFF;    /* Творчество */
  --orange: #F97316;   /* Оптимизм */
  --lime: #84CC16;     /* Энергия */
}

body { 
  font-family: 'Inter', -apple-system, sans-serif; 
  background: var(--white); 
  color: var(--metal); 
  margin: 0; 
  line-height: 1.5;
}

.app-container { display: flex; min-height: 100vh; }

/* Sidebar */
.sidebar { 
  width: 280px; 
  border-right: 1px solid #f1f5f9; 
  padding: 32px 24px; 
  background: white; 
  flex-shrink: 0; 
  position: sticky;
  top: 0;
  height: 100vh;
  box-sizing: border-box;
}

.logo { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  cursor: pointer; 
  margin-bottom: 48px; 
  text-decoration: none;
}
.logo-icon { 
  background: var(--lime); 
  color: white; 
  width: 40px; 
  height: 40px; 
  border-radius: 12px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  font-weight: 900; 
  font-size: 22px;
}
.logo-text { color: var(--purple); font-weight: 800; font-size: 24px; letter-spacing: -0.5px; }

.nav-group { display: flex; flex-direction: column; gap: 8px; }
.step-item { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 14px 16px; 
  border-radius: 14px; 
  cursor: pointer; 
  color: var(--metal); 
  font-weight: 600; 
  transition: all 0.2s ease;
}
.step-item:hover { background: #f8fafc; }
.step-item.active { 
  background: rgba(132, 204, 22, 0.12); 
  color: var(--lime); 
}
.step-num { 
  width: 26px; 
  height: 26px; 
  border-radius: 8px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  font-size: 13px; 
  border: 2px solid currentColor; 
}

/* Main Content */
.main-content { flex-grow: 1; padding: 48px; max-width: 900px; }

.badge-mode {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(124, 58, 237, 0.1);
  color: var(--purple);
  margin-bottom: 16px;
}

.input-area { 
  width: 100%; 
  min-height: 180px; 
  padding: 20px; 
  border: 2px solid #f1f5f9; 
  border-radius: 20px; 
  font-size: 16px; 
  margin-bottom: 20px; 
  outline: none; 
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}
.input-area:focus { border-color: var(--blue); box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1); }

.btn-primary { 
  background: var(--orange); 
  color: white; 
  border: none; 
  padding: 16px 32px; 
  border-radius: 16px; 
  font-weight: 700; 
  font-size: 16px;
  cursor: pointer; 
  transition: transform 0.2s, background 0.2s;
}
.btn-primary:hover { background: var(--purple); transform: translateY(-1px); }

/* Trend Cards */
.analyst-box {
  background: rgba(124, 58, 237, 0.03);
  border: 1px solid rgba(124, 58, 237, 0.2);
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 32px;
}

.trend-card { 
  border-left: 6px solid var(--lime); 
  background: #f8fafc; 
  padding: 28px; 
  border-radius: 20px; 
  margin-bottom: 24px; 
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}
.tension-box {
  background: white;
  padding: 16px;
  border-radius: 12px;
  margin: 16px 0;
  border: 1px solid #edf2f7;
}

/* Mobile */
@media (max-width: 768px) {
  .app-container { flex-direction: column; }
  .sidebar { 
    width: 100%; 
    height: auto; 
    border-right: none; 
    border-bottom: 1px solid #f1f5f9; 
    padding: 16px; 
    position: sticky; 
    top: 0; 
    z-index: 100; 
  }
  .logo { margin-bottom: 16px; }
  .nav-group { flex-direction: row; overflow-x: auto; padding-bottom: 4px; gap: 4px; }
  .step-item { padding: 8px 12px; flex-shrink: 0; font-size: 14px; }
  .main-content { padding: 24px; }
  .btn-primary { width: 100%; }
}
`;

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [market, setMarket] = useState("brazil");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [textToProcess, setTextToProcess] = useState("");

  const resetToHome = () => {
    setStep("search");
    setResult(null);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- Раздел 1: Искать ---
  const SearchContent = () => (
    <div>
      <h1 style={{ color: "var(--purple)", fontSize: "32px", marginBottom: "8px" }}>Тренды 2026</h1>
      <p style={{ color: "var(--metal)", marginBottom: "32px" }}>Анализ B2B нарративов за последние 90 дней.</p>
      
      <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexDirection: "column" }}>
        <select 
          value={market} 
          onChange={(e) => setMarket(e.target.value)} 
          className="input-area" 
          style={{ minHeight: "60px", marginBottom: "0" }}
        >
          {Object.entries(MARKETS).map(([id, m]) => (
            <option key={id} value={id}>{m.flag} {m.label}</option>
          ))}
        </select>
        <button className="btn-primary" onClick={handleSearch}>
          {loading ? "Анализируем рынок..." : "Найти тренды →"}
        </button>
      </div>

      {result?.analyst_note && (
        <div className="analyst-box">
          <strong style={{ color: "var(--purple)", fontSize: "14px", textTransform: "uppercase" }}>Настроение рынка</strong>
          <p style={{ margin: "8px 0 0 0", fontSize: "16px", fontWeight: 500 }}>{result.analyst_note}</p>
        </div>
      )}

      {result?.trends?.map((t: any, i: number) => (
        <div key={i} className="trend-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--blue)", fontWeight: "800", fontSize: "12px" }}>ТРЕНД #{i + 1}</span>
            <span style={{ color: "var(--orange)", fontWeight: "900", fontSize: "20px" }}>{t.resonance_score}</span>
          </div>
          <h2 style={{ margin: "12px 0", color: "var(--metal)" }}>{t.trend_name}</h2>
          
          <div className="tension-box">
            <div style={{ color: "var(--blue)", fontSize: "11px", fontWeight: "900", marginBottom: "4px" }}>MARKET TENSION</div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>{t.market_tension}</p>
          </div>

          <p style={{ fontSize: "17px", fontWeight: 600, color: "var(--purple)", margin: "20px 0" }}>{t.narrative_hook}</p>
          
          <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
            <strong>Почему сейчас:</strong> {t.why_now}
          </div>

          <button 
            onClick={() => { setTextToProcess(t.narrative_hook); setStep("evaluate"); }}
            style={{ 
              background: "none", border: "2px solid var(--lime)", color: "var(--lime)", 
              padding: "12px 20px", borderRadius: "12px", cursor: "pointer", fontWeight: 700 
            }}
          >
            Проверить этот хук
          </button>
        </div>
      ))}
    </div>
  );

  // --- Раздел 2: Проверять ---
  const EvaluateContent = () => (
    <div>
      <h1 style={{ color: "var(--purple)" }}>Проверка резонанса</h1>
      <textarea 
        className="input-area" 
        placeholder="Вставьте ваш маркетинговый текст или заголовок для анализа..."
        value={textToProcess}
        onChange={(e) => setTextToProcess(e.target.value)}
      />
      <button className="btn-primary">Запустить AI-аудит</button>
      <div style={{ marginTop: "32px", padding: "24px", background: "#f8fafc", borderRadius: "20px" }}>
        <h4 style={{ margin: "0 0 12px 0" }}>Параметры проверки:</h4>
        <ul style={{ margin: 0, paddingLeft: "20px", color: "#64748b", fontSize: "14px" }}>
          <li>Культурный код региона {MARKETS[market as keyof typeof MARKETS]?.label}</li>
          <li>Наличие рыночного конфликта (Tension)</li>
          <li>Отсутствие "запрещенных" корпоративных клише</li>
        </ul>
      </div>
    </div>
  );

  // --- Раздел 3: Улучшать ---
  const ImproveContent = () => (
    <div>
      <h1 style={{ color: "var(--purple)" }}>Сделать красиво</h1>
      <textarea 
        className="input-area" 
        placeholder="Введите черновик, который нужно улучшить..."
        value={textToProcess}
        onChange={(e) => setTextToProcess(e.target.value)}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <button className="btn-primary" style={{ background: "var(--blue)" }}>Добавить энергии</button>
        <button className="btn-primary">Сделать строже</button>
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

        <nav className="nav-group">
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
        <div className="badge-mode">{step.toUpperCase()} MODE · 2026</div>
        
        {step === "search"   && <SearchContent />}
        {step === "evaluate" && <EvaluateContent />}
        {step === "improve"  && <ImproveContent />}
      </main>
    </div>
  );
}
