"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey   = "germany" | "poland" | "brazil" | "latam" | "com";
type StepKey     = "search" | "evaluate" | "improve";
type VerdictType = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode   = "text" | "url";

interface NewsItem {
  headline: string; category: string; summary: string;
  business_impact: string; resonance_score: number;
}
interface ToneMap {
  formal_casual: number; bold_cautious: number; technical_benefit: number;
  abstract_concrete: number; global_native: number;
}
interface Rewrite {
  block: string; original: string; problem?: string;
  suggested: string; suggested_local: string; reason: string;
}
interface EvaluateResult {
  verdict: VerdictType; verdict_reason: string; buyer_reaction?: string;
  genericness_score: number; generic_phrases: string[];
  missed_anchors?: string[]; tone_map: ToneMap; tone_gap?: string;
  missing_trust_signals: string[]; trend_context: string;
  rewrites: Rewrite[]; brief_text: string; brief_local?: string;
}
interface ImproveResult {
  improved_text: string; improved_local: string;
  changes: { what: string; why: string }[]; tone_achieved: string;
}
interface UrlStatus {
  type: "success" | "error"; message: string;
  domain?: string; charCount?: number; truncated?: boolean;
}

// ── Константы ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { labelRu: string; flag: string; flagCdn: string | null; desc: string }> = {
  germany: { labelRu: "Германия", flag: "🇩🇪", flagCdn: "de", desc: "Формальный · Точный · Процессный"      },
  poland:  { labelRu: "Польша",   flag: "🇵🇱", flagCdn: "pl", desc: "Прямой · Фактический · Прозрачный"     },
  brazil:  { labelRu: "Бразилия", flag: "🇧🇷", flagCdn: "br", desc: "Тёплый · Человечный · Доверительный"   },
  latam:   { labelRu: "LATAM",    flag: "🌎",  flagCdn: null, desc: "Энергичный · Рост · Испаноязычный"     },
  com:     { labelRu: "COM",      flag: "🌐",  flagCdn: null, desc: "Уверенный · Data-driven · ROI-focused" },
};

// Кросс-платформенный флаг:
// - Для страновых флагов: img из flagcdn.com (решает проблему Windows Chrome/Edge)
// - Для региональных (LATAM🌎, COM🌐): эмодзи — они рендерятся везде корректно
// - onError fallback гарантирует показ эмодзи если CDN недоступен
const FlagImg = ({ code, emoji, size = 28 }: { code: string | null; emoji: string; size?: number }) => {
  if (!code) {
    // Региональные эмодзи (🌎 🌐) рендерятся корректно на всех платформах
    return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{emoji}</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/w${Math.max(size * 2, 40)}/${code}.png`}
      srcSet={`https://flagcdn.com/w${Math.max(size * 4, 80)}/${code}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={emoji}
      style={{ objectFit: "cover", borderRadius: 2, display: "inline-block", verticalAlign: "middle" }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        el.outerHTML = `<span style="font-size:${size}px;line-height:1;display:inline-block;vertical-align:middle">${emoji}</span>`;
      }}
    />
  );
};

const STEPS: Record<StepKey, { num: string; label: string }> = {
  search:   { num: "01", label: "Поиск"     },
  evaluate: { num: "02", label: "Проверка"  },
  improve:  { num: "03", label: "Улучшение" },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)", border: "rgba(132,204,22,0.3)", icon: "✓", label: "Звучит локально"   },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", icon: "⚠", label: "Звучит как импорт" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",  border: "rgba(225,29,72,0.3)",  icon: "✕", label: "Звучит чужеродно"  },
};

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const PRESETS = [
  { id: "zero_click",     icon: "🕳️", label: "Пост без перехода",       desc: "Удержание в ленте без ссылки"        },
  { id: "anti_ai",        icon: "📱", label: "«На бегу»",                desc: "Живой текст, не похожий на ИИ"       },
  { id: "strong_pov",     icon: "🔥", label: "Провокационное мнение",    desc: "Позиция, с которой хочется спорить"  },
  { id: "thread_starter", icon: "🧵", label: "Виральный тред",           desc: "Тред из 5 частей для соцсетей"       },
  { id: "re_engage",      icon: "♻️", label: "Реанимация лидов",         desc: "Пишем лидам «не сейчас»"             },
  { id: "data_story",     icon: "📊", label: "История с данными",        desc: "Аналитический пост — 3x репостов"    },
  { id: "community_drop", icon: "🫂", label: "Пост в комьюнити",         desc: "Органичный обмен опытом без рекламы" },
] as const;

type PresetId = typeof PRESETS[number]["id"];

const SEARCH_MSGS_POOL = [
  "Сканируем деловые СМИ...", "Отбираем ключевые сигналы...", "Формируем дайджест...",
  "Звоним инсайдерам...", "Ужинаем с депутатами...", "Общаемся с Уорреном Баффетом...",
  "Идём к гадалке...", "Раскладываем карты Таро...", "Гадаем на кофейной гуще...",
  "Читаем Bloomberg...", "Подкупаем бухгалтеров...",
];
const EVAL_MSGS   = ["Анализирую тон и культуру...", "Проверяю сигналы доверия...", "Ищу клише...", "Генерирую правки..."];
const IMPROV_MSGS = ["Читаю профиль рынка...", "Переписываю под аудиторию...", "Полирую нативный тон..."];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newsScoreClass(s: number) { return s >= 75 ? "high" : s >= 45 ? "mid" : "low"; }
function scoreColor(s: number) { return s < 35 ? "#3F6212" : s < 65 ? "#C2410C" : "#BE123C"; }

