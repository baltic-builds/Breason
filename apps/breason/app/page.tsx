"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { REDUCK_PROMPT_MAP } from "@breason/prompts";
import type {
  AIResponseMeta,
  AnalyzeResult,
  FeatureFlags,
  MarketKey,
  ReDuckProcessRequest,
  ResonanceGenerateResponse,
  ResonanceTrend,
  ResonanceTrendsResponse,
} from "@breason/types";
import flagsJson from "@/data/feature-flags.json";

const flags = flagsJson as FeatureFlags;

type Step = "search" | "evaluate" | "improve";

const MARKETS: Record<string, { label: string; flag: string; lang: string; summary: string }> = {
  brazil:  { label: "Бразилия",  flag: "🇧🇷", lang: "pt-BR", summary: "Тёплая, доверительная B2B-коммуникация. Важны отношения и местное доверие." },
  poland:  { label: "Польша",    flag: "🇵🇱", lang: "pl-PL", summary: "Прагматичная, скептичная аудитория. Ценит конкретику, а не хайп." },
  germany: { label: "Германия",  flag: "🇩🇪", lang: "de-DE", summary: "Структурированный рынок. Надёжность и соответствие стандартам важнее эмоций." },
};

const stepLabels: Record<Step, string> = {
  search:   "Искать",
  evaluate: "Проверять",
  improve:  "Улучшать",
};

const stepSubs: Record<Step, string> = {
  search:   "Тренды рынка",
  evaluate: "Анализ текста",
  improve:  "AI-рефайн",
};

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#09090B;
  --s1:#111113;
  --s2:#18181B;
  --s3:#27272A;
  --b1:rgba(255,255,255,0.06);
  --b2:rgba(255,255,255,0.10);
  --b3:rgba(255,255,255,0.16);
  --t1:#FAFAFA;
  --t2:#A1A1AA;
  --t3:#52525B;
  --lime:#C8F135;
  --lime2:#A8D920;
  --blue:#3B82F6;
  --green:#22C55E;
  --amber:#F59E0B;
  --red:#EF4444;
  --font:'DM Sans',system-ui,sans-serif;
  --disp:'Syne',system-ui,sans-serif;
  --r:12px;
  --r2:8px;
}

body{font-family:var(--font);background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5}

.shell{display:flex;height:100vh;overflow:hidden}
.sidebar{width:216px;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;flex-shrink:0}
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}

