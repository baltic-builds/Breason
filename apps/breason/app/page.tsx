"use client";

import { useState, useEffect, useCallback } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey  = "germany" | "poland" | "brazil";
type StepKey    = "search" | "evaluate" | "improve";
type VerdictType = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode  = "text" | "url";

interface Trend {
  trend_name:      string;
  narrative_hook:  string;
  market_tension:  string;
  why_now:         string;
  resonance_score: number;
}

interface ToneMap {
  formal_casual:     number;
  bold_cautious:     number;
  technical_benefit: number;
  abstract_concrete: number;
  global_native:     number;
}

interface Rewrite {
  block:          string;
  original:       string;
  suggested:      string;
  suggested_local: string;
  reason:         string;
}

interface EvaluateResult {
  verdict:               VerdictType;
  verdict_reason:        string;
  genericness_score:     number;
  generic_phrases:       string[];
  tone_map:              ToneMap;
  missing_trust_signals: string[];
  trend_context:         string;
  rewrites:              Rewrite[];
  brief_text:            string;
}

interface ImproveResult {
  improved_text:  string;
  improved_local: string;
  changes:        { what: string; why: string }[];
  tone_achieved:  string;
}

interface UrlStatus {
  type:      "success" | "error";
  message:   string;
  domain?:   string;
  charCount?: number;
  truncated?: boolean;
}

// ── Константы ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { label: string; labelRu: string; flag: string; desc: string }> = {
  germany: { label: "Germany",  labelRu: "Германия",  flag: "🇩🇪", desc: "Формальный · Точный · Ориентированный на процесс" },
  poland:  { label: "Poland",   labelRu: "Польша",    flag: "🇵🇱", desc: "Прямой · На основе фактов · Прозрачный" },
  brazil:  { label: "Brazil",   labelRu: "Бразилия",  flag: "🇧🇷", desc: "Тёплый · Человечный · Отношения на первом месте" },
};

const STEPS: Record<StepKey, { num: string; label: string; hint: string; icon: string }> = {
  search:   { num: "01", label: "Поиск",    hint: "Тренды рынка",        icon: "◎" },
  evaluate: { num: "02", label: "Проверка", hint: "Аудит контента",      icon: "◈" },
  improve:  { num: "03", label: "Улучшение",hint: "Нативная редактура",  icon: "◆" },
};

const VERDICT_CFG: Record<VerdictType, {
  color: string; bg: string; border: string; icon: string; label: string;
}> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально" },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как импорт" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Звучит чужеродно" },
};

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Сканирую B2B ландшафт...", "Определяю ключевые сигналы...", "Оцениваю резонанс трендов..."],
  evaluate: ["Анализирую тон и культурный контекст...", "Проверяю сигналы доверия...", "Ищу клише и шаблоны...", "Генерирую нативные варианты..."],
  improve:  ["Читаю профиль рынка...", "Переписываю под локальную аудиторию...", "Полирую нативный тон..."],
};

// ── Стили ─────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet:      #7C3AED;
  --violet-d:    #6D28D9;
  --violet-a:    rgba(124,58,237,0.1);
  --lime:        #84CC16;
  --lime-a:      rgba(132,204,22,0.1);
  --orange:      #F97316;
  --red:         #EF4444;
  --sky-a:       rgba(14,165,233,0.08);
  --sky-b:       rgba(14,165,233,0.18);
  --bg:          #F1F5F9;
  --surface:     #FFFFFF;
  --t1:          #0F172A;
  --t2:          #475569;
  --t3:          #94A3B8;
  --border:      rgba(15,23,42,0.1);
  --border-xs:   rgba(15,23,42,0.05);
  --r:           14px;
  --sidebar-w:   224px;
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

/* ── Оболочка ───────────── */
.shell { display: flex; min-height: 100vh; }

/* ── Сайдбар ────────────── */
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

.sb-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--t3);
  margin-bottom: 6px;
  padding-left: 2px;
}

/* Навигация по шагам */
.nav-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 28px; }

.nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  transition: background 0.15s;
}
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }

