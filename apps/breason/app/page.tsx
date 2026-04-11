"use client";

import { useState, useEffect, useRef } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

type MarketKey   = "germany" | "poland" | "brazil";
type StepKey     = "search" | "evaluate" | "improve";
type VerdictType = "PASS" | "SUSPICIOUS" | "FOREIGN";
type InputMode   = "text" | "url";

interface NewsItem {
  headline: string; topic: string; category: string;
  summary: string; business_impact: string;
}

interface ToneMap        { formal_casual: number; bold_cautious: number; technical_benefit: number; abstract_concrete: number; global_native: number; }
interface Rewrite        { block: string; original: string; suggested: string; suggested_local: string; reason: string; }
interface EvaluateResult { verdict: VerdictType; verdict_reason: string; genericness_score: number; generic_phrases: string[]; tone_map: ToneMap; missing_trust_signals: string[]; rewrites: Rewrite[]; }
interface ImproveResult  { improved_text: string; improved_local: string; changes: { what: string; why: string }[]; tone_achieved: string; }

type PromptKey = "search" | "evaluate" | "improve_icebreaker" | "improve_thought_leader" | "improve_landing_page" | "improve_follow_up" | "improve_social" | "improve_standard";
type PromptStore = Partial<Record<PromptKey, string>>;

interface AppSettings {
  models: { primary: string; fallback: string; };
  prompts: PromptStore;
}

// ── Константы ─────────────────────────────────────────────────────────────────

const MARKETS: Record<MarketKey, { labelRu: string; flag: string }> = {
  germany: { labelRu: "Германия", flag: "🇩🇪" },
  poland:  { labelRu: "Польша",   flag: "🇵🇱" },
  brazil:  { labelRu: "Бразилия", flag: "🇧🇷" },
};

const STEPS: Record<StepKey, { num: string; label: string }> = {
  search:   { num: "01", label: "Поиск трендов"  },
  evaluate: { num: "02", label: "Оценка контента" },
  improve:  { num: "03", label: "Улучшение"       },
};

const VERDICT_CFG: Record<VerdictType, { color: string; bg: string; border: string; icon: string; label: string }> = {
  PASS:       { color: "#3F6212", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  icon: "✓", label: "Звучит локально"    },
  SUSPICIOUS: { color: "#C2410C", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  icon: "⚠", label: "Звучит как перевод" },
  FOREIGN:    { color: "#BE123C", bg: "rgba(225,29,72,0.08)",   border: "rgba(225,29,72,0.3)",   icon: "✕", label: "Чужеродный контент" },
};

const PRESETS = [
  { id: "icebreaker",     icon: "🧊", label: "Холодное письмо",  desc: "LinkedIn / первый контакт"  },
  { id: "thought_leader", icon: "💡", label: "Лидер мнений",     desc: "Экспертный материал"        },
  { id: "landing_page",   icon: "📄", label: "Лендинг",          desc: "Блок для сайта"             },
  { id: "follow_up",      icon: "👋", label: "Напоминание",       desc: "Фоллоу-ап после встречи"   },
  { id: "social",         icon: "📣", label: "Социальные сети",   desc: "Пост для LinkedIn / X"     },
  { id: "standard",       icon: "🪄", label: "Стандартная правка", desc: "Улучшение по профилю"    },
];

const PROMPT_TABS: { key: PromptKey; label: string; icon: string; hint: string }[] = [
  { key: "search",                 icon: "🔍", label: "Поиск трендов",   hint: "Переменные: {{MARKET}}, {{TODAY}}, {{NEWS_CONTEXT}}, {{KEYWORD_FOCUS}}" },
  { key: "evaluate",               icon: "◈",  label: "Оценка контента", hint: "Переменные: {{MARKET}}, {{TONE}}, {{TRUST}}, {{RED_FLAGS}}, {{TEXT}}, {{TREND_CONTEXT}}" },
  { key: "improve_icebreaker",     icon: "🧊", label: "Холодное письмо", hint: "Переменные: {{MARKET}}, {{LANGUAGE}}, {{TREND_NAME}}, {{TREND_TENSION}}, {{TEXT}}" },
  { key: "improve_thought_leader", icon: "💡", label: "Лидер мнений",    hint: "Переменные: {{MARKET}}, {{LANGUAGE}}, {{TREND_NAME}}, {{TREND_TENSION}}, {{TEXT}}" },
  { key: "improve_landing_page",   icon: "📄", label: "Лендинг",         hint: "Переменные: {{MARKET}}, {{LANGUAGE}}, {{TREND_NAME}}, {{TEXT}}" },
  { key: "improve_follow_up",      icon: "👋", label: "Напоминание",      hint: "Переменные: {{MARKET}}, {{LANGUAGE}}, {{TREND_NAME}}, {{TREND_TENSION}}, {{TEXT}}" },
  { key: "improve_social",         icon: "📣", label: "Социальные сети", hint: "Переменные: {{MARKET}}, {{LANGUAGE}}, {{TREND_NAME}}, {{TEXT}}" },
  { key: "improve_standard",       icon: "🪄", label: "Стандартная правка", hint: "Переменные: {{MARKET}}, {{LANGUAGE}}, {{TONE}}, {{TRUST}}, {{RED_FLAGS}}, {{TREND_NAME}}, {{TEXT}}" },
];

