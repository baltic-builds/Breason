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

const PROVIDERS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "groq",             name: "Groq" },
  { id: "openrouter",       name: "OpenRouter" },
  { id: "openai",           name: "OpenAI" },
  { id: "anthropic",        name: "Anthropic" },
];

/* ─── Design tokens ──────────────────────────────────────────────────────── */
// 6 brand colours, each with semantic meaning:
// --violet  #7C3AED  Care & collaboration  → headings, accents
// --lime    #84CC16  Energy                → logo, active step, trend tags
// --orange  #F97316  Optimism              → CTA buttons, scores
// --sky     #0EA5E9  Trust                 → secondary elements, info boxes
// --metal   #475569  Reliability           → body text, labels
// --white   #FFFFFF  Creativity            → page & card backgrounds

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

/* ── Shell ── */
.shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:220px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;transition:transform .2s}
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}

/* ── Sidebar ── */
.sb-logo{padding:20px 18px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;cursor:pointer;text-decoration:none}
.sb-logo:hover .sb-mark{transform:scale(1.05)}
.sb-mark{width:32px;height:32px;border-radius:9px;background:var(--lime);display:grid;place-items:center;flex-shrink:0;transition:transform .15s}
.sb-mark-b{font-family:var(--disp);font-weight:800;font-size:15px;color:#1a2e05}
.sb-brand{font-family:var(--disp);font-size:15px;font-weight:700;color:var(--t1);letter-spacing:-.02em}

.sb-nav{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:3px}

.step-btn{
  display:flex;align-items:center;gap:10px;
  width:100%;border:none;background:transparent;
  padding:10px 10px;border-radius:10px;
  cursor:pointer;font-family:var(--font);
  transition:background .15s;text-align:left;
}
.step-btn:hover{background:var(--surface2)}
.step-btn.active{background:var(--lime);box-shadow:0 2px 8px rgba(132,204,22,0.3)}

.step-num{
  width:24px;height:24px;border-radius:50%;
  border:1.5px solid var(--border2);
  font-size:11px;font-weight:700;font-family:var(--disp);
  display:grid;place-items:center;flex-shrink:0;
  color:var(--t3);transition:all .15s;
}
.step-btn.active .step-num{border-color:rgba(26,46,5,0.3);background:rgba(26,46,5,0.15);color:#1a2e05}
.step-btn.active .step-label{color:#1a2e05}
.step-btn.active .step-sub{color:rgba(26,46,5,0.6)}

.step-label{font-size:13px;font-weight:600;color:var(--t2);display:block;transition:color .15s}
.step-btn:hover .step-label{color:var(--t1)}
.step-sub{font-size:10.5px;color:var(--t3);display:block;margin-top:1px}

.sb-foot{padding:14px 18px;border-top:1px solid var(--border);font-size:11px;color:var(--t3);display:flex;align-items:center;gap:6px}
.sb-foot-love{opacity:.5;font-size:10px}

/* ── Topbar ── */
.topbar{
  height:52px;background:var(--surface);border-bottom:1px solid var(--border);
  padding:0 24px;display:flex;align-items:center;justify-content:space-between;
  flex-shrink:0;box-shadow:var(--shadow);
}
.topbar-left{display:flex;align-items:center;gap:8px}
.crumb{font-size:12.5px;color:var(--t3)}
.crumb-sep{margin:0 4px;color:var(--t3)}
.page-name{font-size:12.5px;font-weight:600;color:var(--t1)}
.pill{height:26px;padding:0 10px;border-radius:999px;background:var(--sky-soft);border:1px solid var(--sky-border);font-size:11px;color:var(--sky);display:flex;align-items:center;gap:6px}
.pill-dot{width:6px;height:6px;border-radius:50%;background:var(--sky);animation:blink-dot 1.2s ease infinite}
@keyframes blink-dot{0%,100%{opacity:1}50%{opacity:.3}}

/* ── Progress bar ── */
.step-bar{height:3px;background:var(--surface3);flex-shrink:0;display:flex;gap:2px;padding:0 24px}
.step-seg{flex:1;border-radius:2px;background:var(--surface3);transition:background .3s}
.step-seg.active{background:var(--lime)}

/* ── Content ── */
.content{flex:1;overflow-y:auto;padding:24px}

/* ── Hero ── */
.hero{
  background:linear-gradient(135deg,var(--violet) 0%,#5B21B6 100%);
  border-radius:var(--r);padding:24px 28px;margin-bottom:20px;
  display:flex;justify-content:space-between;align-items:center;gap:16px;
  box-shadow:0 4px 20px rgba(124,58,237,0.25);
}
.hero h1{font-family:var(--disp);font-size:20px;font-weight:700;color:#fff;letter-spacing:-.02em;margin-bottom:5px;line-height:1.25}
.hero-sub{font-size:12.5px;color:rgba(255,255,255,0.75);line-height:1.6;max-width:380px}
.hero-badge{font-family:var(--disp);font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;white-space:nowrap;flex-shrink:0}

/* ── Cards ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;box-shadow:var(--shadow)}
.card+.card{margin-top:12px}
.card-label{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--t3);margin-bottom:12px}

/* ── Market chips ── */
.market-row{display:flex;gap:8px;margin-bottom:18px}
.mkt{
  flex:1;border:1.5px solid var(--border);border-radius:10px;
  background:var(--surface);padding:12px 13px;
  text-align:left;cursor:pointer;
  transition:border-color .15s,background .15s,box-shadow .15s;
  box-shadow:var(--shadow);
}
.mkt:hover{border-color:var(--border2);background:var(--surface2)}
.mkt.sel{border-color:var(--lime);background:var(--lime-soft);box-shadow:0 0 0 3px rgba(132,204,22,0.12)}
.mkt-flag{font-size:20px;margin-bottom:5px}
.mkt-name{font-size:12px;font-weight:600;color:var(--t1)}
.mkt-lang{font-size:9.5px;color:var(--t3);margin-top:2px}

/* ── Form controls ── */
.field-label{font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--t3);margin-bottom:6px}
.inp,.sel-wrap select,textarea{
  width:100%;border:1.5px solid var(--border);border-radius:var(--r2);
  padding:10px 13px;font-size:13px;font-family:var(--font);
  background:var(--surface2);color:var(--t1);outline:none;
  transition:border-color .15s,box-shadow .15s;
}
.inp::placeholder,textarea::placeholder{color:var(--t3)}
.inp:focus,textarea:focus,.sel-wrap select:focus{border-color:var(--violet);box-shadow:0 0 0 3px rgba(124,58,237,0.12)}
textarea{resize:none;line-height:1.65;display:block;width:100%}
.sel-wrap{position:relative}
.sel-wrap select{appearance:none;cursor:pointer;padding-right:30px}
.sel-arrow{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:10px;pointer-events:none}
.controls-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hint-bar{border:1.5px solid var(--sky-border);border-left:3px solid var(--sky);border-radius:var(--r2);padding:10px 14px;font-size:12.5px;color:var(--t2);line-height:1.6;margin-bottom:16px;background:var(--sky-soft)}
.hint-bar strong{color:var(--t1);font-weight:600}

/* ── Buttons ── */
.btn-cta{
  height:44px;border:none;border-radius:var(--r2);
  background:var(--orange);color:#fff;
  font-family:var(--disp);font-size:14px;font-weight:700;
  cursor:pointer;transition:background .15s,transform .1s,box-shadow .15s;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:0 22px;letter-spacing:-.01em;
  box-shadow:0 2px 8px rgba(249,115,22,0.35);
}
.btn-cta:hover:not(:disabled){background:var(--orange-hover);box-shadow:0 4px 14px rgba(249,115,22,0.45)}
.btn-cta:active:not(:disabled){transform:scale(.98)}
.btn-cta:disabled{background:var(--surface3);color:var(--t3);cursor:not-allowed;box-shadow:none}
.btn-cta.full{width:100%}

.btn-secondary{
  height:38px;padding:0 16px;border-radius:999px;
  border:1.5px solid var(--border2);background:transparent;
  color:var(--t2);font-size:12.5px;font-family:var(--font);font-weight:500;
  cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px;
}
.btn-secondary:hover{background:var(--surface2);color:var(--t1);border-color:var(--border2)}

.btn-next{
  display:flex;align-items:center;gap:12px;
  background:var(--violet-soft);border:1.5px solid var(--violet-border);
  border-radius:var(--r);padding:14px 18px;
  cursor:pointer;width:100%;font-family:var(--font);
  transition:border-color .15s,background .15s,box-shadow .15s;margin-top:12px;
}
.btn-next:hover{border-color:var(--violet);background:rgba(124,58,237,0.12);box-shadow:0 2px 8px rgba(124,58,237,0.12)}
.btn-next-label{font-size:13.5px;font-weight:600;color:var(--violet);display:block;margin-bottom:2px}
.btn-next-sub{font-size:12px;color:var(--t2)}
.btn-next-arrow{margin-left:auto;color:var(--violet);font-size:20px;flex-shrink:0}

.btn-stop{
  height:38px;padding:0 16px;border-radius:var(--r2);
  border:1.5px solid var(--border2);background:transparent;color:var(--t2);
  font-size:13px;font-family:var(--font);cursor:pointer;transition:all .15s;
}
.btn-stop:hover{border-color:rgba(239,68,68,0.4);color:#EF4444;background:rgba(239,68,68,0.06)}

/* ── Verdict ── */
.verdict-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 14px;font-weight:700;font-size:12px;font-family:var(--disp);margin-bottom:12px}
.v-pass{background:rgba(132,204,22,0.12);color:#3D6A00;border:1.5px solid rgba(132,204,22,0.35)}
.v-sus{background:rgba(249,115,22,0.10);color:#92400E;border:1.5px solid rgba(249,115,22,0.35)}
.v-for{background:rgba(239,68,68,0.10);color:#991B1B;border:1.5px solid rgba(239,68,68,0.35)}
@media(prefers-color-scheme:dark){
  .v-pass{color:#A3E635}.v-sus{color:#FB923C}.v-for{color:#FCA5A5}
}

/* ── Score ── */
.score-big{font-family:var(--disp);font-size:56px;font-weight:800;line-height:1;color:var(--orange)}
.score-bar-wrap{height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;margin:10px 0}
.score-bar-fill{height:100%;border-radius:2px;transition:width .6s cubic-bezier(.16,1,.3,1)}

/* ── Lists ── */
.list-items{display:flex;flex-direction:column;gap:8px}
.list-item{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--t2);line-height:1.55}
.bullet{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px}
.b-lime{background:var(--lime)}.b-orange{background:var(--orange)}.b-sky{background:var(--sky)}

.meta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}
.meta-item{font-size:10.5px;color:var(--t3)}
.meta-item span{color:var(--t2);font-weight:500}

/* ── Trend cards ── */
.analyst-note{
  background:var(--violet-soft);border:1.5px solid var(--violet-border);
  border-radius:var(--r);padding:14px 18px;margin-bottom:16px;
}
.analyst-note-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--violet);margin-bottom:6px}
.analyst-note-text{font-size:13px;color:var(--t1);line-height:1.65;font-style:italic}

.trend-card{
  background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r);
  padding:20px 22px;margin-bottom:12px;box-shadow:var(--shadow);
  transition:box-shadow .15s,border-color .15s;
}
.trend-card:hover{box-shadow:var(--shadow-md);border-color:var(--border2)}

.trend-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.trend-title{font-family:var(--disp);font-size:16px;font-weight:700;color:var(--t1);letter-spacing:-.02em;line-height:1.3}
.score-badge{
  font-family:var(--disp);font-size:15px;font-weight:800;
  color:var(--orange);background:var(--orange-soft);
  border:1.5px solid rgba(249,115,22,0.25);
  border-radius:8px;padding:4px 10px;white-space:nowrap;flex-shrink:0;
}

.tension-block{
  background:var(--sky-soft);border:1px solid var(--sky-border);
  border-left:3px solid var(--sky);border-radius:var(--r2);
  padding:10px 14px;margin-bottom:12px;
}
.tension-label{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sky);margin-bottom:4px}
.tension-text{font-size:12.5px;color:var(--t1);font-weight:500;line-height:1.5}

.hook-text{
  font-size:14px;color:var(--violet);font-weight:600;font-style:italic;
  line-height:1.55;margin-bottom:10px;padding-left:12px;
  border-left:2px solid var(--violet-border);
}

.why-now-block{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.why-now-label{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:4px}
.why-now-text{font-size:12px;color:var(--t2);line-height:1.6}

.insight-text{font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:14px}

.trend-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}

.gen-card{
  background:var(--lime-soft);border:1.5px solid var(--lime-border);
  border-radius:var(--r);padding:18px 20px;margin-top:14px;
}
.gen-row{font-size:13px;color:var(--t2);line-height:1.65;margin-bottom:8px}
.gen-row strong{color:var(--t1);font-weight:600}
.gen-meta{font-size:11px;color:var(--t3);margin-top:10px}

/* ── Improve layout ── */
.improve-wrap{display:flex;flex-direction:column;gap:12px}
.improve-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.improve-panels{display:grid;grid-template-columns:1fr 1fr;gap:12px;min-height:420px}
.improve-panel{background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow)}
.improve-panel-hd{padding:13px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;background:var(--surface2)}
.improve-panel-hd-title{font-size:12.5px;font-weight:600;color:var(--t1)}
.improve-panel-body{flex:1;padding:14px 18px;display:flex;flex-direction:column;overflow-y:auto}
.improve-actions{display:flex;align-items:center;justify-content:center;gap:10px}

.out-actions{display:flex;gap:6px}
.btn-xs{height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--border2);background:transparent;color:var(--t2);font-size:11px;font-family:var(--font);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px}
.btn-xs:hover{background:var(--surface2);color:var(--t1)}

