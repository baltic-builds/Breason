"use client";

import { useState, useEffect, useRef } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey     = "germany" | "poland" | "brazil";
type StepKey       = "search" | "evaluate" | "improve";
type VerdictType   = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode     = "text" | "url";
type StyleModifier = "none" | "friendly" | "professional" | "concise";

interface NewsItem {
  headline:        string;
  topic:           string;   // группировка
  category:        string;
  summary:         string;
  business_impact: string;
  resonance_score: number;
}

interface ToneMap        { formal_casual: number; bold_cautious: number; technical_benefit: number; abstract_concrete: number; global_native: number; }
interface Rewrite        { block: string; original: string; suggested: string; suggested_local: string; reason: string; }
interface EvaluateResult { verdict: VerdictType; verdict_reason: string; genericness_score: number; generic_phrases: string[]; tone_map: ToneMap; missing_trust_signals: string[]; trend_context: string; rewrites: Rewrite[]; brief_text: string; }
interface ImproveResult  { improved_text: string; improved_local: string; changes: { what: string; why: string }[]; tone_achieved: string; }

// Кастомные промпты — хранятся в localStorage
interface CustomPrompts {
  search:   string;
  evaluate: string;
  improve:  string;
}

const DEFAULT_PROMPTS: CustomPrompts = { search: "", evaluate: "", improve: "" };

// ── Константы ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { labelRu: string; flag: string; desc: string }> = {
  germany: { labelRu: "Германия",  flag: "🇩🇪", desc: "Формальный · Точный · Процессный" },
  poland:  { labelRu: "Польша",    flag: "🇵🇱", desc: "Прямой · Фактический · Прозрачный" },
  brazil:  { labelRu: "Бразилия",  flag: "🇧🇷", desc: "Тёплый · Человечный · Доверительный" },
};

const STEPS: Record<StepKey, { num: string; label: string }> = {
  search:   { num: "01", label: "Поиск трендов" },
  evaluate: { num: "02", label: "Оценка контента" },
  improve:  { num: "03", label: "Улучшение (AI)" },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально"    },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как перевод" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Чужеродный контент" },
};

const DEFAULT_COPY = `Unlock efficiency with our all-in-one AI platform. It's a revolutionary game-changer for your enterprise. Start your free trial today and 10x your productivity seamlessly!`;

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Смотрим рынок...", "Опрашиваем экспертов...", "Звоним инсайдерам...", "Готовим ответ..."],
  evaluate: ["Анализируем культурный код...", "Ищем сигналы доверия...", "Считаем индекс клише...", "Генерируем советы..."],
  improve:  ["Применяем профиль рынка...", "Переписываем текст...", "Полируем нативный тон..."],
};

const FUNNY_QUOTES = [
  "Работайте на скупого, он платит дважды",
  "Встречайтесь со стоматологом. Это выгодно",
  "Не хватает на отпуск? Отдыхайте на работе",
  "Если хотите удвоить деньги, то сложите их пополам",
  "Зарабатывайте больше, и доход вырастет",
  "Если на карте нет денег, то платите наличными",
  "Тратьте деньги с умом: сначала чужие, а только потом – свои",
];

const PROMPT_LABELS: Record<keyof CustomPrompts, string> = {
  search:   "Поиск трендов",
  evaluate: "Оценка контента",
  improve:  "Улучшение текста",
};

const PROMPT_PLACEHOLDERS: Record<keyof CustomPrompts, string> = {
  search:   "Пример: Фокусируйся только на стартапах, игнорируй enterprise-тренды. Добавляй конкретные примеры компаний...",
  evaluate: "Пример: Дополнительно проверяй наличие социального доказательства (кейсы, цифры). Будь строже к абстрактным формулировкам...",
  improve:  "Пример: Текст должен звучать как личное письмо от CEO, а не корпоративная рассылка. Используй местоимение «ты»...",
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet: #7C3AED; --violet-d: #6D28D9; --violet-a: rgba(124,58,237,0.1);
  --lime: #84CC16; --lime-a: rgba(132,204,22,0.12); --lime-d: #65A30D;
  --orange: #F97316; --orange-d: #EA6C0A; --orange-a: rgba(249,115,22,0.1);
  --red: #EF4444;
  --bg: #F1F5F9; --surface: #FFFFFF;
  --t1: #0F172A; --t2: #475569; --t3: #94A3B8;
  --border: rgba(15,23,42,0.1); --border-xs: rgba(15,23,42,0.05);
  --r: 14px; --r-sm: 10px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--t1); line-height: 1.5; }

