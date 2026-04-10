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
    if (!actionOverride) {
      setEvalRes(null);
      setImpRes(null);
    }
    
    try {
      const action = actionOverride || (step === 'improve' ? `improve_${preset}` : step);
      const res = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, market, text }),
      });
      const data = await res.json();
      
      if (action === 'search') setTrends(data.items || []);
      if (action === 'evaluate') setEvalRes(data);
      if (action.startsWith('improve')) setImpRes(data);
    } catch (e) {
      console.error(e);
      alert("Ошибка связи с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <style>{`
        :root { --orange: #F97316; --orange-light: #FFF7ED; --border: #E5E7EB; --text: #111827; }
        body { background: #FAFAFA; font-family: 'DM Sans', sans-serif; color: var(--text); margin: 0; }
        .container { display: flex; min-height: 100vh; }
        
        .sidebar { width: 260px; background: white; border-right: 1px solid var(--border); padding: 40px 24px; position: sticky; top: 0; height: 100vh; }
        .logo { font-size: 22px; font-weight: 800; color: var(--orange); margin-bottom: 40px; letter-spacing: -0.5px; }
        .nav-btn { width: 100%; text-align: left; padding: 12px 16px; border-radius: 10px; margin-bottom: 8px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6B7280; transition: 0.2s; }
        .nav-btn.active { background: var(--orange-light); color: var(--orange); }

        .main { flex: 1; padding: 60px 80px; max-width: 1000px; }
        
        .market-selector { display: flex; gap: 12px; margin-bottom: 40px; }
        .market-btn { flex: 1; background: white; border: 1px solid var(--border); padding: 16px; border-radius: 16px; cursor: pointer; transition: 0.2s; text-align: center; }
        .market-btn.active { border-color: var(--orange); box-shadow: 0 0 0 2px var(--orange-light); }
        .flag { font-size: 24px; display: block; margin-bottom: 4px; }
        .m-name { font-size: 14px; font-weight: 600; }

        .presets { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .p-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: white; font-size: 13px; cursor: pointer; transition: 0.2s; }
        .p-btn.active { background: var(--orange); color: white; border-color: var(--orange); }

        .input-box { width: 100%; min-height: 160px; padding: 20px; border-radius: 16px; border: 1px solid var(--border); font-size: 16px; outline: none; transition: 0.2s; resize: none; margin-bottom: 24px; box-sizing: border-box; }
        .input-box:focus { border-color: var(--orange); }

        .go-btn { background: var(--orange); color: white; border: none; width: 100%; padding: 16px; border-radius: 14px; font-weight: 700; font-size: 16px; cursor: pointer; transition: 0.2s; }
        .go-btn:hover { opacity: 0.9; }
        .go-btn:disabled { opacity: 0.5; cursor: not-allowed; }

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
          placeholder={step === 'search' ? "О чем искать новости? (или оставьте пустым для общего поиска)" : "Вставьте текст для обработки..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button className="go-btn" onClick={() => handleAction()} disabled={loading}>
          {loading ? "Обработка..." : (step === 'search' ? "Найти тренды" : "Запустить анализ")}
        </button>

        {step === 'search' && trends.length > 0 && (
          <div className="result-card">
            {trends.map((t, i) => (
              <div key={i} style={{ marginBottom: 24, borderBottom: i < trends.length - 1 ? '1px solid #F3F4F6' : 'none', paddingBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--orange)', marginBottom: 4, fontSize: 17 }}>{t.headline}</div>
                <div style={{ fontSize: 13, textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 8, fontWeight: 600 }}>{t.topic} • {t.category}</div>
                <div style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.5, marginBottom: 10 }}>{t.summary}</div>
                <div style={{ fontSize: 13, background: '#F9FAFB', padding: '8px 12px', borderRadius: 8, color: '#374151' }}>
                   <b>Влияние:</b> {t.business_impact}
                </div>
              </div>
            ))}
          </div>
        )}

        {impRes && (
          <div className="result-card" style={{ borderLeft: '4px solid var(--orange)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)', marginBottom: 12 }}>✓ {impRes.tone_achieved}</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 16 }}>{impRes.improved_local}</div>
          </div>
        )}

        {evalRes && (
          <div className="result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
               <span style={{ 
                 padding: '4px 12px', 
                 borderRadius: 6, 
                 fontSize: 12, 
                 fontWeight: 800, 
                 background: evalRes.verdict === 'PASS' ? '#DCFCE7' : '#FEE2E2',
                 color: evalRes.verdict === 'PASS' ? '#166534' : '#991B1B'
               }}>{evalRes.verdict}</span>
               <div style={{ fontWeight: 700 }}>Результат аудита</div>
            </div>
            <div style={{ color: "#4B5563", marginBottom: 20 }}>{evalRes.verdict_reason}</div>
          </div>
        )}
      </main>
    </div>
  );
}