const AVAILABLE_MODELS = {
  primary: [
    { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite Preview (Быстрый)" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview (Умный)" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
    { id: "gemini-flash-latest", label: "Gemini Flash Latest" }
  ],
  fallback: [
    { id: "llama-3.3-70b", label: "Llama 3.3 70B" },
    { id: "llama-4-scout", label: "Llama 4 Scout" },
    { id: "gpt-oss-120b", label: "GPT OSS 120B" },
    { id: "gpt-oss-20b", label: "GPT OSS 20B" },
    { id: "qwen-3-32b", label: "Qwen 3 32B" }
  ]
};

const LOADING_MSGS: Record<StepKey, string[]> = {
  search:   ["Смотрим рынок...", "Опрашиваем экспертов...", "Читаем Bloomberg...", "Готовим отчёт..."],
  evaluate: ["Синхронизируем культурный код...", "Ищем сигналы доверия...", "Считаем индекс клише...", "Генерируем советы..."],
  improve:  ["Применяем профиль рынка...", "Вплетаем тренды...", "Переписываем текст...", "Полируем нативный тон..."],
};

const FUNNY_QUOTES = [
  "Работайте на скупого, он платит дважды",
  "Встречайтесь со стоматологом. Это выгодно",
  "Не хватает на отпуск? Отдыхайте на работе",
  "Если хотите удвоить деньги, то сложите их пополам",
  "Зарабатывайте больше, и доход вырастет",
];

const LS_KEY = "breason_settings_v3";
const DEFAULT_SETTINGS: AppSettings = {
  models: { primary: "gemini-3.1-flash-lite-preview", fallback: "llama-3.3-70b" },
  prompts: {}
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

:root {
  --violet:   #7C3AED; --violet-d: #6D28D9; --violet-a: rgba(124,58,237,0.08);
  --lime:     #84CC16; --lime-a: rgba(132,204,22,0.10); --lime-d: #65A30D; --lime-b: rgba(132,204,22,0.25);
  --orange:   #F97316; --orange-d: #EA6C0A; --orange-a: rgba(249,115,22,0.08);
  --red:      #EF4444;
  --bg:       #F4F6FA;
  --surface:  #FFFFFF;
  --t1:       #0F172A; --t2: #4B5675; --t3: #9BA5BC;
  --border:   rgba(15,23,42,0.08); --border-xs: rgba(15,23,42,0.04);
  --r:        12px; --r-sm: 8px; --r-lg: 16px;
  --shadow-sm: 0 1px 4px rgba(15,23,42,0.06);
  --shadow-md: 0 4px 16px rgba(15,23,42,0.08);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--t1); line-height: 1.5; -webkit-font-smoothing: antialiased; }

/* ── ОБОЛОЧКА ── */
.shell { display: flex; min-height: 100vh; overflow-x: hidden; }

/* ── САЙДБАР ── */
.sidebar {
  width: 228px; flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 12px;
  display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh;
  z-index: 100;
  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
.logo {
  display: flex; align-items: center; gap: 9px;
  font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800;
  color: var(--t1); margin-bottom: 24px; cursor: pointer;
  background: none; border: none; padding: 4px 6px;
  border-radius: 8px; transition: 0.15s;
}
.logo:hover { background: var(--bg); }
.logo-mark { width: 26px; height: 26px; background: var(--lime); border-radius: 6px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #1a2e05; flex-shrink: 0; }

.nav-btn { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border: none; border-radius: 9px; background: transparent; cursor: pointer; width: 100%; text-align: left; font-family: inherit; transition: 0.12s; margin-bottom: 3px; }
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--violet-a); }
.nav-num { width: 22px; height: 22px; border-radius: 5px; background: var(--bg); font-size: 9px; font-weight: 800; color: var(--t3); display: grid; place-items: center; font-family: 'Syne', sans-serif; flex-shrink: 0; }
.nav-btn.active .nav-num { background: var(--violet); color: white; }
.nav-label { font-size: 12.5px; font-weight: 600; color: var(--t2); }
.nav-btn.active .nav-label { color: var(--violet); font-weight: 700; }

.settings-nav-btn { margin-top: auto; border-top: 1px solid var(--border-xs); padding-top: 14px; }
.settings-nav-btn .nav-btn { color: var(--t2); justify-content: flex-start; padding: 12px 10px; }
.settings-nav-btn .nav-btn:hover { color: var(--t1); background: var(--bg); }

/* ── ОСНОВНАЯ ОБЛАСТЬ ── */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

/* ── ТОПБАР ── */
.topbar {
  background: var(--surface); border-bottom: 1px solid var(--border);
  height: 56px; display: flex; align-items: center;
  padding: 0 24px; position: sticky; top: 0; z-index: 40;
  justify-content: space-between; gap: 16px;
}
.topbar-left  { display: flex; align-items: center; gap: 10px; }
.topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.hamburger    { display: none; background: transparent; border: none; font-size: 22px; cursor: pointer; padding: 4px; color: var(--t2); border-radius: 6px; }
.hamburger:hover { background: var(--bg); }
.topbar-title { font-size: 13px; font-weight: 600; color: var(--t2); white-space: nowrap; }
.topbar-sep   { color: var(--border); margin: 0 2px; }

/* ── КНОПКА РЫНКА (топбар) ── */
.market-btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; color: var(--t1); transition: 0.13s; box-shadow: var(--shadow-sm); }
.market-btn:hover { background: var(--bg); box-shadow: var(--shadow-md); }

