"use client";

import { useState, useEffect } from "react";
import { MARKET_PROFILES } from "@breason/prompts";

export default function BreasonApp() {
  const [step, setStep] = useState<"search" | "evaluate" | "improve">("search");
  const [market, setMarket] = useState("germany");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [text, setText] = useState("");

  const PRESETS = [
    { id: "icebreaker", label: "Ледокол" },
    { id: "thought_leader", label: "Лидер мнений" },
    { id: "landing_page", label: "Лендинг" },
    { id: "follow_up", label: "Напоминание" },
    { id: "social", label: "Социальные сети" },
    { id: "standard", label: "Стандартная правка" },
  ];

  return (
    <div className="app-container">
      <style>{`
        :root {
          --accent: #F97316;
          --accent-light: #FFF7ED;
          --bg: #FAFAFA;
          --text: #171717;
          --text-secondary: #737373;
          --border: #E5E5E5;
          --white: #FFFFFF;
        }

        body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; margin: 0; }
        
        .app-container { display: flex; min-height: 100vh; }
        
        /* Sidebar */
        .sidebar { width: 280px; border-right: 1px solid var(--border); background: var(--white); padding: 32px; display: flex; flex-direction: column; }
        .logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 24px; color: var(--accent); margin-bottom: 48px; }
        .nav-item { padding: 12px 16px; border-radius: 12px; cursor: pointer; margin-bottom: 8px; font-weight: 500; transition: all 0.2s; color: var(--text-secondary); }
        .nav-item.active { background: var(--accent-light); color: var(--accent); }

        /* Main */
        .main { flex: 1; padding: 48px 64px; max-width: 1000px; margin: 0 auto; }
        
        .market-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
        .market-card { 
          padding: 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--white); cursor: pointer; text-align: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        }
        .market-card.active { border-color: var(--accent); background: var(--accent-light); transform: translateY(-2px); box-shadow: 0 12px 24px -10px rgba(249, 115, 22, 0.15); }
        .market-flag { font-size: 32px; display: block; margin-bottom: 12px; }
        .market-name { font-weight: 700; font-size: 15px; }

        .preset-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
        .preset-btn { 
          padding: 8px 16px; border-radius: 100px; border: 1px solid var(--border); background: var(--white); font-size: 13px; cursor: pointer; transition: 0.2s;
        }
        .preset-btn:hover { border-color: var(--accent); color: var(--accent); }

        .input-area { width: 100%; border: 1px solid var(--border); border-radius: 16px; padding: 24px; font-size: 16px; line-height: 1.6; min-height: 200px; resize: none; margin-bottom: 24px; outline: none; transition: 0.2s; }
        .input-area:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-light); }

        .btn-main { background: var(--accent); color: white; border: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; font-size: 16px; transition: 0.2s; }
        .btn-main:hover { filter: brightness(1.1); }
        .btn-main:disabled { opacity: 0.5; cursor: not-allowed; }

        .results-box { margin-top: 40px; animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <aside className="sidebar">
        <div className="logo">Breason</div>
        <div className={`nav-item ${step === 'search' ? 'active' : ''}`} onClick={() => setStep('search')}>🔍 Поиск трендов</div>
        <div className={`nav-item ${step === 'evaluate' ? 'active' : ''}`} onClick={() => setStep('evaluate')}>⚖️ Аудит контента</div>
        <div className={`nav-item ${step === 'improve' ? 'active' : ''}`} onClick={() => setStep('improve')}>✨ Улучшение текста</div>
      </aside>

      <main className="main">
        <div className="market-grid">
          {Object.entries(MARKET_PROFILES).map(([key, p]) => (
            <div 
              key={key} 
              className={`market-card ${market === key ? 'active' : ''}`}
              onClick={() => setMarket(key)}
            >
              <span className="market-flag">{p.flag}</span>
              <span className="market-name">{p.labelRu}</span>
            </div>
          ))}
        </div>

        {step === 'improve' && (
          <div className="preset-grid">
            {PRESETS.map(p => (
              <button key={p.id} className="preset-btn">{p.label}</button>
            ))}
          </div>
        )}

        <textarea 
          className="input-area" 
          placeholder={step === 'search' ? 'Ключевое слово для поиска (опционально)...' : 'Вставьте ваш текст здесь...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button className="btn-main" disabled={loading}>
          {loading ? 'Обработка...' : step === 'search' ? 'Найти тренды' : 'Запустить магию'}
        </button>

        {results && <div className="results-box">
          {/* Здесь рендеринг результатов в зависимости от шага */}
        </div>}
      </main>
    </div>
  );
}
