import type { ReDuckProviderGroup } from "@breason/types";

export const runtime = "nodejs";

const ALL_PROVIDERS: ReDuckProviderGroup[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    models: [
      { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",      providerId: "gemini", description: "Best balance" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", providerId: "gemini", description: "Max speed" },
      { id: "gemini-2.0-flash",      label: "Gemini 2.0 Flash",      providerId: "gemini", description: "Stable" },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",  providerId: "groq", description: "Powerful + fast" },
      { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",   providerId: "groq", description: "Ultra fast" },
      { id: "qwen/qwen3-32b",          label: "Qwen3 32B",       providerId: "groq", description: "Alibaba" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: [
      { id: "deepseek/deepseek-chat",             label: "DeepSeek Chat", providerId: "openrouter" },
      { id: "meta-llama/llama-3.3-70b-instruct",  label: "Llama 3.3 70B", providerId: "openrouter" },
      { id: "mistralai/mistral-small",             label: "Mistral Small",  providerId: "openrouter" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4o",      label: "GPT-4o",      providerId: "openai", description: "Most capable" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", providerId: "openai", description: "Fast + cheap" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", providerId: "anthropic", description: "Best balance" },
      { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  providerId: "anthropic", description: "Fastest" },
    ],
  },
];

const ENV_KEYS: Record<string, string> = {
  gemini:     "GEMINI_API_KEY",
  groq:       "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  openai:     "OPENAI_API_KEY",
  anthropic:  "ANTHROPIC_API_KEY",
};

export async function GET(): Promise<Response> {
  const available = ALL_PROVIDERS.filter((p) => !!process.env[ENV_KEYS[p.id]]);

  if (available.length === 0) {
    return Response.json({
      providers: [{
        id: "demo", name: "Demo (no API keys)",
        models: [{ id: "demo", label: "Demo Model", providerId: "demo", description: "Add an API key to .env.local" }],
      }],
    });
  }

  return Response.json({ providers: available });
}
