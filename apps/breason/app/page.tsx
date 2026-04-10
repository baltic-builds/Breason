"use client";

import { useState } from "react";
import { MARKET_PROFILES } from "@breason/prompts";
import { MarketKey, NewsItem, EvaluateResult, ImproveResult } from "@breason/types";

export default function BreasonPage() {
  const [step, setStep] = useState<"search" | "evaluate" | "improve">("search");
  const [market, setMarket] = useState<MarketKey>("germany");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [preset, setPreset] = useState("standard");
  
  const [trends, setTrends] = useState<NewsItem[]>([]);
  const [evalRes, setEvalRes] = useState<EvaluateResult | null>(null);
  const [impRes, setImpRes] = useState<ImproveResult | null>(null);

  const STEPS = {
    search: { label: "Тренды", icon: "🔍" },
    evaluate: { label: "Аудит", icon: "⚖️" },
    improve: { label: "Улучшение", icon: "✨" }
  };

  const handleAction = async (actionOverride?: string) => {
    setLoading(true);
    try {
      const action = actionOverride || (step === 'improve' ? `improve_${preset}` : step);
      const res = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, market, text }),
      });
      const data = await res.json();
      
      if (step === 'search') setTrends(data.items || []);
      if (step === 'evaluate') setEvalRes(data);
      if (step === 'improve') setImpRes(data);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout">
      <style>{`
        :root { 
          --orange: #F97316; --orange-a: rgba(249, 115, 22, 0.1); --orange-d: #EA580C;
          --bg: #FAFAFA; --border: #E5E7EB; --t1: #111827; --t2: #4B5563;
        }
        body { margin: 0; background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--t1); }
        .layout { display: flex; min-height: 100vh; }
        
        /* Sidebar */
        .sidebar { width: 260px; background: white; border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 32px 20px; position: sticky; top: 0; height: 100vh; box-sizing: border-box; }
        .logo { font-size: 24px; font-weight: 800; color: var(--orange); margin-bottom: 40px; letter-spacing: -1px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; cursor: pointer; border: none; background: none; color: var(--t2); font-weight: 500; transition: 0.2s; margin-bottom: 4px; text-align: left; width: 100%; }
        .nav-item.active { background: var(--orange-a); color: var(--orange); }

        /* Main Content */
        .main { flex: 1; display: flex; flex-direction: column; }
        .topbar { height: 72px; background: white; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 40px; position: sticky; top: 0; z-index: 10; }
        .content { padding: 40px 80px; max-width: 900px; margin: 0 auto; width: 100%; box-sizing: border-box; }

        /* Controls */
        .market-pills { display: flex; gap: 8px; }
        .pill { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: white; cursor: pointer; font-size: 14px; transition: 0.2s; }
        .pill.active { border-color: var(--orange); color: var(--orange); font-weight: 600; }

        .editor-card { background: white; border: 1px solid var(--border); border-radius: 20px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .textarea { width: 100%; min-height: 180px; border: 1px solid var(--border); border-radius: 12px; padding: 20px; font-size: 16px; resize: none; margin-bottom: 24px; outline: none; transition: 0.2s; box-sizing: border-box; }
        .textarea:focus { border-color: var(--orange); box-shadow: 0 0 0 3px var(--orange-a); }

        .btn-primary { background: var(--orange); color: white; border: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; font-size: 16px; transition: 0.2s; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .result-item { margin-bottom: 24px; padding: 20px; border-radius: 16px; background: #F9FAFB; border: 1px solid var(--border); }
      `}</style>

      <aside className="sidebar">
        <div className="logo">Breason</div>
        <nav>
          {(Object.entries(STEPS) as [keyof typeof STEPS, any][]).map(([key, s]) => (
            <button 
              key={key} 
              className={`nav-item ${step === key ? 'active' : ''}`}
              onClick={() => setStep(key)}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="market-pills">
            {(Object.keys(MARKET_PROFILES) as MarketKey[]).map(k => (
              <button 
                key={k} 
                className={`pill ${market === k ? 'active' : ''}`}
                onClick={() => setMarket(k)}
              >
                {MARKET_PROFILES[k].flag} {MARKET_PROFILES[k].labelRu}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}>v2.2.1 Fixed</div>
        </header>

        <div className="content">
          <div className="editor-card">
            <textarea 
              className="textarea"
              placeholder={step === 'search' ? "О чем искать новости?" : "Вставьте ваш текст..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn-primary" onClick={() => handleAction()} disabled={loading}>
              {loading ? "Система думает..." : STEPS[step].label}
            </button>
          </div>

          <div style={{ marginTop: 40 }}>
            {step === 'search' && trends.map((t, i) => (
              <div key={i} className="result-item">
                <div style={{ fontWeight: 700, color: 'var(--orange)', marginBottom: 8, fontSize: 18 }}>{t.headline}</div>
                <div style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>{t.summary}</div>
                <div style={{ marginTop: 12, fontSize: 13, background: 'white', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <b>Impact:</b> {t.business_impact}
                </div>
              </div>
            ))}

            {step === 'evaluate' && evalRes && (
              <div className="result-item" style={{ borderLeft: '4px solid var(--orange)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ 
                    background: evalRes.verdict === 'PASS' ? '#DCFCE7' : '#FEE2E2',
                    color: evalRes.verdict === 'PASS' ? '#166534' : '#991B1B',
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800
                  }}>{evalRes.verdict}</span>
                  <b style={{ fontSize: 16 }}>Результат аудита</b>
                </div>
                <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.6 }}>{evalRes.verdict_reason}</p>
              </div>
            )}

            {step === 'improve' && impRes && (
              <div className="result-item" style={{ background: 'white', border: '1px solid var(--orange)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)', marginBottom: 16, textTransform: 'uppercase' }}>
                  ✓ {impRes.tone_achieved}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.7, color: 'var(--t1)' }}>
                  {impRes.improved_local}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
