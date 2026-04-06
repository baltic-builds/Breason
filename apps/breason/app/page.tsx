"use client";

import { useState, useEffect, useCallback } from "react";

// --- Types ---
type MarketKey = "brazil" | "poland" | "germany";
type VerdictType = "PASS" | "SUSPICIOUS" | "FOREIGN";

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

interface AnalysisResult {
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

// --- Constants ---
const MARKETS: Record<MarketKey, { label: string; flag: string; desc: string }> = {
  germany: { label: "Germany", flag: "🇩🇪", desc: "Formal, precise, skeptical of hype." },
  poland:  { label: "Poland",  flag: "🇵🇱", desc: "Direct, fact-based, values numbers." },
  brazil:  { label: "Brazil",  flag: "🇧🇷", desc: "Warm, human, relationship-first." },
};

const DEFAULT_TEXT = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_STEPS = [
  "Analyzing tone and cultural fit...",
  "Comparing with market baseline...",
  "Checking local trust signals...",
  "Scanning for generic clichés...",
  "Generating native rewrites...",
];

const VERDICT_CONFIG: Record<VerdictType, { bg: string; border: string; color: string; icon: string; label: string }> = {
  PASS:       { bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.35)",  color: "#3F6212", icon: "✓", label: "Sounds Local" },
  SUSPICIOUS: { bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.35)",  color: "#C2410C", icon: "⚠", label: "Sounds Imported" },
  FOREIGN:    { bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.35)",   color: "#BE123C", icon: "✕", label: "Sounds Foreign" },
};

// --- Styles ---
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet: #7C3AED;
  --violet-light: rgba(124,58,237,0.08);
  --lime: #84CC16;
  --orange: #F97316;
  --sky: #0EA5E9;
  --red: #EF4444;
  --bg: #F1F5F9;
  --surface: #FFFFFF;
  --t1: #0F172A;
  --t2: #475569;
  --t3: #94A3B8;
  --border: rgba(15,23,42,0.1);
  --border-light: rgba(15,23,42,0.05);
  --radius: 14px;
  --sidebar-w: 240px;
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

/* ── Layout ─────────────────────────────── */
.shell { display: flex; min-height: 100vh; }

.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 32px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 20;
}

.content {
  flex: 1;
  padding: 32px;
  display: grid;
  gap: 24px;
  align-items: start;
  grid-template-columns: 380px 1fr;
}

/* ── Logo ────────────────────────────────── */
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Syne', sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: var(--t1);
  margin-bottom: 28px;
  text-decoration: none;
}

.logo-mark {
  width: 30px;
  height: 30px;
  background: var(--lime);
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 800;
  color: #1a2e05;
  flex-shrink: 0;
}

.sidebar-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--t3);
  margin-bottom: 8px;
}

.sidebar-footer {
  margin-top: auto;
  font-size: 11px;
  color: var(--t3);
  line-height: 1.7;
}

/* ── Cards ───────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.field-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--t3);
  margin-bottom: 10px;
}

/* ── Market Selector ─────────────────────── */
.market-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }

.mkt-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s, background 0.15s;
  font-family: inherit;
}

.mkt-btn:hover { border-color: var(--border); background: var(--bg); }
.mkt-btn.active { border-color: var(--lime); background: rgba(132,204,22,0.06); }

.mkt-flag { font-size: 22px; line-height: 1; }

.mkt-name { font-size: 13px; font-weight: 600; color: var(--t1); }
.mkt-desc { font-size: 11px; color: var(--t3); margin-top: 1px; }

/* ── Textarea ────────────────────────────── */
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
  min-height: 160px;
}

textarea.inp:focus {
  border-color: var(--violet);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
}

/* ── Buttons ─────────────────────────────── */
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  background: var(--violet);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  margin-top: 16px;
}

.btn-primary:hover:not(:disabled) {
  background: #6D28D9;
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
  transition: background 0.15s, border-color 0.15s;
}

.btn-ghost:hover { background: var(--bg); border-color: var(--border); }

/* ── Empty State ─────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  padding: 40px;
  color: var(--t3);
}

.empty-icon { font-size: 40px; margin-bottom: 16px; opacity: 0.5; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--t2); margin-bottom: 6px; }
.empty-text { font-size: 13px; max-width: 260px; line-height: 1.6; }

/* ── Loader ──────────────────────────────── */
.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
  color: var(--t2);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--violet);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loader-step { font-size: 13px; color: var(--t3); transition: opacity 0.3s; }

/* ── Verdict Banner ──────────────────────── */
.verdict {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: var(--radius);
  border: 1.5px solid;
  margin-bottom: 20px;
}

.verdict-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  flex-shrink: 0;
  background: rgba(255,255,255,0.6);
}

.verdict-label {
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.verdict-reason { font-size: 13px; font-weight: 500; opacity: 0.85; }

/* ── Grid 2-col ──────────────────────────── */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

/* ── Tone Map ────────────────────────────── */
.tone-row { margin-bottom: 14px; }
.tone-row:last-child { margin-bottom: 0; }

.tone-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t2);
  margin-bottom: 5px;
}

