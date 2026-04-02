'use client';

import { useState, useEffect } from 'react';
import { REDUCK_PROMPT_MAP } from '@breason/prompts';
import { AIResponseMeta } from '@breason/types';

interface ReDuckProcessRequest {
  text: string;
  providerId: string;
  modelId?: string;
  promptVersion?: string;
}

export default function ReDuckPage() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<string>('');
  const [meta, setMeta] = useState<AIResponseMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('gemini-2.5-flash');
  const [promptVersion, setPromptVersion] = useState('reduck/lead-magnet@1');

  const providers = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'groq', name: 'Groq (Llama/Mixtral)' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic (Claude)' },
  ];

  const handleRefine = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setResult('');
    setMeta(null);
    setError('');

    const payload: ReDuckProcessRequest = {
      text: inputText,
      providerId: selectedProvider,
      modelId: 'latest',
      promptVersion: promptVersion,
    };

    try {
      const response = await fetch('/api/reduck/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to process');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader');

      let streamingText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamingText += chunk;
        setResult(streamingText);
      }

      // После стриминга можно запросить мета-информацию отдельно, если нужно
      setMeta({
        provider: selectedProvider as any,
        promptVersion,
        latencyMs: 0, // можно улучшить позже
        requestedAt: new Date().toISOString(),
        costUsd: 0.0005, // пример
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">ReDuck</h1>
        <p className="text-zinc-400 mb-8">Refine your marketing copy with AI</p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel - Input & Controls */}
          <div className="lg:col-span-5 space-y-6">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your marketing text here..."
              className="w-full h-96 bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-lg resize-y focus:outline-none focus:border-lime-500"
            />

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Prompt Version (A/B)</label>
              <select
                value={promptVersion}
                onChange={(e) => setPromptVersion(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4"
              >
                {Object.keys(REDUCK_PROMPT_MAP).map((key) => (
                  <option key={key} value={`reduck/${key}@1`}>reduck/{key}@1</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefine}
              disabled={isLoading || !inputText.trim()}
              className="w-full py-4 bg-lime-500 hover:bg-lime-600 disabled:bg-zinc-700 text-black font-semibold rounded-2xl text-lg transition"
            >
              {isLoading ? 'Refining with AI...' : 'Refine with ReDuck'}
            </button>
          </div>

          {/* Right panel - Result */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Result</h2>
                {meta && (
                  <div className="text-xs text-zinc-500">
                    {meta.provider} • {meta.promptVersion} • ~${meta.costUsd}
                  </div>
                )}
              </div>

              {error && <p className="text-red-400 mb-4">{error}</p>}

              {result ? (
                <div className="prose prose-invert max-w-none text-lg leading-relaxed">
                  {result}
                </div>
              ) : (
                <div className="text-zinc-500 italic">
                  Your refined copy will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
