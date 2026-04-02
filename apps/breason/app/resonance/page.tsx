"use client";

import { useMemo, useState } from "react";
import type { FeatureFlags, MarketKey, ResonanceGenerateResponse, ResonanceTrend, ResonanceTrendsResponse } from "@breason/types";
import flagsJson from "@/data/feature-flags.json";

const flags = flagsJson as FeatureFlags;

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --blue:#00A2FF;--blue-dark:#0081CC;--lime:#7CFF00;
  --green:#22C55E;--green-dim:rgba(34,197,94,0.10);
  --bg:#F0F2F5;--white:#FFFFFF;--border:#E2E6ED;
  --text:#0D1117;--muted:#6B7280;--muted2:#9CA3AF;
  --radius:12px;--shadow:0 1px 3px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04);
  --font:'Inter',system-ui,sans-serif;
}
body{font-family:var(--font);background:var(--bg);color:var(--text)}
.app{display:flex;min-height:100vh}
.sidebar{width:fit-content;min-width:0;background:#0D1117;color:#fff;display:flex;flex-direction:column;flex-shrink:0}
.sb-logo{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;align-items:center;white-space:nowrap}
.sb-mark{width:28px;height:28px;border-radius:8px;background:var(--lime);color:#000;font-weight:800;font-size:13px;display:grid;place-items:center;flex-shrink:0}
.sb-title{font-size:14px;font-weight:700}
.sb-nav{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px}
.nav-item{display:block;border:none;background:transparent;color:rgba(255,255,255,0.55);padding:8px 10px;border-radius:8px;text-align:left;cursor:pointer;font-weight:500;font-size:13px;white-space:nowrap;font-family:var(--font);text-decoration:none;transition:background 0.15s,color 0.15s}
.nav-item:hover,.nav-item.active{background:rgba(255,255,255,0.10);color:#fff}
.sb-divider{height:1px;background:rgba(255,255,255,0.06);margin:6px 8px}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.top-bar{height:48px;background:#fff;border-bottom:1px solid var(--border);padding:0 20px;display:flex;align-items:center;flex-shrink:0}
.top-bar-title{font-size:14px;font-weight:600}
.hero{background:linear-gradient(130deg,var(--blue),var(--blue-dark));padding:24px 28px;color:#fff;flex-shrink:0}
.hero h1{font-size:18px;font-weight:700;margin-bottom:4px}
.hero-sub{font-size:12px;opacity:0.75}
.content{padding:20px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex:1}
.card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px 18px}
.label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);font-weight:700;margin-bottom:10px}
.select{width:100%;border:1.5px solid var(--border);height:38px;border-radius:8px;padding:0 10px;font-family:var(--font);font-size:13px;outline:none;background:#fff;transition:border-color 0.15s}
.select:focus{border-color:var(--blue)}
.btn{height:34px;border:none;border-radius:999px;padding:0 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:var(--font);transition:opacity 0.15s}
.btn:hover{opacity:0.85}
.btn-primary{background:var(--lime);color:#000}
.btn-ghost{background:#fff;border:1px solid var(--border);color:var(--text)}
.trend-card{background:#fff;border:1px solid #BBF7D0;border-radius:var(--radius);box-shadow:var(--shadow);padding:16px 18px}
.trend-title{font-size:16px;font-weight:700;margin-bottom:8px}
.score-badge{display:inline-flex;border-radius:999px;padding:4px 12px;background:#DCFCE7;color:#166534;font-weight:700;font-size:12px;margin-bottom:8px}
.tension-badge{display:inline-flex;border-radius:999px;padding:4px 10px;background:var(--green-dim);color:#15803D;font-size:11px;font-weight:600;margin-bottom:8px;margin-left:6px}
.trend-insight{color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:12px}
.trend-actions{display:flex;gap:8px;flex-wrap:wrap}
.generated-card{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:var(--radius);padding:16px 18px}
.gen-row{margin-bottom:8px;font-size:13px;line-height:1.6}
.gen-provider{font-size:11px;color:var(--muted2);margin-top:8px}
@media(max-width:860px){.sidebar{display:none}}
`;

export default function ResonancePage() {
  const [market, setMarket] = useState<MarketKey>("brazil");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<ResonanceTrend[]>([]);
  const [selected, setSelected] = useState<ResonanceTrend | null>(null);
  const [generated, setGenerated] = useState<ResonanceGenerateResponse | null>(null);

  const reduckUrl = useMemo(() => {
    const t = selected ? `${selected.title}. ${selected.insight}` : "";
    return `/reduck?market=${market}&text=${encodeURIComponent(t)}`;
  }, [market, selected]);

  async function findTrends() {
    setLoading(true);
    try {
      const res = await fetch(`/api/resonance-trends?market=${market}`);
      const json = await res.json() as ResonanceTrendsResponse;
      setTrends(json.trends);
    } finally {
      setLoading(false);
    }
  }

  async function generateContent(trend: ResonanceTrend) {
    setSelected(trend);
    const res = await fetch("/api/resonance-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market, trend }),
    });
    setGenerated(await res.json() as ResonanceGenerateResponse);
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
            <a className="nav-item" href="/">Analyze</a>
            <a className="nav-item active" href="/resonance">Resonance</a>
            <div className="sb-divider" />
            {flags.enableReDuckIntegration && <a className="nav-item" href="/reduck">ReDuck 🦆</a>}
          </nav>
        </aside>

        <div className="main">
          <header className="top-bar">
            <span className="top-bar-title">Resonance Mode</span>
          </header>
          <section className="hero">
            <h1>What resonates in your market right now?</h1>
            <p className="hero-sub">Live B2B trends with campaign generation</p>
          </section>

          <div className="content">
            <div className="card">
              <div className="label">Discover</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="select" value={market} onChange={(e) => setMarket(e.target.value as MarketKey)}>
                  <option value="brazil">🇧🇷 Brazil</option>
                  <option value="poland">🇵🇱 Poland</option>
                  <option value="germany">🇩🇪 Germany</option>
                </select>
                <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={findTrends}>
                  {loading ? "Loading…" : "Find Trends"}
                </button>
              </div>
            </div>

            {trends.map((trend) => (
              <div className="trend-card" key={trend.title}>
                <div className="label">Trend</div>
                <div className="trend-title">{trend.title}</div>
                <span className="score-badge">Score: {trend.resonanceScore}</span>
                <span className="tension-badge">{trend.marketTension}</span>
                <p className="trend-insight">{trend.insight}</p>
                <div className="trend-actions">
                  <button className="btn btn-primary" onClick={() => generateContent(trend)}>Generate Content</button>
                  <a href="/"><button className="btn btn-ghost">Evaluate</button></a>
                  {flags.enableReDuckIntegration && (
                    <a href={`/reduck?market=${market}&text=${encodeURIComponent(`${trend.title}. ${trend.insight}`)}`}>
                      <button className="btn btn-primary" onClick={() => setSelected(trend)}>ReDuck 🦆</button>
                    </a>
                  )}
                </div>
              </div>
            ))}

            {generated && (
              <div className="generated-card">
                <div className="label">Generated Draft</div>
                <div className="gen-row"><strong>Headline:</strong> {generated.headline}</div>
                <div className="gen-row"><strong>Body:</strong> {generated.body}</div>
                <div className="gen-row"><strong>CTA:</strong> {generated.cta}</div>
                <div className="gen-provider">Provider: {generated.provider} · {generated.latencyMs}ms</div>
                {flags.enableReDuckIntegration && (
                  <a href={reduckUrl} style={{ display: "inline-block", marginTop: 10 }}>
                    <button className="btn btn-primary">Refine in ReDuck 🦆</button>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
