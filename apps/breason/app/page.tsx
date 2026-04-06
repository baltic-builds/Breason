"use client";

import { useState, useEffect } from "react";

// --- Types & Data ---
type MarketKey = "brazil" | "poland" | "germany";

const MARKETS: Record<MarketKey, { label: string; flag: string; desc: string }> = {
  germany: { label: "Германия", flag: "🇩🇪", desc: "Formal, precise, skeptical of hype." },
  poland:  { label: "Польша",    flag: "🇵🇱", desc: "Direct, fact-based, values transparency." },
  brazil:  { label: "Бразилия",  flag: "🇧🇷", desc: "Warm, human, relationship-first." },
};

const DEFAULT_TEXT = "Unlock efficiency with our all-in-one AI platform. It is a revolutionary game-changer for your enterprise. Buy now to 10x your productivity seamlessly!";

const LOADING_STEPS = [
  "Analyzing tone and cultural fit...",
  "Comparing with market baseline...",
  "Checking local trust signals...",
  "Scanning for generic cliches...",
  "Generating native rewrites..."
];

// --- Styles ---
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;600;700&display=swap');
:root {
  --violet: #7C3AED; --lime: #84CC16; --orange: #F97316; --sky: #0EA5E9;
  --bg: #F8FAFC; --surface: #FFFFFF; --t1: #1E293B; --t2: #475569; --t3: #94A3B8;
  --border: rgba(71, 85, 105, 0.15); --border-light: rgba(71, 85, 105, 0.08); --r: 16px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--t1); -webkit-font-smoothing: antialiased; }
.shell { display: flex; height: 100vh; overflow: hidden; }

/* Sidebar */
.sidebar { width: 260px; background: var(--surface); border-right: 1px solid var(--border); padding: 24px; display: flex; flex-direction: column; }
.logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 32px; color: var(--t1); display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 32px; height: 32px; background: var(--lime); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #1a2e05; font-size: 18px; font-weight: 800; }
.footer-info { margin-top: auto; font-size: 11px; color: var(--t3); line-height: 1.6; }

/* Main Content */
.main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
.topbar { height: 64px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 40px; position: sticky; top: 0; z-index: 10; }
.content-wrapper { padding: 40px; max-width: 1200px; margin: 0 auto; width: 100%; display: grid; gap: 32px; }
.content-wrapper.split { grid-template-columns: 400px 1fr; align-items: start; }

/* Forms & Inputs */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
.field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--t3); margin-bottom: 12px; display: block; letter-spacing: 0.5px; }
.inp { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); font-family: inherit; font-size: 14px; line-height: 1.6; outline: none; transition: 0.2s; resize: vertical; }
.inp:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1); }
.btn-cta { background: var(--orange); color: #fff; border: none; padding: 16px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; font-size: 15px; width: 100%; }
.btn-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(249, 115, 22, 0.25); }
.btn-cta:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }
.btn-outline { background: transparent; border: 1px solid var(--border); padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--t2); }
.btn-outline:hover { background: var(--bg); }

/* Market Grid */
.market-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 24px; }
.mkt-box { padding: 12px 16px; border: 2px solid var(--border-light); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: 0.2s; }
.mkt-box:hover { border-color: var(--border); }
.mkt-box.active { border-color: var(--lime); background: rgba(132, 204, 22, 0.05); }
.mkt-flag { font-size: 20px; }
.mkt-text h4 { font-size: 14px; color: var(--t1); margin-bottom: 2px; }
.mkt-text p { font-size: 11px; color: var(--t3); }

/* Dashboard UI */
.verdict-banner { padding: 20px 24px; border-radius: var(--r); margin-bottom: 24px; display: flex; align-items: center; gap: 16px; }
.verdict-banner.SUSPICIOUS { background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); color: #C2410C; }
.verdict-banner.PASS { background: rgba(132, 204, 22, 0.1); border: 1px solid rgba(132, 204, 22, 0.3); color: #3F6212; }
.verdict-banner.FOREIGN { background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.3); color: #BE123C; }
.verdict-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }

/* Tone Map */
.tone-row { margin-bottom: 12px; }
.tone-labels { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--t2); margin-bottom: 6px; text-transform: uppercase; }
.tone-track { height: 6px; background: var(--bg); border-radius: 10px; position: relative; overflow: hidden; }
.tone-fill { position: absolute; height: 100%; background: var(--violet); border-radius: 10px; width: 12px; transform: translateX(-50%); transition: left 0.5s ease-out; }
.tone-center { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--border); }

/* Lists & Badges */
.trust-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.trust-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--t2); background: var(--bg); padding: 10px 14px; border-radius: 8px; border-left: 3px solid #EF4444; }
.cliche-badge { display: inline-block; padding: 4px 10px; background: #FEE2E2; color: #B91C1C; font-size: 12px; font-weight: 600; border-radius: 6px; margin: 0 6px 6px 0; }

/* Rewrites */
.rewrite-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.rw-header { font-size: 12px; font-weight: 700; color: var(--t3); margin-bottom: 12px; text-transform: uppercase; }
.rw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rw-block { background: var(--surface); padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; line-height: 1.5; }
.rw-local { background: rgba(124, 58, 237, 0.05); border-color: rgba(124, 58, 237, 0.2); color: var(--violet); font-weight: 500; }
.rw-reason { margin-top: 12px; font-size: 12px; color: var(--t2); font-style: italic; }

/* Loading */
.loader-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; color: var(--t2); }
.spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--violet); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