// ── Стили ─────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
:root{
  --violet:#7C3AED;--violet-d:#6D28D9;--violet-a:rgba(124,58,237,0.1);
  --lime:#84CC16;--lime-a:rgba(132,204,22,0.12);--lime-d:#65A30D;
  --orange:#F97316;--orange-d:#EA6C0A;--orange-a:rgba(249,115,22,0.1);
  --red:#EF4444;--sky-a:rgba(14,165,233,0.08);--sky-b:rgba(14,165,233,0.2);
  --bg:#F1F5F9;--surface:#FFFFFF;--t1:#0F172A;--t2:#475569;--t3:#94A3B8;
  --border:rgba(15,23,42,0.1);--border-xs:rgba(15,23,42,0.05);--r:14px;--r-sm:10px
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased;line-height:1.5}
.shell{display:flex;min-height:100vh}

/* ── Сайдбар ── */
.sidebar{width:200px;background:var(--surface);border-right:1px solid var(--border);padding:20px 14px;display:flex;flex-direction:column;flex-shrink:0;position:sticky;top:0;height:100vh;overflow:hidden}
.logo{display:flex;align-items:center;gap:9px;font-family:'Syne',sans-serif;font-size:19px;font-weight:800;color:var(--t1);margin-bottom:28px;flex-shrink:0}
.logo-mark{width:26px;height:26px;background:var(--lime);border-radius:6px;display:grid;place-items:center;font-size:13px;font-weight:800;color:#1a2e05;flex-shrink:0}
.sb-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--t3);margin-bottom:6px;padding-left:2px}
.nav-list{display:flex;flex-direction:column;gap:2px}
.nav-btn{display:flex;align-items:center;gap:9px;padding:9px 10px;border:none;border-radius:9px;background:transparent;cursor:pointer;width:100%;text-align:left;font-family:inherit;transition:background .15s}
.nav-btn:hover{background:var(--bg)}.nav-btn.active{background:var(--violet-a)}
.nav-num{width:20px;height:20px;border-radius:5px;background:var(--bg);font-size:9px;font-weight:800;color:var(--t3);display:grid;place-items:center;flex-shrink:0;font-family:'Syne',sans-serif}
.nav-btn.active .nav-num{background:var(--violet);color:white}
.nav-label{font-size:12px;font-weight:600;color:var(--t2)}.nav-btn.active .nav-label{color:var(--violet);font-weight:700}
.sb-footer{margin-top:auto;padding-top:16px;border-top:1px solid var(--border-xs);font-size:10px;color:var(--t3);line-height:1.7}

/* ── Main + Topbar ── */
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:20;flex-shrink:0;gap:12px}
.tab-pills{display:flex;gap:4px;background:var(--bg);padding:3px;border-radius:10px}
.tab-pill{display:flex;align-items:center;gap:6px;padding:6px 12px;border:none;border-radius:7px;background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:var(--t3);cursor:pointer;transition:background .15s,color .15s,box-shadow .15s;white-space:nowrap}
.tab-pill:hover{color:var(--t2)}.tab-pill.active{background:var(--surface);color:var(--violet);box-shadow:0 1px 4px rgba(0,0,0,.08)}
.tab-pill-num{width:16px;height:16px;border-radius:4px;background:var(--bg);font-size:8px;font-weight:800;display:grid;place-items:center;font-family:'Syne',sans-serif;color:var(--t3);flex-shrink:0}
.tab-pill.active .tab-pill-num{background:var(--violet);color:white}
.topbar-market{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--t2);white-space:nowrap}
.btn-reset{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;background:transparent;border:1px solid var(--border);border-radius:7px;font-family:inherit;font-size:11px;font-weight:600;color:var(--t3);cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;flex-shrink:0}
.btn-reset:hover{background:var(--bg);color:var(--t2)}

/* ── Page ── */
.page{flex:1;padding:28px 28px 40px;max-width:1100px;width:100%;margin:0 auto}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px}
.field-label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--t3);margin-bottom:10px}

/* ── Market selector ── */
.market-selector{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
.market-card{padding:14px 12px;border:2px solid var(--border-xs);border-radius:var(--r);background:var(--surface);cursor:pointer;text-align:center;transition:border-color .15s,background .15s,transform .15s,box-shadow .15s;font-family:inherit}
.market-card:hover{border-color:var(--border);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.06)}
.market-card.active{border-color:var(--lime);background:var(--lime-a);box-shadow:0 4px 16px rgba(132,204,22,.15)}
.market-card-flag{font-size:28px;margin-bottom:6px;display:block}
.market-card-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--t1);margin-bottom:3px}
.market-card-desc{font-size:10px;color:var(--t3);line-height:1.35}