.sb-top{padding:20px 18px 16px;border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:10px}
.sb-mark{width:30px;height:30px;border-radius:8px;background:var(--lime);color:#09090B;font-family:var(--disp);font-weight:800;font-size:14px;display:grid;place-items:center;flex-shrink:0}
.sb-brand{font-family:var(--disp);font-size:15px;font-weight:700;letter-spacing:-.02em;color:var(--t1)}

.sb-steps{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:2px}
.sb-section{font-size:10px;font-weight:500;letter-spacing:.09em;text-transform:uppercase;color:var(--t3);padding:10px 8px 6px}

.step-btn{display:flex;align-items:center;gap:10px;width:100%;border:none;background:transparent;padding:9px 10px;border-radius:var(--r2);cursor:pointer;font-family:var(--font);transition:background .12s;text-align:left}
.step-btn:hover{background:var(--s3)}
.step-btn.active{background:var(--s3)}

.step-num{width:22px;height:22px;border-radius:50%;border:1px solid var(--b2);font-size:10px;font-weight:600;font-family:var(--disp);display:grid;place-items:center;flex-shrink:0;color:var(--t3);transition:all .12s}
.step-btn.active .step-num{border-color:var(--lime);background:rgba(200,241,53,.1);color:var(--lime)}
.step-btn.done .step-num{border-color:var(--green);background:rgba(34,197,94,.1);color:var(--green)}

.step-label{font-size:13px;font-weight:500;color:var(--t2);transition:color .12s;display:block}
.step-btn.active .step-label,.step-btn:hover .step-label{color:var(--t1)}
.step-sub{font-size:10.5px;color:var(--t3);display:block;margin-top:1px}

.sb-foot{padding:14px 18px;border-top:1px solid var(--b1);font-size:11px;color:var(--t3)}

.topbar{height:50px;background:var(--s1);border-bottom:1px solid var(--b1);padding:0 26px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.topbar-left{display:flex;align-items:center;gap:8px}
.crumb{font-size:12.5px;color:var(--t3)}
.crumb-sep{margin:0 4px;color:var(--t3)}
.page-name{font-size:12.5px;font-weight:500;color:var(--t1)}
.topbar-right{display:flex;align-items:center;gap:8px}
.pill{height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--b2);background:var(--s2);font-size:11px;color:var(--t2);font-family:var(--font);display:flex;align-items:center;gap:6px}
.pill-dot{width:6px;height:6px;border-radius:50%;background:var(--lime)}
.pill-dot.on{animation:pulse 1.2s ease infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

.step-bar{height:3px;background:var(--s3);flex-shrink:0;display:flex;gap:2px;padding:0 26px}
.step-seg{flex:1;border-radius:2px;background:var(--s3);transition:background .3s}
.step-seg.active{background:var(--lime)}
.step-seg.done{background:rgba(34,197,94,.5)}

.content{flex:1;overflow-y:auto;padding:26px}

.hero{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:24px 28px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center;gap:16px;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:radial-gradient(circle,rgba(200,241,53,.07) 0%,transparent 70%);pointer-events:none}
.hero h1{font-family:var(--disp);font-size:20px;font-weight:700;letter-spacing:-.02em;margin-bottom:5px;line-height:1.25}
.hero-sub{font-size:12.5px;color:var(--t2);line-height:1.6;max-width:380px}
.hero-badge{font-family:var(--disp);font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(200,241,53,.1);border:1px solid rgba(200,241,53,.2);color:var(--lime);white-space:nowrap;flex-shrink:0}

.card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:20px 24px}
.card+.card{margin-top:12px}
.card-label{font-size:10px;font-weight:500;letter-spacing:.09em;text-transform:uppercase;color:var(--t3);margin-bottom:12px}

.market-row{display:flex;gap:8px;margin-bottom:18px}
.mkt{flex:1;border:1px solid var(--b1);border-radius:var(--r2);background:var(--s1);padding:11px 13px;text-align:left;cursor:pointer;transition:border-color .12s,background .12s}
.mkt:hover{border-color:var(--b2);background:var(--s2)}
.mkt.sel{border-color:var(--lime);background:rgba(200,241,53,.04)}
.mkt-flag{font-size:18px;margin-bottom:5px}
.mkt-name{font-size:11.5px;font-weight:500;color:var(--t1)}
.mkt-lang{font-size:9.5px;color:var(--t3);margin-top:2px}

.field-label{font-size:10.5px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--t3);margin-bottom:6px}
.inp,.sel-wrap select,textarea{width:100%;border:1px solid var(--b1);border-radius:var(--r2);padding:10px 13px;font-size:13px;font-family:var(--font);background:var(--s2);color:var(--t1);outline:none;transition:border-color .12s}
.inp::placeholder,textarea::placeholder{color:var(--t3)}
.inp:focus,textarea:focus,.sel-wrap select:focus{border-color:rgba(200,241,53,.25)}
textarea{resize:none;line-height:1.65;display:block;width:100%}
.sel-wrap{position:relative}
.sel-wrap select{appearance:none;cursor:pointer;padding-right:30px}
.sel-arrow{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:10px;pointer-events:none}
.controls-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hint-bar{border:1px solid var(--b1);border-left:2px solid var(--lime);border-radius:var(--r2);padding:9px 13px;font-size:12.5px;color:var(--t2);line-height:1.6;margin-bottom:16px}
.hint-bar strong{color:var(--t1);font-weight:500}

.btn-primary{height:42px;border:none;border-radius:var(--r2);background:var(--lime);color:#09090B;font-family:var(--disp);font-size:13.5px;font-weight:700;cursor:pointer;transition:background .12s,transform .1s;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 20px;letter-spacing:-.01em}
.btn-primary:hover:not(:disabled){background:var(--lime2)}
.btn-primary:active:not(:disabled){transform:scale(.98)}
.btn-primary:disabled{background:var(--s3);color:var(--t3);cursor:not-allowed}