/* ── SHELL & SIDEBAR ── */
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 50; transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); }
.logo { display: flex; align-items: center; gap: 9px; font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; color: var(--t1); margin-bottom: 28px; cursor: pointer; transition: opacity 0.2s; background: none; border: none; }
.logo:hover { opacity: 0.8; }
.logo-mark { width: 26px; height: 26px; background: var(--lime); border-radius: 6px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #1a2e05; flex-shrink: 0; }
.nav-btn { display: flex; align-items: center; gap: 9px; padding: 10px; border: none; border-radius: 9px; background: transparent; cursor: pointer; width: 100%; text-align: left; font-family: inherit; transition: 0.15s; margin-bottom: 4px; }
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }
.nav-num { width: 22px; height: 22px; border-radius: 5px; background: var(--bg); font-size: 9px; font-weight: 800; color: var(--t3); display: grid; place-items: center; font-family: 'Syne', sans-serif; flex-shrink: 0; }
.nav-btn.active .nav-num { background: var(--violet); color: white; }
.nav-label { font-size: 12px; font-weight: 600; color: var(--t2); white-space: nowrap; }
.nav-btn.active .nav-label { color: var(--violet); font-weight: 700; }
.sb-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-xs); font-size: 10px; color: var(--t3); line-height: 1.7; }

/* ── MAIN & TOPBAR ── */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); height: 56px; display: flex; align-items: center; padding: 0 24px; position: sticky; top: 0; z-index: 40; justify-content: space-between; gap: 12px; }
.topbar-left  { display: flex; align-items: center; gap: 12px; min-width: 0; }
.topbar-title { font-size: 13px; font-weight: 600; color: var(--t2); white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ── HAMBURGER ── */
.hamburger { display: none; align-items: center; justify-content: center; width: 36px; height: 36px; border: none; border-radius: 8px; background: transparent; cursor: pointer; color: var(--t2); flex-shrink: 0; transition: background 0.15s; }
.hamburger:hover { background: var(--bg); }

/* ── MARKET BUTTON ── */
.market-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; background: var(--orange); color: #fff; border: none; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.15s; white-space: nowrap; box-shadow: 0 2px 8px rgba(249,115,22,0.25); }
.market-btn:hover { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(249,115,22,0.35); }

/* ── SETTINGS BUTTON ── */
.settings-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 11px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 600; color: var(--t2); cursor: pointer; transition: 0.15s; white-space: nowrap; }
.settings-btn:hover { background: var(--bg); border-color: var(--violet); color: var(--violet); }
.settings-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); margin-left: 2px; }

/* ── MARKET DROPDOWN ── */
.market-dropdown-wrap { position: relative; }
.market-dropdown { position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 6px; box-shadow: 0 12px 40px rgba(0,0,0,0.12); min-width: 210px; z-index: 100; animation: dropIn 0.15s ease-out; }
@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.market-option { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; border: none; background: transparent; width: 100%; text-align: left; font-family: inherit; transition: background 0.12s; }
.market-option:hover { background: var(--bg); }
.market-option.active { background: var(--orange-a); }
.market-option-flag { font-size: 20px; }
.market-option-name { font-size: 13px; font-weight: 700; color: var(--t1); }
.market-option-desc { font-size: 11px; color: var(--t3); margin-top: 1px; }
.market-option-check { margin-left: auto; color: var(--orange); font-weight: 800; }

/* ── OVERLAY ── */
.overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 45; }
.overlay.show { display: block; }

/* ── MODAL (Settings) ── */
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: var(--surface); border-radius: var(--r); padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.18); }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: var(--t1); }
.modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: var(--bg); cursor: pointer; font-size: 16px; color: var(--t2); display: flex; align-items: center; justify-content: center; transition: 0.15s; }
.modal-close:hover { background: var(--border); }
.modal-subtitle { font-size: 13px; color: var(--t3); margin-bottom: 24px; line-height: 1.5; }
.modal-section { margin-bottom: 20px; }
.modal-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--t2); margin-bottom: 6px; display: block; }
.modal-textarea { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: monospace; font-size: 12px; line-height: 1.6; color: var(--t1); resize: vertical; outline: none; min-height: 90px; transition: 0.15s; }
.modal-textarea:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px var(--violet-a); }
.modal-textarea.has-value { border-color: var(--orange); background: var(--orange-a); }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-xs); }
.modal-hint { font-size: 11px; color: var(--t3); margin-top: 5px; line-height: 1.5; }

/* ── PAGE ── */
.page { flex: 1; padding: 28px; max-width: 1200px; width: 100%; margin: 0 auto; }

