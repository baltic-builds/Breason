// Shared types for all AI providers

export interface ModelInfo {
  id: string;
  label: string;
  providerId: string;
  description?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}

export interface ProcessRequest {
  systemPrompt: string;
  text: string;
  modelId: string;
  providerId: string;
}

export interface ProcessResult {
  processedText: string;
  tokensUsed?: number;
  model: string;
  provider: string;
}

// ─── Base OpenAI-compatible provider ────────────────────────────────────────

export async function callOpenAICompatible(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  text: string
): Promise<{ content: string; tokensUsed: number }> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}

// ─── Anthropic provider (different API format) ──────────────────────────────

export async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  text: string
): Promise<{ content: string; tokensUsed: number }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.content
    ?.filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('') ?? '';

  return {
    content,
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

// ─── Gemini provider ─────────────────────────────────────────────────────────

export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  text: string
): Promise<{ content: string; tokensUsed: number }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokensUsed =
    (data.usageMetadata?.promptTokenCount ?? 0) +
    (data.usageMetadata?.candidatesTokenCount ?? 0);

  return { content, tokensUsed };
}
