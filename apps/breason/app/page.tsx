"use client";

import { useRef, useState, useEffect } from "react";
import { REDUCK_PROMPT_MAP } from "@breason/prompts";
import type {
  AIResponseMeta,
  AnalyzeResult,
  MarketKey,
  ReDuckProcessRequest,
  ResonanceGenerateResponse,
  ResonanceTrend,
  ResonanceTrendsResponse,
} from "@breason/types";

type Step = "search" | "evaluate" | "improve";

const MARKETS: Record<string, { label: string; flag: string; lang: string; summary: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", summary: "Тёплая, доверительная B2B-коммуникация. Важны отношения и местного доверие." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", summary: "Прагматичная, скептичная аудитория. Ценит конкретику, а не хайп." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", summary: "Структурированный рынок. Надёжность и соответствие стандартам важнее эмоций." },
};

const stepLabels: Record<Step, string> = { search: "Искать", evaluate: "Проверять", improve: "Улучшать" };
const stepSubs:   Record<Step, string> = { search: "Тренды рынка", evaluate: "Анализ текста", improve: "Сделать красиво" };
const STEPS: Step[] = ["search", "evaluate", "improve"];

// ОБНОВЛЕННЫЙ СПИСОК ПРОВАЙДЕРОВ С GROQ
const PROVIDERS = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite (Auto)" },
  { id: "llama-3.3-70b-versatile",       name: "Groq: Llama 3.3 70B (Fast)" },
  { id: "llama-4-scout",                 name: "Groq: Llama 4 Scout" },
  { id: "gpt-oss-120b",                  name: "Groq: GPT OSS 120B" },
  { id: "openrouter",                    name: "OpenRouter (Fallback)" },
];

/* ─── Design tokens & Global Styles ─────────────────────────────────────── */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --violet: #7C3AED;
  --violet-soft: rgba(124, 58, 237, 0.08);
  --violet-border: rgba(124, 58, 237, 0.25);
  --lime: #84CC16;
  --lime-soft: rgba(132, 204, 22, 0.10);
  --lime-border: rgba(132, 204, 22, 0.30);
  --orange: #F97316;
  --orange-soft: rgba(249, 115, 22, 0.10);
  --orange-hover: #EA6C0A;
  --sky: #0EA5E9;
  --sky-soft: rgba(14, 165, 233, 0.08);
  --sky-border: rgba(14, 165, 233, 0.25);
  --metal: #475569;
  --white: #FFFFFF;
  --bg: #F8FAFC;
  --surface: #FFFFFF;
  --surface2: #F1F5F9;
  --surface3: #E2E8F0;
  --border: rgba(71, 85, 105, 0.12);
  --border2: rgba(71, 85, 105, 0.20);
  --t1: #1E293B;
  --t2: #475569;
  --t3: #94A3B8;
  --font: 'DM Sans', system-ui, sans-serif;
  --disp: 'Syne', system-ui, sans-serif;
  --r: 14px;
  --r2: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0F172A;
    --surface: #1E293B;
    --surface2: #0F172A;
    --surface3: #334155;
    --border: rgba(255, 255, 255, 0.07);
    --border2: rgba(255, 255, 255, 0.13);
    --t1: #F1F5F9;
    --t2: #94A3B8;
    --t3: #475569;
    --shadow: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  }
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--t1);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}

.shell { display: flex; height: 100vh; overflow: hidden; position: relative; }

.sidebar {
  width: 260px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 10;
}

@media (max-width: 900px) { .sidebar { display: none; } }

.sb-logo {
  padding: 24px 20px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.sb-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--lime);
  display: grid;
  place-items: center;
  box-shadow: 0 2px 8px rgba(132, 204, 22, 0.3);
}
.sb-mark-b { font-family: var(--disp); font-weight: 800; font-size: 18px; color: #1a2e05; }
.sb-brand { font-family: var(--disp); font-size: 18px; font-weight: 700; color: var(--t1); letter-spacing: -0.02em; }

.sb-nav { flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.step-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 12px 14px;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.step-btn:hover { background: var(--surface2); }
.step-btn.active { background: var(--violet-soft); }
.step-btn.active .step-num { background: var(--violet); color: #fff; border-color: var(--violet); }
.step-btn.active .step-label { color: var(--violet); }

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--border2);
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  color: var(--t3);
  transition: all 0.2s;
}
.step-info { display: flex; flex-direction: column; }
.step-label { font-size: 14px; font-weight: 600; color: var(--t2); }
.step-sub { font-size: 11px; color: var(--t3); font-weight: 400; }

.main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); position: relative; }