/* ── Buttons ── */
.btn-search{width:100%;padding:15px;background:var(--orange);color:#fff;border:none;border-radius:var(--r-sm);font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;display:flex;align-items:center;justify-content:center;gap:8px}
.btn-search:hover:not(:disabled){background:var(--orange-d);transform:translateY(-2px);box-shadow:0 6px 20px rgba(249,115,22,.3)}
.btn-search:disabled{background:var(--t3);cursor:not-allowed;transform:none;box-shadow:none}
.btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 20px;background:var(--violet);color:#fff;border:none;border-radius:var(--r-sm);font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s,transform .15s,box-shadow .15s;margin-top:14px}
.btn-primary:hover:not(:disabled){background:var(--violet-d);transform:translateY(-1px);box-shadow:0 6px 20px rgba(124,58,237,.25)}
.btn-primary:disabled{background:var(--t3);cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:transparent;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:12px;font-weight:600;color:var(--t2);cursor:pointer;transition:background .15s;white-space:nowrap}
.btn-ghost:hover{background:var(--bg)}.btn-ghost:disabled{opacity:.5;cursor:not-allowed}

/* ── News grid ── */
.news-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:28px}
.news-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;cursor:default;transition:transform .18s,box-shadow .18s,border-color .18s;display:flex;flex-direction:column;gap:10px}
.news-card:hover{transform:translateY(-4px) scale(1.01);box-shadow:0 8px 28px rgba(124,58,237,.1);border-color:rgba(124,58,237,.2)}
.news-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.news-category{display:inline-block;padding:3px 9px;background:var(--violet-a);color:var(--violet);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-radius:5px;white-space:nowrap;flex-shrink:0}
.news-score{font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;white-space:nowrap;flex-shrink:0}
.news-score.high{background:rgba(132,204,22,.15);color:#3F6212}
.news-score.mid{background:rgba(249,115,22,.12);color:#C2410C}
.news-score.low{background:rgba(148,163,184,.15);color:var(--t2)}
.news-headline{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--t1);line-height:1.35}
.news-summary{font-size:12px;color:var(--t2);line-height:1.6;flex:1}
.news-impact{font-size:12px;color:var(--t2);background:var(--bg);border-radius:8px;padding:9px 12px;border-left:3px solid var(--orange);line-height:1.5}
.news-impact-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--orange);margin-bottom:3px}
.news-card-use{margin-top:auto;padding:7px 12px;background:transparent;border:1px solid var(--border);border-radius:8px;font-family:inherit;font-size:11px;font-weight:600;color:var(--t3);cursor:pointer;transition:.15s;text-align:left}
.news-card-use:hover{background:var(--violet-a);border-color:rgba(124,58,237,.25);color:var(--violet)}

/* ── Layout ── */
.split{display:grid;gap:24px;grid-template-columns:340px 1fr;align-items:start}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.stack{display:flex;flex-direction:column;gap:14px}
.row{display:flex;align-items:center;gap:12px}

/* ── Inputs ── */
textarea.inp{width:100%;padding:13px 14px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);font-family:inherit;font-size:13px;line-height:1.65;color:var(--t1);resize:vertical;outline:none;transition:border-color .15s,box-shadow .15s;min-height:130px}
textarea.inp:focus{border-color:var(--violet);background:var(--surface);box-shadow:0 0 0 3px var(--violet-a)}

/* ── Loader ── */
.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:260px;gap:14px;color:var(--t2)}
.spinner{width:30px;height:30px;border:3px solid var(--border);border-top-color:var(--violet);border-radius:50%;animation:spin .75s linear infinite}
.spinner-sm{width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .75s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.loader-label{font-size:14px;font-weight:600}.loader-msg{font-size:12px;color:var(--t3)}

/* ── Empty / Error ── */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:260px;text-align:center;color:var(--t3);gap:10px}
.empty-icon{font-size:32px;opacity:.3}.empty-title{font-size:14px;font-weight:600;color:var(--t2)}.empty-text{font-size:12px;max-width:240px;line-height:1.6}
.error-box{padding:13px 16px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:var(--r-sm);color:#B91C1C;font-size:13px;font-weight:500}

/* ── URL mode ── */
.mode-tabs{display:flex;gap:4px;background:var(--bg);padding:4px;border-radius:var(--r-sm);margin-bottom:14px}
.mode-tab{flex:1;padding:7px;border:none;border-radius:7px;background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:var(--t3);cursor:pointer;transition:.15s}
.mode-tab.active{background:var(--surface);color:var(--t1);box-shadow:0 1px 4px rgba(0,0,0,.08)}
.url-wrap{position:relative}
.url-inp{width:100%;padding:11px 14px 11px 36px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--bg);font-family:inherit;font-size:13px;color:var(--t1);outline:none;transition:border-color .15s,box-shadow .15s}
.url-inp:focus{border-color:var(--violet);background:var(--surface);box-shadow:0 0 0 3px var(--violet-a)}
.url-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none}
.url-status{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:500;margin-top:8px}
.url-status.success{background:rgba(132,204,22,.1);color:#3F6212}.url-status.error{background:rgba(239,68,68,.07);color:#B91C1C}
.url-meta{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:8px;margin-top:6px}
.url-meta-domain{font-size:12px;font-weight:600;color:var(--t2)}.url-meta-chars{font-size:11px;color:var(--t3)}
.url-hint{font-size:11px;color:var(--t3);margin-top:8px;line-height:1.5}
.preview-box{margin-top:12px;padding:10px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--t2);line-height:1.5;max-height:90px;overflow:hidden;position:relative}
.preview-fade{position:absolute;bottom:0;left:0;right:0;height:32px;background:linear-gradient(transparent,var(--bg))}