/* ── ВЫПАДАЮЩИЙ СПИСОК РЫНКОВ ── */
.market-dropdown-wrap { position: relative; }
.market-dropdown { position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 6px; box-shadow: 0 12px 40px rgba(0,0,0,0.1); min-width: 210px; z-index: 200; animation: dropIn 0.14s ease-out; }
@keyframes dropIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
.market-option { display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 8px; cursor: pointer; border: none; background: transparent; width: 100%; text-align: left; font-family: inherit; transition: 0.1s; }
.market-option:hover { background: var(--bg); }
.market-option.active { background: var(--lime-a); }

/* ── ВЫБОР РЫНКА (страница поиска) ── */
.market-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.market-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 7px; padding: 16px 12px;
  border: 1.5px solid var(--border-xs);
  border-radius: var(--r-lg);
  background: var(--surface); cursor: pointer;
  text-align: center; transition: 0.15s; font-family: inherit;
  box-shadow: var(--shadow-sm);
}
.market-card:hover { border-color: rgba(132,204,22,0.4); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.market-card.active {
  border-color: var(--lime); background: var(--lime-a);
  box-shadow: 0 0 0 3px var(--lime-b), var(--shadow-md);
  transform: translateY(-2px);
}
.market-card-flag { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; font-size: 28px; line-height: 1; display: block; margin-bottom: 4px; }
.market-card-name { font-family: 'Syne', sans-serif; font-size: 13.5px; font-weight: 800; color: var(--t1); }

/* ── КНОПКИ ── */
.btn-primary {
  width: 100%; padding: 13px; background: var(--orange); color: #fff;
  border: none; border-radius: var(--r-sm); font-size: 14.5px; font-weight: 700;
  cursor: pointer; transition: 0.15s; display: flex; justify-content: center;
  align-items: center; gap: 8px; font-family: inherit; letter-spacing: 0.01em;
}
.btn-primary:hover:not(:disabled) { background: var(--orange-d); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(249,115,22,0.28); }
.btn-primary:disabled { background: var(--t3); cursor: not-allowed; transform: none; box-shadow: none; }

.btn-action { padding: 9px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 13px; font-weight: 600; color: var(--t1); cursor: pointer; transition: 0.13s; font-family: inherit; }
.btn-action:hover { background: var(--bg); border-color: var(--orange); color: var(--orange); }
.btn-action.active { background: var(--orange); color: #fff; border-color: var(--orange); }

.btn-ghost { padding: 7px 14px; background: transparent; border: 1px solid var(--border); border-radius: var(--r-sm); font-family: inherit; font-size: 12.5px; font-weight: 500; color: var(--t2); cursor: pointer; transition: 0.13s; }
.btn-ghost:hover { background: var(--bg); }

.btn-use-trend { width: 100%; padding: 10px; margin-top: auto; background: var(--t1); color: #fff; border: none; border-radius: var(--r-sm); font-size: 12.5px; font-weight: 700; cursor: pointer; transition: 0.15s; font-family: inherit; }
.btn-use-trend:hover { background: var(--violet); transform: translateY(-1px); }

.btn-sticky { background: var(--orange); color: #fff; padding: 13px 28px; border-radius: 99px; font-weight: 700; font-size: 14px; border: none; cursor: pointer; box-shadow: 0 6px 20px rgba(249,115,22,0.3); transition: 0.2s; font-family: inherit; }
.btn-sticky:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(249,115,22,0.38); }

/* ── ПОЛЯ И КАРТОЧКИ ── */
.page { flex: 1; padding: 28px 28px 48px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 22px; box-shadow: var(--shadow-sm); }
.field-label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--t3); margin-bottom: 11px; }

.inp { width: 100%; padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: inherit; font-size: 14px; line-height: 1.6; color: var(--t1); resize: vertical; outline: none; transition: 0.13s; min-height: 80px; box-sizing: border-box; }
.inp:focus { border-color: var(--orange); background: var(--surface); box-shadow: 0 0 0 3px var(--orange-a); }
input.inp { min-height: auto; resize: none; padding: 11px 14px; }

/* ── РАСКЛАДКИ ── */
.split { display: grid; gap: 24px; grid-template-columns: 400px 1fr; align-items: start; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.stack { display: flex; flex-direction: column; gap: 18px; }

/* ── ТЕМАТИЧЕСКИЕ ГРУППЫ ── */
.topic-section { margin-bottom: 28px; }
.topic-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.topic-label { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--t3); white-space: nowrap; }
.topic-line { flex: 1; height: 1px; background: var(--border-xs); }
.topic-count { font-size: 10px; font-weight: 700; color: var(--t3); background: var(--bg); padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
.news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.news-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 18px; display: flex; flex-direction: column; gap: 10px; transition: 0.18s; box-shadow: var(--shadow-sm); }
.news-card:hover { border-color: rgba(249,115,22,0.25); box-shadow: 0 6px 20px rgba(249,115,22,0.07); transform: translateY(-2px); }
.news-headline { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--t1); line-height: 1.35; }

/* ── ПРЕСЕТЫ ── */
.preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.preset-card { padding: 14px; border: 1.5px solid var(--border); border-radius: var(--r-lg); background: var(--surface); text-align: left; cursor: pointer; transition: 0.15s; font-family: inherit; box-shadow: var(--shadow-sm); }
.preset-card:hover { border-color: rgba(249,115,22,0.35); box-shadow: var(--shadow-md); transform: translateY(-1px); }
.preset-card.active { background: var(--orange-a); border-color: var(--orange); box-shadow: 0 0 0 2px rgba(249,115,22,0.15); }

