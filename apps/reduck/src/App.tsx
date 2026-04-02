import { useState, useEffect, useCallback } from 'react';
import {
  Snackbar, Alert, Select, MenuItem,
} from '@mui/material';
import EditorCard from './components/EditorCard';
import ResultCard from './components/ResultCard';
import { fetchModels, processText } from './services/api';
import type { ProcessResult, ProviderGroup } from './types';

// ── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = [
  {
    id: 'lead-magnet',
    label: '🧲 Lead Magnet Review',
    prompt: `Você é revisor sênior da Folha de S.Paulo. Sua missão é a "limpeza" técnica de lead magnets com foco em naturalidade brasileira, rigor gramatical e eliminação de "marcas de IA".

REGRAS DE FORMATAÇÃO E VISUALIZAÇÃO (CRÍTICO):

PROIBIÇÃO DE SÍMBOLOS (#): Não utilize o símbolo # (cerquilha/hashtag) em NENHUMA parte da resposta. Remova qualquer Markdown de título.

NEGRITO OBRIGATÓRIO E EXCLUSIVO: Use negrito APENAS nas etiquetas iniciais de cada bloco. O conteúdo que segue as etiquetas deve ser texto simples (plain text).
Formato exigido:
**Original**: [trecho sem negrito]
**Sugestão**: [trecho sem negrito]
**Justificativa**: [trecho sem negrito]

PROTOCOLO DE VERIFICAÇÃO:
Antes de enviar, revise se:
Todos os títulos estão em Sentence case (apenas a primeira letra da frase em maiúscula).
Não restou nenhum anglicismo (feedback, insight, etc.).
O negrito está aplicado corretamente apenas nas etiquetas.

CRITÉRIOS DE REVISÃO:

1. TÍTULOS, SUBTÍTULOS E MATRIZES
Corrija o Title Case americano. Maiúscula APENAS na primeira palavra e nomes próprios.
Ex. Errado: "Matriz de Personalização de Conteúdo" -> Sugestão: Matriz de personalização de conteúdo

2. FILTRO DE ANGLICISMOS (NATURALIDADE)
Substitua termos em inglês por equivalentes brasileiros:
feedback → retorno / resposta
insight → percepção / ideia / visão
deadline → prazo
performance → desempenho
pipeline → funil / fluxo
mindset → mentalidade
checklist → lista de verificação
gap → lacuna

3. CALQUES E VÍCIOS DE IA
Elimine expressões artificiais:
no final do dia → no fundo / em última análise
fazer sentido → ter sentido
alavancar → impulsionar / potencializar
Remover clichês: "Além disso", "Certamente", "Vale ressaltar", "Em um mundo cada vez mais".

4. ORTOGRAFIA E LÓGICA
Corrija erros de digitação e espaços duplos.

REGRAS DE EXECUÇÃO:
— Intervenha apenas onde há erro real ou vício de linguagem.
— Responda sempre no mesmo idioma do texto de entrada.`,
  },
  {
    id: 'articles',
    label: '📰 Articles Review',
    prompt: `Você é revisor sênior da Folha de S.Paulo. Tarefa: revisar artigos editoriais para publicação no site. Os textos são gerados por IA e escritos por autor estrangeiro — portanto, carregam vícios de tradução, marcadores de IA e estruturas não naturais. Seu trabalho é torná-los indistinguíveis de um texto escrito por jornalista brasileiro experiente, seguindo a norma culta do português brasileiro e a política editorial dos grandes veículos (Folha, Estadão, Valor Econômico).

BUSQUE:

1. TÍTULOS E SUBTÍTULOS EM TITLE CASE
Qualquer título, subtítulo, intertítulo, nome de seção ou pilar com maiúsculas no padrão americano. Regra: maiúscula SOMENTE na primeira palavra e em nomes próprios.
Ex.: "Pilar 5: O Futuro da Eficiência em Campo" → "Pilar 5: O futuro da eficiência em campo"

2. MARCADORES DE IA
— Clichês de abertura e transição: "Além disso", "Certamente", "É importante destacar", "Vale ressaltar", "Neste artigo vamos explorar", "Em um mundo cada vez mais", "Não é segredo que", "Vamos mergulhar", "Você já se perguntou", "Imagine um cenário onde"
— Travessão longo (—) usado como muleta estrutural em excesso.
— Parágrafos que começam com a mesma estrutura sintática em sequência.
— Frases genéricas: "Isso é fundamental para o sucesso", "A tecnologia veio para ficar".
— Encerramento com "Em resumo", "Concluindo", "Em última análise".

3. ESTRANGEIRISMOS E AMERICANISMOS
Substitua toda palavra estrangeira que tenha equivalente corrente em português brasileiro.
Ex.: "feedback" → "retorno", "insight" → "percepção", "stakeholder" → "parte interessada", "deadline" → "prazo", "follow-up" → "acompanhamento", "budget" → "orçamento", "target" → "meta", "mindset" → "mentalidade", "performance" → "desempenho", "gap" → "lacuna", "pipeline" → "funil".
Exceção: termos técnicos sem equivalente consolidado (ex.: "software", "CRM", "ERP") podem permanecer.

4. CALQUES DE TRADUÇÃO
Ex.: "no final do dia" → "no fundo", "alavancar resultados" → "impulsionar resultados", "fazer sentido" → "ter sentido", "customizar" → "personalizar".

5. NORMA CULTA E ESTILO JORNALÍSTICO BRASILEIRO
— Ordem direta (Sujeito-Verbo-Objeto).
— Uma frase = uma ideia. Parágrafos de no máximo 4 linhas.
— Cortar adjetivos vazios: "incrível", "fantástico", "revolucionário".
— Cortar advérbios de intensidade sem função: "extremamente", "absolutamente".

6. TERMOS TÉCNICOS — EXPLICAÇÃO EM PARÊNTESES
Na primeira ocorrência de siglas, inserir explicação entre parênteses.

7. ORTOGRAFIA, ESPAÇAMENTO E LÓGICA
Erros de digitação, espaços duplos, dados inconsistentes.

REGRAS:
— Intervenha em todo erro, vício de IA e desvio editorial.
— Mantenha a estrutura geral e a argumentação do autor.
— NÃO converta listas com marcadores em parágrafo corrido.
— Responda sempre no mesmo idioma do texto de entrada.
— Saída em texto puro. Sem Markdown (sem #, ##). Use negrito APENAS nas três etiquetas.

FORMATO (um bloco por correção):
**Original:** [cópia literal do trecho do texto de entrada]
**Sugestão:** [versão corrigida]
**Justificativa:** [motivo em uma frase]`,
  },
  {
    id: 'editorial',
    label: '🏆 Editorial Consultant & Scorer',
    prompt: `Role: Act as a Senior Editor-in-Chief for a premier and engaging Global business and technology publication (e.g., Forbes, Nikkei Business, HBR).

Objective: Evaluate the provided article for a business audience (C-Suite, CMOs, Business Owners, Mid-sized and Small Business). Provide a deep, actionable critique and a formal 10-Point Editorial Evaluation.

1. THE 10-POINT EDITORIAL SCORECARD
Evaluate the draft on a scale of 1–10 (10 being World-Class):
- Hook Strength: Immediate Urgency, Emotional Empathy, Relatable Pain Point
- Executive Resonance: ROI/Profitability, Risk Mitigation, Scaling Efficiency
- Creative Problem/Solution Logic: Frame Problem as "Bleeding Wound", Solution as "Strategic Asset"
- Quantified Benefits: Numbers over vague adjectives ("7 hours saved" vs "efficient")
- Cultural Nuance: Tone/logic adapted to the local market
- Skimmability: Headers, Bold, Lists for busy readers
- AEO/AI-Readiness: Formatted for AI Answer Engines
- Data Credibility: Statistics and research used effectively
- Narrative Flow: Seamless transition from Pain to Gain
- The "Non-Salesy" Factor: Genuine value without product pitch tone

2. BUSINESS AUDIENCE & MARKET STRATEGY
- Tone & Persona: Authoritative yet consultative voice
- The "Hidden Cost": Identify financial risk of inaction. Frame as [The Chaos Tax / The Complexity Tax / The Invisible Expense]

3. SEO & AEO
- Keyword Strategy: Identify 3–5 high-value keywords to anchor
- Direct Answer Block: 1-paragraph summary designed for AI-generated answer

4. CREATIVE NARRATIVE & LOCAL STORYTELLING
- Metaphorical Layer: Transform dry technical steps into a Narrative Philosophy
- The "Real-World" Case: Story-based example of a business illustrating the Solution

5. HARD-HITTING NUMERICS & ROI
- The "Problem" Formula: Copy-pasteable formula to prove the current cost of the problem
- The "Benefit" Projection: Creative way to highlight financial gain
- Research Anchors: Suggest specific research to add Social Proof

OUTPUT FORMAT:
Scorecard Table → Executive Summary → Redline List (blunt, specific edits) → Final Verdict: Publish As-Is / Minor Polish / Major Rewrite`,
  },
  {
    id: 'localization',
    label: '🌎 Localization PT-BR',
    prompt: `Ты — Senior SaaS Localization Copywriter. Твоя задача — маркетинговая локализация текстов для продукта Bitrix24 на бразильский португальский язык (PT-BR).

[ГЛАВНЫЙ ПРИНЦИП]
Это не дословный перевод, а адаптация для рынка Бразилии.
Формула: clareza + objetividade + naturalidade brasileira.
Текст должен звучать современно, технологично и коротко. Уровень: HubSpot Brasil, RD Station, Zendesk.

[СТИЛЬ И ТОН]
Нейтрально-маркетинговый, профессиональный, уверенный (без агрессивного hype-тона и клише).
Короткие предложения, активный залог (✅ Gerencie sua equipe ❌ Plataforma que permite gerenciar).
Формулы: Controle total, Tudo em um único lugar, Centralize sua equipe, Gerencie [objeto].

[ЖЕСТКИЕ ПРАВИЛА (CRITICAL RULES)]
Капитализация: В заголовках и терминах с заглавной пишется ТОЛЬКО первое слово (✅ Gestão da equipe de vendas ❌ Gestão Da Equipe De Vendas).
Глоссарий: Если английский термин есть в словаре ниже — используй СТРОГО его PT-BR версию. Запрещено придумывать синонимы.
Валюта и даты: R$ [сумма]/mês (пробел после R$), 1 a 31 de dezembro.
UX/UI: Текст интерфейсов и кнопок должен быть максимально лаконичным.
Культурный код: Избегай упоминания фиолетового цвета в маркетинге. Запрещен европейский португальский (PT-PT).

[ОБЯЗАТЕЛЬНЫЙ ГЛОССАРИЙ: EN -> PT-BR]
Core & Workspace: Online workspace -> Espaço de trabalho on-line, All-in-one platform -> Plataforma tudo-em-um, Dashboard -> Painel, Settings -> Configurações, Activity stream -> Feed de atividades, Interface -> Interface, Search -> Pesquisa.
Collaboration & HR: Team collaboration -> Colaboração em equipe, Workgroups -> Grupos de trabalho, Knowledge base -> Base de conhecimento, HR tools -> Ferramentas de RH, Time tracking -> Controle de tempo de trabalho, Worktime management -> Gestão do tempo de trabalho, Absence management -> Gestão de ausências, Onboarding -> Integração de funcionários, Candidate screening -> Triagem de candidatos.
Tasks & Projects: Tasks -> Tarefas, Task owner -> Responsável pela tarefa, Assignee -> Executor, Deadline -> Prazo, Task list -> Lista de tarefas, Task templates -> Modelos de tarefas, Checklists -> Checklists, Project timeline -> Linha do tempo do projeto, Kanban board -> Quadro Kanban, Gantt chart -> Gráfico de Gantt, Recurring tasks -> Tarefas recorrentes.
CRM & Sales: Lead capture -> Captação de leads, Lead source -> Origem do lead, Deal -> Negócio, Sales funnel -> Funil de vendas, Sales pipelines -> Funis de vendas, Recurring deals -> Negócios recorrentes, Sales enablement -> Habilitação de vendas, Customer database -> Base de clientes.
Contact Center & Telephony: Contact center -> Central de contato, Omnichannel communication -> Comunicação omnichannel, Live chat -> Chat ao vivo, Telephony -> Telefonia Bitrix24, Incoming calls -> Chamadas recebidas, Voicemail -> Correio de voz, IVR -> URA (Resposta de voz interativa), Call routing -> Roteamento de chamadas, Call blocking -> Bloqueio de chamadas, Blacklist -> Lista negra.
Video & Comm: Video calls -> Videochamadas, Meetings -> Reuniões, Screen sharing -> Compartilhamento de tela, Meeting recording -> Gravação de reunião, Team chat -> Chat da equipe.
Docs & Automation: Documents -> Documentos, Files -> Arquivos, Cloud storage -> Armazenamento em nuvem, Workflow automation -> Automação de fluxos de trabalho, Business processes -> Processos de negócios, Triggers -> Gatilhos, Approval workflow -> Fluxos de aprovação automatizados.
Analytics, Marketing & Site: Reports & analytics -> Relatórios e análises, BI Builder -> Criador de BI, Data visualization -> Visualização de dados, KPIs -> KPIs, Marketing automation -> Automação de marketing, Lead nurturing -> Nutrição de leads, Landing pages -> Landing pages, Website builder -> Criador de sites visual, no-code, Online marketing -> Marketing on-line.
AI Features: AI tools -> Ferramentas de IA, AI-powered sales -> Vendas com IA, AI automation -> Automação com IA, AI listing generation -> Geração de descrições por IA, AI assistant -> Assistente de IA.
Real Estate CRM: Real estate CRM software -> Software CRM imobiliário, Listing management -> Gestão de imóveis, Property listings -> Imóveis cadastrados, Real estate agent -> Corretor de imóveis, Agency owner -> Dono de imobiliária.
Mobile: Mobile app -> Aplicativo móvel, Works from smartphone -> Funciona no celular, Push notifications -> Notificações push.
Pricing & Plans: Cloud plans -> Planos Cloud, On-Premise editions -> Edições On-Premise, Fixed monthly/annual fee -> Tarifa fixa mensal/anual, Up to 35% off -> até 35% de desconto, Holiday sale -> Promoção de fim de ano.
UI & Actions: Create -> Criar, Edit -> Editar, Delete -> Excluir, Save -> Salvar, Cancel -> Cancelar, Apply -> Aplicar, Upload -> Enviar, Download -> Baixar.
CTAs: Get started -> Começar, Learn more -> Saiba mais, Try for free -> Testar gratuitamente, Create account -> Criar conta, Invite users -> Convidar usuários, Go to my account -> Acessar minha conta.

[АЛГОРИТМ ТВОЕЙ РАБОТЫ]
1. Проанализируй текст и примени глоссарий.
2. Сделай смысловой перевод в стиле SaaS PT-BR (active voice).
3. Проверь капитализацию.
4. Сформируй ответ СТРОГО по шаблону ниже.

[СТРОГИЙ ФОРМАТ ОТВЕТА (OUTPUT FORMAT)]
Ты должен выдать ответ ровно в таком виде. Запрещены любые вступительные слова (вроде "Aqui está..." или "Конечно, вот перевод"). Сначала ТОЛЬКО готовый текст, затем разделитель, затем твои комментарии.

[ТОЛЬКО ЛОКАЛИЗОВАННЫЙ ТЕКСТ (без кавычек и лишних тегов)]

Observações:
• [Краткий буллет-поинт о примененных терминах из глоссария]
• [Краткий буллет-поинт о сокращениях/active voice]
• [Краткий буллет-поинт о проверке капитализации]`,
  },
];

