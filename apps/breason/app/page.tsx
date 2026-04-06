"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

type Step = "search" | "evaluate" | "improve";

const MARKETS: Record<string, { label: string; flag: string; lang: string; summary: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", summary: "Тёплая, доверительная B2B-коммуникация. Важны отношения и местное доверие." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", summary: "Прагматичная, скептичная аудитория. Ценит конкретику, а не хайп." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", summary: "Структурированный рынок. Надёжность и соответствие стандартам важнее эмоций." },
};

const STYLE = `
:root {
  --purple: #7C3AED;
  --blue: #0EA5E9;
  --metal: #475569;
  --white: #FFFFFF;
  --orange: #F97316;
  --lime: #84CC16;
  --bg: var(--white);
  --t1: var(--metal);
}

body { 
  background: var(--bg); 
  color: var(--t1); 
  font-family: 'DM Sans', sans-serif;
}

.sb-mark { 
  background: var(--lime); 
  color: var(--white); 
  cursor: pointer;
  transition: transform 0.2s;
}
.sb-mark:hover { transform: scale(1.05); }

.sb-brand { 
  color: var(--purple); 
  font-weight: 800; 
  cursor: pointer;
}

/* Яркие лаймовые шаги */
.hero-badge {
  background: var(--lime) !important;
  color: var(--white) !important;
  font-weight: 900 !important;
  padding: 6px 16px !important;
  box-shadow: 0 4px 12px rgba(132, 204, 22, 0.3);
}

.step-btn.active .step-num {
  background: var(--lime) !important;
  color: var(--white) !important;
  border-color: var(--lime) !important;
}

.btn-primary {
  background: var(--orange);
  color: var(--white);
}
.btn-primary:hover {
  background: var(--purple);
}

.trend-card {
  border-left: 4px solid var(--lime);
}

.score-bar-fill {
  background: var(--blue) !important;
}
`;

// ... (остальной вспомогательный код из вашего page.tsx остается, меняем только UI часть)

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [improveText, setImproveText] = useState("");
  const [evaluateText, setEvaluateText] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Функция возврата "Домой"
  const resetToHome = () => {
    setStep("search");
    setImproveText("");
    setEvaluateText("");
  };

  return (
    <>
      <style>{STYLE}</style>
      <div className="shell">
        <aside className="sidebar">
          {/* Кликабельный логотип */}
          <div className="sb-top" onClick={resetToHome} style={{ cursor: 'pointer' }}>
            <div className="sb-mark">B</div>
            <span className="sb-brand">Breason</span>
          </div>
          
          <div className="sb-steps">
            {["search", "evaluate", "improve"].map((s, i) => (
              <button 
                key={s} 
                className={`step-btn${step === s ? " active" : ""}`} 
                onClick={() => setStep(s as Step)}
              >
                <div className="step-num">{i + 1}</div>
                <div>
                  <span className="step-label" style={{ fontWeight: step === s ? 800 : 500 }}>
                    {s === "search" ? "Искать" : s === "evaluate" ? "Проверять" : "Улучшать"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-left" onClick={resetToHome} style={{ cursor: 'pointer' }}>
              <span className="page-name" style={{ color: 'var(--purple)', fontWeight: 700 }}>Breason</span>
              <span className="crumb-sep">/</span>
              <span className="page-name">{step}</span>
            </div>
          </header>

          <div className="content">
            {step === "search"   && <SearchStep onSendToImprove={setImproveText} onSendToEvaluate={setEvaluateText} />}
            {step === "evaluate" && <EvaluateStep initialText={evaluateText} onSendToImprove={setImproveText} />}
            {step === "improve"  && <ImproveStep initialText={improveText} onStreaming={setStreaming} />}
          </div>
        </div>
      </div>
    </>
  );
}
