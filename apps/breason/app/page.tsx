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
  
  // Состояния для результатов
  const [trends, setTrends] = useState<NewsItem[]>([]);
  const [evalRes, setEvalRes] = useState<EvaluateResult | null>(null);
  const [impRes, setImpRes] = useState<ImproveResult | null>(null);

  const PRESETS = [
    { id: "standard", label: "Стандарт" },
    { id: "icebreaker", label: "Ледокол" },
    { id: "thought_leader", label: "Лидер мнений" },
    { id: "landing_page", label: "Лендинг" },
    { id: "follow_up", label: "Напоминание" },
    { id: "social", label: "Соцсети" },
  ];

  async function handleAction(actionOverride?: string) {
    setLoading(true);
    setEvalRes(null);
    setImpRes(null);
    
    try {
      const action = actionOverride || (step === 'improve' ? `improve_${preset}` : step);
      const res = await fetch("/api/resonance-trends", {
        method: "POST",
        body: JSON.stringify({ action, market, text }),
      });
      const data = await res.json();
      
      if (step === 'search') setTrends(data.items || []);
      if (step === 'evaluate') setEvalRes(data);
      if (step === 'improve') setImpRes(data);
    } catch (e) {
      alert("Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <style>{`
        :root { --orange: #F97316; --orange-light: #FFF7ED; --border: #E5E7EB; --text: #111827; }
        body { background: #FAFAFA; font-family: 'DM Sans', sans-serif; color: var(--text); }
        .container { display: flex; min-height: 100vh; }
        
        .sidebar { width: 260px; background: white; border-right: 1px solid var(--border); padding: 40px 24px; }
        .logo { font-size: 22px; font-weight: 800; color: var(--orange); margin-bottom: 40px; letter-spacing: -0.5px; }
        .nav-btn { width: 100%; text-align: left; padding: 12px 16px; border-radius: 10px; margin-bottom: 8px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6B7280; transition: 0.2s; }
        .nav-btn.active { background: var(--orange-light); color: var(--orange); }

        .main { flex: 1; padding: 60px 80px; max-width: 900px; }
        
        .market-selector { display: flex; gap: 12px; margin-bottom: 40px; }
        .market-btn { flex: 1; background: white; border: 1px solid var(--border); padding: 16px; border-radius: 16px; cursor: pointer; transition: 0.2s; text-align: center; }
        .market-btn.active { border-color: var(--orange); box-shadow: 0 0 0 2px var(--orange-light); }
        .flag { font-size: 24px; display: block; margin-bottom: 4px; }
        .m-name { font-size: 14px; font-weight: 600; }

        .presets { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .p-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: white; font-size: 13px; cursor: pointer; transition: 0.2s; }
        .p-btn.active { background: var(--orange); color: white; border-color: var(--orange); }

        .input-box { width: 100%; min-height: 160px; padding: 20px; border-radius: 16px; border: 1px solid var(--border); font-size: 16px; outline: none; transition: 0.2s; resize: none; margin-bottom: 24px; }
        .input-box:focus { border-color: var(--orange); }

        .go-btn { background: var(--orange); color: white; border: none; width: 100%; padding: 16px; border-radius: 14px; font-weight: 700; font-size: 16px; cursor: pointer; }
        .go-btn:disabled { opacity: 0.5; }

        .result-card { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-top: 32px; animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <aside className="sidebar">
        <div className="logo">Breason</div>
        <button className={`nav-btn ${step === 'search' ? 'active' : ''}`} onClick={() => setStep('search')}>🔍 Тренды рынка</button>
        <button className={`nav-btn ${step === 'evaluate' ? 'active' : ''}`} onClick={() => setStep('evaluate')}>⚖️ Культурный аудит</button>
        <button className={`nav-btn ${step === 'improve' ? 'active' : ''}`} onClick={() => setStep('improve')}>✨ Улучшение текста</button>
      </aside>

      <main className="main">
        <div className="market-selector">
          {(Object.keys(MARKET_PROFILES) as MarketKey[]).map(k => (
            <button key={k} className={`market-btn ${market === k ? 'active' : ''}`} onClick={() => setMarket(k)}>
              <span className="flag">{MARKET_PROFILES[k].flag}</span>
              <span className="m-name">{MARKET_PROFILES[k].labelRu}</span>
            </button>
          ))}
        </div>

        {step === 'improve' && (
          <div className="presets">
            {PRESETS.map(p => (
              <button key={p.id} className={`p-btn ${preset === p.id ? 'active' : ''}`} onClick={() => setPreset(p.id)}>{p.label}</button>
            ))}
          </div>
        )}

        <textarea 
          className="input-box" 
          placeholder={step === 'search' ? "Введите тему или оставьте пустым..." : "Вставьте текст для анализа или улучшения..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button className="go-btn" onClick={() => handleAction()} disabled={loading}>
          {loading ? "Минутку..." : "Запустить процесс"}
        </button>

        {/* Вывод результатов */}
        {step === 'search' && trends.length > 0 && (
          <div className="result-card">
            {trends.map((t, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: var(--orange) }}>{t.headline}</div>
                <div style={{ fontSize: 14, color: "#666" }}>{t.summary}</div>
              </div>
            ))}
          </div>
        )}

        {impRes && (
          <div className="result-card" style={{ borderLeft: '4px solid var(--orange)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: var(--orange), marginBottom: 12 }}>✓ {impRes.tone_achieved}</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{impRes.improved_local}</div>
          </div>
        )}

        {evalRes && (
          <div className="result-card">
            <div style={{ fontWeight: 700 }}>Вердикт: {evalRes.verdict}</div>
            <div style={{ color: "#666", marginTop: 8 }}>{evalRes.verdict_reason}</div>
          </div>
        )}
      </main>
    </div>
  );
}