// ── CSS ───────────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --cyan:#2fc7f7;--cyan-dark:#0066a1;--lime:#C9FF36;
  --bg:#F0F2F5;--white:#fff;--border:#E2E6ED;
  --text:#0D0D0D;--muted:#6B7280;--muted2:#9CA3AF;
  --radius:12px;
  --shadow:0 1px 4px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.04);
  --shadow-md:0 4px 16px rgba(47,199,247,0.10),0 0 0 1px rgba(0,0,0,0.04);
  --font:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono',monospace;
}
html,body,#root{height:100%;overflow:hidden}
body{font-family:var(--font);background:var(--bg);color:var(--text)}
.layout{display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* ── Top bar ── */
.topbar{
  height:48px;background:var(--white);border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 16px;flex-shrink:0;gap:12px;
}
.brand{display:flex;align-items:center;gap:8px;flex-shrink:0}
.brand-duck{width:26px;height:26px}
.brand-name{font-size:14px;font-weight:700;line-height:1;color:var(--text)}
.brand-sub{font-size:9px;color:var(--cyan-dark);font-weight:600;line-height:1.3}
.topbar-controls{display:flex;align-items:center;gap:8px;flex:1;justify-content:flex-end}
.demo-badge{
  font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;
  background:var(--lime);color:var(--text);flex-shrink:0;
}
.provider-select{
  height:30px;border:1.5px solid var(--border);border-radius:8px;
  padding:0 8px;font-size:12px;font-family:var(--font);
  background:var(--white);outline:none;cursor:pointer;
  transition:border-color 0.15s;min-width:0;
}
.provider-select:focus{border-color:var(--cyan)}

/* ── Mode bar ── */
.modebar{
  background:var(--white);border-bottom:1px solid var(--border);
  padding:8px 16px;flex-shrink:0;
}
.mode-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:6px}
.mode-pills{display:flex;gap:6px;flex-wrap:wrap}
.mode-pill{
  border:1.5px solid var(--border);border-radius:999px;
  background:var(--white);padding:5px 12px;
  font-size:12px;font-weight:500;cursor:pointer;
  font-family:var(--font);color:var(--muted);
  transition:all 0.15s;white-space:nowrap;
}
.mode-pill:hover{border-color:var(--cyan);color:var(--text)}
.mode-pill.active{
  border-color:var(--cyan);background:#EBF9FE;
  color:var(--cyan-dark);font-weight:600;
}

