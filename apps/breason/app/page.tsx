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
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", summary: "Тёплая, доверительная B2B-коммуникация. Важны отношения и местное доверие." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", summary: "Прагматичная, скептичная аудитория. Ценит конкретику, а не хайп." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", summary: "Структурированный рынок. Надёжность и соответствие стандартам важнее эмоций." },
};

const stepLabels: Record<Step, string> = { search: "Искать", evaluate: "Проверять", improve: "Улучшать" };
const stepSubs:   Record<Step, string> = { search: "Тренды рынка", evaluate: "Анализ текста", improve: "Сделать красиво" };
const STEPS: Step[] = ["search", "evaluate", "improve"];

// ОБНОВЛЕННЫЙ СПИСОК ПРОВАЙДЕРОВ
const PROVIDERS = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite (Auto)" },
  { id: "gemini-3-flash-preview",        name: "Gemini 3 Flash" },
  { id: "openrouter",                    name: "OpenRouter (Fallback)" },
  { id: "groq",                          name: "Groq (Fast)" },
  { id: "openai",                        name: "OpenAI" },
  { id: "anthropic",                     name: "Anthropic" },
];

/* ─── Design tokens (STYLE) ─────────────────────────────────────────────── */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --violet:#7C3AED;
  --violet-soft:rgba(124,58,237,0.08);
  --violet-border:rgba(124,58,237,0.25);
  --lime:#84CC16;
  --lime-soft:rgba(132,204,22,0.10);
  --lime-border:rgba(132,204,22,0.30);
  --orange:#F97316;
  --orange-soft:rgba(249,115,22,0.10);
  --orange-hover:#EA6C0A;
  --sky:#0EA5E9;
  --sky-soft:rgba(14,165,233,0.08);
  --sky-border:rgba(14,165,233,0.25);
  --metal:#475569;
  --white:#FFFFFF;
  --bg:#F8FAFC;
  --surface:#FFFFFF;
  --surface2:#F1F5F9;
  --surface3:#E2E8F0;
  --border:rgba(71,85,105,0.12);
  --border2:rgba(71,85,105,0.20);
  --t1:#1E293B;
  --t2:#475569;
  --t3:#94A3B8;
  --font:'DM Sans',system-ui,sans-serif;
  --disp:'Syne',system-ui,sans-serif;
  --r:14px;
  --r2:8px;
  --shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:0 4px 12px rgba(0,0,0,0.08);
}

@media(prefers-color-scheme:dark){
  :root{
    --bg:#0F172A;
    --surface:#1E293B;
    --surface2:#0F172A;
    --surface3:#334155;
    --border:rgba(255,255,255,0.07);
    --border2:rgba(255,255,255,0.13);
    --t1:#F1F5F9;
    --t2:#94A3B8;
    --t3:#475569;
    --shadow:0 1px 3px rgba(0,0,0,0.3);
    --shadow-md:0 4px 12px rgba(0,0,0,0.4);
  }
}

body{font-family:var(--font);background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5}

.shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:220px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}

.sb-logo{padding:20px 18px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;cursor:pointer;text-decoration:none}
.sb-mark{width:32px;height:32px;border-radius:9px;background:var(--lime);display:grid;place-items:center}
.sb-mark-b{font-family:var(--disp);font-weight:800;font-size:15px;color:#1a2e05}
.sb-brand{font-family:var(--disp);font-size:15px;font-weight:700;color:var(--t1)}

.sb-nav{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:3px}
.step-btn{display:flex;align-items:center;gap:10px;width:100%;border:none;background:transparent;padding:10px 10px;border-radius:10px;cursor:pointer;text-align:left}
.step-btn.active{background:var(--lime)}
.step-num{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--border2);font-size:11px;font-weight:700;display:grid;place-items:center}
.step-label{font-size:13px;font-weight:600;color:var(--t2)}
.step-sub{font-size:10.5px;color:var(--t3)}