/* ── МОДАЛЬНОЕ ОКНО ── */
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 500; display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px); }
.modal { background: var(--surface); border-radius: var(--r-lg); width: 100%; max-width: 900px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.18); border: 1px solid var(--border); }
.modal-header { padding: 22px 26px 0; display: flex; align-items: flex-start; justify-content: space-between; flex-shrink: 0; }
.modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: var(--t1); }
.modal-subtitle { font-size: 12.5px; color: var(--t3); margin-top: 4px; line-height: 1.5; }
.modal-close { background: var(--bg); border: none; border-radius: 7px; width: 30px; height: 30px; font-size: 15px; cursor: pointer; color: var(--t2); display: flex; align-items: center; justify-content: center; transition: 0.13s; flex-shrink: 0; }
.modal-close:hover { background: var(--border); }

/* Модалка: Переключатель вкладок (Модели/Промпты) */
.modal-tabs { display: flex; padding: 0 26px; border-bottom: 1px solid var(--border); margin-top: 20px; gap: 20px; flex-shrink: 0; }
.modal-tab { padding: 10px 0; font-size: 14px; font-weight: 600; color: var(--t3); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: 0.2s; }
.modal-tab:hover { color: var(--t1); }
.modal-tab.active { color: var(--orange); border-bottom-color: var(--orange); }

/* Модалка: Контент */
.modal-content { display: flex; flex: 1; overflow: hidden; }

/* Редактор промптов */
.prompt-tabs { width: 190px; flex-shrink: 0; border-right: 1px solid var(--border-xs); padding: 6px; overflow-y: auto; }
.prompt-tab { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 11px; border: none; border-radius: 7px; background: transparent; text-align: left; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--t2); cursor: pointer; transition: 0.12s; margin-bottom: 2px; }
.prompt-tab:hover { background: var(--bg); }
.prompt-tab.active { background: var(--violet-a); color: var(--violet); }
.prompt-tab-icon { font-size: 13px; flex-shrink: 0; }
.prompt-tab-modified { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); margin-left: auto; flex-shrink: 0; }

.prompt-panel { flex: 1; display: flex; flex-direction: column; padding: 18px 22px; overflow: hidden; }
.prompt-panel-hint { font-size: 11.5px; color: var(--t3); background: var(--bg); border-radius: 7px; padding: 9px 13px; margin-bottom: 12px; line-height: 1.6; border-left: 3px solid var(--violet-a); flex-shrink: 0; }
.prompt-panel-hint strong { color: var(--violet); }
.prompt-textarea { flex: 1; width: 100%; padding: 14px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--bg); font-family: 'Fira Code', 'Courier New', monospace; font-size: 12px; line-height: 1.7; color: var(--t1); resize: none; outline: none; transition: 0.13s; min-height: 280px; box-sizing: border-box; }
.prompt-textarea:focus { border-color: var(--violet); background: var(--surface); box-shadow: 0 0 0 3px var(--violet-a); }
.prompt-textarea.modified { border-color: var(--orange); }

.modal-footer { padding: 14px 22px; border-top: 1px solid var(--border-xs); display: flex; align-items: center; gap: 10px; flex-shrink: 0; background: var(--surface); }
.modal-footer-status { font-size: 12px; color: var(--t3); margin-right: auto; }
.modal-footer-status.has-changes { color: var(--orange); font-weight: 600; }

/* Настройки моделей */
.models-panel { padding: 26px; width: 100%; overflow-y: auto; }
.model-field { margin-bottom: 24px; }
.model-select { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 14px; background: var(--bg); outline: none; transition: 0.2s; cursor: pointer; }
.model-select:focus { border-color: var(--orange); }

/* ── ОВЕРЛЕЙ ── */
.overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 90; backdrop-filter: blur(4px); transition: opacity 0.3s ease; opacity: 0; pointer-events: none; }
.overlay.show { display: block; opacity: 1; pointer-events: auto; }

