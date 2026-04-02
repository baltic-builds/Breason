import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callOpenAICompatible,
  callAnthropic,
  callGemini,
  type ProcessRequest,
  type ProcessResult,
} from './_providers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as Partial<ProcessRequest>;

  const systemPrompt = body.systemPrompt?.trim();
  const text = body.text?.trim();
  const providerId = body.providerId ?? 'demo';
  const modelId = body.modelId ?? '';

  if (!systemPrompt) return res.status(400).json({ error: 'systemPrompt is required' });
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (text.length > 200_000) return res.status(400).json({ error: 'Text too long (max 200 000 chars)' });

  try {
    const result = await dispatch(providerId, modelId, systemPrompt, text);
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}

async function dispatch(
  providerId: string,
  modelId: string,
  systemPrompt: string,
  text: string
): Promise<ProcessResult> {

  // ── Demo ────────────────────────────────────────────────────────────────────
  if (providerId === 'demo') {
    return {
      processedText: text + '\n\n---\n*[Demo: добавьте API-ключ в настройках Vercel]*',
      model: 'demo',
      provider: 'demo',
    };
  }

  // ── Google Gemini ────────────────────────────────────────────────────────────
  if (providerId === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY не задан в переменных окружения Vercel');
    const { content, tokensUsed } = await callGemini(apiKey, modelId, systemPrompt, text);
    return { processedText: content, tokensUsed, model: modelId, provider: 'gemini' };
  }

  // ── Groq (OpenAI-compatible) ─────────────────────────────────────────────────
  if (providerId === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY не задан в переменных окружения Vercel');
    const { content, tokensUsed } = await callOpenAICompatible(
      apiKey, 'https://api.groq.com/openai', modelId, systemPrompt, text
    );
    return { processedText: content, tokensUsed, model: modelId, provider: 'groq' };
  }

  // ── OpenRouter (OpenAI-compatible) ───────────────────────────────────────────
  if (providerId === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY не задан в переменных окружения Vercel');
    const { content, tokensUsed } = await callOpenAICompatible(
      apiKey, 'https://openrouter.ai/api', modelId, systemPrompt, text
    );
    return { processedText: content, tokensUsed, model: modelId, provider: 'openrouter' };
  }

  // ── OpenAI ───────────────────────────────────────────────────────────────────
  if (providerId === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY не задан в переменных окружения Vercel');
    const { content, tokensUsed } = await callOpenAICompatible(
      apiKey, 'https://api.openai.com', modelId, systemPrompt, text
    );
    return { processedText: content, tokensUsed, model: modelId, provider: 'openai' };
  }

  // ── Anthropic ────────────────────────────────────────────────────────────────
  if (providerId === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY не задан в переменных окружения Vercel');
    const { content, tokensUsed } = await callAnthropic(apiKey, modelId, systemPrompt, text);
    return { processedText: content, tokensUsed, model: modelId, provider: 'anthropic' };
  }

  throw new Error(`Неизвестный провайдер: ${providerId}`);
}
