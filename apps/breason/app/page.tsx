"use client";

import { useRef, useState, useEffect } from "react";
import { REDUCK_PROMPT_MAP } from "@breason/prompts";

type Step = "search" | "evaluate" | "improve";

const MARKETS: Record<string, { label: string; flag: string; lang: string; summary: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", summary: "Тёплая B2B-коммуникация." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", summary: "Прагматичная аудитория." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", summary: "Стандарты и надёжность." },
};

const PROVIDERS = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite (Standard)" },
  { id: "llama-4-scout",                 name: "Groq: Llama 4 Scout (Ultra Fast)" },
  { id: "llama-3.3-70b-versatile",       name: "Groq: Llama 3.3 70B" },
  { id: "gpt-oss-120b",                  name: "Groq: GPT OSS 120B" },
  { id: "openrouter",                    name: "OpenRouter (Universal)" },
];

const STYLE = `
:root {
  --violet: #7C3AED; --lime: #84CC16; --orange: #F97316; --bg: #F8FAFC; --surface: #FFFFFF;
  --t1: #1E293B; --t2: #475569; --t3: #94A3B8; --border: rgba(71,85,105,0.12);
  --font: 'DM Sans', sans-serif; --r: 14px;
}
body { font-family: var(--font); background: var(--bg); color: var(--t1); margin: 0; }
.shell { display: flex; height: 100vh; }
.sidebar { width: 240px; border-right: 1px solid var(--border); background: var(--surface); padding: 20px; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.content { padding: 30px; overflow-y: auto; flex: 1; }
.card { background: #fff; border: 1px solid var(--border); border-radius: var(--r); padding: 20px; margin-bottom: 15px; }
.btn-cta { background: var(--orange); color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; }
.inp, select, textarea { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border); margin-top: 5px; background: #F1F5F9; }
.field-label { font-size: 11px; font-weight: 700; color: var(--t3); text-transform: uppercase; margin-top: 15px; }
.step-btn { display: block; width: 100%; padding: 10px; text-align: left; border: none; background: none; cursor: pointer; border-radius: 8px; margin-bottom: 5px; }
.step-btn.active { background: var(--lime); font-weight: 700; }
`;

function SearchStep() {
  const [market, setMarket] = useState("brazil");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);

  async function find() {
    setLoading(true);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      setTrends(data.trends || []);
    } catch { alert("Ошибка"); }
    finally { setLoading(false); }
  }

  return (
    <div className="card">
      <div className="field-label">Регион поиска</div>
      <select value={market} onChange={e => setMarket(e.target.value)}>
        {Object.keys(MARKETS).map(k => <option key={k} value={k}>{MARKETS[k].label}</option>)}
      </select>
      <button className="btn-cta" style={{marginTop:20}} onClick={find} disabled={loading}>{loading ? "Поиск..." : "Найти тренды"}</button>
      {trends.map((t, i) => <div key={i} className="card" style={{marginTop:15}}><strong>{t.trend_name}</strong></div>)}
    </div>
  );
}

function ImproveStep() {
  const [provider, setProvider] = useState("gemini-3.1-flash-lite-preview");
  const [text, setText] = useState("");
  const [res, setRes] = useState("");

  return (
    <div className="card">
      <div className="field-label">Модель (Провайдер)</div>
      <select value={provider} onChange={e => setProvider(e.target.value)}>
        {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="field-label" style={{marginTop:20}}>Текст для обработки</div>
      <textarea rows={5} value={text} onChange={e => setText(e.target.value)} />
      <button className="btn-cta" style={{marginTop:15}} onClick={() => setRes("Генерация через " + provider + "...")}>Улучшить</button>
      {res && <div className="card" style={{marginTop:15, background:'#F0FDF4'}}>{res}</div>}
    </div>
  );
}

export default function Page() {
  const [step, setStep] = useState<Step>("search");
  return (
    <div className="shell">
      <style>{STYLE}</style>
      <aside className="sidebar">
        <h2>Breason</h2>
        <button className={`step-btn ${step === 'search' ? 'active' : ''}`} onClick={() => setStep('search')}>1. Тренды</button>
        <button className={`step-btn ${step === 'improve' ? 'active' : ''}`} onClick={() => setStep('improve')}>2. Улучшить</button>
      </aside>
      <main className="main">
        <div className="content">
          {step === "search" ? <SearchStep /> : <ImproveStep />}
        </div>
      </main>
    </div>
  );
}