.nav-num {
  width: 22px; height: 22px;
  border-radius: 6px;
  background: var(--bg);
  font-size: 9px; font-weight: 800;
  color: var(--t3);
  display: grid; place-items: center;
  flex-shrink: 0;
  font-family: 'Syne', sans-serif;
}
.nav-btn.active .nav-num { background: var(--violet); color: white; }

.nav-info { flex: 1; min-width: 0; }
.nav-label { font-size: 13px; font-weight: 600; color: var(--t2); line-height: 1; margin-bottom: 2px; }
.nav-hint  { font-size: 10px; color: var(--t3); }
.nav-btn.active .nav-label { color: var(--violet); font-weight: 700; }

/* Выбор рынка */
.mkt-list { display: flex; flex-direction: column; gap: 6px; flex: 1; }

.mkt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1.5px solid var(--border-xs);
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.mkt-btn:hover { border-color: var(--border); background: var(--bg); }
.mkt-btn.active { border-color: var(--lime); background: var(--lime-a); }
.mkt-flag { font-size: 18px; line-height: 1; flex-shrink: 0; }
.mkt-name { font-size: 12px; font-weight: 600; color: var(--t1); }

.sb-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-xs);
  font-size: 10px;
  color: var(--t3);
  line-height: 1.7;
  flex-shrink: 0;
}

/* ── Основная область ───── */
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
.topbar-left { display: flex; align-items: center; gap: 10px; }
.topbar-badge {
  background: var(--violet-a);
  color: var(--violet);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 6px;
  font-family: 'Syne', sans-serif;
}
.topbar-title { font-size: 13px; font-weight: 600; color: var(--t2); }

.page {
  flex: 1;
  padding: 32px;
  max-width: 1160px;
  width: 100%;
  margin: 0 auto;
}

/* ── Карточки ───────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
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

/* ── Текстовое поле ─────── */
textarea.inp {
  width: 100%;
  padding: 13px 14px;
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
  min-height: 130px;
}
textarea.inp:focus {
  border-color: var(--violet);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--violet-a);
}

/* ── Кнопки ─────────────── */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 13px 20px;
  background: var(--violet); color: #fff;
  border: none; border-radius: 10px;
  font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  margin-top: 14px;
}
.btn-primary:hover:not(:disabled) {
  background: var(--violet-d);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(124,58,237,0.25);
}
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }

.btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  background: transparent; border: 1px solid var(--border); border-radius: 8px;
  font-family: inherit; font-size: 12px; font-weight: 600; color: var(--t2);
  cursor: pointer; transition: background 0.15s; white-space: nowrap;
}
.btn-ghost:hover { background: var(--bg); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Лейаут ─────────────── */
.split { display: grid; gap: 24px; grid-template-columns: 360px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.row   { display: flex; align-items: center; gap: 12px; }

/* ── Лоадер ─────────────── */
.loader {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 320px; gap: 14px; color: var(--t2);
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border); border-top-color: var(--violet);
  border-radius: 50%; animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loader-label { font-size: 14px; font-weight: 600; }
.loader-msg   { font-size: 13px; color: var(--t3); }

/* ── Пустой стейт ───────── */
.empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 300px;
  text-align: center; color: var(--t3); gap: 10px;
}
.empty-icon  { font-size: 36px; opacity: 0.35; }
.empty-title { font-size: 15px; font-weight: 600; color: var(--t2); }
.empty-text  { font-size: 13px; max-width: 260px; line-height: 1.6; }

/* ── Ошибка ──────────────── */
.error-box {
  padding: 13px 16px;
  background: rgba(239,68,68,0.07);
  border: 1px solid rgba(239,68,68,0.2);
  border-radius: 10px;
  color: #B91C1C; font-size: 13px; font-weight: 500;
}

/* ── URL-ввод ───────────── */
.mode-tabs {
  display: flex; gap: 4px;
  background: var(--bg); padding: 4px; border-radius: 10px;
  margin-bottom: 14px;
}
.mode-tab {
  flex: 1; padding: 8px;
  border: none; border-radius: 7px; background: transparent;
  font-family: inherit; font-size: 12px; font-weight: 600; color: var(--t3);
  cursor: pointer; transition: 0.15s;
}
.mode-tab.active {
  background: var(--surface); color: var(--t1);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.url-wrap { position: relative; }
.url-inp {
  width: 100%; padding: 12px 14px 12px 38px;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg); font-family: inherit; font-size: 13px; color: var(--t1);
  outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.url-inp:focus {
  border-color: var(--violet); background: var(--surface);
  box-shadow: 0 0 0 3px var(--violet-a);
}
.url-icon {
  position: absolute; left: 12px; top: 50%;
  transform: translateY(-50%); font-size: 14px; pointer-events: none;
}

.url-status {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 8px;
  font-size: 12px; font-weight: 500; margin-top: 8px;
}
.url-status.success { background: rgba(132,204,22,0.1); color: #3F6212; }
.url-status.error   { background: rgba(239,68,68,0.07); color: #B91C1C; }

.url-meta {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px; background: var(--bg); border-radius: 8px; margin-top: 6px;
}
.url-meta-domain { font-size: 12px; font-weight: 600; color: var(--t2); }
.url-meta-chars  { font-size: 11px; color: var(--t3); }

.url-hint { font-size: 11px; color: var(--t3); margin-top: 8px; line-height: 1.5; }

.preview-box {
  margin-top: 12px; padding: 10px 12px;
  background: var(--bg); border-radius: 8px;
  font-size: 12px; color: var(--t2); line-height: 1.5;
  max-height: 100px; overflow: hidden; position: relative;
}
.preview-fade {
  position: absolute; bottom: 0; left: 0; right: 0; height: 36px;
  background: linear-gradient(transparent, var(--bg));
}

/* ── Карточки трендов ───── */
.trend-grid { display: flex; flex-direction: column; gap: 16px; }

.trend-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r); padding: 20px;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.trend-card:hover {
  border-color: rgba(124,58,237,0.2);
  box-shadow: 0 4px 16px rgba(124,58,237,0.07);
}

.trend-header {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 12px; margin-bottom: 10px;
}
.trend-name { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--t1); line-height: 1.3; }

.score-pill {
  flex-shrink: 0; padding: 4px 10px;
  border-radius: 99px; font-size: 12px; font-weight: 700;
}
.score-high { background: rgba(132,204,22,0.15); color: #3F6212; }
.score-mid  { background: rgba(249,115,22,0.12);  color: #C2410C; }
.score-low  { background: rgba(148,163,184,0.15); color: var(--t2); }

.trend-hook {
  font-size: 13px; color: var(--t2); line-height: 1.6;
  margin-bottom: 12px; font-style: italic;
}

.trend-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.trend-meta-item { background: var(--bg); border-radius: 8px; padding: 10px 12px; }
.trend-meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); margin-bottom: 4px; }
.trend-meta-value { font-size: 12px; color: var(--t2); line-height: 1.4; }

/* ── Вердикт ─────────────── */
.verdict-banner {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; border-radius: var(--r); border: 1.5px solid;
  margin-bottom: 16px;
}
.verdict-icon {
  width: 38px; height: 38px; border-radius: 9px;
  display: grid; place-items: center;
  font-size: 17px; font-weight: 800;
  background: rgba(255,255,255,0.6); flex-shrink: 0;
}
.verdict-label  { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 3px; }
.verdict-reason { font-size: 13px; font-weight: 500; opacity: 0.8; }

/* Тон-мап */
.tone-row { margin-bottom: 12px; }
.tone-row:last-child { margin-bottom: 0; }
.tone-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--t2); margin-bottom: 5px; }
.tone-track  { position: relative; height: 5px; background: var(--bg); border-radius: 99px; }
.tone-mid    { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1.5px; background: var(--border); }
.tone-dot    {
  position: absolute; top: 50%;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--violet); border: 2px solid white;
  transform: translate(-50%, -50%);
  box-shadow: 0 1px 4px rgba(124,58,237,0.35);
  transition: left 0.5s cubic-bezier(0.34,1.56,0.64,1);
}

/* Шкала */
.score-big { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; line-height: 1; margin-bottom: 2px; }
.score-sub { font-size: 11px; color: var(--t3); margin-bottom: 10px; }