.topbar{height:52px;background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;display:flex;align-items:center;justify-content:space-between}
.page-name{font-size:12.5px;font-weight:600;color:var(--t1)}
.pill{height:26px;padding:0 10px;border-radius:999px;background:var(--sky-soft);border:1px solid var(--sky-border);font-size:11px;color:var(--sky);display:flex;align-items:center;gap:6px}

.content{flex:1;overflow-y:auto;padding:24px}
.hero{background:linear-gradient(135deg,var(--violet) 0%,#5B21B6 100%);border-radius:var(--r);padding:24px 28px;margin-bottom:20px;color:#fff}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;margin-bottom:12px}

.market-row{display:flex;gap:8px;margin-bottom:18px}
.mkt{flex:1;border:1.5px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;background:var(--surface)}
.mkt.sel{border-color:var(--lime);background:var(--lime-soft)}

.field-label{font-size:10.5px;font-weight:600;text-transform:uppercase;color:var(--t3);margin-bottom:6px}
.inp, select, textarea{width:100%;border:1.5px solid var(--border);border-radius:var(--r2);padding:10px;background:var(--surface2);color:var(--t1);outline:none}
.sel-wrap{position:relative}

.btn-cta{height:44px;border:none;border-radius:var(--r2);background:var(--orange);color:#fff;font-weight:700;cursor:pointer;padding:0 22px;width:100%}
.btn-cta:disabled{background:var(--surface3);cursor:not-allowed}

.err{background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.25);padding:10px;color:#DC2626;border-radius:var(--r2);margin:10px 0}
.toast{position:fixed;bottom:20px;right:20px;background:var(--surface);border:1px solid var(--lime);padding:10px 16px;border-radius:var(--r2);z-index:99}

.improve-panels{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.improve-panel{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r);display:flex;flex-direction:column;min-height:400px}
.improve-panel-hd{padding:10px 18px;border-bottom:1px solid var(--border);background:var(--surface2);font-size:12px;font-weight:600}
.improve-panel-body{padding:18px;flex:1;display:flex;flex-direction:column}
`;

/* ─── Market Picker ─────────────────────────────────────────────────────── */
function MarketPicker({ market, onChange }: { market: string; onChange: (m: MarketKey) => void }) {
  return (
    <div className="market-row">
      {Object.keys(MARKETS).map((k) => (
        <button key={k} className={`mkt${market === k ? " sel" : ""}`} onClick={() => onChange(k as MarketKey)}>
          <div>{MARKETS[k].flag} {MARKETS[k].label}</div>
        </button>
      ))}
    </div>
  );
}

/* ─── STEP 1: Искать ────────────────────────────────────────────────────── */
function SearchStep({ onSendToImprove, onSendToEvaluate }: { onSendToImprove: (t: string) => void; onSendToEvaluate: (t: string) => void }) {
  const [market, setMarket] = useState("brazil");
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
    <>
      <div className="hero"><h1>B2B Тренды 2026</h1><p>Живая аналитика рынка в реальном времени.</p></div>
      <div className="card">
        <div className="field-label">Регион</div>
        <MarketPicker market={market} onChange={setMarket} />
        <button className="btn-cta" onClick={findTrends} disabled={loading}>{loading ? "Анализируем..." : "Найти тренды"}</button>
      </div>
      {error && <div className="err">{error}</div>}
      {trends.map((t: any, i) => (
        <div className="card" key={i}>
          <div style={{fontWeight:700, marginBottom:8}}>{t.trend_name}</div>
          <div style={{fontSize:13, fontStyle:'italic', color:'var(--violet)'}}>«{t.narrative_hook}»</div>
        </div>
      ))}
    </>
  );
}

/* ─── STEP 2: Проверять ─────────────────────────────────────────────────── */
function EvaluateStep({ initialText, onSendToImprove }: { initialText: string; onSendToImprove: (t: string) => void }) {
  const [text, setText] = useState(initialText);
  return (
    <div className="card">
      <div className="field-label">Ваш текст</div>
      <textarea rows={8} value={text} onChange={e => setText(e.target.value)} />
      <button className="btn-cta" style={{marginTop:12}} onClick={() => onSendToImprove(text)}>Перейти к улучшению</button>
    </div>
  );
}

/* ─── STEP 3: Улучшать ──────────────────────────────────────────────────── */
function ImproveStep({ initialText, onStreaming }: { initialText: string; onStreaming: (v: boolean) => void }) {
  const [inputText, setInputText] = useState(initialText);
  const [result, setResult]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);
  
  // УСТАНОВКА МОДЕЛИ ПО УМОЛЧАНИЮ
  const [provider, setProvider]   = useState("gemini-3.1-flash-lite-preview");
  const [prompt, setPrompt]       = useState("reduck/brazil-warmth@1");

  useEffect(() => { if (initialText) setInputText(initialText); }, [initialText]);

  async function run() {
    setIsLoading(true); onStreaming(true); setResult(""); setError("");
    try {
      const res = await fetch("/api/reduck/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, providerId: provider, promptVersion: prompt })
      });
      if (!res.ok) throw new Error("Ошибка генерации");
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader!.read();
        done = d;
        if (value) setResult(prev => prev + dec.decode(value).replace(/data: /g, "").replace(/\[DONE\]/g, ""));
      }
    } catch (e: any) { setError(e.message); }
    finally { setIsLoading(false); onStreaming(false); }
  }

  return (
    <>
      <div className="hero"><h1>Улучшение текста</h1><p>Адаптация под Tone of Voice региона.</p></div>
      <div className="improve-wrap">
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
          <div>
            <div className="field-label">Провайдер</div>
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <div className="field-label">Цель</div>
            <select value={prompt} onChange={e => setPrompt(e.target.value)}>
              {Object.keys(REDUCK_PROMPT_MAP).map(k => <option key={k} value={`reduck/${k}@1`}>{REDUCK_PROMPT_MAP[k].label}</option>)}
            </select>
          </div>
        </div>
        <div className="improve-panels">
          <div className="improve-panel">
            <div className="improve-panel-hd">Оригинал</div>
            <div className="improve-panel-body"><textarea style={{border:'none', background:'none', flex:1}} value={inputText} onChange={e => setInputText(e.target.value)} /></div>
          </div>
          <div className="improve-panel">
            <div className="improve-panel-hd">Результат</div>
            <div className="improve-panel-body" style={{whiteSpace:'pre-wrap', fontSize:14}}>{result}</div>
          </div>
        </div>
        {error && <div className="err">{error}</div>}
        <button className="btn-cta" style={{marginTop:12}} onClick={run} disabled={isLoading}>{isLoading ? "Работаем..." : "Сделать красиво →"}</button>
      </div>
    </>
  );
}

/* ─── Root App ──────────────────────────────────────────────────────────── */
export default function BreasonApp() {
  const [step, setStep] = useState<Step>("search");
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);

  return (
    <>
      <style>{STYLE}</style>
      <div className="shell">
        <aside className="sidebar">
          <div className="sb-logo"><div className="sb-mark"><span className="sb-mark-b">B</span></div><span className="sb-brand">Breason</span></div>
          <nav className="sb-nav">
            {STEPS.map((s, i) => (
              <button key={s} className={`step-btn${step === s ? " active" : ""}`} onClick={() => setStep(s)}>
                <div className="step-num">{i + 1}</div>
                <div><span className="step-label">{stepLabels[s]}</span><span className="step-sub">{stepSubs[s]}</span></div>
              </button>
            ))}
          </nav>
        </aside>
        <div className="main">
          <header className="topbar"><span className="page-name">{stepLabels[step]}</span>{streaming && <div className="pill">Генерируем...</div>}</header>
          <div className="content">
            {step === "search" && <SearchStep onSendToImprove={t => {setText(t); setStep("improve")}} onSendToEvaluate={t => {setText(t); setStep("evaluate")}} />}
            {step === "evaluate" && <EvaluateStep initialText={text} onSendToImprove={t => {setText(t); setStep("improve")}} />}
            {step === "improve" && <ImproveStep initialText={text} onStreaming={setStreaming} />}
          </div>
        </div>
      </div>
    </>
  );
}