/* ── CARDS ── */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
.field-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--t3); margin-bottom: 10px; }
.split { display: grid; gap: 24px; grid-template-columns: 380px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stack { display: flex; flex-direction: column; gap: 16px; }

/* ── SEARCH STEP ── */
.market-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.market-card { padding: 16px; border: 2px solid var(--border-xs); border-radius: var(--r); background: var(--surface); cursor: pointer; text-align: center; transition: 0.15s; font-family: inherit; }
.market-card:hover { border-color: var(--border); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.market-card.active { border-color: var(--lime); background: var(--lime-a); box-shadow: 0 4px 16px rgba(132,204,22,0.15); }
.market-card-flag { font-size: 32px; display: block; margin-bottom: 8px; }
.market-card-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--t1); margin-bottom: 4px; }
.market-card-desc { font-size: 11px; color: var(--t3); line-height: 1.4; }

/* Keyword input row */
.keyword-row { display: flex; gap: 10px; margin-bottom: 16px; }
.keyword-input { flex: 1; padding: 11px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 13px; color: var(--t1); outline: none; transition: 0.15s; }
.keyword-input:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px var(--violet-a); }
.keyword-input::placeholder { color: var(--t3); }
.keyword-clear { padding: 0 12px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); font-size: 18px; color: var(--t3); cursor: pointer; transition: 0.15s; }
.keyword-clear:hover { background: var(--bg); color: var(--t1); }

/* ── BUTTONS ── */
.btn-primary { width: 100%; padding: 14px; background: var(--orange); color: #fff; border: none; border-radius: var(--r-sm); font-size: 14px; font-weight: 700; cursor: pointer; transition: 0.15s; display: flex; justify-content: center; align-items: center; gap: 8px; font-family: inherit; }
.btn-primary:hover:not(:disabled) { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,0.25); }
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }
.btn-primary.violet { background: var(--violet); }
.btn-primary.violet:hover:not(:disabled) { background: var(--violet-d); box-shadow: 0 6px 20px rgba(124,58,237,0.25); }
.btn-action { padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--t1); cursor: pointer; transition: 0.15s; font-family: inherit; }
.btn-action:hover { background: var(--bg); border-color: var(--violet); color: var(--violet); }
.btn-action.active { background: var(--violet); color: #fff; border-color: var(--violet); }
.btn-ghost { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--t2); cursor: pointer; transition: 0.15s; }
.btn-ghost:hover { background: var(--bg); }
.btn-sticky { background: var(--t1); color: #fff; padding: 14px 28px; border-radius: 99px; font-weight: 700; font-size: 14px; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.2); transition: 0.2s; display: flex; align-items: center; gap: 8px; font-family: inherit; }
.btn-sticky:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }

/* ── INPUTS ── */
.inp { width: 100%; padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 13px; line-height: 1.65; color: var(--t1); resize: vertical; outline: none; transition: 0.15s; min-height: 100px; }
.inp:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px var(--violet-a); }
input.inp { min-height: auto; resize: none; }

/* ── TOPIC GROUP ── */
.topic-section { margin-bottom: 28px; }
.topic-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.topic-label { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: var(--t3); }
.topic-line { flex: 1; height: 1px; background: var(--border-xs); }
.topic-count { font-size: 10px; font-weight: 700; color: var(--t3); background: var(--bg); padding: 2px 7px; border-radius: 99px; }
.news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }

/* ── NEWS CARD ── */
.news-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: 0.2s; }
.news-card:hover { border-color: rgba(124,58,237,0.2); box-shadow: 0 8px 24px rgba(124,58,237,0.08); transform: translateY(-2px); }
.news-headline { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--t1); line-height: 1.35; }
.news-summary { font-size: 12px; color: var(--t2); line-height: 1.6; flex: 1; }
.news-card-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.news-category { font-size: 10px; font-weight: 700; color: var(--violet); background: var(--violet-a); padding: 3px 8px; border-radius: 4px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; }
.news-score { font-size: 11px; font-weight: 700; color: var(--lime-d); white-space: nowrap; flex-shrink: 0; }

/* Кнопка тренда — одна, чёткая */
.btn-use-trend { width: 100%; padding: 10px; margin-top: auto; background: var(--t1); color: #fff; border: none; border-radius: 8px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px; }
.btn-use-trend:hover { background: var(--violet); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,58,237,0.3); }

/* keyword focus badge */
.keyword-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: var(--orange-a); border: 1px solid rgba(249,115,22,0.3); border-radius: 99px; font-size: 12px; font-weight: 600; color: var(--orange-d); margin-bottom: 16px; }