.badge-row { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { padding: 4px 9px; background: #FEE2E2; color: #B91C1C; font-size: 11px; font-weight: 600; border-radius: 6px; }

/* Сигналы доверия */
.trust-list { display: flex; flex-direction: column; gap: 6px; }
.trust-item { display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px; background: var(--bg); border-radius: 8px; font-size: 12px; color: var(--t2); border-left: 3px solid var(--red); line-height: 1.4; }

/* Контекст тренда */
.ctx-box { display: flex; gap: 10px; padding: 12px 14px; background: var(--sky-a); border: 1px solid var(--sky-b); border-radius: 10px; font-size: 13px; color: var(--t2); line-height: 1.55; }
.ctx-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }

/* Карточки переписи */
.rw-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.rw-tag  { display: inline-block; padding: 3px 8px; background: var(--violet-a); color: var(--violet); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border-radius: 5px; margin-bottom: 12px; }
.rw-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.rw-col-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--t3); margin-bottom: 5px; }
.rw-block { padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.55; border: 1px solid var(--border); background: var(--surface); color: var(--t2); }
.rw-block.local { background: var(--violet-a); border-color: rgba(124,58,237,0.2); color: var(--violet); font-weight: 500; }
.rw-reason { font-size: 12px; color: var(--t3); font-style: italic; padding-top: 10px; border-top: 1px solid var(--border-xs); }

/* ── Улучшение ───────────── */
.improve-result { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
.improve-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.improve-tab {
  padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--t2);
  cursor: pointer; transition: 0.15s;
}
.improve-tab.active { background: var(--violet); border-color: var(--violet); color: white; }
.improve-body { font-size: 14px; line-height: 1.75; color: var(--t1); white-space: pre-wrap; padding: 16px; background: var(--bg); border-radius: 10px; }
.change-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.change-item { padding: 12px 14px; border-radius: 8px; background: var(--bg); border-left: 3px solid var(--violet); }
.change-what { font-size: 13px; font-weight: 600; color: var(--t1); margin-bottom: 3px; }
.change-why  { font-size: 12px; color: var(--t2); }
.tone-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(132,204,22,0.1); border: 1px solid rgba(132,204,22,0.25); border-radius: 8px; font-size: 12px; font-weight: 600; color: #3F6212; margin-bottom: 16px; }

