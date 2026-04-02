"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReDuckModelInfo, ReDuckProviderGroup, ReDuckProcessResult } from "@breason/types";
import { REDUCK_PROMPTS } from "@breason/prompts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function isMarkdown(s: string): boolean {
  return /^#{1,6}\s|\*\*[^*]+\*\*|^[-*+]\s/m.test(s);
}

// ── Shared CSS (same tokens as page.tsx) ─────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --blue:#00A2FF;--blue-dark:#0081CC;--lime:#7CFF00;--cyan:#2fc7f7;
  --bg:#F0F2F5;--white:#FFFFFF;--border:#E2E6ED;
  --text:#0D1117;--muted:#6B7280;--muted2:#9CA3AF;
  --red:#EF4444;--radius:12px;--radius-sm:8px;
  --shadow:0 1px 3px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04);
  --font:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono','Courier New',monospace;
}
body{font-family:var(--font);background:var(--bg);color:var(--text)}
.app{display:flex;min-height:100vh}
.sidebar{width:fit-content;min-width:0;background:#0D1117;color:#fff;display:flex;flex-direction:column;flex-shrink:0}
.sb-logo{padding:18px 16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;align-items:center;white-space:nowrap}
.sb-mark{width:28px;height:28px;border-radius:8px;background:var(--lime);color:#000;font-weight:800;font-size:13px;display:grid;place-items:center;flex-shrink:0}
.sb-title{font-size:14px;font-weight:700}
.sb-nav{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:2px}
.nav-item{
  display:block;border:none;background:transparent;color:rgba(255,255,255,0.55);
  padding:8px 10px;border-radius:8px;text-align:left;cursor:pointer;
  font-weight:500;font-size:13px;white-space:nowrap;font-family:var(--font);
  text-decoration:none;transition:background 0.15s,color 0.15s;
}
.nav-item:hover,.nav-item.active{background:rgba(255,255,255,0.10);color:#fff}
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
/* ── Top bar ── */
.top-bar{height:48px;background:var(--white);border-bottom:1px solid var(--border);padding:0 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:12px}
.top-bar-title{font-size:14px;font-weight:600}
.topbar-selects{display:flex;align-items:center;gap:8px}
.sel{height:30px;border:1.5px solid var(--border);border-radius:8px;padding:0 8px;font-size:12px;font-family:var(--font);background:var(--white);outline:none;cursor:pointer;transition:border-color 0.15s;min-width:0}
.sel:focus{border-color:var(--blue)}
.demo-tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--lime);color:#000}
/* ── Mode pills ── */
.modebar{background:var(--white);border-bottom:1px solid var(--border);padding:8px 16px;flex-shrink:0}
.mode-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:6px}
.mode-pills{display:flex;gap:6px;flex-wrap:wrap}
.mode-pill{border:1.5px solid var(--border);border-radius:999px;background:var(--white);padding:5px 12px;font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font);color:var(--muted);transition:all 0.15s;white-space:nowrap}
.mode-pill:hover{border-color:var(--blue);color:var(--text)}
.mode-pill.active{border-color:var(--blue);background:#EBF9FE;color:var(--blue-dark);font-weight:600}
.mode-pill:disabled{opacity:0.5;cursor:not-allowed}
/* ── Editor split ── */
.editors{flex:1;display:flex;gap:10px;padding:10px 12px;min-height:0;overflow:hidden}
.panel{flex:1;display:flex;flex-direction:column;background:var(--white);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);min-width:0;overflow:hidden}
.panel-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
.panel-title{font-size:12px;font-weight:600;color:var(--muted)}
.panel-meta{display:flex;align-items:center;gap:6px}
.chip{font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid transparent}
.chip-md{background:rgba(124,255,0,0.18);color:#4a7a00;border-color:rgba(124,255,0,0.4)}
.chip-plain{background:#F4F6F9;color:var(--muted);border-color:var(--border)}
.chip-words{background:rgba(0,162,255,0.10);color:var(--blue-dark);border-color:rgba(0,162,255,0.25)}
.chip-tokens{background:rgba(124,255,0,0.15);color:#4a7a00;border-color:rgba(124,255,0,0.35)}
.icon-btn{width:26px;height:26px;border:none;background:transparent;border-radius:6px;cursor:pointer;display:grid;place-items:center;font-size:13px;color:var(--muted2);transition:background 0.15s,color 0.15s}
.icon-btn:hover{background:#F4F6F9;color:var(--text)}
.view-toggle{display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-right:2px}
.view-btn{border:none;background:transparent;padding:3px 8px;font-size:11px;cursor:pointer;color:var(--muted2);font-family:var(--font);transition:background 0.15s,color 0.15s}
.view-btn.active{background:var(--bg);color:var(--text);font-weight:600}
.panel-body{flex:1;overflow:hidden;position:relative}
.editor-ta{width:100%;height:100%;border:none;outline:none;resize:none;padding:12px 14px;font-family:var(--mono);font-size:12px;line-height:1.7;color:var(--text);background:transparent}
.editor-ta::placeholder{color:var(--muted2);font-family:var(--font)}
.editor-ta:disabled{color:var(--muted2);cursor:not-allowed}
/* ── Result states ── */
.result-scroll{height:100%;overflow-y:auto;padding:12px 14px;font-size:13px;line-height:1.75;color:var(--text)}
.result-scroll h1{font-size:1.4em;font-weight:700;color:var(--blue-dark);margin:12px 0 6px}
.result-scroll h2{font-size:1.2em;font-weight:700;color:var(--blue-dark);margin:10px 0 4px}
.result-scroll h3{font-size:1.05em;font-weight:600;margin:8px 0 4px}
.result-scroll p{margin:0 0 10px}
.result-scroll ul,.result-scroll ol{padding-left:20px;margin:0 0 10px}
.result-scroll li{margin:3px 0}
.result-scroll strong{font-weight:700}
.result-scroll blockquote{border-left:3px solid var(--blue);padding-left:12px;margin:0 0 10px;color:var(--muted);font-style:italic}
.result-scroll code{font-family:var(--mono);font-size:.88em;background:rgba(124,255,0,0.15);padding:1px 5px;border-radius:4px}
.result-scroll pre{background:#F0F2F5;padding:12px;border-radius:8px;overflow-x:auto;margin:0 0 10px}
.result-scroll pre code{background:transparent;padding:0}
.result-scroll hr{border:none;border-top:1px solid var(--border);margin:12px 0}
.result-scroll table{border-collapse:collapse;width:100%;margin:0 0 10px}
.result-scroll th,.result-scroll td{border:1px solid rgba(0,162,255,0.2);padding:5px 10px}
.result-scroll th{background:rgba(0,162,255,0.08);color:var(--blue-dark);font-weight:700}
.result-empty,.result-loading{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted2);font-size:13px;text-align:center;padding:20px}
.spinner{width:24px;height:24px;border:2.5px solid rgba(0,162,255,0.2);border-top-color:var(--blue);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* ── Bottom bar ── */
.bottom-bar{height:52px;background:var(--white);border-top:1px solid var(--border);display:flex;align-items:center;justify-content:center;padding:0 16px;gap:10px;flex-shrink:0}
.run-btn{height:36px;padding:0 28px;border:none;border-radius:999px;background:linear-gradient(135deg,var(--blue) 0%,var(--blue-dark) 100%);color:#fff;font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;display:flex;align-items:center;gap:8px;transition:opacity 0.15s,transform 0.15s;letter-spacing:0.02em}
.run-btn:hover:not(:disabled){opacity:0.9;transform:translateY(-1px)}
.run-btn:disabled{background:rgba(180,180,180,0.5);cursor:not-allowed;transform:none}
.run-lightning{color:var(--lime)}
.token-info{font-size:10px;color:var(--muted2);white-space:nowrap}
.err-banner{font-size:12px;color:var(--red);background:#FFF1F2;border:1px solid #FECDD3;border-radius:8px;padding:6px 12px}
@media(max-width:860px){.sidebar{display:none}.editors{flex-direction:column}}
`;

// ── Simple markdown → html ────────────────────────────────────────────────────

function mdToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^\* (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hpuloi])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReDuckPage() {
  const [promptId, setPromptId] = useState(REDUCK_PROMPTS[0].meta.id);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReDuckProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");
  const [error, setError] = useState("");

  const [providers, setProviders] = useState<ReDuckProviderGroup[]>([]);
  const [providerId, setProviderId] = useState("gemini");
  const [modelId, setModelId] = useState("gemini-2.5-flash");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Prefill from ?text= query param (linked from Analyze/Resonance pages)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("text");
    if (prefill) setText(decodeURIComponent(prefill));
  }, []);

  // Load available providers from the server
  useEffect(() => {
    fetch("/api/reduck/models")
      .then((r) => r.json())
      .then((data: { providers: ReDuckProviderGroup[] }) => {
        setProviders(data.providers);
        const first = data.providers.find((p) => p.id === "gemini") ?? data.providers[0];
        if (first) {
          setProviderId(first.id);
          setModelId(first.models[0]?.id ?? "");
          setIsDemoMode(first.id === "demo");
        }
      })
      .catch(() => {
        setIsDemoMode(true);
        setProviders([{ id: "demo", name: "Demo", models: [{ id: "demo", label: "Demo", providerId: "demo" }] }]);
      });
  }, []);

  const currentProvider = providers.find((p) => p.id === providerId);
  const currentModels: ReDuckModelInfo[] = currentProvider?.models ?? [];

  const handleProviderChange = (newId: string) => {
    const prov = providers.find((p) => p.id === newId);
    setProviderId(newId);
    setModelId(prov?.models[0]?.id ?? "");
    setIsDemoMode(newId === "demo");
  };

  const currentPrompt = REDUCK_PROMPTS.find((p) => p.meta.id === promptId) ?? REDUCK_PROMPTS[0];

  const handleRun = useCallback(async () => {
    if (!text.trim()) { setError("Введите текст для обработки"); return; }
    setError("");
    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/reduck/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: currentPrompt.systemPrompt,
          text,
          providerId,
          modelId,
          promptVersion: currentPrompt.meta.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const json = await res.json() as ReDuckProcessResult;
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setProcessing(false);
    }
  }, [text, providerId, modelId, currentPrompt]);

  const copyResult = async () => {
    if (result?.processedText) {
      await navigator.clipboard.writeText(result.processedText);
    }
  };

  const resultWords = wordCount(result?.processedText ?? "");
  const inputWords = wordCount(text);

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        {/* Sidebar — same as other pages */}
        <aside className="sidebar">
          <div className="sb-logo">
            <div className="sb-mark">B</div>
            <span className="sb-title">Breason</span>
          </div>
          <nav className="sb-nav">
            <a className="nav-item" href="/">Analyze</a>
            <a className="nav-item" href="/resonance">Resonance</a>
            <a className="nav-item active" href="/reduck">ReDuck 🦆</a>
          </nav>
        </aside>

        <div className="main">
          {/* Top bar with provider/model selectors */}
          <header className="top-bar">
            <span className="top-bar-title">ReDuck — Text Refinement</span>
            <div className="topbar-selects">
              {isDemoMode && <span className="demo-tag">Demo</span>}
              {providers.length > 1 && (
                <select className="sel" value={providerId} onChange={(e) => handleProviderChange(e.target.value)} disabled={processing}>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {currentModels.length > 1 && (
                <select className="sel" value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={processing}>
                  {currentModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}{m.description ? ` — ${m.description}` : ""}</option>
                  ))}
                </select>
              )}
            </div>
          </header>

          {/* Mode pills */}
          <div className="modebar">
            <div className="mode-label">Режим проверки</div>
            <div className="mode-pills">
              {REDUCK_PROMPTS.map((p) => (
                <button
                  key={p.meta.id}
                  className={`mode-pill${promptId === p.meta.id ? " active" : ""}`}
                  onClick={() => setPromptId(p.meta.id)}
                  disabled={processing}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Split editor */}
          <div className="editors">
            {/* Input panel */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-meta">
                  <span className="panel-title">Оригинал</span>
                  {text && <span className={`chip ${isMarkdown(text) ? "chip-md" : "chip-plain"}`}>{isMarkdown(text) ? "MD" : "TXT"}</span>}
                </div>
                <div className="panel-meta">
                  {text && <span className="panel-title" style={{ color: "var(--muted2)", fontSize: 11 }}>{inputWords} сл.</span>}
                  {text && <button className="icon-btn" title="Очистить" onClick={() => { setText(""); setResult(null); }}>✕</button>}
                </div>
              </div>
              <div className="panel-body">
                <textarea
                  className="editor-ta"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={processing}
                  placeholder={"Вставьте текст сюда…\n\nПоддерживается:\n• Обычный текст\n• Markdown\n• Rich Text из Google Docs"}
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Result panel */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-meta">
                  <span className="panel-title">{processing ? "Обработка…" : "Результат"}</span>
                  {result && !processing && (
                    <>
                      <span className="chip chip-words">{resultWords} сл.</span>
                      {result.tokensUsed && <span className="chip chip-tokens">{result.tokensUsed} токенов</span>}
                    </>
                  )}
                </div>
                {result && !processing && (
                  <div className="panel-meta">
                    <div className="view-toggle">
                      <button className={`view-btn${viewMode === "preview" ? " active" : ""}`} onClick={() => setViewMode("preview")}>Preview</button>
                      <button className={`view-btn${viewMode === "raw" ? " active" : ""}`} onClick={() => setViewMode("raw")}>Raw</button>
                    </div>
                    <button className="icon-btn" title="Скопировать" onClick={copyResult}>⎘</button>
                  </div>
                )}
              </div>
              <div className="panel-body">
                {processing ? (
                  <div className="result-loading">
                    <div className="spinner" />
                    <span>ИИ обрабатывает текст…</span>
                  </div>
                ) : result ? (
                  viewMode === "preview" ? (
                    <div className="result-scroll" dangerouslySetInnerHTML={{ __html: mdToHtml(result.processedText) }} />
                  ) : (
                    <textarea className="editor-ta" value={result.processedText} readOnly spellCheck={false} />
                  )
                ) : (
                  <div className="result-empty">
                    <span>Результат появится здесь</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bottom-bar">
            {error && <span className="err-banner">{error}</span>}
            <button
              className="run-btn"
              onClick={handleRun}
              disabled={processing || !text.trim()}
            >
              {processing
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />ОБРАБОТКА…</>
                : <><span className="run-lightning">⚡</span>Нормально делай — нормально будет</>
              }
            </button>
            {result && <span className="token-info">{result.provider} · {result.latencyMs}ms</span>}
          </div>
        </div>
      </div>
    </>
  );
}