/* ── EVALUATE ── */
.context-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--lime-a); border: 1px solid var(--lime); color: var(--lime-d); border-radius: 99px; font-size: 11px; font-weight: 700; margin-bottom: 12px; }
.tone-row { margin-bottom: 12px; }
.tone-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--t2); margin-bottom: 5px; }
.tone-track { position: relative; height: 6px; background: var(--bg); border-radius: 99px; }
.tone-mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: var(--border); }
.tone-dot { position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%; background: var(--violet); border: 2px solid white; transform: translate(-50%, -50%); box-shadow: 0 2px 6px rgba(124,58,237,0.4); transition: left 0.6s cubic-bezier(0.34,1.56,0.64,1); }
.badge { padding: 4px 10px; background: #FEE2E2; color: #B91C1C; font-size: 11px; font-weight: 600; border-radius: 6px; margin: 0 6px 6px 0; display: inline-block; }
.trust-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; background: var(--bg); border-radius: 8px; font-size: 12px; color: var(--t2); border-left: 3px solid var(--red); line-height: 1.4; margin-bottom: 8px; }
.rw-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.rw-block { padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.5; border: 1px solid var(--border); background: var(--surface); color: var(--t2); margin-bottom: 8px; }
.rw-block.local { background: var(--violet-a); border-color: rgba(124,58,237,0.2); color: var(--violet); font-weight: 500; }
.sticky-footer { position: sticky; bottom: 0; padding: 16px 0; background: linear-gradient(transparent, var(--bg) 20%); margin-top: 24px; display: flex; justify-content: flex-end; z-index: 10; }