.topbar {
  height: 64px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.crumb { font-size: 13px; color: var(--t3); font-weight: 500; }
.crumb-sep { margin: 0 4px; opacity: 0.5; }
.page-name { font-size: 14px; font-weight: 700; color: var(--t1); }

.pill {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--sky-soft);
  border: 1px solid var(--sky-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--sky);
  display: flex;
  align-items: center;
  gap: 8px;
  animation: pulse 2s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
.pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sky); }

.step-bar { height: 3px; background: var(--surface3); display: flex; }
.step-seg { flex: 1; height: 100%; transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.step-seg.active { background: var(--violet); box-shadow: 0 0 10px var(--violet); }

.content { flex: 1; overflow-y: auto; padding: 32px; }
.content-inner { max-width: 1000px; margin: 0 auto; }

.hero {
  background: linear-gradient(135deg, var(--violet) 0%, #5B21B6 100%);
  border-radius: var(--r);
  padding: 32px 36px;
  margin-bottom: 24px;
  color: #fff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.3);
}
.hero h1 { font-family: var(--disp); font-size: 28px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.02em; }
.hero p { font-size: 15px; opacity: 0.9; font-weight: 500; max-width: 500px; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover { box-shadow: var(--shadow-md); }

.field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--t3); margin-bottom: 8px; display: block; }

.market-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.mkt {
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  background: var(--surface);
  text-align: center;
  transition: all 0.2s;
}
.mkt:hover { border-color: var(--border2); transform: translateY(-2px); }
.mkt.sel { border-color: var(--lime); background: var(--lime-soft); box-shadow: 0 4px 12px rgba(132, 204, 22, 0.15); }
.mkt-flag { font-size: 24px; margin-bottom: 8px; display: block; }
.mkt-name { font-size: 14px; font-weight: 700; color: var(--t1); }

.btn-cta {
  height: 52px;
  border: none;
  border-radius: 12px;
  background: var(--orange);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 28px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.3);
}
.btn-cta:hover { background: var(--orange-hover); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4); }
.btn-cta:disabled { background: var(--surface3); color: var(--t3); cursor: not-allowed; box-shadow: none; transform: none; }

.inp, select, textarea {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  background: var(--surface2);
  color: var(--t1);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  transition: all 0.2s;
}
.inp:focus, select:focus, textarea:focus { border-color: var(--violet-border); background: var(--surface); box-shadow: 0 0 0 4px var(--violet-soft); }

.err {
  background: rgba(239, 68, 68, 0.08);
  border: 1.5px solid rgba(239, 68, 68, 0.2);
  padding: 14px 18px;
  color: #DC2626;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  margin: 16px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.trend-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-left: 4px solid var(--lime);
}
.trend-title { font-size: 18px; font-weight: 700; color: var(--t1); }
.trend-hook { font-size: 15px; font-weight: 500; color: var(--violet); font-style: italic; }
.trend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
.trend-meta { font-size: 12px; color: var(--t2); }
.trend-meta-label { font-weight: 700; color: var(--t3); text-transform: uppercase; font-size: 10px; margin-bottom: 2px; display: block; }

.improve-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
@media (max-width: 800px) { .improve-panels { grid-template-columns: 1fr; } }

