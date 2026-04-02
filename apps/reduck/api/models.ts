import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ProviderInfo } from './_providers';

// A provider appears in the list only if its API key env var is set.
// This way the frontend automatically shows only what's configured.

const ALL_PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', providerId: 'gemini', description: 'Быстрый, бесплатный' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', providerId: 'gemini', description: 'Баланс скорости и качества' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', providerId: 'gemini', description: 'Максимальная скорость' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', providerId: 'gemini', description: 'Стабильная версия' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', providerId: 'groq', description: 'Мощная и быстрая' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', providerId: 'groq', description: 'Максимальная скорость' },
      { id: 'qwen/qwen3-32b', label: 'Qwen3 32B', providerId: 'groq', description: 'Alibaba Qwen3' },
      { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', providerId: 'groq', description: 'Moonshot AI' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', providerId: 'openrouter', description: 'DeepSeek V3' },
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', providerId: 'openrouter', description: 'Alibaba Qwen' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', providerId: 'openrouter', description: 'Meta Llama' },
      { id: 'mistralai/mistral-small', label: 'Mistral Small', providerId: 'openrouter', description: 'Mistral AI' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', providerId: 'openai', description: 'Самая мощная' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', providerId: 'openai', description: 'Быстрая и дешёвая' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', providerId: 'anthropic', description: 'Лучший баланс' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', providerId: 'anthropic', description: 'Быстрый и лёгкий' },
    ],
  },
];

const ENV_KEYS: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const available = ALL_PROVIDERS.filter(
    (p) => !!process.env[ENV_KEYS[p.id]]
  );

  // If no keys are configured → return demo provider so frontend still works
  if (available.length === 0) {
    return res.status(200).json({
      providers: [
        {
          id: 'demo',
          name: 'Demo (нет ключей API)',
          models: [
            { id: 'demo', label: 'Demo Model', providerId: 'demo', description: 'Добавьте ключ API в настройках Vercel' },
          ],
        },
      ],
    });
  }

  return res.status(200).json({ providers: available });
}
