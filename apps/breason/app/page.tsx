"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type MarketKey = "germany" | "poland" | "brazil";
type StepKey   = "search" | "evaluate" | "improve";
type VerdictType = "PASS" | "SUSPICIOUS" | "FOREIGN";

interface Trend {
  trend_name: string;
  narrative_hook: string;
  market_tension: string;
  why_now: string;
  resonance_score: number;
}

interface ToneMap {
  formal_casual: number;
  bold_cautious: number;
  technical_benefit: number;
  abstract_concrete: number;
  global_native: number;
}

interface Rewrite {
  block: string;
  original: string;
  suggested: string;
  suggested_local: string;
  reason: string;
}

interface EvaluateResult {
  verdict: VerdictType;
  verdict_reason: string;
  genericness_score: number;
  generic_phrases: string[];
  tone_map: ToneMap;
  missing_trust_signals: string[];
  trend_context: string;
  rewrites: Rewrite[];
  brief_text: string;
}

interface ImproveResult {
  improved_text: string;
  improved_local: string;
  changes: { what: string; why: string }[];
  tone_achieved: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { label: string; flag: string; desc: string }> = {
  germany: { label: "Germany",  flag: "🇩🇪", desc: "Formal · Precise · Process-led" },
  poland:  { label: "Poland",   flag: "🇵🇱", desc: "Direct · Fact-based · Transparent" },
  brazil:  { label: "Brazil",   flag: "🇧🇷", desc: "Warm · Human · Relationship-first" },
};

const STEPS: Record<StepKey, { icon: string; label: string; hint: string }> = {
  search:   { icon: "◎", label: "Search",   hint: "Find market trends" },
  evaluate: { icon: "◈", label: "Evaluate", hint: "Audit your copy" },
  improve:  { icon: "◆", label: "Improve",  hint: "Polish for locals" },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; sub: string }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)", border: "rgba(132,204,22,0.3)", icon: "✓", sub: "Sounds Local" },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", icon: "⚠", sub: "Sounds Imported" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",  border: "rgba(225,29,72,0.3)",  icon: "✕", sub: "Sounds Foreign" },
};

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_STEPS_SEARCH   = ["Scanning B2B landscape...", "Detecting emerging signals...", "Scoring market resonance..."];
const LOADING_STEPS_EVALUATE = ["Analyzing tone & fit...", "Checking trust signals...", "Scanning for clichés...", "Generating rewrites..."];
const LOADING_STEPS_IMPROVE  = ["Reading market profile...", "Rewriting for locals...", "Polishing native tone..."];

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet:       #7C3AED;
  --violet-d:     #6D28D9;
  --violet-a:     rgba(124,58,237,0.1);
  --lime:         #84CC16;
  --lime-a:       rgba(132,204,22,0.1);
  --orange:       #F97316;
  --orange-a:     rgba(249,115,22,0.1);
  --red:          #EF4444;
  --sky:          #0EA5E9;
  --sky-a:        rgba(14,165,233,0.08);
  --bg:           #F1F5F9;
  --surface:      #FFFFFF;
  --t1:           #0F172A;
  --t2:           #475569;
  --t3:           #94A3B8;
  --border:       rgba(15,23,42,0.1);
  --border-xs:    rgba(15,23,42,0.05);
  --sidebar-w:    220px;
  --r:            14px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: var(--bg);
  color: var(--t1);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}

/* ── Shell ──────────────────── */
.shell { display: flex; min-height: 100vh; }

/* ── Sidebar ────────────────── */
.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Syne', sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: var(--t1);
  margin-bottom: 32px;
  text-decoration: none;
  flex-shrink: 0;
}
.logo-mark {
  width: 28px; height: 28px;
  background: var(--lime);
  border-radius: 7px;
  display: grid; place-items: center;
  font-size: 14px; font-weight: 800;
  color: #1a2e05;
  flex-shrink: 0;
}

/* Steps nav */
.nav-section-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--t3);
  margin-bottom: 6px;
  padding-left: 4px;
}