.improve-panel {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--r);
  display: flex;
  flex-direction: column;
  min-height: 400px;
  overflow: hidden;
}
.improve-panel-hd {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--t2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.improve-panel-body { padding: 20px; flex: 1; display: flex; flex-direction: column; position: relative; }
.panel-textarea {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  resize: none;
  font-size: 15px;
  line-height: 1.6;
  color: var(--t1);
  padding: 0;
}
.panel-textarea:focus { box-shadow: none; }

.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  background: var(--violet);
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

.mobile-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); border-top: 1px solid var(--border); padding: 12px 20px; z-index: 100; }
@media (max-width: 900px) { .mobile-nav { display: block; } }
.mobile-nav-inner { display: flex; justify-content: space-between; max-width: 500px; margin: 0 auto; }
.mobile-step-btn { border: none; background: none; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--t3); }
.mobile-step-btn.active { color: var(--violet); }
`;

/* ─── Components ────────────────────────────────────────────────────────── */

function MarketPicker({ market, onChange }: { market: string; onChange: (m: MarketKey) => void }) {
  return (
    <div className="market-row">
      {Object.keys(MARKETS).map((k) => (
        <div key={k} className={`mkt${market === k ? " sel" : ""}`} onClick={() => onChange(k as MarketKey)}>
          <span className="mkt-flag">{MARKETS[k].flag}</span>
          <span className="mkt-name">{MARKETS[k].label}</span>
        </div>
      ))}
    </div>
  );
}

function SearchStep({ onSendToImprove, onSendToEvaluate }: { onSendToImprove: (t: string) => void; onSendToEvaluate: (t: string) => void }) {
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<ResonanceTrend[]>([]);
  const [error, setError] = useState("");

  async function findTrends() {
    setLoading(true); setTrends([]); setError("");
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка сервера");
      setTrends(json.trends || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="content-inner">
      <div className="hero">
        <h1>B2B Тренды 2026</h1>
        <p>Используем ИИ для поиска реальных инсайтов на выбранном рынке.</p>
      </div>
      <div className="card">
        <label className="field-label">Целевой рынок</label>
        <MarketPicker market={market} onChange={setMarket} />
        <button className="btn-cta" onClick={findTrends} disabled={loading}>
          {loading ? "Анализируем..." : "Найти тренды региона"}
        </button>
      </div>
      {error && <div className="err"><span>⚠️</span> {error}</div>}
      {trends.map((t, i) => (
        <div className="card trend-card" key={i}>
          <div className="trend-title">{t.trend_name}</div>
          <div className="trend-hook">«{t.narrative_hook}»</div>
          <div className="trend-grid">
            <div>
              <span className="trend-meta-label">Конфликт</span>
              <div className="trend-meta">{t.market_tension}</div>
            </div>
            <div>
              <span className="trend-meta-label">Почему сейчас</span>
              <div className="trend-meta">{t.why_now}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button 
              className="btn-cta" 
              style={{ height: 36, fontSize: 12, background: 'var(--violet)' }}
              onClick={() => onSendToImprove(t.trend_name + ": " + t.narrative_hook)}
            >Адаптировать текст</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvaluateStep({ initialText, onSendToImprove }: { initialText: string; onSendToImprove: (t: string) => void }) {
  const [text, setText] = useState(initialText);
  return (
    <div className="content-inner">
      <div className="card">
        <label className="field-label">Анализируемый текст</label>
        <textarea className="inp" rows={12} value={text} onChange={e => setText(e.target.value)} placeholder="Вставьте ваш текст..." />
        <button className="btn-cta" style={{ marginTop: 20 }} onClick={() => onSendToImprove(text)}>
          Перейти к улучшению
        </button>
      </div>
    </div>
  );
}

function ImproveStep({ initialText, onStreaming }: { initialText: string; onStreaming: (v: boolean) => void }) {
  const [inputText, setInputText] = useState(initialText);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // УСТАНОВКА МОДЕЛИ ПО УМОЛЧАНИЮ
  const [provider, setProvider] = useState("gemini-3.1-flash-lite-preview");
  const [prompt, setPrompt] = useState("reduck/brazil-warmth@1");

  useEffect(() => { if (initialText) setInputText(initialText); }, [initialText]);

  async function run() {
    setIsLoading(true); onStreaming(true); setResult(""); setError("");
    try {
      const res = await fetch("/api/reduck/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, providerId: provider, promptVersion: prompt } as ReDuckProcessRequest)
      });
      if (!res.ok) throw new Error("Ошибка генерации");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader!.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              setResult(prev => prev + data);
            }
          }
        }
      }
    } catch (e: any) { setError(e.message); }
    finally { setIsLoading(false); onStreaming(false); }
  }

  return (
    <div className="content-inner">
      <div className="hero">
        <h1>Улучшение и адаптация</h1>
        <p>Меняем структуру, тон и подачу текста под конкретный культурный код.</p>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label">Провайдер ИИ</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Инструкция (Tone of Voice)</label>
            <select value={prompt} onChange={e => setPrompt(e.target.value)}>
              {Object.keys(REDUCK_PROMPT_MAP).map(k => (
                <option key={k} value={`reduck/${k}@1`}>{REDUCK_PROMPT_MAP[k].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="improve-panels">
        <div className="improve-panel">
          <div className="improve-panel-hd">Исходный текст</div>
          <div className="improve-panel-body">
            <textarea className="panel-textarea" value={inputText} onChange={e => setInputText(e.target.value)} />
          </div>
        </div>
        <div className="improve-panel">
          <div className="improve-panel-hd">Улучшенная версия</div>
          <div className="improve-panel-body">
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6 }}>
              {result}
              {isLoading && <span className="stream-cursor" />}
            </div>
            {!result && !isLoading && <div style={{ color: 'var(--t3)', fontSize: 14 }}>Нажмите кнопку ниже, чтобы запустить магию...</div>}
          </div>
        </div>
      </div>

      {error && <div className="err"><span>⚠️</span> {error}</div>}

      <button className="btn-cta" onClick={run} disabled={isLoading || !inputText}>
        {isLoading ? "Генерируем шедевр..." : "Улучшить текст →"}
      </button>
    </div>
  );
}

/* ─── Layout ────────────────────────────────────────────────────────────── */

export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [evaluateText, setEvaluateText] = useState("");
  const [improveText, setImproveText] = useState("");
  const [streaming, setStreaming] = useState(false);

  const goEvaluate = (t: string) => { setEvaluateText(t); setStep("evaluate"); };
  const goImprove  = (t: string) => { setImproveText(t); setStep("improve"); };

  return (
    <div className="shell">
      <style>{STYLE}</style>

      {/* Sidebar Desktop */}
      <aside className="sidebar">
        <a href="/" className="sb-logo">
          <div className="sb-mark"><span className="sb-mark-b">B</span></div>
          <span className="sb-brand">Breason</span>
        </a>
        <nav className="sb-nav">
          {STEPS.map((s, i) => (
            <button key={s} className={`step-btn${step === s ? " active" : ""}`} onClick={() => setStep(s)}>
              <div className="step-num">{i + 1}</div>
              <div className="step-info">
                <span className="step-label">{stepLabels[s]}</span>
                <span className="step-sub">{stepSubs[s]}</span>
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Nav */}
      <div className="mobile-nav">
        <div className="mobile-nav-inner">
          {STEPS.map((s, i) => (
            <button key={s} className={`mobile-step-btn${step === s ? " active" : ""}`} onClick={() => setStep(s)}>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{i + 1}</span>
              {stepLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="crumb">Breason <span className="crumb-sep">/</span></span>
            <span className="page-name">{stepLabels[step]}</span>
          </div>
          {streaming && (
            <div className="pill">
              <span className="pill-dot" />
              Генерируем…
            </div>
          )}
        </header>

        <div className="step-bar">
          {STEPS.map((s) => <div key={s} className={`step-seg${step === s ? " active" : ""}`} />)}
        </div>

        <div className="content">
          {step === "search" && <SearchStep onSendToImprove={goImprove} onSendToEvaluate={goEvaluate} />}
          {step === "evaluate" && <EvaluateStep initialText={evaluateText} onSendToImprove={goImprove} />}
          {step === "improve" && <ImproveStep initialText={improveText} onStreaming={setStreaming} />}
        </div>
      </div>
    </div>
  );
}