.tone-track {
  position: relative;
  height: 5px;
  background: var(--bg);
  border-radius: 99px;
  overflow: visible;
}

.tone-center-line {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 1.5px;
  background: var(--border);
  border-radius: 99px;
}

.tone-dot {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--violet);
  border: 2px solid white;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(124,58,237,0.4);
  transition: left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ── Score & Badges ──────────────────────── */
.score-number {
  font-family: 'Syne', sans-serif;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.score-label { font-size: 11px; color: var(--t3); margin-bottom: 12px; }

.badge-wrap { display: flex; flex-wrap: wrap; gap: 6px; }

.badge {
  padding: 4px 10px;
  background: #FEE2E2;
  color: #B91C1C;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
}

/* ── Trust Signals ───────────────────────── */
.trust-list { display: flex; flex-direction: column; gap: 6px; }

.trust-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 12px;
  background: var(--bg);
  border-radius: 8px;
  font-size: 12px;
  color: var(--t2);
  border-left: 3px solid var(--red);
}

/* ── Trend Context ───────────────────────── */
.trend-box {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(14,165,233,0.06);
  border: 1px solid rgba(14,165,233,0.2);
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--t2);
  line-height: 1.5;
}

.trend-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

/* ── Rewrites ────────────────────────────── */
.rw-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rw-title { font-size: 14px; font-weight: 700; color: var(--t1); }

.rw-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.rw-card:last-child { margin-bottom: 0; }

.rw-block-tag {
  display: inline-block;
  padding: 3px 8px;
  background: var(--violet-light);
  color: var(--violet);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 5px;
  margin-bottom: 12px;
}

.rw-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }

.rw-col-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--t3);
  margin-bottom: 6px;
}

.rw-text {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.55;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--t2);
}

.rw-text.local {
  background: var(--violet-light);
  border-color: rgba(124,58,237,0.2);
  color: var(--violet);
  font-weight: 500;
}

.rw-reason {
  font-size: 12px;
  color: var(--t3);
  font-style: italic;
  padding-top: 10px;
  border-top: 1px solid var(--border-light);
}

/* ── Toast ───────────────────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--t1);
  color: #fff;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  z-index: 100;
  animation: slideUp 0.3s ease-out;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Error Banner ────────────────────────── */
.error-banner {
  padding: 14px 16px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 10px;
  color: #B91C1C;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
}

