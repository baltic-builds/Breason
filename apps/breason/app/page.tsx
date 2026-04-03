"use client";
import { useMemo, useState } from "react";
import type { AnalyzeResult, FeatureFlags, MarketKey } from "@breason/types";
import flagsJson from "@/data/feature-flags.json";

const flags = flagsJson as FeatureFlags;

const MARKETS: Record<MarketKey, { label: string; flag: string; lang: string; summary: string }> = {
  brazil:  { label: "Brazil",  flag: "🇧🇷", lang: "pt-BR", summary: "Warm, relationship-driven B2B communication with strong local trust expectations." },
  poland:  { label: "Poland",  flag: "🇵🇱", lang: "pl-PL", summary: "Pragmatic, skeptical, technically-minded audience that values substance over hype." },
  germany: { label: "Germany", flag: "🇩🇪", lang: "de-DE", summary: "Structured, trust-first, compliance-oriented market. Reliability over hype." },
};

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #0A0A0B;
  --surface:  #111113;
  --surface2: #18181B;
  --surface3: #222226;
  --border:   rgba(255,255,255,0.07);
  --border2:  rgba(255,255,255,0.12);
  --text:     #F4F4F5;
  --muted:    #71717A;
  --muted2:   #52525B;
  --accent:   #C8F135;
  --accent2:  #A8D920;
  --blue:     #3B82F6;
  --green:    #22C55E;
  --amber:    #F59E0B;
  --red:      #EF4444;
  --font:     'DM Sans', system-ui, sans-serif;
  --display:  'Syne', system-ui, sans-serif;
  --radius:   14px;
  --radius-sm: 8px;
  --radius-xs: 6px;
}

body { font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.5; -webkit-font-smoothing: antialiased; }

.app { display: flex; min-height: 100vh; }