/* ── Editor area ── */
.editors{flex:1;display:flex;gap:10px;padding:10px 12px;min-height:0;overflow:hidden}
.editor-panel{
  flex:1;display:flex;flex-direction:column;
  background:var(--white);border:1px solid var(--border);
  border-radius:var(--radius);box-shadow:var(--shadow);
  min-width:0;overflow:hidden;
}
.editor-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;border-bottom:1px solid var(--border);flex-shrink:0;
}
.editor-title{font-size:12px;font-weight:600;color:var(--muted)}
.editor-meta{font-size:11px;color:var(--muted2)}
.editor-actions{display:flex;align-items:center;gap:4px}
.icon-btn{
  width:26px;height:26px;border:none;background:transparent;
  border-radius:6px;cursor:pointer;display:grid;place-items:center;
  font-size:14px;color:var(--muted2);transition:background 0.15s,color 0.15s;
}
.icon-btn:hover{background:#F4F6F9;color:var(--text)}
.chip{
  font-size:9px;font-weight:700;padding:2px 7px;
  border-radius:999px;border:1px solid transparent;
}
.chip-md{background:rgba(201,255,54,0.25);color:#5a7a00;border-color:rgba(201,255,54,0.5)}
.chip-plain{background:#F4F6F9;color:var(--muted);border-color:var(--border)}
.chip-words{background:rgba(47,199,247,0.12);color:var(--cyan-dark);border-color:rgba(47,199,247,0.3)}
.chip-tokens{background:rgba(201,255,54,0.18);color:#5a7a00;border-color:rgba(201,255,54,0.4)}
.view-toggle{display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden}
.view-btn{
  border:none;background:transparent;padding:3px 8px;
  font-size:11px;cursor:pointer;color:var(--muted2);font-family:var(--font);
  transition:background 0.15s,color 0.15s;
}
.view-btn.active{background:var(--bg);color:var(--text);font-weight:600}
.editor-body{flex:1;overflow:hidden;position:relative}
.editor-textarea{
  width:100%;height:100%;
  border:none;outline:none;resize:none;
  padding:12px 14px;font-family:var(--mono);
  font-size:12px;line-height:1.7;color:var(--text);
  background:transparent;
}
.editor-textarea::placeholder{color:var(--muted2);font-family:var(--font)}
.editor-textarea:disabled{color:var(--muted2);cursor:not-allowed}
.result-preview{
  height:100%;overflow-y:auto;padding:12px 14px;
  font-size:13px;line-height:1.75;color:var(--text);
}
.result-preview h1{font-size:1.4em;font-weight:700;color:var(--cyan-dark);margin:12px 0 6px}
.result-preview h2{font-size:1.2em;font-weight:700;color:var(--cyan-dark);margin:10px 0 4px}
.result-preview h3{font-size:1.05em;font-weight:600;margin:8px 0 4px}
.result-preview p{margin:0 0 10px}
.result-preview ul,.result-preview ol{padding-left:20px;margin:0 0 10px}
.result-preview li{margin:3px 0}
.result-preview strong{font-weight:700}
.result-preview blockquote{border-left:3px solid var(--cyan);padding-left:12px;margin:0 0 10px;color:var(--muted);font-style:italic}
.result-preview code{font-family:var(--mono);font-size:.88em;background:rgba(201,255,54,0.18);padding:1px 5px;border-radius:4px}
.result-preview pre{background:#F0F2F5;padding:12px;border-radius:8px;overflow-x:auto;margin:0 0 10px}
.result-preview pre code{background:transparent;padding:0}
.result-preview table{border-collapse:collapse;width:100%;margin:0 0 10px}
.result-preview th,.result-preview td{border:1px solid rgba(47,199,247,0.25);padding:5px 10px}
.result-preview th{background:rgba(47,199,247,0.10);color:var(--cyan-dark);font-weight:700}
.result-preview hr{border:none;border-top:1px solid var(--border);margin:12px 0}
.result-empty{
  height:100%;display:flex;align-items:center;justify-content:center;
  color:var(--muted2);font-size:13px;text-align:center;padding:20px;
}
.result-loading{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
.spinner{width:28px;height:28px;border:2.5px solid rgba(47,199,247,0.2);border-top-color:var(--cyan);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-text{font-size:13px;color:var(--muted2)}

/* ── Bottom bar ── */
.bottombar{
  height:52px;background:var(--white);border-top:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  padding:0 16px;gap:10px;flex-shrink:0;
}
.run-btn{
  height:36px;padding:0 28px;border:none;border-radius:999px;
  background:linear-gradient(135deg,var(--cyan) 0%,var(--cyan-dark) 100%);
  color:#fff;font-size:13px;font-weight:700;font-family:var(--font);
  cursor:pointer;display:flex;align-items:center;gap:8px;
  transition:opacity 0.15s,transform 0.15s;letter-spacing:0.02em;
}
.run-btn:hover:not(:disabled){opacity:0.9;transform:translateY(-1px)}
.run-btn:disabled{background:rgba(200,200,200,0.6);cursor:not-allowed;transform:none}
.run-lightning{color:var(--lime);font-size:15px}
.token-info{font-size:10px;color:var(--muted2);white-space:nowrap}
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_MODEL = 'gemini-2.5-flash';

// ── Simple markdown-to-html (reuse from ResultCard utils) ─────────────────────

function htmlFromMd(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (line) => line.startsWith('<') ? line : line);
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [selectedPromptId, setSelectedPromptId] = useState('lead-magnet');
  const [originalText, setOriginalText] = useState('');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState(DEFAULT_PROVIDER);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Prefill from Breason via ?text=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('text');
    if (prefill) setOriginalText(decodeURIComponent(prefill));
  }, []);

  // Load providers
  useEffect(() => {
    fetchModels()
      .then((data) => {
        setProviders(data);
        const first = data.find((p) => p.id === 'gemini') ?? data[0];
        if (first) {
          setSelectedProviderId(first.id);
          setSelectedModelId(first.models[0]?.id ?? '');
          setIsDemoMode(first.id === 'demo');
        }
      })
      .catch(() => {
        setIsDemoMode(true);
        setProviders([{ id: 'demo', name: 'Demo', models: [{ id: 'demo', label: 'Demo', providerId: 'demo' }] }]);
      });
  }, []);

  const currentProvider = providers.find((p) => p.id === selectedProviderId);
  const currentModels = currentProvider?.models ?? [];

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const prov = providers.find((p) => p.id === id);
    setSelectedProviderId(id);
    setSelectedModelId(prov?.models[0]?.id ?? '');
    setIsDemoMode(id === 'demo');
  };

  const handleProcess = useCallback(async () => {
    if (!originalText.trim()) { setError('Введите текст для обработки'); return; }
    const systemPrompt = PROMPTS.find((p) => p.id === selectedPromptId)?.prompt ?? '';
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await processText({ systemPrompt, text: originalText, modelId: selectedModelId, providerId: selectedProviderId });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка');
    } finally {
      setIsProcessing(false);
    }
  }, [originalText, selectedPromptId, selectedModelId, selectedProviderId]);

  const words = originalText.trim() ? originalText.trim().split(/\s+/).length : 0;
  const resultWords = result?.processedText.trim() ? result.processedText.trim().split(/\s+/).length : 0;

  const copyResult = async () => {
    if (result?.processedText) await navigator.clipboard.writeText(result.processedText);
  };

  return (
    <>
      <style>{STYLE}</style>
      <div className="layout">

        {/* ── Top bar ── */}
        <div className="topbar">
          <div className="brand">
            <img src="/duck.svg" alt="" className="brand-duck" />
            <div>
              <div className="brand-name">ReDuck</div>
              <div className="brand-sub">from Pavel</div>
            </div>
          </div>

          <div className="topbar-controls">
            {isDemoMode && <span className="demo-badge">Demo</span>}

            {providers.length > 1 && (
              <select className="provider-select" value={selectedProviderId} onChange={handleProviderChange} disabled={isProcessing}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {currentModels.length > 1 && (
              <select className="provider-select" value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)} disabled={isProcessing}>
                {currentModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.description ? ` — ${m.description}` : ''}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Mode bar ── */}
        <div className="modebar">
          <div className="mode-label">Режим проверки</div>
          <div className="mode-pills">
            {PROMPTS.map((p) => (
              <button
                key={p.id}
                className={`mode-pill${selectedPromptId === p.id ? ' active' : ''}`}
                onClick={() => setSelectedPromptId(p.id)}
                disabled={isProcessing}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Editors ── */}
        <div className="editors">
          {/* Input panel */}
          <div className="editor-panel">
            <div className="editor-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="editor-title">Оригинал</span>
                {originalText && (
                  <span className={`chip ${originalText.match(/^#{1,6}\s|\*\*|^[-*]\s/m) ? 'chip-md' : 'chip-plain'}`}>
                    {originalText.match(/^#{1,6}\s|\*\*|^[-*]\s/m) ? 'MD' : 'TXT'}
                  </span>
                )}
              </div>
              <div className="editor-actions">
                {originalText && <span className="editor-meta">{words} сл.</span>}
                {originalText && (
                  <button className="icon-btn" title="Очистить" onClick={() => setOriginalText('')}>✕</button>
                )}
              </div>
            </div>
            <div className="editor-body">
              <textarea
                className="editor-textarea"
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                disabled={isProcessing}
                placeholder={'Вставьте текст сюда…\n\nПоддерживается:\n• Обычный текст\n• Markdown\n• Rich Text из Google Docs'}
                spellCheck={false}
              />
            </div>
          </div>

          {/* Result panel */}
          <div className="editor-panel">
            <div className="editor-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="editor-title">{isProcessing ? 'Обработка…' : 'Результат'}</span>
                {result && !isProcessing && (
                  <>
                    <span className="chip chip-words">{resultWords} сл.</span>
                    {result.tokensUsed && <span className="chip chip-tokens">{result.tokensUsed} токенов</span>}
                  </>
                )}
              </div>
              {result && !isProcessing && (
                <div className="editor-actions">
                  <div className="view-toggle">
                    <button className={`view-btn${viewMode === 'preview' ? ' active' : ''}`} onClick={() => setViewMode('preview')}>Preview</button>
                    <button className={`view-btn${viewMode === 'raw' ? ' active' : ''}`} onClick={() => setViewMode('raw')}>Raw</button>
                  </div>
                  <button className="icon-btn" title="Скопировать" onClick={copyResult}>⎘</button>
                </div>
              )}
            </div>
            <div className="editor-body">
              {isProcessing ? (
                <div className="result-loading">
                  <div className="spinner" />
                  <div className="loading-text">ИИ форматирует текст…</div>
                </div>
              ) : result ? (
                viewMode === 'preview' ? (
                  <div
                    className="result-preview"
                    dangerouslySetInnerHTML={{ __html: htmlFromMd(result.processedText) }}
                  />
                ) : (
                  <textarea
                    className="editor-textarea"
                    value={result.processedText}
                    readOnly
                    spellCheck={false}
                  />
                )
              ) : (
                <div className="result-empty">
                  Результат появится здесь
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="bottombar">
          <button
            className="run-btn"
            onClick={handleProcess}
            disabled={isProcessing || !originalText.trim()}
          >
            {isProcessing ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />ОБРАБОТКА…</>
            ) : (
              <><span className="run-lightning">⚡</span>Нормально делай — нормально будет</>
            )}
          </button>
          {result?.model && (
            <span className="token-info">{result.model}</span>
          )}
        </div>

      </div>

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