/* ── Responsive ──────────────────────────── */
@media (max-width: 900px) {
  .sidebar { display: none; }
  .content { grid-template-columns: 1fr; padding: 20px; }
}
`;

export default function BreasonApp() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [market, setMarket] = useState<MarketKey>("germany");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Rotate loading message
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadingStep(s => (s + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, [loading]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setLoadingStep(0);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), market }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Server error ${res.status}`);
        return;
      }

      // Validate required fields exist
      if (!data.verdict || !data.tone_map || !data.rewrites) {
        setError("Incomplete response from AI. Please try again.");
        return;
      }

      setResult(data);
    } catch (e: any) {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [text, market, loading]);

  const handleCopyBrief = () => {
    if (!result?.brief_text) return;
    navigator.clipboard.writeText(result.brief_text).then(() => {
      showToast("✓ Brief copied to clipboard");
    });
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  const renderToneBar = (labelL: string, labelR: string, value: number) => {
    const pct = ((value + 5) / 10) * 100;
    return (
      <div className="tone-row">
        <div className="tone-labels">
          <span>{labelL}</span>
          <span>{labelR}</span>
        </div>
        <div className="tone-track">
          <div className="tone-center-line" />
          <div className="tone-dot" style={{ left: `${pct}%` }} />
        </div>
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score < 35) return "#3F6212";
    if (score < 65) return "#C2410C";
    return "#BE123C";
  };

  return (
    <div className="shell">
      <style>{STYLE}</style>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">B</div>
          Breason
        </div>

        <p className="sidebar-label">About</p>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.65, marginBottom: 24 }}>
          AI-powered localization auditor for B2B SaaS teams expanding to new markets.
        </p>

        <p className="sidebar-label">Markets</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {(Object.keys(MARKETS) as MarketKey[]).map(k => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)" }}>
              <span>{MARKETS[k].flag}</span> {MARKETS[k].label}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          v1.0 · Breason<br />
          <span style={{ opacity: 0.5 }}>Not translation. Resonance.</span>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">

        {/* Topbar */}
        <header className="topbar">
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)" }}>
            Global Content Auditor
          </span>
          {result && (
            <button className="btn-ghost" onClick={handleReset}>
              ↺ New Analysis
            </button>
          )}
        </header>

        {/* Content */}
        <div className="content">

          {/* ── LEFT: Input Panel ── */}
          <div className="card" style={{ position: "sticky", top: 72 }}>
            <p className="field-label" style={{ marginBottom: 12 }}>Target Market</p>
            <div className="market-list">
              {(Object.keys(MARKETS) as MarketKey[]).map(k => (
                <button
                  key={k}
                  className={`mkt-btn ${market === k ? "active" : ""}`}
                  onClick={() => setMarket(k)}
                  aria-pressed={market === k}
                >
                  <span className="mkt-flag">{MARKETS[k].flag}</span>
                  <div>
                    <div className="mkt-name">{MARKETS[k].label}</div>
                    <div className="mkt-desc">{MARKETS[k].desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <p className="field-label">Marketing Copy</p>
            <textarea
              className="inp"
              rows={8}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your B2B marketing text here..."
              aria-label="Marketing copy to analyze"
            />

            <button
              className="btn-primary"
              onClick={handleAnalyze}
              disabled={loading || !text.trim()}
              aria-label="Analyze resonance"
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 0 }} />
                  Analyzing...
                </>
              ) : (
                "Analyze Resonance →"
              )}
            </button>
          </div>

          {/* ── RIGHT: Output Panel ── */}
          <div>
            {/* Error */}
            {error && (
              <div className="error-banner">
                ⚠ {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="loader">
                <div className="spinner" />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Auditing Content</div>
                <div className="loader-step">{LOADING_STEPS[loadingStep]}</div>
              </div>
            )}

            {/* Empty */}
            {!loading && !result && !error && (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <div className="empty-title">Ready to Audit</div>
                <p className="empty-text">
                  Paste your text, select a market, and hit Analyze to reveal cultural gaps.
                </p>
              </div>
            )}

            {/* Results */}
            {!loading && result && (() => {
              const vc = VERDICT_CONFIG[result.verdict];
              return (
                <div>
                  {/* Verdict */}
                  <div
                    className="verdict"
                    style={{ background: vc.bg, borderColor: vc.border, color: vc.color }}
                  >
                    <div className="verdict-icon">{vc.icon}</div>
                    <div>
                      <div className="verdict-label">{result.verdict} — {vc.label}</div>
                      <div className="verdict-reason">{result.verdict_reason}</div>
                    </div>
                  </div>

                  {/* Trend Context */}
                  {result.trend_context && (
                    <div className="trend-box">
                      <span className="trend-icon">📡</span>
                      <span><strong>Market context:</strong> {result.trend_context}</span>
                    </div>
                  )}

                  {/* Metrics grid */}
                  <div className="grid2">
                    {/* Tone Map */}
                    <div className="card" style={{ marginBottom: 0 }}>
                      <p className="field-label">Tone Map</p>
                      {renderToneBar("Formal", "Casual", result.tone_map.formal_casual)}
                      {renderToneBar("Bold / Hype", "Cautious", result.tone_map.bold_cautious)}
                      {renderToneBar("Tech-led", "Benefit-led", result.tone_map.technical_benefit)}
                      {renderToneBar("Abstract", "Concrete", result.tone_map.abstract_concrete)}
                      {renderToneBar("Translated", "Native", result.tone_map.global_native)}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Genericness */}
                      <div className="card" style={{ flex: 1 }}>
                        <p className="field-label">Genericness Score</p>
                        <div
                          className="score-number"
                          style={{ color: getScoreColor(result.genericness_score) }}
                        >
                          {result.genericness_score}
                          <span style={{ fontSize: 16, color: "var(--t3)", fontWeight: 400 }}>/100</span>
                        </div>
                        <p className="score-label">
                          {result.genericness_score < 35 ? "Original & Local" :
                           result.genericness_score < 65 ? "Generic SaaS Voice" :
                           "Pure US SaaS Clichés"}
                        </p>
                        <div className="badge-wrap">
                          {result.generic_phrases.map((p, i) => (
                            <span key={i} className="badge">"{p}"</span>
                          ))}
                        </div>
                      </div>

                      {/* Trust Signals */}
                      <div className="card" style={{ flex: 1 }}>
                        <p className="field-label">Missing Trust Signals</p>
                        <ul className="trust-list">
                          {result.missing_trust_signals.map((s, i) => (
                            <li key={i} className="trust-item">
                              <span>✕</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Rewrites */}
                  <div>
                    <div className="rw-section-header">
                      <span className="rw-title">Suggested Rewrites</span>
                      <button className="btn-ghost" onClick={handleCopyBrief}>
                        📋 Copy Full Brief
                      </button>
                    </div>

                    {result.rewrites.map((rw, i) => (
                      <div className="rw-card" key={i}>
                        <div className="rw-block-tag">{rw.block}</div>
                        <div className="rw-cols">
                          <div>
                            <div className="rw-col-label">Original</div>
                            <div className="rw-text">{rw.original}</div>
                          </div>
                          <div>
                            <div className="rw-col-label">
                              Localized {MARKETS[market].flag}
                            </div>
                            <div className="rw-text local">{rw.suggested_local}</div>
                            {rw.suggested !== rw.suggested_local && (
                              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>
                                EN: {rw.suggested}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rw-reason">💡 {rw.reason}</div>
                      </div>
                    ))}
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