/* ── Evaluate ── */
.verdict-banner{display:flex;align-items:center;gap:14px;padding:15px 18px;border-radius:var(--r);border:1.5px solid;margin-bottom:14px}
.verdict-icon{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;font-size:16px;font-weight:800;background:rgba(255,255,255,.6);flex-shrink:0}
.verdict-label{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;margin-bottom:2px}
.verdict-reason{font-size:13px;font-weight:500;opacity:.8}
.buyer-reaction{padding:12px 14px;background:var(--bg);border-radius:var(--r-sm);font-size:13px;color:var(--t2);line-height:1.55;border-left:3px solid var(--violet);font-style:italic}
.tone-row{margin-bottom:12px}.tone-row:last-child{margin-bottom:0}
.tone-labels{display:flex;justify-content:space-between;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--t2);margin-bottom:5px}
.tone-track{position:relative;height:5px;background:var(--bg);border-radius:99px}
.tone-mid{position:absolute;left:50%;top:-3px;bottom:-3px;width:1.5px;background:var(--border)}
.tone-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:var(--violet);border:2px solid white;transform:translate(-50%,-50%);box-shadow:0 1px 4px rgba(124,58,237,.35);transition:left .5s cubic-bezier(.34,1.56,.64,1)}
.score-big{font-family:'Syne',sans-serif;font-size:34px;font-weight:800;line-height:1;margin-bottom:2px}
.score-sub{font-size:11px;color:var(--t3);margin-bottom:10px}
.badge-row{display:flex;flex-wrap:wrap;gap:6px}
.badge{padding:3px 9px;background:#FEE2E2;color:#B91C1C;font-size:11px;font-weight:600;border-radius:5px}
.trust-list{display:flex;flex-direction:column;gap:6px}
.trust-item{display:flex;align-items:flex-start;gap:8px;padding:8px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--t2);border-left:3px solid var(--red);line-height:1.4}
.ctx-box{display:flex;gap:10px;padding:12px 14px;background:var(--sky-a);border:1px solid var(--sky-b);border-radius:var(--r-sm);font-size:13px;color:var(--t2);line-height:1.55}
.ctx-icon{font-size:14px;flex-shrink:0;margin-top:1px}
.rw-card{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:15px}
.rw-tag{display:inline-block;padding:3px 8px;background:var(--violet-a);color:var(--violet);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-radius:5px;margin-bottom:12px}
.rw-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.rw-col-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--t3);margin-bottom:5px}
.rw-block{padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.55;border:1px solid var(--border);background:var(--surface);color:var(--t2)}
.rw-block.local{background:var(--violet-a);border-color:rgba(124,58,237,.2);color:var(--violet);font-weight:500}
.rw-reason{font-size:12px;color:var(--t3);font-style:italic;padding-top:10px;border-top:1px solid var(--border-xs)}

/* ── Presets ── */
.preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.preset-btn{padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface);text-align:left;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s,transform .12s}
.preset-btn:hover{border-color:var(--violet);background:var(--violet-a);transform:translateY(-1px)}
.preset-btn.active{border-color:var(--violet);background:var(--violet-a)}
.preset-btn-icon{font-size:16px;margin-bottom:5px}
.preset-btn-label{font-size:12px;font-weight:700;color:var(--t1);margin-bottom:2px}
.preset-btn-desc{font-size:10px;color:var(--t3);line-height:1.35}