.result-text{font-size:14px;line-height:1.78;color:var(--t1);white-space:pre-wrap;word-break:break-word}
.cursor{display:inline-block;width:2px;height:14px;background:var(--violet);border-radius:1px;vertical-align:text-bottom;margin-left:1px;animation:blink 1s step-end infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;gap:8px}
.empty-icon{width:44px;height:44px;border-radius:12px;background:var(--surface2);border:1.5px solid var(--border);display:grid;place-items:center;font-size:20px;margin-bottom:4px}
.empty-title{font-family:var(--disp);font-size:14px;font-weight:700;color:var(--t1)}
.empty-sub{font-size:12px;color:var(--t2);line-height:1.6;max-width:220px}

.err{background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.25);border-radius:var(--r2);padding:10px 14px;font-size:13px;color:#DC2626;margin-bottom:12px}
@media(prefers-color-scheme:dark){.err{color:#FCA5A5}}

.toast{position:fixed;bottom:22px;right:22px;background:var(--surface);border:1px solid var(--lime-border);border-radius:var(--r2);padding:10px 16px;font-size:12.5px;color:var(--lime);display:flex;align-items:center;gap:8px;z-index:999;box-shadow:var(--shadow-md);animation:slideUp .18s ease,fadeOut .25s ease 1.6s forwards;pointer-events:none}
@keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes fadeOut{to{opacity:0}}

/* ── Mobile ── */
.mobile-nav{display:none;background:var(--surface);border-bottom:1px solid var(--border);padding:0 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;box-shadow:var(--shadow)}
.mobile-nav-inner{display:inline-flex;gap:4px;padding:10px 0}
.mobile-step-btn{display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;padding:7px 12px;border-radius:8px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500;color:var(--t2);white-space:nowrap;transition:all .15s}
.mobile-step-btn.active{background:var(--lime);color:#1a2e05;font-weight:700}
.mobile-step-btn:hover:not(.active){background:var(--surface2);color:var(--t1)}
.mobile-logo{display:none;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);align-items:center;gap:8px;cursor:pointer}
.mobile-logo-mark{width:28px;height:28px;border-radius:8px;background:var(--lime);display:grid;place-items:center;font-family:var(--disp);font-weight:800;font-size:13px;color:#1a2e05}

@media(max-width:860px){
  .sidebar{display:none}
  .mobile-logo{display:flex}
  .mobile-nav{display:block}
  .market-row{flex-direction:column}
  .improve-panels{grid-template-columns:1fr}
  .improve-controls{grid-template-columns:1fr 1fr}
  .content{padding:16px}
  .btn-cta.full{width:100%}
  .trend-actions .btn-secondary{flex:1;justify-content:center}
  .hero{flex-direction:column;align-items:flex-start}
  .hero-badge{align-self:flex-start}
}
`;

/* ─── Market Picker ─────────────────────────────────────────────────────── */

function MarketPicker({ market, onChange }: { market: string; onChange: (m: MarketKey) => void }) {
  return (
    <div className="market-row">
      {Object.keys(MARKETS).map((k) => (
        <button key={k} className={`mkt${market === k ? " sel" : ""}`} onClick={() => onChange(k as MarketKey)}>
          <div className="mkt-flag">{MARKETS[k].flag}</div>
          <div className="mkt-name">{MARKETS[k].label}</div>
          <div className="mkt-lang">{MARKETS[k].lang}</div>
        </button>
      ))}
    </div>
  );
}

/* ─── STEP 1: Искать ────────────────────────────────────────────────────── */

function SearchStep({ onSendToImprove, onSendToEvaluate }: {
  onSendToImprove: (t: string) => void;
  onSendToEvaluate: (t: string) => void;
}) {
  const [market, setMarket] = useState("brazil");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<ResonanceTrend[]>([]);
  const [analystNote, setAnalystNote] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function findTrends() {
    setLoading(true); setTrends([]);
    setAnalystNote(null); setError("");
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      if (!res.ok) throw new Error(`Ошибка сервера ${res.status}`);
      const json = await res.json() as ResonanceTrendsResponse & { analyst_note?: string };
      if (!json.trends?.length) throw new Error("Тренды не найдены");
      setTrends(json.trends);
      if (json.analyst_note) setAnalystNote(json.analyst_note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить тренды");
    } finally { setLoading(false); }
  }

  return (
    <>
      <div className="hero">
        <div>
          <h1>Что сейчас происходит в регионе?</h1>
          <p className="hero-sub">Живые B2B-тренды с нарративными хуками и анализом рыночного напряжения.</p>
        </div>
        <div className="hero-badge">Шаг 1 · Искать</div>
      </div>

      <div className="card">
        <div className="card-label">Выберите регион</div>
        <MarketPicker market={market} onChange={setMarket} />
        <button className="btn-cta full" onClick={findTrends} disabled={loading}>
          {loading ? "Анализируем рынок…" : "Найти тренды →"}
        </button>
      </div>

      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}

      {analystNote && (
        <div className="analyst-note">
          <div className="analyst-note-label">Настроение рынка · 2026</div>
          <div className="analyst-note-text">{analystNote}</div>
        </div>
      )}

      {trends.map((t, idx) => {
        const hook = (t as any).narrative_hook as string | undefined;
        const tension = (t as any).market_tension as string | undefined ?? t.marketTension;
        const whyNow = (t as any).why_now as string | undefined;
        const brief = (t as any).brief_for_marketer as string | undefined;
        const title = (t as any).trend_name || t.title || `Тренд ${idx + 1}`;

        return (
          <div className="trend-card" key={title}>
            <div className="trend-header">
              <div className="trend-title">{title}</div>
              {t.resonanceScore !== undefined && t.resonanceScore !== null ? (
                <div className="score-badge">{t.resonanceScore}</div>
              ) : (t as any).resonance_score !== undefined && (
                <div className="score-badge">{(t as any).resonance_score}</div>
              )}
            </div>

            {tension && (
              <div className="tension-block">
                <div className="tension-label">Конфликт рынка</div>
                <div className="tension-text">{tension}</div>
              </div>
            )}

            {hook && <div className="hook-text">«{hook}»</div>}

            {t.insight && <p className="insight-text">{t.insight}</p>}

            {whyNow && (
              <div className="why-now-block">
                <div className="why-now-label">Почему сейчас</div>
                <div className="why-now-text">{whyNow}</div>
              </div>
            )}

            {brief && (
              <div className="gen-card" style={{ marginTop: 14 }}>
                <div className="tension-label" style={{ color: "var(--lime)", marginBottom: 6 }}>Бриф для маркетолога</div>
                <div className="gen-row" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{brief}</div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ─── STEP 2: Проверять ─────────────────────────────────────────────────── */

function EvaluateStep({ initialText, onSendToImprove }: {
  initialText: string;
  onSendToImprove: (t: string) => void;
}) {
  const [market, setMarket] = useState("brazil");
  const [tab, setTab] = useState<"url" | "text">("text");
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (initialText) { setText(initialText); setResult(null); } }, [initialText]);

  async function analyze() {
    setError("");
    if (!text.trim()) { setError("Вставьте текст или URL."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market, text }) });
      if (!res.ok) { const e = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(e.error ?? `Ошибка ${res.status}`); }
      setResult((await res.json()) as AnalyzeResult);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка анализа"); }
    finally { setLoading(false); }
  }

  const generic = result ? Math.max(0, 100 - result.score) : 0;
  const scoreColor = generic <= 30 ? "var(--lime)" : generic <= 60 ? "var(--orange)" : "#EF4444";
  const verdictCfg = result
    ? ({ PASS: { cls: "v-pass", icon: "✓", label: "Звучит нативно" }, SUSPICIOUS: { cls: "v-sus", icon: "~", label: "Немного импортно" }, FOREIGN: { cls: "v-for", icon: "✕", label: "Читается как перевод" } }[result.verdict as "PASS" | "SUSPICIOUS" | "FOREIGN"])
    : null;

  return (
    <>
      <div className="hero">
        <div>
          <h1>Ваш текст звучит по-местному?</h1>
          <p className="hero-sub">Анализ соответствия рынку, tone of voice и слабых мест — моментально.</p>
        </div>
        <div className="hero-badge">Шаг 2 · Проверять</div>
      </div>

      {!result ? (
        <>
          <div className="card-label" style={{ marginBottom: 8 }}>Регион</div>
          <MarketPicker market={market} onChange={setMarket} />
          <div className="hint-bar"><strong>{MARKETS[market].label}:</strong> {MARKETS[market].summary}</div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
              {(["url", "text"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, border: "none", padding: "11px 16px", background: tab === t ? "var(--surface2)" : "transparent", color: tab === t ? "var(--t1)" : "var(--t2)", fontWeight: tab === t ? 600 : 400, fontSize: 13, fontFamily: "var(--font)", cursor: "pointer", transition: "all .15s", borderBottom: tab === t ? `2px solid var(--violet)` : "2px solid transparent" }}>
                  {t === "url" ? "🔗 URL" : "✍️ Текст"}
                </button>
              ))}
            </div>
            <div style={{ padding: 16 }}>
              {tab === "url"
                ? <input className="inp" placeholder="https://ваш-лендинг.com" value={text} onChange={(e) => setText(e.target.value)} />
                : <textarea className="inp" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Вставьте маркетинговый текст…" />}
            </div>
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn-cta full" style={{ marginTop: 8 }} onClick={analyze} disabled={loading}>
            {loading ? "Анализируем…" : "Проверить текст →"}
          </button>
        </>
      ) : (
        <>
          <div className="card">
            <div className="card-label">Вердикт</div>
            {verdictCfg && <div className={`verdict-badge ${verdictCfg.cls}`}>{verdictCfg.icon} {result.verdict} — {verdictCfg.label}</div>}
            <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.65 }}>{result.insight}</p>
          </div>
          <div className="card">
            <div className="card-label">Genericness Score</div>
            <div className="score-big" style={{ color: scoreColor }}>{generic}<span style={{ fontSize: 22, color: "var(--t3)" }}>%</span></div>
            <div className="score-bar-wrap"><div className="score-bar-fill" style={{ width: `${generic}%`, background: scoreColor }} /></div>
            <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>
              {generic <= 30 ? "Текст звучит аутентично." : generic <= 60 ? "Некоторые фразы звучат импортно — стоит поработать." : "Высокий genericness. Рекомендуем переработать текст."}
            </p>
            <div className="meta-row">
              <div className="meta-item"><span>Провайдер </span>{result.provider}</div>
              <div className="meta-item"><span>Задержка </span>{result.latencyMs}ms</div>
              {result.promptVersion && <div className="meta-item"><span>Промпт </span>{result.promptVersion}</div>}
            </div>
          </div>
          {result.marketTension && <div className="card"><div className="card-label">Напряжение рынка</div><p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.65 }}>{result.marketTension}</p></div>}
          {(result.strengths ?? []).length > 0 && <div className="card"><div className="card-label">Сигналы доверия</div><div className="list-items">{(result.strengths ?? []).map((x) => <div className="list-item" key={x}><span className="bullet b-lime" />{x}</div>)}</div></div>}
          {(result.risks ?? []).length > 0 && <div className="card"><div className="card-label">Риски</div><div className="list-items">{(result.risks ?? []).map((x) => <div className="list-item" key={x}><span className="bullet b-orange" />{x}</div>)}</div></div>}
          {(result.suggestions ?? []).length > 0 && <div className="card"><div className="card-label">Рекомендации</div><div className="list-items">{(result.suggestions ?? []).map((x) => <div className="list-item" key={x}><span className="bullet b-sky" />{x}</div>)}</div></div>}

          <button className="btn-next" onClick={() => onSendToImprove(text)}>
            <div>
              <span className="btn-next-label">Сделать красиво</span>
              <span className="btn-next-sub">Передать в рефайн с учётом результатов анализа</span>
            </div>
            <span className="btn-next-arrow">→</span>
          </button>
          <div style={{ marginTop: 10 }}><button className="btn-secondary" onClick={() => setResult(null)}>← Новый анализ</button></div>
        </>
      )}
    </>
  );
}

/* ─── STEP 3: Улучшать ──────────────────────────────────────────────────── */

function ImproveStep({ initialText, onStreaming }: {
  initialText: string;
  onStreaming: (v: boolean) => void;
}) {
  const [inputText, setInputText] = useState(initialText);
  const [result, setResult]       = useState("");
  const [meta, setMeta]           = useState<AIResponseMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);
  const [provider, setProvider]   = useState("gemini-2.5-flash");
  const [prompt, setPrompt]       = useState("reduck/brazil-warmth@1"); // Установили дефолтный новый пресет
  const abortRef                  = useRef<AbortController | null>(null);
  const outRef                    = useRef<HTMLDivElement>(null);

  useEffect(() => { if (initialText) { setInputText(initialText); setResult(""); setMeta(null); } }, [initialText]);
  useEffect(() => { if (isLoading && outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, [result, isLoading]);

  async function run() {
    if (!inputText.trim() || isLoading) return;
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true); onStreaming(true);
    setResult(""); setMeta(null); setError("");
    const t0 = Date.now();
    const payload: ReDuckProcessRequest = { text: inputText, providerId: provider, modelId: "latest", promptVersion: prompt };
    try {
      const res = await fetch("/api/reduck/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
      if (!res.ok) { const e = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(e.error ?? `Ошибка ${res.status}`); }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Нет тела ответа");
      const dec = new TextDecoder();
      let text = "", buf = "", done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
          for (const p of parts) {
            const tr = p.trim();
            if (!tr.startsWith("data: ")) continue;
            const data = tr.slice(6);
            if (data === "[DONE]") { done = true; break; }
            text += data; setResult(text);
          }
        }
      }
      setMeta({ provider: provider as AIResponseMeta["provider"], promptVersion: prompt, latencyMs: Date.now() - t0, requestedAt: new Date().toISOString(), costUsd: 0.0008 });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Что-то пошло не так.");
    } finally { setIsLoading(false); onStreaming(false); abortRef.current = null; }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const words = result.trim() ? result.trim().split(/\s+/).length : 0;

  return (
    <>
      <div className="hero">
        <div>
          <h1>Сделаем текст красивым</h1>
          <p className="hero-sub">AI-рефайн под рынок, tone of voice и маркетинговые задачи.</p>
        </div>
        <div className="hero-badge">Шаг 3 · Улучшать</div>
      </div>

      <div className="improve-wrap">
        <div className="improve-controls">
          <div>
            <div className="field-label">Провайдер</div>
            <div className="sel-wrap">
              <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={isLoading}>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="sel-arrow">▾</span>
            </div>
          </div>
          <div>
            <div className="field-label">Цель</div>
            <div className="sel-wrap">
              <select value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading}>
                {Object.keys(REDUCK_PROMPT_MAP).map((k) => (
                  <option key={k} value={`reduck/${k}@1`}>
                    {REDUCK_PROMPT_MAP[k]?.label || k}
                  </option>
                ))}
              </select>
              <span className="sel-arrow">▾</span>
            </div>
          </div>
        </div>

        <div className="improve-panels">
          <div className="improve-panel">
            <div className="improve-panel-hd">
              <span className="improve-panel-hd-title">Ваш текст</span>
              <span style={{ fontSize: 11, color: "var(--t3)" }}>{inputText.trim() ? `${inputText.trim().split(/\s+/).length} слов` : ""}</span>
            </div>
            <div className="improve-panel-body">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Вставьте текст, который хотите улучшить…"
                style={{ flex: 1, minHeight: 320, border: "none", background: "transparent", padding: 0, fontSize: 13.5, resize: "none", outline: "none", color: "var(--t1)", fontFamily: "var(--font)", lineHeight: 1.7 }}
              />
            </div>
          </div>

          <div className="improve-panel">
            <div className="improve-panel-hd">
              <span className="improve-panel-hd-title">{result ? "Улучшенный текст" : "Результат"}</span>
              {result && (
                <div className="out-actions">
                  <button className="btn-xs" onClick={copy}>{copied ? "✓" : "⎘"} {copied ? "Скопировано" : "Копировать"}</button>
                  <button className="btn-xs" onClick={() => { setResult(""); setMeta(null); }}>Очистить</button>
                </div>
              )}
            </div>
            <div className="improve-panel-body" ref={outRef}>
              {!result && !isLoading ? (
                <div className="empty-state">
                  <div className="empty-icon">✦</div>
                  <div className="empty-title">Готов к работе</div>
                  <div className="empty-sub">Нажмите «Сделать красиво» — результат появится здесь.</div>
                </div>
              ) : (
                <>
                  <div className="result-text">{result}{isLoading && <span className="cursor" />}</div>
                  {meta && !isLoading && (
                    <div className="meta-row">
                      <div className="meta-item"><span>Провайдер </span>{meta.provider}</div>
                      <div className="meta-item"><span>Задержка </span>{meta.latencyMs}ms</div>
                      <div className="meta-item"><span>Слов </span>{words}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {error && <div className="err">{error}</div>}
        <div className="improve-actions">
          <button className="btn-cta" onClick={run} disabled={isLoading || !inputText.trim()}>
            {isLoading ? "Делаем красиво…" : "Сделать красиво →"}
          </button>
          {isLoading && <button className="btn-stop" onClick={() => abortRef.current?.abort()}>Остановить</button>}
        </div>
      </div>

      {copied && <div className="toast">✓ Скопировано в буфер обмена</div>}
    </>
  );
}

/* ─── Root App ──────────────────────────────────────────────────────────── */

export default function BreasonApp() {
  const [step, setStep]                 = useState<Step>("search");
  const [improveText, setImproveText]   = useState("");
  const [evaluateText, setEvaluateText] = useState("");
  const [streaming, setStreaming]       = useState(false);

  function goImprove(text: string)  { setImproveText(text);  setStep("improve");  }
  function goEvaluate(text: string) { setEvaluateText(text); setStep("evaluate"); }

  function resetToSearch() {
    setStep("search");
    setImproveText("");
    setEvaluateText("");
  }

  return (
    <>
      <style>{STYLE}</style>
      <div className="shell">

        {/* ── Sidebar (desktop) ── */}
        <aside className="sidebar">
          <div className="sb-logo" onClick={resetToSearch} role="button" aria-label="На главную">
            <div className="sb-mark"><span className="sb-mark-b">B</span></div>
            <span className="sb-brand">Breason</span>
          </div>
          <nav className="sb-nav">
            {STEPS.map((s, i) => (
              <button key={s} className={`step-btn${step === s ? " active" : ""}`} onClick={() => setStep(s)}>
                <div className="step-num">{i + 1}</div>
                <div>
                  <span className="step-label">{stepLabels[s]}</span>
                  <span className="step-sub">{stepSubs[s]}</span>
                </div>
              </button>
            ))}
          </nav>
          <div className="sb-foot">
            <span>Breason · v0.5</span>
            <span className="sb-foot-love">from pavel with love</span>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main">

          {/* Mobile logo */}
          <div className="mobile-logo" onClick={resetToSearch} role="button">
            <div className="mobile-logo-mark">B</div>
            <span style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>Breason</span>
          </div>

          {/* Mobile nav */}
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

          {/* Desktop topbar */}
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
            {step === "search"   && <SearchStep onSendToImprove={goImprove} onSendToEvaluate={goEvaluate} />}
            {step === "evaluate" && <EvaluateStep initialText={evaluateText} onSendToImprove={goImprove} />}
            {step === "improve"  && <ImproveStep initialText={improveText} onStreaming={setStreaming} />}
          </div>
        </div>
      </div>
    </>
  );
}