/* ── Sidebar ── */
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sb-logo {
  padding: 22px 20px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.sb-mark {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--accent);
  color: #0A0A0B;
  font-family: var(--display);
  font-weight: 800;
  font-size: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.sb-title {
  font-family: var(--display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

.sb-section-label {
  padding: 16px 20px 6px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted2);
}

.sb-nav { flex: 1; padding: 8px 10px; display: flex; flex-direction: column; gap: 1px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  text-align: left;
  cursor: pointer;
  font-weight: 400;
  font-size: 13.5px;
  font-family: var(--font);
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.nav-item:hover { background: var(--surface3); color: var(--text); }
.nav-item.active { background: var(--surface3); color: var(--text); font-weight: 500; }
.nav-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

.sb-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted2);
}

/* ── Main ── */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.top-bar {
  height: 52px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.top-bar-left { display: flex; align-items: center; gap: 12px; }
.breadcrumb { font-size: 13px; color: var(--muted); }
.breadcrumb-sep { color: var(--muted2); margin: 0 2px; }
.top-bar-title { font-size: 13px; font-weight: 500; color: var(--text); }

.top-actions { display: flex; align-items: center; gap: 8px; }

.btn { 
  height: 32px; padding: 0 14px;
  border-radius: 999px; border: 1px solid var(--border2);
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  font-family: var(--font); transition: all 0.12s;
  display: inline-flex; align-items: center; gap: 6px;
}
.btn-ghost { background: transparent; color: var(--muted); }
.btn-ghost:hover { background: var(--surface3); color: var(--text); border-color: var(--border2); }
.btn-accent { background: var(--accent); color: #0A0A0B; border-color: var(--accent); font-weight: 600; }
.btn-accent:hover { background: var(--accent2); border-color: var(--accent2); }
.btn-accent:disabled { background: var(--surface3); color: var(--muted2); border-color: transparent; cursor: not-allowed; }

.content { flex: 1; overflow-y: auto; padding: 28px; }

/* ── Hero banner ── */
.hero {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px 32px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -60px; right: -60px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(200,241,53,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-text h1 {
  font-family: var(--display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
  line-height: 1.2;
}

.hero-sub { font-size: 13px; color: var(--muted); line-height: 1.6; max-width: 400px; }

.hero-stats { display: flex; gap: 8px; flex-shrink: 0; }
.stat-pill {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 16px;
  text-align: center;
  min-width: 70px;
}
.stat-num { font-family: var(--display); font-size: 20px; font-weight: 700; color: var(--accent); }
.stat-lbl { font-size: 10px; color: var(--muted); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }

/* ── Input section ── */
.section-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}

.market-row { display: flex; gap: 8px; margin-bottom: 16px; }

.mkt-chip {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.mkt-chip:hover { border-color: var(--border2); background: var(--surface2); }
.mkt-chip.sel { border-color: var(--accent); background: rgba(200,241,53,0.04); }

.mkt-flag { font-size: 20px; margin-bottom: 6px; }
.mkt-name { font-size: 12px; font-weight: 500; color: var(--text); }
.mkt-lang { font-size: 10px; color: var(--muted2); margin-top: 2px; font-family: 'DM Mono', monospace; }

.input-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 12px;
}

.inp-tabs { display: flex; border-bottom: 1px solid var(--border); }
.inp-tab {
  flex: 1; border: none; background: transparent;
  padding: 11px 16px; cursor: pointer;
  font-size: 12.5px; font-weight: 400; font-family: var(--font);
  color: var(--muted); transition: color 0.12s, background 0.12s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.inp-tab:hover { color: var(--text); }
.inp-tab.active { color: var(--text); font-weight: 500; background: var(--surface2); }

.inp-body { padding: 14px; }
.inp-field {
  width: 100%; border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px; font-size: 13.5px;
  font-family: var(--font); background: var(--surface2);
  color: var(--text); resize: none; outline: none;
  transition: border-color 0.12s;
  line-height: 1.6;
}
.inp-field::placeholder { color: var(--muted2); }
.inp-field:focus { border-color: rgba(200,241,53,0.3); }

.hint-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 16px;
}
.hint-card strong { color: var(--text); font-weight: 500; }

.err-card {
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 13px;
  color: #FCA5A5;
  margin-bottom: 12px;
}

/* ── Results ── */
.results-grid { display: flex; flex-direction: column; gap: 12px; }

.rcard {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 24px;
}

.rcard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.rcard-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.verdict-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }

.v-badge {
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 999px; padding: 5px 12px;
  font-weight: 600; font-size: 12px;
  font-family: var(--display);
}
.v-pass { background: rgba(34,197,94,0.12); color: #86EFAC; border: 1px solid rgba(34,197,94,0.2); }
.v-sus  { background: rgba(245,158,11,0.12); color: #FCD34D; border: 1px solid rgba(245,158,11,0.2); }
.v-for  { background: rgba(239,68,68,0.12);  color: #FCA5A5; border: 1px solid rgba(239,68,68,0.2); }

.v-icon { width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; }
.v-pass .v-icon { background: rgba(34,197,94,0.25); }
.v-sus .v-icon  { background: rgba(245,158,11,0.25); }
.v-for .v-icon  { background: rgba(239,68,68,0.25); }

.score-display { display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px; }
.score-num { font-family: var(--display); font-size: 48px; font-weight: 800; line-height: 1; }
.score-pct { font-size: 16px; color: var(--muted); }

.score-bar { height: 3px; background: var(--surface3); border-radius: 2px; overflow: hidden; margin-bottom: 12px; }
.score-fill { height: 100%; border-radius: 2px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }

.rcard p, .rcard-body { font-size: 13.5px; color: var(--muted); line-height: 1.65; }

.list-items { display: flex; flex-direction: column; gap: 7px; }
.list-item { 
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; color: var(--muted); line-height: 1.5;
}
.list-bullet {
  width: 5px; height: 5px; border-radius: 50%;
  flex-shrink: 0; margin-top: 7px;
}
.bullet-green { background: var(--green); }
.bullet-red   { background: var(--red); }
.bullet-blue  { background: var(--blue); }

.provider-meta {
  font-size: 11px; color: var(--muted2);
  font-family: 'DM Mono', monospace;
  display: flex; gap: 8px; align-items: center;
}
.meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--muted2); }

/* ── Bottom bar ── */
.bottom-bar {
  height: 60px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.bar-field {
  flex: 1; border: 1px solid var(--border);
  border-radius: 999px; padding: 0 18px; height: 38px;
  font-family: var(--font); font-size: 13px;
  background: var(--surface2); color: var(--text);
  outline: none; transition: border-color 0.12s;
}
.bar-field::placeholder { color: var(--muted2); }
.bar-field:focus { border-color: rgba(200,241,53,0.25); }

.send-btn {
  width: 38px; height: 38px; border-radius: 50%;
  border: none; background: var(--accent);
  font-size: 15px; cursor: pointer;
  display: grid; place-items: center;
  transition: opacity 0.12s, transform 0.1s;
  flex-shrink: 0; color: #0A0A0B;
}
.send-btn:hover { opacity: 0.88; }
.send-btn:active { transform: scale(0.94); }

/* ── ReDuck CTA ── */
.reduck-cta {
  background: rgba(200,241,53,0.04);
  border: 1px solid rgba(200,241,53,0.15);
  border-radius: var(--radius);
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-decoration: none;
  transition: border-color 0.12s, background 0.12s;
}
.reduck-cta:hover { border-color: rgba(200,241,53,0.3); background: rgba(200,241,53,0.06); }
.reduck-cta-text { font-size: 13.5px; color: var(--muted); line-height: 1.5; }
.reduck-cta-text strong { color: var(--text); display: block; font-size: 14px; margin-bottom: 2px; }
.reduck-arrow { font-size: 20px; color: var(--accent); flex-shrink: 0; }

@media (max-width: 900px) {
  .sidebar { display: none; }
  .market-row { flex-direction: column; }
  .hero { flex-direction: column; align-items: flex-start; }
  .content { padding: 16px; }
}
`;

function VerdictCard({ data }: { data: AnalyzeResult }) {
  const cfg = {
    PASS:       { cls: "v-pass", icon: "✓", label: "Sounds native" },
    SUSPICIOUS: { cls: "v-sus",  icon: "~", label: "Imported-sounding" },
    FOREIGN:    { cls: "v-for",  icon: "✕", label: "Reads like a translation" },
  }[data.verdict];
  return (
    <div className="rcard">
      <div className="rcard-label" style={{ marginBottom: 14 }}>Verdict</div>
      <div className="verdict-row">
        <div className={`v-badge ${cfg.cls}`}>
          <span className="v-icon">{cfg.icon}</span>
          {data.verdict} — {cfg.label}
        </div>
      </div>
      <p>{data.insight}</p>
    </div>
  );
}

function ScoreCard({ data }: { data: AnalyzeResult }) {
  const generic = Math.max(0, 100 - data.score);
  const color = generic <= 30 ? "#22C55E" : generic <= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="rcard">
      <div className="rcard-header">
        <div className="rcard-label">Genericness Score</div>
        <div className="provider-meta">
          <span>{data.provider}</span>
          <span className="meta-dot" />
          <span>{data.latencyMs}ms</span>
          {data.promptVersion && (
            <>
              <span className="meta-dot" />
              <span>{data.promptVersion}</span>
            </>
          )}
        </div>
      </div>
      <div className="score-display">
        <span className="score-num" style={{ color }}>{generic}</span>
        <span className="score-pct">%</span>
      </div>
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${generic}%`, background: color }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted2)' }}>
        {generic <= 30 ? "Your copy feels local and authentic." :
         generic <= 60 ? "Some phrases sound imported — worth refining." :
         "High genericness detected. Consider a full ReDuck rewrite."}
      </p>
    </div>
  );
}

export default function EvaluatePage() {
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [tab, setTab] = useState<"url" | "text">("text");
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reduckUrl = useMemo(
    () => `/reduck?market=${market}&text=${encodeURIComponent(text)}`,
    [market, text]
  );

  async function analyze() {
    setError("");
    if (!text.trim()) { setError("Please enter text or URL."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      setResult(await res.json() as AnalyzeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-mark">B</div>
            <span className="sb-title">Breason</span>
          </div>
          <nav className="sb-nav">
            <div className="section-label" style={{ padding: '14px 10px 6px', fontSize: 10 }}>Workflow</div>
            <a className="nav-item active" href="/">
              <span className="nav-dot" />
              Evaluate
            </a>
            {flags.enableResonance && (
              <a className="nav-item" href="/resonance">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted2)', flexShrink: 0 }} />
                Resonance
              </a>
            )}
            {flags.enableReDuckIntegration && (
              <a className="nav-item" href="/reduck">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted2)', flexShrink: 0 }} />
                ReDuck
              </a>
            )}
          </nav>
          <div className="sb-footer">Breason MVP · v0.1</div>
        </aside>

        {/* Main */}
        <div className="main">
          <header className="top-bar">
            <div className="top-bar-left">
              <span className="breadcrumb">
                Breason <span className="breadcrumb-sep">/</span>
              </span>
              <span className="top-bar-title">
                {result
                  ? `${MARKETS[market].flag} ${MARKETS[market].label} · Analysis`
                  : "Market Fit Evaluation"}
              </span>
            </div>
            <div className="top-actions">
              {result && (
                <button className="btn btn-ghost" onClick={() => setResult(null)}>
                  ← New analysis
                </button>
              )}
              <button
                className="btn btn-accent"
                onClick={result ? () => setResult(null) : analyze}
                disabled={loading}
              >
                {loading ? "Analyzing…" : result ? "Analyze again" : "Analyze →"}
              </button>
            </div>
          </header>

          <div className="content">
            {/* Hero */}
            <div className="hero">
              <div className="hero-text">
                <h1>Does your copy sound local?</h1>
                <p className="hero-sub">
                  Paste any marketing text — get instant market-fit diagnosis with trust signals, risks, and rewrite suggestions.
                </p>
              </div>
              <div className="hero-stats">
                <div className="stat-pill">
                  <div className="stat-num">3</div>
                  <div className="stat-lbl">Markets</div>
                </div>
                <div className="stat-pill">
                  <div className="stat-num">AI</div>
                  <div className="stat-lbl">Powered</div>
                </div>
              </div>
            </div>

            {/* Input state */}
            {!result && (
              <>
                <div className="section-label">Select market</div>
                <div className="market-row">
                  {(Object.keys(MARKETS) as MarketKey[]).map((key) => (
                    <button
                      key={key}
                      className={`mkt-chip${market === key ? " sel" : ""}`}
                      onClick={() => setMarket(key)}
                    >
                      <div className="mkt-flag">{MARKETS[key].flag}</div>
                      <div className="mkt-name">{MARKETS[key].label}</div>
                      <div className="mkt-lang">{MARKETS[key].lang}</div>
                    </button>
                  ))}
                </div>

                <div className="section-label">Your copy</div>
                <div className="input-card">
                  <div className="inp-tabs">
                    <button
                      className={`inp-tab${tab === "url" ? " active" : ""}`}
                      onClick={() => setTab("url")}
                    >
                      🔗 URL
                    </button>
                    <button
                      className={`inp-tab${tab === "text" ? " active" : ""}`}
                      onClick={() => setTab("text")}
                    >
                      ✍️ Text
                    </button>
                  </div>
                  <div className="inp-body">
                    {tab === "url"
                      ? <input
                          className="inp-field"
                          placeholder="https://your-landing-page.com"
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                      : <textarea
                          className="inp-field"
                          rows={7}
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="Paste your marketing copy here…"
                        />
                    }
                  </div>
                </div>

                <div className="hint-card">
                  <strong>{MARKETS[market].label}:</strong> {MARKETS[market].summary}
                </div>

                {error && <div className="err-card">{error}</div>}
              </>
            )}

            {/* Results state */}
            {result && (
              <div className="results-grid">
                <VerdictCard data={result} />
                <ScoreCard data={result} />

                <div className="rcard">
                  <div className="rcard-label" style={{ marginBottom: 12 }}>Market Tension</div>
                  <p>{result.marketTension}</p>
                </div>

                <div className="rcard">
                  <div className="rcard-label" style={{ marginBottom: 12 }}>Trust Signals</div>
                  <div className="list-items">
                    {result.strengths.map((x) => (
                      <div className="list-item" key={x}>
                        <span className="list-bullet bullet-green" />
                        {x}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rcard">
                  <div className="rcard-label" style={{ marginBottom: 12 }}>Risks</div>
                  <div className="list-items">
                    {result.risks.map((x) => (
                      <div className="list-item" key={x}>
                        <span className="list-bullet bullet-red" />
                        {x}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rcard">
                  <div className="rcard-label" style={{ marginBottom: 12 }}>Suggestions</div>
                  <div className="list-items">
                    {result.suggestions.map((x) => (
                      <div className="list-item" key={x}>
                        <span className="list-bullet bullet-blue" />
                        {x}
                      </div>
                    ))}
                  </div>
                </div>

                {flags.enableReDuckIntegration && (
                  <a href={reduckUrl} className="reduck-cta">
                    <div className="reduck-cta-text">
                      <strong>Refine with ReDuck</strong>
                      AI-powered rewrite tailored to the {MARKETS[market].label} market
                    </div>
                    <span className="reduck-arrow">→</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="bottom-bar">
            <input
              className="bar-field"
              placeholder="Paste a URL or type your marketing copy here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !result && analyze()}
            />
            <button className="send-btn" onClick={result ? () => setResult(null) : analyze}>
              {result ? "↺" : "→"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