.nav-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 28px; }

.nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  transition: background 0.15s;
  position: relative;
}
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }
.nav-btn.active .nav-step-icon { color: var(--violet); }
.nav-btn.active .nav-step-label { color: var(--violet); font-weight: 700; }

.nav-step-num {
  width: 20px; height: 20px;
  border-radius: 6px;
  background: var(--bg);
  font-size: 9px;
  font-weight: 800;
  color: var(--t3);
  display: grid; place-items: center;
  flex-shrink: 0;
  letter-spacing: 0;
}
.nav-btn.active .nav-step-num { background: var(--violet); color: white; }

.nav-step-info { flex: 1; min-width: 0; }
.nav-step-label { font-size: 13px; font-weight: 600; color: var(--t2); line-height: 1; margin-bottom: 2px; }
.nav-step-hint  { font-size: 10px; color: var(--t3); }

/* Market pills in sidebar */
.mkt-section { flex: 1; }

.mkt-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1.5px solid var(--border-xs);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
  margin-bottom: 6px;
}
.mkt-pill:hover { border-color: var(--border); background: var(--bg); }
.mkt-pill.active { border-color: var(--lime); background: var(--lime-a); }
.mkt-pill-flag { font-size: 16px; line-height: 1; flex-shrink: 0; }
.mkt-pill-name { font-size: 12px; font-weight: 600; color: var(--t1); }

.sidebar-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-xs);
  font-size: 10px;
  color: var(--t3);
  line-height: 1.7;
  flex-shrink: 0;
}

/* ── Main ───────────────────── */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
}
.topbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--t2);
}
.topbar-step-badge {
  background: var(--violet-a);
  color: var(--violet);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
}

.page { flex: 1; padding: 32px; max-width: 1140px; width: 100%; margin: 0 auto; }

/* ── Cards ──────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px;
}
.card + .card { margin-top: 16px; }

.field-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t3);
  margin-bottom: 10px;
}

/* ── Textarea ───────────────── */
textarea.inp {
  width: 100%;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
  color: var(--t1);
  resize: vertical;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-height: 140px;
}
textarea.inp:focus {
  border-color: var(--violet);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--violet-a);
}

/* ── Buttons ────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 20px;
  background: var(--violet);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  width: 100%;
}
.btn-primary:hover:not(:disabled) {
  background: var(--violet-d);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(124,58,237,0.25);
}
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-ghost:hover { background: var(--bg); }

.btn-lime {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 18px;
  background: var(--lime);
  color: #1a2e05;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.btn-lime:hover { opacity: 0.9; transform: translateY(-1px); }

/* ── Layout helpers ─────────── */
.split { display: grid; gap: 24px; grid-template-columns: 360px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.row   { display: flex; align-items: center; gap: 12px; }

/* ── Loader ─────────────────── */
.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  gap: 14px;
  color: var(--t2);
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--violet);
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loader-msg { font-size: 13px; color: var(--t3); }

/* ── Empty state ────────────── */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  text-align: center;
  color: var(--t3);
  gap: 10px;
}
.empty-icon  { font-size: 36px; opacity: 0.4; }
.empty-title { font-size: 15px; font-weight: 600; color: var(--t2); }
.empty-text  { font-size: 13px; max-width: 260px; line-height: 1.6; }

/* ── Error ──────────────────── */
.error-box {
  padding: 14px 16px;
  background: rgba(239,68,68,0.07);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  color: #B91C1C;
  font-size: 13px;
  font-weight: 500;
}

/* ── SEARCH: Trend cards ────── */
.trend-grid { display: flex; flex-direction: column; gap: 16px; }

.trend-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.trend-card:hover { border-color: rgba(124,58,237,0.25); box-shadow: 0 4px 16px rgba(124,58,237,0.08); }

.trend-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.trend-name   { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--t1); line-height: 1.3; }

