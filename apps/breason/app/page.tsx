"use client";

import { useMemo, useState } from "react";
import type { AnalyzeResult, FeatureFlags, MarketKey } from "@breason/types";
import flagsJson from "@/data/feature-flags.json";

const flags = flagsJson as FeatureFlags;

const MARKETS: Record<MarketKey, { label: string; flag: string; lang: string; summary: string }> = {
  brazil: { label: "Brazil", flag: "🇧🇷", lang: "pt-BR", summary: "Warm, relationship-driven B2B communication with strong local trust expectations." },
  poland: { label: "Poland", flag: "🇵🇱", lang: "pl-PL", summary: "Pragmatic, skeptical, technically-minded audience that values substance over hype." },
  germany: { label: "Germany", flag: "🇩🇪", lang: "de-DE", summary: "Structured, trust-first, compliance-oriented market. Reliability over hype." },
};

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --blue:#00A2FF;--blue-dark:#0081CC;--lime:#7CFF00;
  --bg:#F0F2F5;--white:#FFFFFF;--border:#E2E6ED;
  --text:#0D1117;--muted:#6B7280;--muted2:#9CA3AF;
  --green:#10B981;--amber:#F59E0B;--red:#EF4444;
  --radius:12px;--radius-sm:8px;
  --shadow:0 1px 3px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04);
  --shadow-md:0 4px 12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.04);
  --font:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono','Courier New',monospace;
}
body{font-family:var(--font);background:var(--bg);color:var(--text)}
.app{display:flex;min-height:100vh}
.sidebar{width:fit-content;min-width:0;background:#0D1117;color:#fff;display:flex;flex-direction:column;flex-shrink:0}
.sb-logo{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;align-items:center;white-space:nowrap}
.sb-mark{width:28px;height:28px;border-radius:8px;background:var(--lime);color:#000;font-weight:800;font-size:13px;display:grid;place-items:center;flex-shrink:0}
.sb-title{font-size:14px;font-weight:700;letter-spacing:0.01em}
.sb-nav{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px}
.nav-item{
  display:block;border:none;background:transparent;color:rgba(255,255,255,0.55);
  padding:8px 10px;border-radius:8px;text-align:left;cursor:pointer;
  font-weight:500;font-size:13px;white-space:nowrap;font-family:var(--font);
  text-decoration:none;transition:background 0.15s,color 0.15s;
}
.nav-item:hover,.nav-item.active{background:rgba(255,255,255,0.10);color:#fff}
.sb-divider{height:1px;background:rgba(255,255,255,0.06);margin:6px 8px}
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.top-bar{height:48px;background:var(--white);border-bottom:1px solid var(--border);padding:0 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.top-bar-title{font-size:14px;font-weight:600;color:var(--text)}
.btn-primary{height:30px;padding:0 14px;border-radius:999px;border:none;background:var(--lime);font-weight:700;font-size:12px;cursor:pointer;font-family:var(--font);transition:opacity 0.15s}
.btn-primary:hover{opacity:0.85}
.btn-primary:disabled{opacity:0.5;cursor:not-allowed}
.hero{background:linear-gradient(130deg,var(--blue) 0%,var(--blue-dark) 100%);padding:24px 28px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-shrink:0}
.hero h1{font-size:18px;font-weight:700;margin-bottom:6px;line-height:1.3}
.hero-sub{font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5}
.hero-stats{display:flex;gap:8px;flex-shrink:0}
.hero-stat{border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.10);border-radius:8px;padding:8px 12px;text-align:center}
.hero-stat-n{font-size:18px;font-weight:800;line-height:1}
.hero-stat-l{font-size:10px;opacity:0.7;margin-top:2px}
.content-scroll{flex:1;overflow-y:auto}
.input-section,.results-wrap{padding:20px;display:flex;flex-direction:column;gap:12px}
.market-row{display:flex;gap:8px}
.mkt-chip{flex:1;border:1.5px solid var(--border);border-radius:10px;background:#fff;box-shadow:var(--shadow);padding:10px 12px;text-align:left;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s}
.mkt-chip:hover{border-color:#93C5FD}
.mkt-chip.sel{border-color:var(--blue);background:#EFF8FF;box-shadow:0 0 0 3px rgba(0,162,255,0.10)}
.mkt-flag{font-size:18px;margin-bottom:4px}
.mkt-name{font-weight:600;font-size:12px;color:var(--text)}
.mkt-lang{color:var(--muted2);font-size:10px;font-family:var(--mono);margin-top:1px}
.input-card,.rcard,.market-hint,.err{background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}
.inp-tabs{display:flex;border-bottom:1px solid var(--border)}
.inp-tab{flex:1;border:none;background:transparent;padding:10px;cursor:pointer;font-weight:600;font-size:13px;font-family:var(--font);color:var(--muted);transition:color 0.15s}
.inp-tab.active{color:var(--blue);border-bottom:2px solid var(--blue);background:#F7FBFF}
.inp-body{padding:12px 14px}
.inp-field{width:100%;border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;font-size:13px;font-family:var(--mono);background:var(--bg);resize:none;transition:border-color 0.15s;outline:none}
.inp-field:focus{border-color:var(--blue)}
.err{background:#FFF1F2;border-color:#FECDD3;color:var(--red);padding:10px 14px;font-size:13px}
.rcard{padding:18px 20px}
.rcard-label{color:var(--muted2);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px}
.v-badge{display:inline-flex;gap:8px;border-radius:999px;padding:6px 16px;font-weight:700;font-size:13px;margin-bottom:10px}
.v-pass{background:#D1FAE5;color:#065F46}
.v-sus{background:#FEF3C7;color:#78350F}
.v-for{background:#FEE2E2;color:#7F1D1D}
.rcard p{color:var(--muted);font-size:13px;line-height:1.6}
.result-list{padding-left:16px;color:var(--muted);font-size:13px;line-height:1.6}
.result-list li{margin:3px 0}
.bottom-bar{height:56px;background:#fff;border-top:1px solid var(--border);padding:0 14px;display:flex;align-items:center;gap:8px;flex-shrink:0}
.bar-field{flex:1;border:1.5px solid var(--border);border-radius:999px;padding:0 14px;height:34px;font-family:var(--font);font-size:13px;outline:none;transition:border-color 0.15s}
.bar-field:focus{border-color:var(--blue)}
.send-btn{width:34px;height:34px;border-radius:50%;border:none;background:var(--lime);font-size:16px;cursor:pointer;display:grid;place-items:center;transition:opacity 0.15s;flex-shrink:0}
.send-btn:hover{opacity:0.85}
.market-hint{padding:10px 14px;background:#F0F9FF;border-color:#BAE6FD;font-size:13px}
@media(max-width:860px){.sidebar{display:none}.market-row{flex-direction:column}.hero{padding:16px 18px}}
`;

function VerdictCard({ data }: { data: AnalyzeResult }) {
  const cfg = {
    PASS:       { cls: "v-pass", icon: "✓", label: "Sounds native" },
    SUSPICIOUS: { cls: "v-sus", icon: "~", label: "Imported-sounding" },
    FOREIGN:    { cls: "v-for", icon: "✕", label: "Reads like a translation" },
  }[data.verdict];
  return (
    <div className="rcard">
      <div className="rcard-label">Verdict</div>
      <div className={`v-badge ${cfg.cls}`}>{cfg.icon} {data.verdict} — {cfg.label}</div>
      <p>{data.insight}</p>
    </div>
  );
}

function ScoreCard({ data }: { data: AnalyzeResult }) {
  const generic = Math.max(0, 100 - data.score);
  const color = generic <= 30 ? "#10B981" : generic <= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="rcard">
      <div className="rcard-label">Genericness Score</div>
      <div style={{ fontSize: 40, fontWeight: 800, color }}>{generic}%</div>
      <div style={{ height: 4, background: "#E2E6ED", borderRadius: 2, overflow: "hidden", marginTop: 10 }}>
        <div style={{ width: `${generic}%`, background: color, height: "100%" }} />
      </div>
      <p style={{ marginTop: 10 }}>
        Provider: {data.provider} · {data.latencyMs}ms
        {data.promptVersion ? ` · ${data.promptVersion}` : ""}
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
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-mark">B</div>
            <span className="sb-title">Breason</span>
          </div>
          <nav className="sb-nav">
            <a className="nav-item active" href="/">Analyze</a>
            {flags.enableResonance && <a className="nav-item" href="/resonance">Resonance</a>}
            <div className="sb-divider" />
            {flags.enableReDuckIntegration && <a className="nav-item" href="/reduck">ReDuck 🦆</a>}
          </nav>
        </aside>

        <div className="main">
          <header className="top-bar">
            <span className="top-bar-title">
              {result ? `Analysis — ${MARKETS[market].flag} ${MARKETS[market].label}` : "Market Fit Analysis"}
            </span>
            <button className="btn-primary" onClick={result ? () => setResult(null) : analyze} disabled={loading}>
              {loading ? "Analyzing…" : result ? "New Analysis" : "Analyze →"}
            </button>
          </header>

          <div className="content-scroll">
            <section className="hero">
              <div>
                <h1>Does your marketing sound local?</h1>
                <p className="hero-sub">Paste any copy — get an instant diagnosis with trust signals and rewrite suggestions.</p>
              </div>
              <div className="hero-stats">
                <div className="hero-stat"><div className="hero-stat-n">3</div><div className="hero-stat-l">Markets</div></div>
                <div className="hero-stat"><div className="hero-stat-n">AI</div><div className="hero-stat-l">Powered</div></div>
              </div>
            </section>

            {!result && (
              <div className="input-section">
                <div className="market-row">
                  {(Object.keys(MARKETS) as MarketKey[]).map((key) => (
                    <button key={key} className={`mkt-chip${market === key ? " sel" : ""}`} onClick={() => setMarket(key)}>
                      <div className="mkt-flag">{MARKETS[key].flag}</div>
                      <div className="mkt-name">{MARKETS[key].label}</div>
                      <div className="mkt-lang">{MARKETS[key].lang}</div>
                    </button>
                  ))}
                </div>

                <div className="input-card">
                  <div className="inp-tabs">
                    <button className={`inp-tab${tab === "url" ? " active" : ""}`} onClick={() => setTab("url")}>🔗 URL</button>
                    <button className={`inp-tab${tab === "text" ? " active" : ""}`} onClick={() => setTab("text")}>📝 Text</button>
                  </div>
                  <div className="inp-body">
                    {tab === "url"
                      ? <input className="inp-field" placeholder="https://your-landing-page.com" value={text} onChange={(e) => setText(e.target.value)} />
                      : <textarea className="inp-field" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your marketing copy…" />
                    }
                  </div>
                </div>

                <div className="market-hint">
                  <strong>{MARKETS[market].label}:</strong> {MARKETS[market].summary}
                </div>
                {error && <div className="err">{error}</div>}
              </div>
            )}

            {result && (
              <div className="results-wrap">
                <VerdictCard data={result} />
                <ScoreCard data={result} />
                <div className="rcard">
                  <div className="rcard-label">Market Tension</div>
                  <p>{result.marketTension}</p>
                </div>
                <div className="rcard">
                  <div className="rcard-label">Trust Signals</div>
                  <ul className="result-list">{result.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div className="rcard">
                  <div className="rcard-label">Risks</div>
                  <ul className="result-list">{result.risks.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div className="rcard">
                  <div className="rcard-label">Suggestions</div>
                  <ul className="result-list">{result.suggestions.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                {flags.enableReDuckIntegration && (
                  <a href={reduckUrl} style={{ textDecoration: "none" }}>
                    <button className="btn-primary" style={{ marginTop: 4 }}>Refine in ReDuck 🦆</button>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="bottom-bar">
            <input
              className="bar-field"
              placeholder="Paste a URL or type your marketing copy here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
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