/* ── Improve result ── */
.improve-result{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px}
.improve-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.improve-tab{padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:var(--t2);cursor:pointer;transition:.15s}
.improve-tab.active{background:var(--violet);border-color:var(--violet);color:white}
.improve-body{font-size:14px;line-height:1.75;color:var(--t1);white-space:pre-wrap;padding:16px;background:var(--bg);border-radius:10px}
.change-list{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.change-item{padding:11px 14px;border-radius:8px;background:var(--bg);border-left:3px solid var(--violet)}
.change-what{font-size:13px;font-weight:600;color:var(--t1);margin-bottom:3px}
.change-why{font-size:12px;color:var(--t2)}
.tone-tag{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(132,204,22,.1);border:1px solid rgba(132,204,22,.25);border-radius:8px;font-size:12px;font-weight:600;color:#3F6212;margin-bottom:14px}

/* ── Toast ── */
.toast{position:fixed;bottom:20px;right:20px;background:var(--t1);color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:500;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.18);animation:fadeUp .25s ease-out}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

/* ── Mobile ── */
@media(max-width:768px){
  .sidebar{display:none}
  .topbar{padding:0 16px;height:48px;overflow-x:auto}
  .tab-pill{padding:5px 10px;font-size:11px}.tab-pill-num{display:none}
  .page{padding:16px 16px 32px}

  /* 5 рынков — 1 колонка на мобиле */
  .market-selector{grid-template-columns:1fr;gap:8px}
  .market-card{display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px}
  .market-card-flag{font-size:24px;margin-bottom:0;flex-shrink:0}

  .news-grid{grid-template-columns:1fr;gap:12px;margin-top:20px}

  /* КЛЮЧЕВОЙ ФИКС: на мобиле output идёт первым */
  .split{grid-template-columns:1fr;gap:0}
  .split-form{order:2;margin-top:16px}
  .split-output{order:1}

  .grid2{grid-template-columns:1fr}
  .rw-cols{grid-template-columns:1fr}
  .topbar-market{display:none}
  .preset-grid{grid-template-columns:1fr}
}
@media(max-width:480px){.tab-pills{gap:2px;padding:2px}.tab-pill{padding:5px 8px;font-size:10px}}
`;

// ── Компонент ─────────────────────────────────────────────────────────────────

export default function BreasonApp() {
  const [step,   setStep]   = useState<StepKey>("search");
  const [market, setMarket] = useState<MarketKey>("germany");

  const [loading,  setLoading]  = useState(false);
  const [loadMsg,  setLoadMsg]  = useState(0);
  const [loadMsgs, setLoadMsgs] = useState<string[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  const [newsItems,     setNewsItems]     = useState<NewsItem[] | null>(null);
  const [evalResult,    setEvalResult]    = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);

  const [activePreset,  setActivePreset]  = useState<PresetId>("zero_click");
  const [selectedTrend, setSelectedTrend] = useState<NewsItem | null>(null);

  const [evalText,    setEvalText]    = useState(DEFAULT_COPY);
  const [improveText, setImproveText] = useState("");
  const [improveCtx,  setImproveCtx]  = useState("");
  const [improveTab,  setImproveTab]  = useState<"en" | "local">("local");

  const [inputMode,  setInputMode]  = useState<InputMode>("text");
  const [urlInput,   setUrlInput]   = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlStatus,  setUrlStatus]  = useState<UrlStatus | null>(null);

  // Refs для мобильного scroll-to-output
  const outputRefEval    = useRef<HTMLDivElement>(null);
  const outputRefImprove = useRef<HTMLDivElement>(null);

  // Крутим сообщения лоадера
  useEffect(() => {
    if (!loading) return;
    const msgs = step === "search" ? shuffleArray(SEARCH_MSGS_POOL) : step === "evaluate" ? EVAL_MSGS : IMPROV_MSGS;
    setLoadMsgs(msgs);
    setLoadMsg(0);
    const id = setInterval(() => setLoadMsg(m => (m + 1) % msgs.length), 2200);
    return () => clearInterval(id);
  }, [loading, step]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // Scroll output в видимую область на мобиле
  const scrollToOutput = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const showToast  = (msg: string) => setToast(msg);
  const switchStep = (s: StepKey) => { setStep(s); setError(null); };
  const copyText   = (text: string, label = "Скопировано!") =>
    navigator.clipboard.writeText(text).then(() => showToast(`✓ ${label}`));
  const resetAll   = () => {
    setNewsItems(null); setEvalResult(null); setImproveResult(null);
    setError(null); setUrlStatus(null); setSelectedTrend(null);
  };

  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true); setUrlStatus(null);
    try {
      const res  = await fetch("/api/fetch-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.trim() }) });
      const data = await res.json();
      if (!res.ok || data.error) { setUrlStatus({ type: "error", message: data.error || "Не удалось загрузить URL" }); return; }
      setEvalText(data.text);
      setUrlStatus({ type: "success", message: "Содержимое успешно извлечено", domain: data.domain, charCount: data.charCount, truncated: data.truncated });
    } catch { setUrlStatus({ type: "error", message: "Ошибка сети. Проверьте соединение." }); }
    finally   { setUrlLoading(false); }
  }, [urlInput]);

  const handleSearch = useCallback(async () => {
    setLoading(true); setLoadMsg(0); setError(null); setNewsItems(null);
    try {
      const res  = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сервера"); return; }
      setNewsItems(data.items || []);
    } catch { setError("Ошибка сети. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }, [market]);

  const handleEvaluate = useCallback(async () => {
    if (!evalText.trim()) return;
    setLoading(true); setLoadMsg(0); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", text: evalText.trim(), market }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сервера"); return; }
      if (!data.verdict) { setError("Неполный ответ ИИ. Попробуйте ещё раз."); return; }
      setEvalResult(data);
      scrollToOutput(outputRefEval);
    } catch { setError("Ошибка сети. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }, [evalText, market]);

  const handleImprove = useCallback(async () => {
    const src = improveText.trim() || evalText.trim();
    if (!src) return;
    setLoading(true); setLoadMsg(0); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "improve", text: src, market,
          context: improveCtx, preset: activePreset,
          trendName:    selectedTrend?.headline      || "",
          trendTension: selectedTrend?.business_impact || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сервера"); return; }
      if (!data.improved_text) { setError("Неполный ответ ИИ. Попробуйте ещё раз."); return; }
      setImproveResult(data);
      scrollToOutput(outputRefImprove);
    } catch { setError("Ошибка сети. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }, [improveText, improveCtx, evalText, market, activePreset, selectedTrend]);

  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = ((val + 5) / 10) * 100;
    return (
      <div className="tone-row">
        <div className="tone-labels"><span>{labelL}</span><span>{labelR}</span></div>
        <div className="tone-track"><div className="tone-mid" /><div className="tone-dot" style={{ left: `${pct}%` }} /></div>
      </div>
    );
  };

  // ── Step 1: Search ────────────────────────────────────────────────────────

  const renderSearch = () => (
    <div>
      <div className="market-selector">
        {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
          <button key={key} className={`market-card ${market === key ? "active" : ""}`} onClick={() => setMarket(key)}>
            <span className="market-card-flag"><FlagImg code={m.flagCdn} emoji={m.flag} size={30} /></span>
            <div className="market-card-name">{m.labelRu}</div>
            <div className="market-card-desc">{m.desc}</div>
          </button>
        ))}
      </div>
      <button className="btn-search" onClick={handleSearch} disabled={loading}>
        {loading ? <><span className="spinner-sm" /> Сканирую рынок...</> : <>◎ Найти тренды — {MARKETS[market].labelRu} <FlagImg code={MARKETS[market].flagCdn} emoji={MARKETS[market].flag} size={16} /></>}
      </button>
      {loading && (<div className="loader" style={{ marginTop: 24 }}><div className="spinner" /><div className="loader-label">Формирую дайджест</div><div className="loader-msg">{loadMsgs[loadMsg] || ""}</div></div>)}
      {!loading && error && <div className="error-box" style={{ marginTop: 20 }}>⚠ {error}</div>}
      {!loading && !error && !newsItems && (<div className="empty" style={{ marginTop: 8 }}><div className="empty-icon">◎</div><div className="empty-title">Нет данных</div><p className="empty-text">Выберите рынок и нажмите кнопку, чтобы получить свежий B2B-дайджест.</p></div>)}
      {!loading && newsItems && (
        <div className="news-grid">
          {newsItems.map((item, i) => (
            <div className="news-card" key={i}>
              <div className="news-card-top">
                <span className="news-category">{item.category}</span>
                <span className={`news-score ${newsScoreClass(item.resonance_score)}`}>↑ {item.resonance_score}</span>
              </div>
              <div className="news-headline">{item.headline}</div>
              <div className="news-summary">{item.summary}</div>
              <div className="news-impact"><div className="news-impact-label">Влияние на B2B</div>{item.business_impact}</div>
              <button className="news-card-use" onClick={() => { setSelectedTrend(item); setImproveText(""); setImproveCtx(item.headline); switchStep("improve"); }}>◆ Улучшить текст под этот тренд →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Step 2: Evaluate ──────────────────────────────────────────────────────

  const renderEvaluate = () => (
    <div className="split">
      {/* Форма — на мобиле идёт второй (order:2) */}
      <div className="card split-form" style={{ position: "sticky", top: 60 }}>
        <div className="mode-tabs">
          <button className={`mode-tab ${inputMode === "text" ? "active" : ""}`} onClick={() => { setInputMode("text"); setUrlStatus(null); }}>✏️ Вставить текст</button>
          <button className={`mode-tab ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")}>🔗 По ссылке</button>
        </div>
        {inputMode === "url" && (
          <div style={{ marginBottom: 14 }}>
            <p className="field-label">Адрес страницы</p>
            <div className="url-wrap">
              <span className="url-icon">🌐</span>
              <input className="url-inp" type="url" value={urlInput} onChange={e => { setUrlInput(e.target.value); setUrlStatus(null); }} onKeyDown={e => e.key === "Enter" && handleFetchUrl()} placeholder="https://example.com/страница" />
            </div>
            <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={handleFetchUrl} disabled={urlLoading || !urlInput.trim()}>
              {urlLoading ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Извлекаю...</> : "Извлечь содержимое →"}
            </button>
            {urlStatus && <div className={`url-status ${urlStatus.type}`}>{urlStatus.type === "success" ? "✓" : "⚠"} {urlStatus.message}</div>}
            {urlStatus?.type === "success" && (<div className="url-meta"><span className="url-meta-domain">📄 {urlStatus.domain}</span><span className="url-meta-chars">{urlStatus.charCount?.toLocaleString()} симв.{urlStatus.truncated ? " (обрезано)" : ""}</span></div>)}
            {!urlStatus && !urlLoading && <p className="url-hint">Работает с открытыми страницами. Сайты с авторизацией могут не загрузиться — вставьте текст вручную.</p>}
            {urlStatus?.type === "success" && evalText && (<><p className="field-label" style={{ marginTop: 12 }}>Предпросмотр</p><div className="preview-box">{evalText.slice(0, 280)}...<div className="preview-fade" /></div></>)}
          </div>
        )}
        {inputMode === "text" && (<><p className="field-label">Ваш маркетинговый текст</p><textarea className="inp" rows={9} value={evalText} onChange={e => setEvalText(e.target.value)} placeholder="Вставьте текст: заголовок, email, лендинг, CTA..." /></>)}
        {inputMode === "url" && urlStatus?.type === "success" && (<><p className="field-label" style={{ marginTop: 8 }}>Редактировать перед анализом</p><textarea className="inp" rows={4} value={evalText} onChange={e => setEvalText(e.target.value)} /></>)}
        <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !evalText.trim() || urlLoading}>
          {loading ? <><span className="spinner-sm" /> Проверяю...</> : <>◈ Проверить для <FlagImg code={MARKETS[market].flagCdn} emoji={MARKETS[market].flag} size={14} /> {MARKETS[market].labelRu}</>}
        </button>
        {evalResult && (<button className="btn-ghost" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} onClick={() => { setImproveText(evalText); switchStep("improve"); }}>◆ Улучшить этот текст →</button>)}
      </div>

      {/* Output — на мобиле идёт первым (order:1) */}
      <div className="split-output" ref={outputRefEval}>
        {loading && (<div className="loader"><div className="spinner" /><div className="loader-label">Аудит контента</div><div className="loader-msg">{loadMsgs[loadMsg] || ""}</div></div>)}
        {!loading && error && <div className="error-box" style={{ marginBottom: 14 }}>⚠ {error}</div>}
        {!loading && !evalResult && !error && (<div className="empty"><div className="empty-icon">◈</div><div className="empty-title">Готов к проверке</div><p className="empty-text">{inputMode === "url" ? "Вставьте ссылку, извлеките страницу и нажмите «Проверить»." : "Вставьте текст и нажмите «Проверить»."}</p></div>)}
        {!loading && evalResult && (() => {
          const vc = VERDICT_CFG[evalResult.verdict];
          return (
            <div className="stack">
              <div className="verdict-banner" style={{ background: vc.bg, borderColor: vc.border, color: vc.color }}>
                <div className="verdict-icon">{vc.icon}</div>
                <div><div className="verdict-label">{evalResult.verdict} — {vc.label}</div><div className="verdict-reason">{evalResult.verdict_reason}</div></div>
              </div>
              {evalResult.buyer_reaction && (
                <div className="buyer-reaction">💬 {evalResult.buyer_reaction}</div>
              )}
              {evalResult.trend_context && (<div className="ctx-box"><span className="ctx-icon">📡</span><span><strong>Сигнал рынка:</strong> {evalResult.trend_context}</span></div>)}
              {evalResult.tone_gap && (<div className="ctx-box" style={{ background: "rgba(249,115,22,0.06)", borderColor: "rgba(249,115,22,0.2)" }}><span className="ctx-icon">🎯</span><span><strong>Тональный разрыв:</strong> {evalResult.tone_gap}</span></div>)}
              <div className="grid2">
                <div className="card" style={{ margin: 0 }}>
                  <p className="field-label">Карта тона</p>
                  {renderToneBar("Формальный",  "Неформальный", evalResult.tone_map.formal_casual)}
                  {renderToneBar("Дерзкий",     "Осторожный",   evalResult.tone_map.bold_cautious)}
                  {renderToneBar("Технический", "Про пользу",   evalResult.tone_map.technical_benefit)}
                  {renderToneBar("Абстрактный", "Конкретный",   evalResult.tone_map.abstract_concrete)}
                  {renderToneBar("Переведённый","Нативный",     evalResult.tone_map.global_native)}
                </div>
                <div className="stack">
                  <div className="card" style={{ margin: 0 }}>
                    <p className="field-label">Индекс шаблонности</p>
                    <div className="score-big" style={{ color: scoreColor(evalResult.genericness_score) }}>{evalResult.genericness_score}<span style={{ fontSize: 15, color: "var(--t3)", fontWeight: 400 }}>/100</span></div>
                    <p className="score-sub">{evalResult.genericness_score < 35 ? "Оригинально и локально" : evalResult.genericness_score < 65 ? "Типичный SaaS-голос" : "Чистые US-клише"}</p>
                    <div className="badge-row">{evalResult.generic_phrases.map((p, i) => <span className="badge" key={i}>«{p}»</span>)}</div>
                  </div>
                  <div className="card" style={{ margin: 0 }}>
                    <p className="field-label">Отсутствующие сигналы доверия</p>
                    <ul className="trust-list">{evalResult.missing_trust_signals.map((s, i) => <li className="trust-item" key={i}><span>✕</span>{s}</li>)}</ul>
                    {evalResult.missed_anchors && evalResult.missed_anchors.length > 0 && (
                      <ul className="trust-list" style={{ marginTop: 8 }}>
                        {evalResult.missed_anchors.map((a, i) => <li className="trust-item" key={i} style={{ borderLeftColor: "var(--orange)" }}><span>◎</span>{a}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Предлагаемые правки</span>
                  <button className="btn-ghost" onClick={() => copyText(evalResult.brief_local || evalResult.brief_text, "Бриф скопирован!")}>📋 Скопировать бриф</button>
                </div>
                <div className="stack">
                  {evalResult.rewrites.map((rw, i) => (
                    <div className="rw-card" key={i}>
                      <div className="rw-tag">{rw.block}</div>
                      {rw.problem && <div style={{ fontSize: 12, color: "#C2410C", background: "rgba(249,115,22,0.06)", padding: "6px 10px", borderRadius: 6, marginBottom: 10 }}>⚠ {rw.problem}</div>}
                      <div className="rw-cols">
                        <div><div className="rw-col-label">Оригинал</div><div className="rw-block">{rw.original}</div></div>
                        <div>
                          <div className="rw-col-label">Локализовано <FlagImg code={MARKETS[market].flagCdn} emoji={MARKETS[market].flag} size={12} /></div>
                          <div className="rw-block local">{rw.suggested_local}</div>
                          {rw.suggested !== rw.suggested_local && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 6 }}>EN: {rw.suggested}</div>}
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

  // ── Step 3: Improve ───────────────────────────────────────────────────────

  const renderImprove = () => (
    <div className="split">
      {/* Форма — на мобиле order:2 */}
      <div className="card split-form" style={{ position: "sticky", top: 60 }}>
        {selectedTrend && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--violet-a)", borderRadius: "var(--r-sm)", border: "1px solid rgba(124,58,237,0.2)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--violet)", marginBottom: 4 }}>Тренд из поиска</div>
            <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{selectedTrend.headline}</div>
            <button style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--t3)", padding: 0 }} onClick={() => setSelectedTrend(null)}>✕ Убрать</button>
          </div>
        )}
        <p className="field-label">Формат</p>
        <div className="preset-grid">
          {PRESETS.map(p => (
            <button key={p.id} className={`preset-btn ${activePreset === p.id ? "active" : ""}`} onClick={() => setActivePreset(p.id)}>
              <div className="preset-btn-icon">{p.icon}</div>
              <div className="preset-btn-label">{p.label}</div>
              <div className="preset-btn-desc">{p.desc}</div>
            </button>
          ))}
        </div>
        <p className="field-label">Текст для улучшения</p>
        <textarea className="inp" rows={7} value={improveText || evalText} onChange={e => setImproveText(e.target.value)} placeholder="Вставьте текст или он перенесётся из «Проверки»..." />
        <p className="field-label" style={{ marginTop: 14 }}>Контекст (необязательно)</p>
        <textarea className="inp" rows={2} value={improveCtx} onChange={e => setImproveCtx(e.target.value)} placeholder="Тренд рынка, позиционирование, целевая персона..." />
        <button className="btn-primary" onClick={handleImprove} disabled={loading || !(improveText.trim() || evalText.trim())}>
          {loading ? <><span className="spinner-sm" /> Переписываю...</> : <>◆ Применить — <FlagImg code={MARKETS[market].flagCdn} emoji={MARKETS[market].flag} size={14} /> {MARKETS[market].labelRu}</>}
        </button>
      </div>

      {/* Output — на мобиле order:1 */}
      <div className="split-output" ref={outputRefImprove}>
        {loading && (<div className="loader"><div className="spinner" /><div className="loader-label">Переписываю для {MARKETS[market].labelRu}</div><div className="loader-msg">{loadMsgs[loadMsg] || ""}</div></div>)}
        {!loading && error && <div className="error-box" style={{ marginBottom: 14 }}>⚠ {error}</div>}
        {!loading && !improveResult && !error && (<div className="empty"><div className="empty-icon">◆</div><div className="empty-title">Готов к улучшению</div><p className="empty-text">Текст будет переписан под {MARKETS[market].labelRu}: нативный тон, правильные сигналы доверия, локальный CTA.</p></div>)}
        {!loading && improveResult && (
          <div className="stack">
            <div className="tone-tag">✓ {improveResult.tone_achieved}</div>
            <div className="improve-result">
              <div className="improve-tabs">
                <button className={`improve-tab ${improveTab === "local" ? "active" : ""}`} onClick={() => setImproveTab("local")}><FlagImg code={MARKETS[market].flagCdn} emoji={MARKETS[market].flag} size={14} /> Локальная версия</button>
                <button className={`improve-tab ${improveTab === "en" ? "active" : ""}`} onClick={() => setImproveTab("en")}>English</button>
                <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={() => copyText(improveTab === "local" ? improveResult.improved_local : improveResult.improved_text, "Текст скопирован!")}>📋 Скопировать</button>
              </div>
              <div className="improve-body">{improveTab === "local" ? improveResult.improved_local : improveResult.improved_text}</div>
            </div>
            {improveResult.changes?.length > 0 && (
              <div>
                <p className="field-label" style={{ marginBottom: 8 }}>Что изменено и почему</p>
                <div className="change-list">
                  {improveResult.changes.map((c, i) => (<div className="change-item" key={i}><div className="change-what">{c.what}</div><div className="change-why">{c.why}</div></div>))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="shell">
      <style>{STYLE}</style>
      <aside className="sidebar">
        <div className="logo"><div className="logo-mark">B</div>Breason</div>
        <p className="sb-label">Разделы</p>
        <nav className="nav-list">
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => switchStep(key)}>
              <div className="nav-num">{s.num}</div><div className="nav-label">{s.label}</div>
            </button>
          ))}
        </nav>
        <div className="sb-footer">Breason v2.0<br /><span style={{ opacity: 0.5 }}>Не перевод. Резонанс.</span></div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="tab-pills">
            {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
              <button key={key} className={`tab-pill ${step === key ? "active" : ""}`} onClick={() => switchStep(key)}>
                <span className="tab-pill-num">{s.num}</span>{s.label}
              </button>
            ))}
          </div>
          <div className="topbar-market"><FlagImg code={MARKETS[market].flagCdn} emoji={MARKETS[market].flag} size={16} /> {MARKETS[market].labelRu}</div>
          {(evalResult || improveResult || newsItems) && <button className="btn-reset" onClick={resetAll}>↺ Сбросить</button>}
        </header>
        <main className="page">
          {step === "search"   && renderSearch()}
          {step === "evaluate" && renderEvaluate()}
          {step === "improve"  && renderImprove()}
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