/* ── ЛОАДЕР ── */
.stream-loader { font-family: monospace; font-size: 13.5px; color: var(--orange-d); background: var(--orange-a); padding: 18px; border-radius: 10px; display: flex; flex-direction: column; gap: 9px; border: 1px solid rgba(249,115,22,0.12); }
.stream-line { display: flex; align-items: center; gap: 8px; }
.blink { animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.sticky-footer { position: sticky; bottom: 0; padding: 18px 0; background: linear-gradient(transparent, var(--bg) 35%); margin-top: 20px; display: flex; justify-content: flex-end; z-index: 10; }

/* ── МОБИЛЬНАЯ ВЕРСИЯ ── */
@media (max-width: 960px) {
  .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.09); z-index: 100; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: var(--surface); }
  .sidebar.open { transform: translateX(0); }
  .overlay { display: block; } 
  .hamburger { display: block; }
  .split { grid-template-columns: 1fr; gap: 18px; }
  .split > div:first-child { position: static !important; }
  .news-grid { grid-template-columns: 1fr 1fr; }
  .topbar { padding: 0 16px; }
  .page { padding: 16px 16px 40px; }
  .market-selector { grid-template-columns: 1fr; gap: 8px; }
  .market-card { flex-direction: row; text-align: left; gap: 12px; padding: 14px; }
  .market-card-flag { font-size: 24px; margin-bottom: 0; }
  .prompt-editor { flex-direction: column; }
  .prompt-tabs { width: 100%; border-right: none; border-bottom: 1px solid var(--border-xs); display: flex; flex-wrap: wrap; padding: 6px; gap: 4px; overflow-y: visible; }
  .modal { max-height: 96vh; }
  .preset-grid { grid-template-columns: 1fr; }
  .grid2 { grid-template-columns: 1fr; }
}
@media (max-width: 580px) {
  .news-grid { grid-template-columns: 1fr; }
  .topbar-sep { display: none; }
}
`;

// ── Компоненты ────────────────────────────────────────────────────────────────

const ProgressStream = ({ steps, activeIdx, quoteIdx }: { steps: string[]; activeIdx: number; quoteIdx: number }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div className="stream-loader">
      {steps.map((s, i) => {
        if (i > activeIdx) return null;
        return (
          <div key={i} className="stream-line" style={{ opacity: i === activeIdx ? 1 : 0.45 }}>
            <span>{i === activeIdx ? <span className="blink">▶</span> : "✓"}</span>
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
        <span style={{ fontSize: 15, fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", sans-serif' }}>{m.flag}</span>
        <span>{m.labelRu}</span>
        <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 2 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="market-dropdown">
          {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, data]) => (
            <button key={key} className={`market-option ${key === market ? "active" : ""}`}
              onClick={() => { onChange(key); setOpen(false); }}>
              <span style={{ fontSize: 19, fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", sans-serif' }}>{data.flag}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{data.labelRu}</span>
              {key === market && <span style={{ marginLeft: "auto", color: "var(--lime-d)", fontWeight: 800, fontSize: 13 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SettingsModal = ({
  settings, onSave, onClose,
}: {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}) => {
  const [view, setView] = useState<"models" | "prompts">("models");
  
  // Prompt Editor State
  const [activeTab,       setActiveTab]       = useState<PromptKey>("search");
  const [systemDefaults,  setSystemDefaults]  = useState<PromptStore>({});
  const [localPrompts,    setLocalPrompts]    = useState<PromptStore>({ ...settings.prompts });
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Models State
  const [localModels, setLocalModels] = useState({ ...settings.models });

  useEffect(() => {
    setLoadingDefaults(true);
    fetch("/api/resonance-trends?action=prompts")
      .then(r => r.json())
      .then(data => { if (data.prompts) setSystemDefaults(data.prompts); })
      .catch(() => {})
      .finally(() => setLoadingDefaults(false));
  }, []);

  const activeTabMeta   = PROMPT_TABS.find(t => t.key === activeTab)!;
  const getCurrentValue = (key: PromptKey) => localPrompts[key] !== undefined ? localPrompts[key]! : (systemDefaults[key] || "");
  const isModified      = (key: PromptKey) => localPrompts[key] !== undefined && localPrompts[key] !== systemDefaults[key];
  const hasAnyModified  = PROMPT_TABS.some(t => isModified(t.key));
  const modifiedCount   = PROMPT_TABS.filter(t => isModified(t.key)).length;

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">⚙️ Настройки Breason</h2>
            <p className="modal-subtitle">Конфигурация нейросетей и системных промптов.</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${view === 'models' ? 'active' : ''}`} onClick={() => setView('models')}>Нейросети</button>
          <button className={`modal-tab ${view === 'prompts' ? 'active' : ''}`} onClick={() => setView('prompts')}>Редактор промптов</button>
        </div>

        <div className="modal-content">
          {view === 'models' && (
            <div className="models-panel">
              <div className="model-field">
                <p className="field-label">Основная модель (Gemini)</p>
                <select 
                  className="model-select" 
                  value={localModels.primary} 
                  onChange={e => setLocalModels(p => ({ ...p, primary: e.target.value }))}
                >
                  {AVAILABLE_MODELS.primary.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>Используется для парсинга и генерации трендов. Минимум Gemini 3.1 Flash Lite.</div>
              </div>

              <div className="model-field">
                <p className="field-label">Резервная модель (Groq Fallback)</p>
                <select 
                  className="model-select" 
                  value={localModels.fallback} 
                  onChange={e => setLocalModels(p => ({ ...p, fallback: e.target.value }))}
                >
                  {AVAILABLE_MODELS.fallback.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>Включается при 429 ошибке или недоступности Google API.</div>
              </div>
            </div>
          )}

          {view === 'prompts' && (
            <div className="prompt-editor" style={{ marginTop: 0 }}>
              <div className="prompt-tabs">
                {PROMPT_TABS.map(tab => (
                  <button key={tab.key} className={`prompt-tab ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}>
                    <span className="prompt-tab-icon">{tab.icon}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.label}</span>
                    {isModified(tab.key) && <span className="prompt-tab-modified" title="Изменён" />}
                  </button>
                ))}
              </div>

              <div className="prompt-panel">
                <div className="prompt-panel-hint">
                  <strong>Переменные:</strong>{" "}{activeTabMeta.hint.replace("Переменные: ", "")}
                </div>
                {loadingDefaults ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--t3)" }}>Загружаем промпты...</div>
                ) : (
                  <textarea
                    className={`prompt-textarea ${isModified(activeTab) ? "modified" : ""}`}
                    value={getCurrentValue(activeTab)}
                    onChange={e => setLocalPrompts(p => ({ ...p, [activeTab]: e.target.value }))}
                    spellCheck={false}
                  />
                )}
                {isModified(activeTab) && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 11px" }}
                      onClick={() => setLocalPrompts(p => ({ ...p, [activeTab]: systemDefaults[activeTab] || "" }))}>
                      ↺ По умолчанию
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className={`modal-footer-status ${hasAnyModified ? "has-changes" : ""}`}>
            {view === 'prompts' && hasAnyModified ? `${modifiedCount} промпт(ов) изменено` : ""}
          </span>
          {view === 'prompts' && hasAnyModified && <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setLocalPrompts({})}>Сбросить промпты</button>}
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn-action active" style={{ minWidth: 110 }}
            onClick={() => {
              const toSavePrompts: PromptStore = {};
              PROMPT_TABS.forEach(t => { if (isModified(t.key)) toSavePrompts[t.key] = localPrompts[t.key]; });
              onSave({ models: localModels, prompts: toSavePrompts }); 
              onClose();
            }}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default function BreasonApp() {
  const [step,        setStep]        = useState<StepKey>("search");
  const [market,      setMarket]      = useState<MarketKey>("germany");
  const [inputMode,   setInputMode]   = useState<InputMode>("text");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [globalText,    setGlobalText]    = useState("");
  const [selectedTrend, setSelectedTrend] = useState<NewsItem | null>(null);
  const [presetAction,  setPresetAction]  = useState<string>("standard");
  const [keyword,       setKeyword]       = useState("");

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  useEffect(() => {
    try { 
      const s = localStorage.getItem(LS_KEY); 
      if (s) {
        const parsed = JSON.parse(s);
        setSettings({
          models: parsed.models || DEFAULT_SETTINGS.models,
          prompts: parsed.prompts || DEFAULT_SETTINGS.prompts
        });
      }
    } catch {}
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try { localStorage.setItem(LS_KEY, JSON.stringify(newSettings)); } catch {}
  };

  const buildApiPrompts = () => ({
    search:   settings.prompts["search"],
    evaluate: settings.prompts["evaluate"],
    improve:  settings.prompts[`improve_${presetAction}` as PromptKey],
  });

  const [loading,        setLoading]        = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [quoteIdx,       setQuoteIdx]       = useState(0);
  const [error,          setError]          = useState<string | null>(null);

  const [newsItems,     setNewsItems]     = useState<NewsItem[] | null>(null);
  const [keywordFocus,  setKeywordFocus]  = useState("");
  const [evalResult,    setEvalResult]    = useState<EvaluateResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const [urlInput,      setUrlInput]      = useState("");

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
    setStep("search"); setNewsItems(null); setEvalResult(null); setImproveResult(null);
    setSelectedTrend(null); setGlobalText(""); setSidebarOpen(false); setKeyword(""); setKeywordFocus("");
  };

  const handleFetchUrl = async () => {
    if (!urlInput) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/resonance-trends", { 
        method: "POST", headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ action: "fetch-url", url: urlInput }) 
      });
      const data = await res.json();
      if (data.text) setGlobalText(data.text);
      else setError(data.error || "Ошибка парсинга URL");
    } catch { setError("Ошибка сети при загрузке страницы"); }
    finally   { setLoading(false); }
  };

  const handleSearch = async () => {
    setLoading(true); setError(null); setNewsItems(null);
    const kw = keyword.trim();
    setKeywordFocus(kw);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", market, keyword: kw || undefined, customPrompts: buildApiPrompts(), models: settings.models }),
      });
      const data = await res.json();
      setNewsItems(data.items || []);
    } catch { setError("Не удалось загрузить тренды."); }
    finally   { setLoading(false); }
  };

  const handleUseTrend = (item: NewsItem) => { setSelectedTrend(item); switchStep("evaluate"); };

  const handleEvaluate = async () => {
    if (!globalText.trim()) return;
    setLoading(true); setError(null); setEvalResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", text: globalText, market, trendContext: selectedTrend, customPrompts: buildApiPrompts(), models: settings.models }),
      });
      const data = await res.json();
      if (data.verdict) setEvalResult(data);
      else setError("Система вернула неполные данные.");
    } catch { setError("Ошибка при анализе."); }
    finally   { setLoading(false); }
  };

  const handleImprove = async () => {
    setLoading(true); setError(null); setImproveResult(null);
    try {
      const res  = await fetch("/api/resonance-trends", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "improve", text: globalText, market, trendContext: selectedTrend, preset: presetAction, customPrompts: buildApiPrompts(), models: settings.models }),
      });
      const data = await res.json();
      if (data.improved_local) setImproveResult(data);
      else setError("Не удалось сгенерировать текст.");
    } catch { setError("Ошибка генерации."); }
    finally   { setLoading(false); }
  };

  const groupedTrends = (newsItems || []).reduce<Record<string, NewsItem[]>>((acc, item) => {
    const key = item.topic || "Общее";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const renderToneBar = (labelL: string, labelR: string, val: number) => {
    const pct = Math.max(0, Math.min(100, ((val + 5) / 10) * 100));
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--t2)", marginBottom: 7 }}>
          <span>{labelL}</span><span>{labelR}</span>
        </div>
        <div style={{ position: "relative", height: 5, background: "var(--bg)", borderRadius: 99, border: "1px solid var(--border-xs)" }}>
          <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1.5, background: "var(--border)" }} />
          <div style={{ position: "absolute", top: "50%", width: 14, height: 14, borderRadius: "50%", background: "var(--orange)", border: "2.5px solid white", transform: "translate(-50%, -50%)", left: `${pct}%`, transition: "left 0.5s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 6px rgba(249,115,22,0.3)" }} />
        </div>
      </div>
    );
  };

  return (
    <div className="shell">
      <style>{STYLE}</style>

      <div className={`overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {settingsOpen && (
        <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
      )}

      {/* ── Сайдбар ── */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="logo" onClick={resetToHome}>
          <div className="logo-mark">B</div>Breason
        </button>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {(Object.entries(STEPS) as [StepKey, typeof STEPS[StepKey]][]).map(([key, s]) => (
            <button key={key} className={`nav-btn ${step === key ? "active" : ""}`} onClick={() => switchStep(key)}>
              <div className="nav-num">{s.num}</div>
              <div className="nav-label">{s.label}</div>
            </button>
          ))}
        </nav>
        
        {/* Кнопка настроек внизу сайдбара */}
        <div className="settings-nav-btn">
          <button className="nav-btn" onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}>
            <div className="nav-num" style={{ background: 'transparent', fontSize: 16 }}>⚙️</div>
            <div className="nav-label">Настройки</div>
          </button>
        </div>
      </aside>

      {/* ── Основная область ── */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="topbar-title">
              Breason <span className="topbar-sep">/</span> {STEPS[step].label}
            </span>
          </div>
          <div className="topbar-right">
            <MarketPicker market={market} onChange={setMarket} />
          </div>
        </header>

        <main className="page">

          {/* ── ШАГ 1: ПОИСК ТРЕНДОВ ── */}
          {step === "search" && (
            <div className="stack">
              <div className="card">
                <p className="field-label">1. Целевой рынок</p>
                <div className="market-selector">
                  {(Object.entries(MARKETS) as [MarketKey, typeof MARKETS[MarketKey]][]).map(([key, m]) => (
                    <button key={key} className={`market-card ${market === key ? "active" : ""}`} onClick={() => setMarket(key)}>
                      <span className="market-card-flag">{m.flag}</span>
                      <span className="market-card-name">{m.labelRu}</span>
                    </button>
                  ))}
                </div>

                <p className="field-label">2. Фокус (необязательно)</p>
                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  <input
                    className="inp" type="text" value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !loading && handleSearch()}
                    placeholder="Например: AI, логистика, финтех..."
                  />
                  {keyword && <button className="btn-action" onClick={() => setKeyword("")} style={{ flexShrink: 0 }}>✕</button>}
                </div>

                <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                  {loading ? "Анализ рынка..." : `Найти тренды — ${MARKETS[market].labelRu}`}
                </button>
              </div>

              {loading && <ProgressStream steps={LOADING_MSGS.search} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
              {!loading && error && (
                <div style={{ color: "var(--red)", padding: "13px 16px", background: "rgba(239,68,68,0.05)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>{error}</div>
              )}

              {!loading && newsItems && newsItems.length > 0 && (
                <div>
                  {keywordFocus && (
                    <div style={{ display: "inline-flex", padding: "5px 14px", background: "var(--orange-a)", color: "var(--orange)", borderRadius: 99, fontSize: 12.5, fontWeight: 700, marginBottom: 20, border: "1px solid rgba(249,115,22,0.2)" }}>
                      🔍 Фокус: «{keywordFocus}»
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
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-a)", padding: "3px 8px", borderRadius: 5, display: "inline-block", width: "fit-content" }}>
                              {item.category}
                            </div>
                            <h3 className="news-headline">{item.headline}</h3>
                            <p style={{ fontSize: 12.5, color: "var(--t2)", flex: 1, lineHeight: 1.55 }}>{item.summary}</p>
                            <p style={{ fontSize: 11.5, color: "var(--t3)", padding: "9px 11px", background: "var(--bg)", borderRadius: 7, borderLeft: "2.5px solid var(--orange)", lineHeight: 1.5 }}>
                              {item.business_impact}
                            </p>
                            <button className="btn-use-trend" onClick={() => handleUseTrend(item)}>
                              Проверить текст под тренд →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ШАГ 2: ОЦЕНКА КОНТЕНТА ── */}
          {step === "evaluate" && (
            <div className="split">
              <div className="stack" style={{ position: "sticky", top: 72 }}>
                <div className="card">
                  <p className="field-label">Контекст</p>
                  {selectedTrend ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 13px", background: "var(--lime-a)", color: "var(--lime-d)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 18, border: "1px solid rgba(132,204,22,0.25)" }}>
                      🎯 {selectedTrend.headline.length > 35 ? selectedTrend.headline.slice(0, 35) + "…" : selectedTrend.headline}
                      <span style={{ cursor: "pointer", marginLeft: 4, opacity: 0.5 }} onClick={() => setSelectedTrend(null)}>✕</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "var(--t3)", marginBottom: 18 }}>Общая оценка (без тренда)</div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <button className={`btn-action ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")} style={{ flex: 1 }}>Текст</button>
                    <button className={`btn-action ${inputMode === "url" ? "active" : ""}`} onClick={() => setInputMode("url")} style={{ flex: 1 }}>Ссылка</button>
                  </div>

                  {inputMode === "url" && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      <input className="inp" style={{ padding: "11px 13px", flex: 1, margin: 0 }} placeholder="https://" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFetchUrl()} />
                      <button className="btn-action" onClick={handleFetchUrl} disabled={loading}>Загрузить</button>
                    </div>
                  )}

                  <p className="field-label">Маркетинговый текст</p>
                  <textarea className="inp" rows={8} value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="Вставьте текст для анализа..." />
                  <button className="btn-primary" onClick={handleEvaluate} disabled={loading || !globalText.trim()} style={{ marginTop: 20 }}>
                    {loading ? "Идёт аудит..." : `Оценить для ${MARKETS[market].labelRu}`}
                  </button>
                </div>
              </div>

              <div className="stack">
                {loading && <ProgressStream steps={LOADING_MSGS.evaluate} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
                {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
                {!loading && !evalResult && !error && (
                  <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>
                    <div style={{ fontSize: 38, opacity: 0.12, marginBottom: 14 }}>◈</div>
                    <p style={{ fontSize: 14 }}>Нажмите «Оценить».</p>
                  </div>
                )}

                {!loading && evalResult && (() => {
                  const vc = VERDICT_CFG[evalResult.verdict];
                  return (
                    <>
                      <div className="card" style={{ background: vc.bg, borderColor: vc.border }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                          <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 24, color: vc.color, boxShadow: "var(--shadow-md)", flexShrink: 0 }}>{vc.icon}</div>
                          <div>
                            <h2 style={{ fontFamily: "Syne", fontSize: 22, color: vc.color, margin: 0, fontWeight: 800 }}>{evalResult.verdict} — {vc.label}</h2>
                            <p style={{ margin: "5px 0 0", fontSize: 14.5, color: "var(--t1)" }}>{evalResult.verdict_reason}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid2">
                        <div className="card">
                          <p className="field-label" style={{ marginBottom: 18 }}>Карта тона</p>
                          {renderToneBar("Формальный", "Кэжуал",    evalResult.tone_map.formal_casual)}
                          {renderToneBar("Дерзкий",    "Осторожный", evalResult.tone_map.bold_cautious)}
                          {renderToneBar("Технический", "Про пользу", evalResult.tone_map.technical_benefit)}
                          {renderToneBar("Абстрактный", "Конкретный", evalResult.tone_map.abstract_concrete)}
                          {renderToneBar("Перевод",    "Нативный",   evalResult.tone_map.global_native)}
                        </div>
                        <div className="stack">
                          <div className="card">
                            <p className="field-label">Индекс клише</p>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                              <span style={{ fontFamily: "Syne", fontSize: 38, fontWeight: 800, color: evalResult.genericness_score > 60 ? "var(--red)" : "var(--lime-d)" }}>{evalResult.genericness_score}</span>
                              <span style={{ fontSize: 14, color: "var(--t3)" }}>/100</span>
                            </div>
                            <div>{evalResult.generic_phrases?.map((p, i) => <span key={i} style={{ padding: "5px 11px", background: "#FEE2E2", color: "#B91C1C", fontSize: 12, fontWeight: 600, borderRadius: 7, margin: "0 7px 7px 0", display: "inline-block" }}>«{p}»</span>)}</div>
                          </div>
                          <div className="card">
                            <p className="field-label">Красные флаги</p>
                            {evalResult.missing_trust_signals?.map((s, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 14px", background: "var(--bg)", borderRadius: 9, fontSize: 13, color: "var(--t2)", borderLeft: "3px solid var(--red)", marginBottom: 8 }}>✕ {s}</div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="sticky-footer">
                        <button className="btn-sticky" onClick={() => switchStep("improve")}>✨ Улучшить с учётом правок →</button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ── ШАГ 3: УЛУЧШЕНИЕ ── */}
          {step === "improve" && (
            <div className="split">
              <div className="stack" style={{ position: "sticky", top: 72 }}>
                <div className="card">
                  <p className="field-label">1. Целевой формат</p>
                  <div className="preset-grid">
                    {PRESETS.map(p => (
                      <button key={p.id} className={`preset-card ${presetAction === p.id ? "active" : ""}`} onClick={() => setPresetAction(p.id)}>
                        <div style={{ fontSize: 17, marginBottom: 7 }}>{p.icon}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>{p.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.4 }}>{p.desc}</div>
                      </button>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={handleImprove} disabled={loading || !globalText.trim()} style={{ marginBottom: 20 }}>
                    {loading ? "Генерация..." : "🪄 Применить магию"}
                  </button>
                  <p className="field-label">2. Исходный текст</p>
                  <textarea className="inp" rows={10} value={globalText} onChange={e => setGlobalText(e.target.value)} placeholder="Вставьте текст для обработки..." />
                </div>
              </div>

              <div className="stack">
                {loading && <ProgressStream steps={LOADING_MSGS.improve} activeIdx={loadingStepIdx} quoteIdx={quoteIdx} />}
                {!loading && error && <div style={{ color: "var(--red)" }}>{error}</div>}
                {!loading && !improveResult && !error && (
                  <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--t3)" }}>
                    <div style={{ fontSize: 38, opacity: 0.12, marginBottom: 14 }}>✨</div>
                    <p style={{ fontSize: 14 }}>Выберите формат и нажмите кнопку.</p>
                  </div>
                )}
                {!loading && improveResult && (
                  <>
                    <div className="card" style={{ borderLeft: "4px solid var(--orange)" }}>
                      <div style={{ display: "inline-flex", padding: "7px 14px", background: "var(--orange-a)", color: "var(--orange-d)", borderRadius: 7, fontSize: 12.5, fontWeight: 700, marginBottom: 20, border: "1px solid rgba(249,115,22,0.18)" }}>
                        ✓ {improveResult.tone_achieved}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", fontSize: 15.5, lineHeight: 1.8, color: "var(--t1)" }}>{improveResult.improved_local}</div>
                    </div>
                    <div className="card">
                      <p className="field-label">Что и почему изменено</p>
                      <div className="stack" style={{ gap: 10 }}>
                        {improveResult.changes?.map((c, i) => (
                          <div key={i} style={{ padding: 14, background: "var(--bg)", borderRadius: 9, borderLeft: "3px solid var(--violet)" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{c.what}</div>
                            <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>{c.why}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