export default function BreasonApp() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [market, setMarket] = useState<MarketKey>("germany");
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<any>(null);

  // Animate loading text
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setLoadingMsgIdx(0);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, market }),
      });
      const data = await res.json();
      if (data.verdict) {
        setResult(data);
      } else {
        alert("Failed to analyze text. Check server logs.");
      }
    } catch (e) {
      console.error(e);
      alert("API Error");
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = () => {
    if (result?.brief_text) {
      navigator.clipboard.writeText(result.brief_text);
      alert("Copied to clipboard!");
    }
  };

  const renderToneBar = (labelLeft: string, labelRight: string, value: number) => {
    // value is -5 to 5. Map to 0% to 100%
    const percentage = ((value + 5) / 10) * 100;
    return (
      <div className="tone-row">
        <div className="tone-labels"><span>{labelLeft}</span><span>{labelRight}</span></div>
        <div className="tone-track">
          <div className="tone-center" />
          <div className="tone-fill" style={{ left: `${percentage}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="shell">
      <style>{STYLE}</style>
      
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo"><div className="logo-icon">B</div> Breason</div>
        <div className="footer-info">v 1.0.0 (Unified)<br/><span style={{ opacity: 0.5 }}>from pavel with love</span></div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <header className="topbar">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
            Breason <span style={{ color: 'var(--border)', margin: '0 8px' }}>/</span> Global Content Auditor
          </div>
        </header>

        <div className={`content-wrapper ${result ? 'split' : ''}`}>
          
          {/* LEFT: INPUT COLUMN */}
          <div className="input-col">
            <div className="card">
              <label className="field-label">1. Select Target Market</label>
              <div className="market-grid">
                {(Object.keys(MARKETS) as MarketKey[]).map(k => (
                  <div key={k} className={`mkt-box ${market === k ? 'active' : ''}`} onClick={() => setMarket(k)}>
                    <div className="mkt-flag">{MARKETS[k].flag}</div>
                    <div className="mkt-text">
                      <h4>{MARKETS[k].label}</h4>
                      <p>{MARKETS[k].desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <label className="field-label">2. Input Copy (Draft)</label>
              <textarea 
                className="inp" 
                rows={result ? 8 : 12} 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Paste your B2B marketing text here..."
              />
              <div style={{ marginTop: 24 }}>
                <button className="btn-cta" onClick={handleAnalyze} disabled={loading || !text}>
                  {loading ? "Analyzing..." : "Analyze Resonance →"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: DASHBOARD COLUMN */}
          <div className="output-col">
            
            {loading && (
              <div className="card loader-wrap">
                <div className="spinner" />
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Auditing Content</h3>
                <p>{LOADING_STEPS[loadingMsgIdx]}</p>
              </div>
            )}

            {!loading && !result && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t3)', textAlign: 'center', paddingTop: '10vh' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <h2 style={{ color: 'var(--t2)', marginBottom: 8 }}>Ready for Audit</h2>
                <p style={{ maxWidth: 300, fontSize: 14 }}>Paste your text and select a market to reveal cultural gaps and tone mismatch.</p>
              </div>
            )}

            {!loading && result && (
              <div className="dashboard-results">
                
                {/* L1: VERDICT */}
                <div className={`verdict-banner ${result.verdict}`}>
                  <div>
                    <div className="verdict-title">{result.verdict}</div>
                    <div style={{ fontSize: 14, marginTop: 4, fontWeight: 500 }}>{result.verdict_reason}</div>
                  </div>
                </div>

                {/* L2: METRICS */}
                <div className="grid-2">
                  <div className="card" style={{ marginBottom: 0 }}>
                    <label className="field-label">Tone Map Matrix</label>
                    {renderToneBar("Formal", "Casual", result.tone_map.formal_casual)}
                    {renderToneBar("Bold/Hype", "Cautious", result.tone_map.bold_cautious)}
                    {renderToneBar("Tech Specs", "Benefits", result.tone_map.technical_benefit)}
                    {renderToneBar("Abstract", "Concrete", result.tone_map.abstract_concrete)}
                    {renderToneBar("Translated", "100% Native", result.tone_map.global_native)}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div className="card" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="field-label">Genericness Score: {result.genericness_score}/100</label>
                      <div>
                        {result.generic_phrases.map((phrase: string, idx: number) => (
                          <span key={idx} className="cliche-badge">"{phrase}"</span>
                        ))}
                      </div>
                    </div>
                    <div className="card" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="field-label">Missing Trust Signals</label>
                      <ul className="trust-list">
                        {result.missing_trust_signals.map((sig: string, idx: number) => (
                          <li key={idx} className="trust-item">❌ {sig}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* L3: REWRITES */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 18 }}>Suggested Rewrites</h3>
                    <button className="btn-outline" onClick={copyBrief}>📋 Copy Full Brief</button>
                  </div>
                  
                  {result.rewrites.map((rw: any, idx: number) => (
                    <div className="rewrite-card" key={idx}>
                      <div className="rw-header">{rw.block}</div>
                      <div className="rw-grid">
                         <div>
                           <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Original</div>
                           <div className="rw-block">{rw.original}</div>
                         </div>
                         <div>
                           <div style={{ fontSize: 11, color: 'var(--violet)', fontWeight: 600, marginBottom: 4 }}>Localized ({MARKETS[market].flag})</div>
                           <div className="rw-block rw-local">{rw.suggested_local}</div>
                           <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>EN translation: {rw.suggested}</div>
                         </div>
                      </div>
                      <div className="rw-reason">💡 <strong>Why:</strong> {rw.reason}</div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