.score-pill {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
}
.score-high { background: rgba(132,204,22,0.15); color: #3F6212; }
.score-mid  { background: rgba(249,115,22,0.12); color: #C2410C; }
.score-low  { background: rgba(148,163,184,0.15); color: var(--t2); }

.trend-hook { font-size: 13px; color: var(--t2); line-height: 1.6; margin-bottom: 12px; font-style: italic; }

.trend-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.trend-meta-item { background: var(--bg); border-radius: 8px; padding: 10px 12px; }
.trend-meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); margin-bottom: 4px; }
.trend-meta-value { font-size: 12px; color: var(--t2); line-height: 1.4; }

.trend-footer { margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px; }

/* ── EVALUATE: Verdict ──────── */
.verdict-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: var(--r);
  border: 1.5px solid;
  margin-bottom: 16px;
}
.verdict-icon {
  width: 38px; height: 38px;
  border-radius: 9px;
  display: grid; place-items: center;
  font-size: 17px; font-weight: 800;
  background: rgba(255,255,255,0.6);
  flex-shrink: 0;
}
.verdict-label  { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 3px; }
.verdict-reason { font-size: 13px; font-weight: 500; opacity: 0.8; }

/* Tone map */
.tone-row { margin-bottom: 12px; }
.tone-row:last-child { margin-bottom: 0; }
.tone-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--t2); margin-bottom: 5px; }
.tone-track { position: relative; height: 5px; background: var(--bg); border-radius: 99px; }
.tone-midline { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1.5px; background: var(--border); }
.tone-dot {
  position: absolute; top: 50%;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--violet);
  border: 2px solid white;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(124,58,237,0.35);
  transition: left 0.5s cubic-bezier(0.34,1.56,0.64,1);
}

/* Score */
.score-big { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 2px; }
.score-sub { font-size: 11px; color: var(--t3); margin-bottom: 10px; }

/* Badges */
.badge-row { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { padding: 4px 9px; background: #FEE2E2; color: #B91C1C; font-size: 11px; font-weight: 600; border-radius: 6px; }

/* Trust list */
.trust-list { display: flex; flex-direction: column; gap: 6px; }
.trust-item { display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px; background: var(--bg); border-radius: 8px; font-size: 12px; color: var(--t2); border-left: 3px solid var(--red); line-height: 1.4; }

/* Trend context */
.ctx-box { display: flex; gap: 10px; padding: 12px 14px; background: var(--sky-a); border: 1px solid rgba(14,165,233,0.18); border-radius: 10px; font-size: 13px; color: var(--t2); line-height: 1.55; }
.ctx-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }

/* Rewrite cards */
.rw-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.rw-tag { display: inline-block; padding: 3px 8px; background: var(--violet-a); color: var(--violet); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border-radius: 5px; margin-bottom: 12px; }
.rw-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.rw-col-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--t3); margin-bottom: 5px; }
.rw-block { padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.55; border: 1px solid var(--border); background: var(--surface); color: var(--t2); }
.rw-block.local { background: var(--violet-a); border-color: rgba(124,58,237,0.2); color: var(--violet); font-weight: 500; }
.rw-reason { font-size: 12px; color: var(--t3); font-style: italic; padding-top: 10px; border-top: 1px solid var(--border-xs); }

/* ── IMPROVE ────────────────── */
.improve-result { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
.improve-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.improve-tab {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--t2);
  cursor: pointer;
  transition: 0.15s;
}
.improve-tab.active { background: var(--violet); border-color: var(--violet); color: white; }
.improve-body { font-size: 14px; line-height: 1.75; color: var(--t1); white-space: pre-wrap; padding: 16px; background: var(--bg); border-radius: 10px; }
.change-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.change-item { padding: 12px 14px; border-radius: 8px; background: var(--bg); border-left: 3px solid var(--violet); }
.change-what { font-size: 13px; font-weight: 600; color: var(--t1); margin-bottom: 3px; }
.change-why  { font-size: 12px; color: var(--t2); }
.tone-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.25); border-radius: 8px; font-size: 12px; font-weight: 600; color: #3F6212; margin-bottom: 16px; }