/* ── LOADER ── */
.stream-loader { font-family: monospace; font-size: 13px; color: var(--violet); background: var(--violet-a); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; }
.stream-line { display: flex; align-items: center; gap: 8px; animation: fadeIn 0.3s ease-out; }
.blink { animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

/* ── MOBILE ── */
@media (max-width: 900px) {
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.08); }
  .sidebar.open { transform: translateX(0); }
  .overlay.show { display: block; }
  .hamburger { display: flex; }
  .topbar { padding: 0 16px; }
  .page { padding: 16px 16px 40px; }
  .market-selector { grid-template-columns: 1fr; gap: 8px; }
  .market-card { display: flex; align-items: center; gap: 14px; text-align: left; padding: 14px; }
  .market-card-flag { font-size: 26px; margin-bottom: 0; flex-shrink: 0; }
  .news-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .split { grid-template-columns: 1fr; gap: 16px; }
  .split > div:first-child { position: static !important; }
  .grid2 { grid-template-columns: 1fr; }
  .modal { padding: 20px; }
}
@media (max-width: 560px) {
  .news-grid { grid-template-columns: 1fr; }
  .topbar-title { display: none; }
  .settings-btn span { display: none; }
}
`;

// ── Подкомпоненты ─────────────────────────────────────────────────────────────

const ProgressStream = ({ steps, activeIdx, quoteIdx }: { steps: string[]; activeIdx: number; quoteIdx: number }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div className="stream-loader">
      {steps.map((s, i) => {
        if (i > activeIdx) return null;
        const cur = i === activeIdx;
        return (
          <div key={i} className="stream-line" style={{ opacity: cur ? 1 : 0.5 }}>
            <span>{cur ? <span className="blink">▶</span> : "✓"}</span>
            <span>{s}</span>
          </div>
        );
      })}
    </div>
    <div style={{ textAlign: "center", fontStyle: "italic", fontSize: 13, color: "var(--t3)" }}>
      💡 {FUNNY_QUOTES[quoteIdx]}
    </div>
  </div>
);

// Market picker dropdown
const MarketPicker = ({ market, onChange }: { market: MarketKey; onChange: (m: MarketKey) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const m = MARKETS[market];
  return (
    <div className="market-dropdown-wrap" ref={ref}>
      <button className="market-btn" onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 15 }}>{m.flag}</span>
        <span>{m.labelRu}</span>
        <span style={{ fontSize: 9, opacity: 0.8 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="market-dropdown">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, data]) => (
            <button key={key} className={`market-option ${key === market ? "active" : ""}`}
              onClick={() => { onChange(key); setOpen(false); }}>
              <span className="market-option-flag">{data.flag}</span>
              <div>
                <div className="market-option-name">{data.labelRu}</div>
                <div className="market-option-desc">{data.desc}</div>
              </div>
              {key === market && <span className="market-option-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Settings Modal ────────────────────────────────────────────────────────────

const SettingsModal = ({
  prompts, onSave, onClose,
}: {
  prompts: CustomPrompts;
  onSave: (p: CustomPrompts) => void;
  onClose: () => void;
}) => {
  const [local, setLocal] = useState<CustomPrompts>({ ...prompts });
  const hasChanges = (Object.keys(local) as (keyof CustomPrompts)[]).some(k => local[k] !== prompts[k]);
  const hasAny     = (Object.keys(local) as (keyof CustomPrompts)[]).some(k => local[k].trim().length > 0);

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">⚙️ Настройки промптов</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-subtitle">
          Добавьте дополнительные инструкции к системным промптам ИИ. Поля оставьте пустыми, чтобы использовать настройки по умолчанию. Сохраняются в браузере.
        </p>

        {(Object.keys(local) as (keyof CustomPrompts)[]).map(key => (
          <div key={key} className="modal-section">
            <label className="modal-section-label">
              {PROMPT_LABELS[key]}
              {local[key].trim() && <span style={{ marginLeft: 6, color: "var(--orange)", fontSize: 9 }}>● АКТИВНО</span>}
            </label>
            <textarea
              className={`modal-textarea ${local[key].trim() ? "has-value" : ""}`}
              value={local[key]}
              onChange={e => setLocal(p => ({ ...p, [key]: e.target.value }))}
              placeholder={PROMPT_PLACEHOLDERS[key]}
            />
            <p className="modal-hint">
              {key === "search" && "Добавляется к промпту поиска трендов. Влияет на выбор и фокус тем."}
              {key === "evaluate" && "Добавляется к промпту оценки контента. Влияет на строгость и критерии."}
              {key === "improve" && "Добавляется к промпту улучшения текста. Влияет на стиль результата."}
            </p>
          </div>
        ))}

        <div className="modal-footer">
          {hasAny && (
            <button className="btn-ghost" onClick={() => setLocal(DEFAULT_PROMPTS)} style={{ marginRight: "auto" }}>
              Сбросить всё
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
          <button
            className="btn-primary violet"
            style={{ width: "auto", padding: "10px 24px" }}
            onClick={() => { onSave(local); onClose(); }}
          >
            {hasChanges ? "Сохранить" : "Закрыть"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Главный компонент ─────────────────────────────────────────────────────────

export default function BreasonApp() {
  const [step,         setStep]         = useState<StepKey>("search");
  const [market,       setMarket]       = useState<MarketKey>("germany");
  const [inputMode,    setInputMode]    = useState<InputMode>("text");
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [globalText,    setGlobalText]    = useState(DEFAULT_COPY);
  const [selectedTrend, setSelectedTrend] = useState("");
  const [styleModifier, setStyleModifier] = useState<StyleModifier>("none");
  const [keyword,       setKeyword]       = useState("");

  // Кастомные промпты — загружаем из localStorage после гидрации
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>(DEFAULT_PROMPTS);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("breason_prompts");
      if (saved) setCustomPrompts(JSON.parse(saved));
    } catch {}
  }, []);

  const savePrompts = (p: CustomPrompts) => {
    setCustomPrompts(p);
    try { localStorage.setItem("breason_prompts", JSON.stringify(p)); } catch {}
  };

  const hasCustomPrompts = Object.values(customPrompts).some(v => v.trim().length > 0);

  const [loading,        setLoading]        = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [quoteIdx,       setQuoteIdx]       = useState(0);
  const [error,          setError]          = useState<string | null>(null);

  const [newsItems,     setNewsItems]     = useState<NewsItem[] | null>(null);
  const [keywordFocus,  setKeywordFocus]  = useState("");  // запомненное keyword при поиске
  const [evalResult,    setEvalResult]    = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const [urlInput,      setUrlInput]      = useState("");

  // Лоадер-таймеры
  useEffect(() => {
    if (!loading) return;
    setLoadingStepIdx(0);
    setQuoteIdx(Math.floor(Math.random() * FUNNY_QUOTES.length));
    const li = setInterval(() => setLoadingStepIdx(p => Math.min(p + 1, 3)), 1500);
    const qi = setInterval(() => setQuoteIdx(p => (p + 1) % FUNNY_QUOTES.length), 4000);
    return () => { clearInterval(li); clearInterval(qi); };
  }, [loading]);

  const switchStep = (s: StepKey) => { setStep(s); setSidebarOpen(false); setError(null); };
  const resetToHome = () => {
    setStep("search"); setNewsItems(null); setEvalResult(null);
    setImproveResult(null); setSelectedTrend(""); setGlobalText(DEFAULT_COPY);
    setSidebarOpen(false); setKeyword(""); setKeywordFocus("");
  };

  // ── API ────────────────────────────────────────────────────────────────────

  const handleFetchUrl = async () => {
    if (!urlInput) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/fetch-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput }) });
      const data = await res.json();
      if (data.text) setGlobalText(data.text);
      else setError(data.error || "Ошибка парсинга URL");
    } catch { setError("Ошибка сети"); }
    finally   { setLoading(false); }
  };

  const handleSearch = async () => {
    setLoading(true); setError(null); setNewsItems(null);
    const kw = keyword.trim();
    setKeywordFocus(kw);
    try {
      // Используем POST action=search для передачи keyword + customPrompts
      const res  = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          market,
          keyword: kw || undefined,
          customPrompts: { search: customPrompts.search },
        }),
      });
      const data = await res.json();
      setNewsItems(data.items || []);
    } catch { setError("Не удалось загрузить тренды."); }
    finally   { setLoading(false); }
  };

  // Единственная кнопка на карточке тренда — чёткое действие
  const handleUseTrend = (headline: string) => {
    setSelectedTrend(headline);
    switchStep("evaluate");
  };

  const handleEvaluate = async () => {
    if (!globalText.trim()) return;
    setLoading(true); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate", text: globalText, market,
          trendContext: selectedTrend || undefined,
          customPrompts: { evaluate: customPrompts.evaluate },
        }),
      });
      const data = await res.json();
      if (data.verdict) setEvalResult(data);
      else setError("ИИ вернул неполные данные.");
    } catch { setError("Ошибка при анализе."); }
    finally   { setLoading(false); }
  };

  const handleImprove = async () => {
    setLoading(true); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "improve", text: globalText, market,
          context: selectedTrend || undefined,
          styleModifier,
          customPrompts: { improve: customPrompts.improve },
        }),
      });
      const data = await res.json();
      if (data.improved_text) setImproveResult(data);
      else setError("Не удалось сгенерировать текст.");
    } catch { setError("Ошибка генерации."); }
    finally   { setLoading(false); }
  };

  const handleCheckAgain = () => {
    if (improveResult?.improved_text) {
      setGlobalText(improveResult.improved_text);
      setImproveResult(null); setEvalResult(null); switchStep("evaluate");
    }
  };

  // ── Группировка трендов по topic ──────────────────────────────────────────
  const groupedTrends = (newsItems || []).reduce<Record<string, NewsItem[]>>((acc, item) => {
    const key = item.topic || "Общее";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Tone bar
  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = Math.max(0, Math.min(100, ((val + 5) / 10) * 100));
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

  // ── ШАГ 1: Поиск ─────────────────────────────────────────────────────────
  const renderSearch = () => (
    <div className="stack">
      <div className="card">
        <p className="field-label">1. Целевой рынок</p>
        <div className="market-selector">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
            <button key={key} className={`market-card ${market === key ? "active" : ""}`} onClick={() => setMarket(key)}>
              <span className="market-card-flag">{m.flag}</span>
              <div className="market-card-name">{m.labelRu}</div>
              <div className="market-card-desc">{m.desc}</div>
            </button>
          ))}
        </div>

        <p className="field-label" style={{ marginTop: 16 }}>2. Ключевое слово (необязательно)</p>
        <div className="keyword-row">
          <input
            className="keyword-input"
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !loading && handleSearch()}
            placeholder="Например: AI, SaaS, логистика, финтех..."
            maxLength={80}
          />
          {keyword && (
            <button className="keyword-clear" onClick={() => setKeyword("")} title="Очистить">×</button>
          )}
        </div>

        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "Анализ рынка..." : `Найти 12 трендов — ${MARKETS[market].labelRu} ${MARKETS[market].flag}`}
        </button>
      </div>

      {loading && <ProgressStream steps={LOADING_MSGS.search} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
      {!loading && error && (
        <div style={{ color: "var(--red)", padding: "12px 16px", background: "rgba(239,68,68,0.06)", borderRadius: 8 }}>{error}</div>
      )}

      {/* Результаты — сгруппированные по темам */}
      {!loading && newsItems && newsItems.length > 0 && (
        <div>
          {keywordFocus && (
            <div className="keyword-badge">
              🔍 Фокус: «{keywordFocus}»
              <span style={{ opacity: 0.6, cursor: "pointer", marginLeft: 4 }} onClick={() => setKeyword("")}>✕</span>
            </div>
          )}

          {Object.entries(groupedTrends).map(([topic, items]) => (
            <div key={topic} className="topic-section">
              <div className="topic-header">
                <span className="topic-label">{topic}</span>
                <div className="topic-line" />
                <span className="topic-count">{items.length}</span>
              </div>

              <div className="news-grid">
                {items.map((item, i) => (
                  <div className="news-card" key={i}>
                    <div className="news-card-top">
                      <span className="news-category">{item.category}</span>
                      <span className="news-score">↑ {item.resonance_score}</span>
                    </div>
                    <h3 className="news-headline">{item.headline}</h3>
                    <p className="news-summary">{item.summary}</p>
                    <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, padding: "8px 10px", background: "var(--bg)", borderRadius: 6, borderLeft: "2px solid var(--orange)" }}>
                      {item.business_impact}
                    </p>
                    {/* Единственная чёткая CTA */}
                    <button className="btn-use-trend" onClick={() => handleUseTrend(item.headline)}>
                      Проверить мой текст под этот тренд →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── ШАГ 2: Оценка ────────────────────────────────────────────────────────
  const renderEvaluate = () => (
    <div className="split">
      <div className="stack" style={{ position: "sticky", top: 68 }}>
        <div className="card">
          <p className="field-label">Контекст проверки</p>
          {selectedTrend ? (
            <div className="context-pill">
              🎯 {selectedTrend.length > 40 ? selectedTrend.slice(0, 40) + "…" : selectedTrend}
              <span style={{ cursor: "pointer", marginLeft: 6, opacity: 0.6 }} onClick={() => setSelectedTrend("")}>✕</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>Без тренда — общая оценка.</div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={`btn-action ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")} style={{ flex: 1 }}>Текст</button>
            <button className={`btn-action ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")} style={{ flex: 1 }}>URL</button>
          </div>

          {inputMode === "url" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input className="inp" style={{ padding: "10px", flex: 1, margin: 0 }} placeholder="https://" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFetchUrl()} />
              <button className="btn-action" onClick={handleFetchUrl} disabled={loading}>Парсить</button>
            </div>
          )}

          <p className="field-label">Маркетинговый контент</p>
          <textarea className="inp" rows={7} value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="Вставьте текст..." />

          <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !globalText.trim()} style={{ marginTop: 16 }}>
            {loading ? "Аудит..." : `Оценить для ${MARKETS[market].flag} ${MARKETS[market].labelRu}`}
          </button>
        </div>
      </div>

      <div className="stack">
        {loading && <ProgressStream steps={LOADING_MSGS.evaluate} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
        {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
        {!loading && !evalResult && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>
            <div style={{ fontSize: 40, opacity: 0.15, marginBottom: 16 }}>◈</div>
            <p>Вставьте текст и нажмите «Оценить».</p>
          </div>
        )}

        {!loading && evalResult && (() => {
          const vc = VERDICT_CFG[evalResult.verdict];
          return (
            <>
              <div className="card" style={{ background: vc.bg, borderColor: vc.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 22, color: vc.color, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", flexShrink: 0 }}>{vc.icon}</div>
                  <div>
                    <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 20, color: vc.color, margin: 0 }}>{evalResult.verdict} — {vc.label}</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--t1)" }}>{evalResult.verdict_reason}</p>
                  </div>
                </div>
              </div>

              <div className="grid2">
                <div className="card">
                  <p className="field-label">Карта тона</p>
                  {renderToneBar("Формальный", "Кэжуал", evalResult.tone_map.formal_casual)}
                  {renderToneBar("Дерзкий", "Осторожный", evalResult.tone_map.bold_cautious)}
                  {renderToneBar("Технический", "Про пользу", evalResult.tone_map.technical_benefit)}
                  {renderToneBar("Абстрактный", "Конкретный", evalResult.tone_map.abstract_concrete)}
                  {renderToneBar("Перевод", "Нативный", evalResult.tone_map.global_native)}
                </div>
                <div className="stack">
                  <div className="card">
                    <p className="field-label">Индекс клише</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontFamily: "Syne, sans-serif", fontSize: 32, fontWeight: 800, color: evalResult.genericness_score > 60 ? "var(--red)" : "var(--lime-d)" }}>{evalResult.genericness_score}</span>
                      <span style={{ fontSize: 14, color: "var(--t3)" }}>/100</span>
                    </div>
                    <div>{evalResult.generic_phrases?.map((p, i) => <span key={i} className="badge">«{p}»</span>)}</div>
                  </div>
                  <div className="card">
                    <p className="field-label">Красные флаги</p>
                    {evalResult.missing_trust_signals?.map((s, i) => <div key={i} className="trust-item">✕ {s}</div>)}
                  </div>
                </div>
              </div>

              <div className="card">
                <p className="field-label">Точечные рекомендации</p>
                {evalResult.rewrites?.map((rw, i) => (
                  <div key={i} className="rw-card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--violet)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{rw.block}</div>
                    <div className="grid2" style={{ gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4 }}>Оригинал</div>
                        <div className="rw-block">{rw.original}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--violet)", fontWeight: 700, marginBottom: 4 }}>Локально {MARKETS[market].flag}</div>
                        <div className="rw-block local">{rw.suggested_local}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t2)", fontStyle: "italic", marginTop: 8 }}>💡 {rw.reason}</div>
                  </div>
                ))}
              </div>

              <div className="sticky-footer">
                <button className="btn-sticky" onClick={() => switchStep("improve")}>✨ Улучшить с учётом правок →</button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  // ── ШАГ 3: Улучшение ──────────────────────────────────────────────────────
  const renderImprove = () => (
    <div className="split">
      <div className="stack" style={{ position: "sticky", top: 68 }}>
        <div className="card">
          <p className="field-label">Стиль</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {(["none", "friendly", "professional", "concise"] as StyleModifier[]).map(m => (
              <button key={m} className={`btn-action ${styleModifier === m ? "active" : ""}`} onClick={() => setStyleModifier(m)}>
                {{ none: "Стандартно (по профилю)", friendly: "🤝 Дружелюбнее", professional: "💼 Экспертнее", concise: "✂️ Лаконично" }[m]}
              </button>
            ))}
          </div>
          <p className="field-label">Текст для редактуры</p>
          <textarea className="inp" rows={7} value={globalText} onChange={e => setGlobalText(e.target.value)} />
          <button className="btn-primary" onClick={handleImprove} disabled={loading || !globalText.trim()} style={{ marginTop: 16 }}>
            {loading ? "Генерация..." : "🪄 Применить магию ИИ"}
          </button>
        </div>
      </div>

      <div className="stack">
        {loading && <ProgressStream steps={LOADING_MSGS.improve} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
        {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
        {!loading && !improveResult && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--t3)" }}>
            <div style={{ fontSize: 40, opacity: 0.15, marginBottom: 16 }}>✨</div>
            <p>Выберите стиль и нажмите кнопку.</p>
          </div>
        )}

        {!loading && improveResult && (
          <>
            <div className="card" style={{ borderLeft: "4px solid var(--lime)" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", background: "var(--lime-a)", color: "var(--lime-d)", borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                ✓ {improveResult.tone_achieved}
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7 }}>{improveResult.improved_text}</div>
            </div>
            <div className="card">
              <p className="field-label">Лог изменений</p>
              <div className="stack">
                {improveResult.changes?.map((c, i) => (
                  <div key={i} style={{ padding: 16, background: "var(--bg)", borderRadius: 8, borderLeft: "3px solid var(--violet)" }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.what}</div>
                    <div style={{ fontSize: 13, color: "var(--t2)" }}>{c.why}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sticky-footer">
              <button className="btn-sticky" style={{ background: "var(--surface)", color: "var(--t1)", border: "1px solid var(--border)" }} onClick={handleCheckAgain}>
                ↻ Проверить заново
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <style>{STYLE}</style>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {settingsOpen && (
        <SettingsModal prompts={customPrompts} onSave={savePrompts} onClose={() => setSettingsOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="logo" onClick={resetToHome}>
          <div className="logo-mark">B</div>
          Breason
        </button>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => switchStep(key)}>
              <div className="nav-num">{s.num}</div>
              <div className="nav-label">{s.label}</div>
            </button>
          ))}
        </nav>
        <div className="sb-footer">Breason v2.2<br /><span style={{ opacity: 0.5 }}>Не перевод. Резонанс.</span></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Меню">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect y="3" width="18" height="2" rx="1" fill="currentColor" />
                <rect y="8" width="18" height="2" rx="1" fill="currentColor" />
                <rect y="13" width="18" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>
            <span className="topbar-title">Breason / {STEPS[step].label}</span>
          </div>

          <div className="topbar-right">
            {/* Кнопка настроек с индикатором активных кастомных промптов */}
            <button className="settings-btn" onClick={() => setSettingsOpen(true)}>
              <span>⚙️</span>
              <span>Промпты</span>
              {hasCustomPrompts && <span className="settings-dot" title="Есть кастомные промпты" />}
            </button>

            <MarketPicker market={market} onChange={setMarket} />
          </div>
        </header>

        <main className="page">
          {step === "search"   && renderSearch()}
          {step === "evaluate" && renderEvaluate()}
          {step === "improve"  && renderImprove()}
        </main>
      </div>
    </div>
  );
}