/* ── Тост ────────────────── */
.toast {
  position: fixed; bottom: 24px; right: 24px;
  background: var(--t1); color: #fff;
  padding: 11px 18px; border-radius: 10px;
  font-size: 13px; font-weight: 500;
  z-index: 200; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  animation: fadeUp 0.25s ease-out;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Адаптив ─────────────── */
@media (max-width: 860px) {
  .sidebar { display: none; }
  .split   { grid-template-columns: 1fr; }
  .grid2   { grid-template-columns: 1fr; }
  .page    { padding: 20px; }
}
`;

// ── Хелперы ───────────────────────────────────────────────────────────────────

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

// ── Компонент ─────────────────────────────────────────────────────────────────

export default function BreasonApp() {
  const [step,   setStep]   = useState<StepKey>("search");
  const [market, setMarket] = useState<MarketKey>("germany");

  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState(0);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  // Данные по шагам
  const [trends,        setTrends]        = useState<Trend[] | null>(null);
  const [evalResult,    setEvalResult]    = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);

  // Инпуты
  const [evalText,    setEvalText]    = useState(DEFAULT_COPY);
  const [improveText, setImproveText] = useState("");
  const [improveCtx,  setImproveCtx]  = useState("");
  const [improveTab,  setImproveTab]  = useState<"en" | "local">("local");

  // URL-режим
  const [inputMode,  setInputMode]  = useState<InputMode>("text");
  const [urlInput,   setUrlInput]   = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlStatus,  setUrlStatus]  = useState<UrlStatus | null>(null);

  const loadingMsgs = LOADING_MSGS[step];

  // Ротация сообщений загрузки
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadMsg(m => (m + 1) % loadingMsgs.length), 2200);
    return () => clearInterval(id);
  }, [loading, loadingMsgs.length]);

  // Автоскрытие тоста
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

  const copyText = (text: string, label = "Скопировано!") => {
    navigator.clipboard.writeText(text).then(() => showToast(`✓ ${label}`));
  };

  // ── API: загрузка по URL ───────────────────────────────────────────────────

  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlStatus(null);
    try {
      const res  = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUrlStatus({ type: "error", message: data.error || "Не удалось загрузить URL" });
        return;
      }
      setEvalText(data.text);
      setUrlStatus({
        type:      "success",
        message:   "Содержимое страницы успешно извлечено",
        domain:    data.domain,
        charCount: data.charCount,
        truncated: data.truncated,
      });
    } catch {
      setUrlStatus({ type: "error", message: "Ошибка сети. Проверьте соединение." });
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput]);

  // ── API: поиск трендов ────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    setLoading(true); setLoadMsg(0); setError(null); setTrends(null);
    try {
      const res  = await fetch(`/api/resonance-trends?market=${market}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сервера"); return; }
      setTrends(data.trends || []);
    } catch { setError("Ошибка сети. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }, [market]);

  // ── API: проверка ─────────────────────────────────────────────────────────

  const handleEvaluate = useCallback(async () => {
    if (!evalText.trim()) return;
    setLoading(true); setLoadMsg(0); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "evaluate", text: evalText.trim(), market }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сервера"); return; }
      if (!data.verdict) { setError("Неполный ответ ИИ. Попробуйте ещё раз."); return; }
      setEvalResult(data);
    } catch { setError("Ошибка сети. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }, [evalText, market]);

  // ── API: улучшение ────────────────────────────────────────────────────────

  const handleImprove = useCallback(async () => {
    const src = improveText.trim() || evalText.trim();
    if (!src) return;
    setLoading(true); setLoadMsg(0); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "improve", text: src, market, context: improveCtx }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сервера"); return; }
      if (!data.improved_text) { setError("Неполный ответ ИИ. Попробуйте ещё раз."); return; }
      setImproveResult(data);
    } catch { setError("Ошибка сети. Попробуйте ещё раз."); }
    finally   { setLoading(false); }
  }, [improveText, improveCtx, evalText, market]);

  // ── Рендер: тон-бар ──────────────────────────────────────────────────────

  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = ((val + 5) / 10) * 100;
    return (
      <div className="tone-row">
        <div className="tone-labels"><span>{labelL}</span><span>{labelR}</span></div>
        <div className="tone-track">
          <div className="tone-mid" />
          <div className="tone-dot" style={{ left: `${pct}%` }} />
        </div>
      </div>
    );
  };

  // ── Шаг 1: Поиск ─────────────────────────────────────────────────────────

  const renderSearch = () => (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="field-label">Что ищем</p>
        <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16, lineHeight: 1.6 }}>
          Сканируем рынок <strong>{MARKETS[market].flag} {MARKETS[market].labelRu}</strong> и находим 3 наиболее резонансных B2B-тренда за последние 90 дней — с анализом напряжения рынка и актуальностью прямо сейчас.
        </p>
        <button
          className="btn-primary"
          style={{ marginTop: 0 }}
          onClick={handleSearch}
          disabled={loading}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Сканирую...</>
            : `◎ Сканировать рынок ${MARKETS[market].labelRu}`
          }
        </button>
      </div>

      {loading && (
        <div className="loader">
          <div className="spinner" />
          <div className="loader-label">Анализирую B2B-ландшафт</div>
          <div className="loader-msg">{loadingMsgs[loadMsg]}</div>
        </div>
      )}

      {!loading && error && <div className="error-box">⚠ {error}</div>}

      {!loading && !error && !trends && (
        <div className="empty">
          <div className="empty-icon">◎</div>
          <div className="empty-title">Данных пока нет</div>
          <p className="empty-text">Нажмите «Сканировать», чтобы узнать, что резонирует на рынке {MARKETS[market].labelRu} прямо сейчас.</p>
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
                <p className="trend-hook">«{t.narrative_hook}»</p>
              )}
              <div className="trend-meta">
                <div className="trend-meta-item">
                  <div className="trend-meta-label">Напряжение рынка</div>
                  <div className="trend-meta-value">{t.market_tension}</div>
                </div>
                <div className="trend-meta-item">
                  <div className="trend-meta-label">Почему сейчас</div>
                  <div className="trend-meta-value">{t.why_now}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Шаг 2: Проверка ──────────────────────────────────────────────────────

  const renderEvaluate = () => (
    <div className="split">
      {/* Левая колонка: ввод */}
      <div className="card" style={{ position: "sticky", top: 72 }}>

        {/* Переключатель режима */}
        <div className="mode-tabs">
          <button
            className={`mode-tab ${inputMode === "text" ? "active" : ""}`}
            onClick={() => { setInputMode("text"); setUrlStatus(null); }}
          >
            ✏️ Вставить текст
          </button>
          <button
            className={`mode-tab ${inputMode === "url" ? "active" : ""}`}
            onClick={() => setInputMode("url")}
          >
            🔗 По ссылке
          </button>
        </div>

        {/* Режим URL */}
        {inputMode === "url" && (
          <div style={{ marginBottom: 14 }}>
            <p className="field-label">Адрес страницы</p>
            <div className="url-wrap">
              <span className="url-icon">🌐</span>
              <input
                className="url-inp"
                type="url"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlStatus(null); }}
                onKeyDown={e => e.key === "Enter" && handleFetchUrl()}
                placeholder="https://example.com/landing-page"
              />
            </div>

            <button
              className="btn-ghost"
              style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
              onClick={handleFetchUrl}
              disabled={urlLoading || !urlInput.trim()}
            >
              {urlLoading
                ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Извлекаю...</>
                : "Извлечь содержимое страницы →"
              }
            </button>

            {urlStatus && (
              <div className={`url-status ${urlStatus.type}`}>
                {urlStatus.type === "success" ? "✓" : "⚠"} {urlStatus.message}
              </div>
            )}

            {urlStatus?.type === "success" && (
              <div className="url-meta">
                <span className="url-meta-domain">📄 {urlStatus.domain}</span>
                <span className="url-meta-chars">
                  {urlStatus.charCount?.toLocaleString()} симв.
                  {urlStatus.truncated ? " (обрезано)" : ""}
                </span>
              </div>
            )}

            {!urlStatus && !urlLoading && (
              <p className="url-hint">
                Работает с публичными страницами. Сайты с авторизацией или на React/Next.js могут не загрузиться — вставьте текст вручную.
              </p>
            )}

            {urlStatus?.type === "success" && evalText && (
              <>
                <p className="field-label" style={{ marginTop: 12 }}>Предпросмотр извлечённого текста</p>
                <div className="preview-box">
                  {evalText.slice(0, 280)}...
                  <div className="preview-fade" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Режим текста */}
        {inputMode === "text" && (
          <>
            <p className="field-label">Ваш маркетинговый текст</p>
            <textarea
              className="inp"
              rows={9}
              value={evalText}
              onChange={e => setEvalText(e.target.value)}
              placeholder="Вставьте текст для проверки: заголовок, email, лендинг, CTA..."
            />
          </>
        )}

        {/* Редактирование после извлечения */}
        {inputMode === "url" && urlStatus?.type === "success" && (
          <>
            <p className="field-label" style={{ marginTop: 8 }}>Редактировать перед анализом (необязательно)</p>
            <textarea
              className="inp"
              rows={4}
              value={evalText}
              onChange={e => setEvalText(e.target.value)}
            />
          </>
        )}

        <button
          className="btn-primary"
          onClick={handleEvaluate}
          disabled={loading || !evalText.trim() || urlLoading}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Проверяю...</>
            : `◈ Проверить для ${MARKETS[market].flag} ${MARKETS[market].labelRu}`
          }
        </button>

        {evalResult && (
          <button
            className="btn-ghost"
            style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
            onClick={() => { setImproveText(evalText); switchStep("improve"); }}
          >
            ◆ Улучшить этот текст →
          </button>
        )}
      </div>

      {/* Правая колонка: результаты */}
      <div>
        {loading && (
          <div className="loader">
            <div className="spinner" />
            <div className="loader-label">Аудит контента</div>
            <div className="loader-msg">{loadingMsgs[loadMsg]}</div>
          </div>
        )}

        {!loading && error && <div className="error-box" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        {!loading && !evalResult && !error && (
          <div className="empty">
            <div className="empty-icon">◈</div>
            <div className="empty-title">Готов к проверке</div>
            <p className="empty-text">
              {inputMode === "url"
                ? "Вставьте ссылку, извлеките страницу и нажмите «Проверить»."
                : "Вставьте текст и нажмите «Проверить», чтобы выявить культурные ошибки и несоответствия тона."
              }
            </p>
          </div>
        )}

        {!loading && evalResult && (() => {
          const vc = VERDICT_CFG[evalResult.verdict];
          return (
            <div className="stack">
              {/* Вердикт */}
              <div className="verdict-banner" style={{ background: vc.bg, borderColor: vc.border, color: vc.color }}>
                <div className="verdict-icon">{vc.icon}</div>
                <div>
                  <div className="verdict-label">{evalResult.verdict} — {vc.label}</div>
                  <div className="verdict-reason">{evalResult.verdict_reason}</div>
                </div>
              </div>

              {/* Контекст тренда */}
              {evalResult.trend_context && (
                <div className="ctx-box">
                  <span className="ctx-icon">📡</span>
                  <span><strong>Сигнал рынка:</strong> {evalResult.trend_context}</span>
                </div>
              )}

              {/* Метрики */}
              <div className="grid2">
                <div className="card" style={{ margin: 0 }}>
                  <p className="field-label">Карта тона</p>
                  {renderToneBar("Формальный", "Неформальный", evalResult.tone_map.formal_casual)}
                  {renderToneBar("Дерзкий / Хайп", "Осторожный", evalResult.tone_map.bold_cautious)}
                  {renderToneBar("Технический", "Про пользу", evalResult.tone_map.technical_benefit)}
                  {renderToneBar("Абстрактный", "Конкретный", evalResult.tone_map.abstract_concrete)}
                  {renderToneBar("Переведённый", "Нативный", evalResult.tone_map.global_native)}
                </div>

                <div className="stack">
                  <div className="card" style={{ margin: 0 }}>
                    <p className="field-label">Индекс шаблонности</p>
                    <div className="score-big" style={{ color: scoreColor(evalResult.genericness_score) }}>
                      {evalResult.genericness_score}
                      <span style={{ fontSize: 16, color: "var(--t3)", fontWeight: 400 }}>/100</span>
                    </div>
                    <p className="score-sub">
                      {evalResult.genericness_score < 35 ? "Оригинально и локально" :
                       evalResult.genericness_score < 65 ? "Типичный SaaS-голос" : "Чистые US-клише"}
                    </p>
                    <div className="badge-row">
                      {evalResult.generic_phrases.map((p, i) => (
                        <span className="badge" key={i}>«{p}»</span>
                      ))}
                    </div>
                  </div>

                  <div className="card" style={{ margin: 0 }}>
                    <p className="field-label">Отсутствующие сигналы доверия</p>
                    <ul className="trust-list">
                      {evalResult.missing_trust_signals.map((s, i) => (
                        <li className="trust-item" key={i}><span>✕</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Варианты переписи */}
              <div>
                <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Предлагаемые правки</span>
                  <button className="btn-ghost" onClick={() => copyText(evalResult.brief_text, "Бриф скопирован!")}>
                    📋 Скопировать бриф
                  </button>
                </div>
                <div className="stack">
                  {evalResult.rewrites.map((rw, i) => (
                    <div className="rw-card" key={i}>
                      <div className="rw-tag">{rw.block}</div>
                      <div className="rw-cols">
                        <div>
                          <div className="rw-col-label">Оригинал</div>
                          <div className="rw-block">{rw.original}</div>
                        </div>
                        <div>
                          <div className="rw-col-label">Локализовано {MARKETS[market].flag}</div>
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

  // ── Шаг 3: Улучшение ─────────────────────────────────────────────────────

  const renderImprove = () => (
    <div className="split">
      {/* Левая колонка: ввод */}
      <div className="card" style={{ position: "sticky", top: 72 }}>
        <p className="field-label">Текст для улучшения</p>
        <textarea
          className="inp"
          rows={7}
          value={improveText || evalText}
          onChange={e => setImproveText(e.target.value)}
          placeholder="Вставьте текст или он перенесётся из шага «Проверка»..."
        />

        <p className="field-label" style={{ marginTop: 14 }}>Контекст (необязательно)</p>
        <textarea
          className="inp"
          rows={3}
          value={improveCtx}
          onChange={e => setImproveCtx(e.target.value)}
          placeholder="Контекст тренда, позиционирование продукта, целевая персона..."
        />

        <button
          className="btn-primary"
          onClick={handleImprove}
          disabled={loading || !(improveText.trim() || evalText.trim())}
        >
          {loading
            ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Переписываю...</>
            : `◆ Улучшить для ${MARKETS[market].flag} ${MARKETS[market].labelRu}`
          }
        </button>
      </div>

      {/* Правая колонка: результаты */}
      <div>
        {loading && (
          <div className="loader">
            <div className="spinner" />
            <div className="loader-label">Переписываю для {MARKETS[market].labelRu}</div>
            <div className="loader-msg">{loadingMsgs[loadMsg]}</div>
          </div>
        )}

        {!loading && error && <div className="error-box" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        {!loading && !improveResult && !error && (
          <div className="empty">
            <div className="empty-icon">◆</div>
            <div className="empty-title">Готов к улучшению</div>
            <p className="empty-text">Текст будет полностью переписан так, чтобы звучать нативно и убедительно для {MARKETS[market].labelRu}.</p>
          </div>
        )}

        {!loading && improveResult && (
          <div className="stack">
            <div className="tone-tag">
              ✓ {improveResult.tone_achieved}
            </div>

            <div className="improve-result">
              <div className="improve-tabs">
                <button
                  className={`improve-tab ${improveTab === "local" ? "active" : ""}`}
                  onClick={() => setImproveTab("local")}
                >
                  {MARKETS[market].flag} Локальный
                </button>
                <button
                  className={`improve-tab ${improveTab === "en" ? "active" : ""}`}
                  onClick={() => setImproveTab("en")}
                >
                  English
                </button>
                <button
                  className="btn-ghost"
                  style={{ marginLeft: "auto" }}
                  onClick={() => copyText(
                    improveTab === "local" ? improveResult.improved_local : improveResult.improved_text,
                    "Текст скопирован!"
                  )}
                >
                  📋 Скопировать
                </button>
              </div>
              <div className="improve-body">
                {improveTab === "local" ? improveResult.improved_local : improveResult.improved_text}
              </div>
            </div>

            {improveResult.changes?.length > 0 && (
              <div>
                <p className="field-label" style={{ marginBottom: 8 }}>Что изменено и почему</p>
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

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="shell">
      <style>{STYLE}</style>

      {/* Сайдбар */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">B</div>
          Breason
        </div>

        <p className="sb-label">Рабочий процесс</p>
        <nav className="nav-list">
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button
              key={key}
              className={`nav-btn ${step === key ? "active" : ""}`}
              onClick={() => switchStep(key)}
            >
              <div className="nav-num">{s.num}</div>
              <div className="nav-info">
                <div className="nav-label">{s.label}</div>
                <div className="nav-hint">{s.hint}</div>
              </div>
            </button>
          ))}
        </nav>

        <p className="sb-label">Целевой рынок</p>
        <div className="mkt-list">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
            <button
              key={key}
              className={`mkt-btn ${market === key ? "active" : ""}`}
              onClick={() => setMarket(key)}
            >
              <span className="mkt-flag">{m.flag}</span>
              <span className="mkt-name">{m.labelRu}</span>
            </button>
          ))}
        </div>

        <div className="sb-footer">
          Breason v2.0<br />
          <span style={{ opacity: 0.5 }}>Не перевод. Резонанс.</span>
        </div>
      </aside>

      {/* Основная область */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-badge">{STEPS[step].num}</span>
            <span className="topbar-title">
              {STEPS[step].label} — {MARKETS[market].flag} {MARKETS[market].labelRu}
            </span>
          </div>
          {(evalResult || improveResult || trends) && (
            <button className="btn-ghost" onClick={() => {
              setTrends(null);
              setEvalResult(null);
              setImproveResult(null);
              setError(null);
              setUrlStatus(null);
            }}>
              ↺ Сбросить
            </button>
          )}
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