/* ── Toast ──────────────────── */
.toast {
  position: fixed; bottom: 24px; right: 24px;
  background: var(--t1); color: #fff;
  padding: 11px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 500;
  z-index: 200;
  animation: fadeUp 0.25s ease-out;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Responsive ─────────────── */
@media (max-width: 860px) {
  .sidebar { display: none; }
  .split { grid-template-columns: 1fr; }
  .grid2 { grid-template-columns: 1fr; }
  .page  { padding: 20px; }
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreClass(s: number) {
  if (s >= 75) return "score-high";
  if (s >= 45) return "score-mid";
  return "score-low";
}

function scoreColor(s: number) {
  if (s < 35) return "#3F6212";
  if (s < 65) return "#C2410C";
  return "#BE123C";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BreasonApp() {
  const [step,    setStep]    = useState<StepKey>("search");
  const [market,  setMarket]  = useState<MarketKey>("germany");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(0);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  // Per-step data
  const [trends,      setTrends]      = useState<Trend[] | null>(null);
  const [evalResult,  setEvalResult]  = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);

  // Inputs
  const [evalText,    setEvalText]    = useState(DEFAULT_COPY);
  const [improveText, setImproveText] = useState("");
  const [improveCtx,  setImproveCtx]  = useState("");
  const [improveTab,  setImproveTab]  = useState<"en" | "local">("en");

  // Loading message rotation
  const loadingSteps = step === "search" ? LOADING_STEPS_SEARCH
                     : step === "evaluate" ? LOADING_STEPS_EVALUATE
                     : LOADING_STEPS_IMPROVE;

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadMsg(m => (m + 1) % loadingSteps.length), 2200);
    return () => clearInterval(id);
  }, [loading, loadingSteps.length]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const switchStep = (s: StepKey) => {
    setStep(s);
    setError(null);
  };

  // ── API Calls ──────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    setLoading(true); setLoadMsg(0); setError(null); setTrends(null);
    try {
      const res  = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Server error"); return; }
      setTrends(data.trends || []);
    } catch { setError("Network error. Please try again."); }
    finally   { setLoading(false); }
  }, [market]);

  const handleEvaluate = useCallback(async () => {
    if (!evalText.trim()) return;
    setLoading(true); setLoadMsg(0); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", text: evalText.trim(), market }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Server error"); return; }
      if (!data.verdict) { setError("Incomplete response. Try again."); return; }
      setEvalResult(data);
    } catch { setError("Network error. Please try again."); }
    finally   { setLoading(false); }
  }, [evalText, market]);

  const handleImprove = useCallback(async () => {
    const src = improveText.trim() || evalResult?.brief_text || evalText.trim();
    if (!src) return;
    setLoading(true); setLoadMsg(0); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "improve", text: src, market, context: improveCtx }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Server error"); return; }
      if (!data.improved_text) { setError("Incomplete response. Try again."); return; }
      setImproveResult(data);
    } catch { setError("Network error. Please try again."); }
    finally   { setLoading(false); }
  }, [improveText, improveCtx, evalResult, evalText, market]);

  const copyText = (text: string, label = "Copied!") => {
    navigator.clipboard.writeText(text).then(() => showToast(`✓ ${label}`));
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = ((val + 5) / 10) * 100;
    return (
      <div className="tone-row">
        <div className="tone-labels"><span>{labelL}</span><span>{labelR}</span></div>
        <div className="tone-track">
          <div className="tone-midline" />
          <div className="tone-dot" style={{ left: `${pct}%` }} />
        </div>
      </div>
    );
  };

  // ── Step: Search ───────────────────────────────────────────────────────────
  const renderSearch = () => (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="field-label">What to find</p>
        <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16, lineHeight: 1.6 }}>
          Scan the <strong>{MARKETS[market].flag} {MARKETS[market].label}</strong> B2B market for the 3 most resonant trends of the last 90 days — with tension analysis and market timing.
        </p>
        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Scanning...</> : `◎ Scan ${MARKETS[market].label} Market`}
        </button>
      </div>

      {loading && (
        <div className="loader">
          <div className="spinner" />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Scanning B2B Landscape</div>
          <div className="loader-msg">{loadingSteps[loadMsg]}</div>
        </div>
      )}

      {!loading && error && <div className="error-box">⚠ {error}</div>}

      {!loading && !error && !trends && (
        <div className="empty">
          <div className="empty-icon">◎</div>
          <div className="empty-title">No data yet</div>
          <p className="empty-text">Hit "Scan Market" to discover what's resonating in {MARKETS[market].label} right now.</p>
        </div>
      )}

      {!loading && trends && (
        <div className="trend-grid">
          {trends.map((t, i) => (
            <div className="trend-card" key={i}>
              <div className="trend-header">
                <div className="trend-name">{t.trend_name}</div>
                <div className={`score-pill ${scoreClass(t.resonance_score)}`}>
                  ↑ {t.resonance_score}
                </div>
              </div>
              {t.narrative_hook && (
                <p className="trend-hook">"{t.narrative_hook}"</p>
              )}
              <div className="trend-meta">
                <div className="trend-meta-item">
                  <div className="trend-meta-label">Market Tension</div>
                  <div className="trend-meta-value">{t.market_tension}</div>
                </div>
                <div className="trend-meta-item">
                  <div className="trend-meta-label">Why Now</div>
                  <div className="trend-meta-value">{t.why_now}</div>
                </div>
              </div>
              <div className="trend-footer">
                <button className="btn-ghost" onClick={() => {
                  setImproveCtx(t.trend_name + ": " + t.narrative_hook);
                  switchStep("improve");
                }}>
                  Use as context →
                </button>
                <button className="btn-lime" onClick={() => {
                  setEvalText(evalText);
                  switchStep("evaluate");
                }}>
                  Evaluate my copy ◈
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Step: Evaluate ─────────────────────────────────────────────────────────
  const renderEvaluate = () => (
    <div className="split">
      {/* Left: Input */}
      <div className="card" style={{ position: "sticky", top: 72 }}>
        <p className="field-label">Your B2B Copy</p>
        <textarea
          className="inp"
          rows={9}
          value={evalText}
          onChange={e => setEvalText(e.target.value)}
          placeholder="Paste your marketing text, headline, email, or landing page section..."
        />
        <button
          className="btn-primary"
          style={{ marginTop: 14 }}
          onClick={handleEvaluate}
          disabled={loading || !evalText.trim()}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Auditing...</>
            : `◈ Audit for ${MARKETS[market].flag} ${MARKETS[market].label}`
          }
        </button>
        {evalResult && (
          <button
            className="btn-ghost"
            style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
            onClick={() => { setImproveText(evalText); switchStep("improve"); }}
          >
            ◆ Improve this text →
          </button>
        )}
      </div>

      {/* Right: Results */}
      <div>
        {loading && (
          <div className="loader">
            <div className="spinner" />
            <div style={{ fontWeight: 600, fontSize: 14 }}>Auditing Content</div>
            <div className="loader-msg">{loadingSteps[loadMsg]}</div>
          </div>
        )}
        {!loading && error && <div className="error-box" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        {!loading && !evalResult && !error && (
          <div className="empty">
            <div className="empty-icon">◈</div>
            <div className="empty-title">Ready to Audit</div>
            <p className="empty-text">Paste your copy and hit Audit to reveal cultural gaps, tone mismatch, and exact rewrites.</p>
          </div>
        )}

        {!loading && evalResult && (() => {
          const vc = VERDICT_CFG[evalResult.verdict];
          return (
            <div className="stack">
              {/* Verdict */}
              <div className="verdict-banner" style={{ background: vc.bg, borderColor: vc.border, color: vc.color }}>
                <div className="verdict-icon">{vc.icon}</div>
                <div>
                  <div className="verdict-label">{evalResult.verdict} — {vc.sub}</div>
                  <div className="verdict-reason">{evalResult.verdict_reason}</div>
                </div>
              </div>

              {/* Trend context */}
              {evalResult.trend_context && (
                <div className="ctx-box">
                  <span className="ctx-icon">📡</span>
                  <span><strong>Market signal:</strong> {evalResult.trend_context}</span>
                </div>
              )}

              {/* Metrics */}
              <div className="grid2">
                {/* Tone map */}
                <div className="card" style={{ margin: 0 }}>
                  <p className="field-label">Tone Map</p>
                  {renderToneBar("Formal", "Casual", evalResult.tone_map.formal_casual)}
                  {renderToneBar("Bold / Hype", "Cautious", evalResult.tone_map.bold_cautious)}
                  {renderToneBar("Tech-led", "Benefit-led", evalResult.tone_map.technical_benefit)}
                  {renderToneBar("Abstract", "Concrete", evalResult.tone_map.abstract_concrete)}
                  {renderToneBar("Translated", "Native", evalResult.tone_map.global_native)}
                </div>

                <div className="stack">
                  {/* Genericness */}
                  <div className="card" style={{ margin: 0 }}>
                    <p className="field-label">Genericness Score</p>
                    <div className="score-big" style={{ color: scoreColor(evalResult.genericness_score) }}>
                      {evalResult.genericness_score}
                      <span style={{ fontSize: 16, color: "var(--t3)", fontWeight: 400 }}>/100</span>
                    </div>
                    <p className="score-sub">
                      {evalResult.genericness_score < 35 ? "Original & local" :
                       evalResult.genericness_score < 65 ? "Generic SaaS voice" : "Pure US clichés"}
                    </p>
                    <div className="badge-row">
                      {evalResult.generic_phrases.map((p, i) => (
                        <span className="badge" key={i}>"{p}"</span>
                      ))}
                    </div>
                  </div>

                  {/* Trust signals */}
                  <div className="card" style={{ margin: 0 }}>
                    <p className="field-label">Missing Trust Signals</p>
                    <ul className="trust-list">
                      {evalResult.missing_trust_signals.map((s, i) => (
                        <li className="trust-item" key={i}><span>✕</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Rewrites */}
              <div>
                <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Suggested Rewrites</span>
                  <button className="btn-ghost" onClick={() => copyText(evalResult.brief_text, "Brief copied!")}>
                    📋 Copy Full Brief
                  </button>
                </div>
                <div className="stack">
                  {evalResult.rewrites.map((rw, i) => (
                    <div className="rw-card" key={i}>
                      <div className="rw-tag">{rw.block}</div>
                      <div className="rw-cols">
                        <div>
                          <div className="rw-col-label">Original</div>
                          <div className="rw-block">{rw.original}</div>
                        </div>
                        <div>
                          <div className="rw-col-label">Localized {MARKETS[market].flag}</div>
                          <div className="rw-block local">{rw.suggested_local}</div>
                          {rw.suggested !== rw.suggested_local && (
                            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>EN: {rw.suggested}</div>
                          )}
                        </div>
                      </div>
                      <div className="rw-reason">💡 {rw.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  // ── Step: Improve ──────────────────────────────────────────────────────────
  const renderImprove = () => (
    <div className="split">
      {/* Left: Input */}
      <div className="card" style={{ position: "sticky", top: 72 }}>
        <p className="field-label">Text to Improve</p>
        <textarea
          className="inp"
          rows={7}
          value={improveText || evalText}
          onChange={e => setImproveText(e.target.value)}
          placeholder="Paste text to rewrite, or it will carry over from Evaluate..."
        />
        <p className="field-label" style={{ marginTop: 14 }}>Context (optional)</p>
        <textarea
          className="inp"
          rows={3}
          value={improveCtx}
          onChange={e => setImproveCtx(e.target.value)}
          placeholder="e.g. trend context, product positioning, target persona..."
        />
        <button
          className="btn-primary"
          style={{ marginTop: 14 }}
          onClick={handleImprove}
          disabled={loading || !(improveText.trim() || evalText.trim())}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Rewriting...</>
            : `◆ Improve for ${MARKETS[market].flag} ${MARKETS[market].label}`
          }
        </button>
      </div>

      {/* Right: Results */}
      <div>
        {loading && (
          <div className="loader">
            <div className="spinner" />
            <div style={{ fontWeight: 600, fontSize: 14 }}>Rewriting for {MARKETS[market].label}</div>
            <div className="loader-msg">{loadingSteps[loadMsg]}</div>
          </div>
        )}
        {!loading && error && <div className="error-box" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        {!loading && !improveResult && !error && (
          <div className="empty">
            <div className="empty-icon">◆</div>
            <div className="empty-title">Ready to Improve</div>
            <p className="empty-text">Your text will be fully rewritten to sound native and compelling for {MARKETS[market].label}.</p>
          </div>
        )}

        {!loading && improveResult && (
          <div className="stack">
            {/* Tone achieved */}
            <div className="tone-tag">
              ✓ {improveResult.tone_achieved}
            </div>

            {/* Result text */}
            <div className="improve-result">
              <div className="improve-tabs">
                <button className={`improve-tab ${improveTab === "en" ? "active" : ""}`} onClick={() => setImproveTab("en")}>
                  English
                </button>
                <button className={`improve-tab ${improveTab === "local" ? "active" : ""}`} onClick={() => setImproveTab("local")}>
                  {MARKETS[market].flag} Local
                </button>
                <button className="btn-ghost" style={{ marginLeft: "auto" }}
                  onClick={() => copyText(improveTab === "en" ? improveResult.improved_text : improveResult.improved_local, "Text copied!")}>
                  📋 Copy
                </button>
              </div>
              <div className="improve-body">
                {improveTab === "en" ? improveResult.improved_text : improveResult.improved_local}
              </div>
            </div>

            {/* What changed */}
            {improveResult.changes?.length > 0 && (
              <div>
                <p className="field-label" style={{ marginBottom: 8 }}>What Changed & Why</p>
                <div className="change-list">
                  {improveResult.changes.map((c, i) => (
                    <div className="change-item" key={i}>
                      <div className="change-what">{c.what}</div>
                      <div className="change-why">{c.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <style>{STYLE}</style>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">B</div>
          Breason
        </div>

        {/* Steps */}
        <p className="nav-section-label">Workflow</p>
        <nav className="nav-list">
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s], idx) => (
            <button
              key={key}
              className={`nav-btn ${step === key ? "active" : ""}`}
              onClick={() => switchStep(key)}
              aria-current={step === key ? "page" : undefined}
            >
              <div className="nav-step-num">{String(idx + 1).padStart(2, "0")}</div>
              <div className="nav-step-info">
                <div className="nav-step-label">{s.label}</div>
                <div className="nav-step-hint">{s.hint}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Markets */}
        <p className="nav-section-label">Target Market</p>
        <div className="mkt-section">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
            <button
              key={key}
              className={`mkt-pill ${market === key ? "active" : ""}`}
              onClick={() => setMarket(key)}
              aria-pressed={market === key}
            >
              <span className="mkt-pill-flag">{m.flag}</span>
              <span className="mkt-pill-name">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          Breason v2.0<br />
          <span style={{ opacity: 0.5 }}>Not translation. Resonance.</span>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-step-badge">{String(Object.keys(STEPS).indexOf(step) + 1).padStart(2, "0")}</span>
            {STEPS[step].label} — {MARKETS[market].flag} {MARKETS[market].label}
          </div>
          {(evalResult || improveResult || trends) && (
            <button className="btn-ghost" onClick={() => {
              setTrends(null); setEvalResult(null); setImproveResult(null); setError(null);
            }}>
              ↺ Reset
            </button>
          )}
        </header>

        <main className="page">
          {step === "search"   && renderSearch()}
          {step === "evaluate" && renderEvaluate()}
          {step === "improve"  && renderImprove()}
        </main>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
