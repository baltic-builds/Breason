'use client';

import { useState } from 'react';
import { REDUCK_PROMPT_MAP } from '@breason/prompts';
import type { AIResponseMeta, ReDuckProcessRequest } from '@breason/types';

export default function ReDuckPage() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [meta, setMeta] = useState<AIResponseMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('gemini-2.5-flash');
  const [promptVersion, setPromptVersion] = useState('reduck/lead-magnet@1');

  const providers = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'groq', name: 'Groq' },
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
      promptVersion,
    };

    try {
      const response = await fetch('/api/reduck/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to start processing');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamingText = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamingText += chunk;
        setResult(streamingText);
      }

      setMeta({
        provider: selectedProvider as any,
        promptVersion,
        latencyMs: Date.now(),
        requestedAt: new Date().toISOString(),
        costUsd: 0.0008,
      });
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">ReDuck</h1>
        <p className="text-zinc-400 mb-10">Улучшай маркетинговый текст с помощью AI</p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Панель ввода */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <label className="block text-sm text-zinc-400 mb-3">Ваш текст</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Вставьте сюда маркетинговый текст, который нужно улучшить..."
                className="w-full h-96 bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-lg focus:border-lime-500 focus:outline-none resize-y font-light"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Провайдер AI</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-white"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Версия промпта (A/B)</label>
              <select
                value={promptVersion}
                onChange={(e) => setPromptVersion(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-white"
              >
                {Object.keys(REDUCK_PROMPT_MAP).map((key) => (
                  <option key={key} value={`reduck/${key}@1`}>
                    reduck/{key}@1
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefine}
              disabled={isLoading || !inputText.trim()}
              className="w-full py-4 bg-lime-500 hover:bg-lime-600 disabled:bg-zinc-700 disabled:text-zinc-400 font-semibold rounded-2xl text-lg transition-colors"
            >
              {isLoading ? 'Обрабатываем с помощью AI...' : 'Улучшить текст с ReDuck'}
            </button>
          </div>

          {/* Панель результата */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 min-h-[520px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Результат улучшения</h2>
                {meta && (
                  <div className="text-xs text-lime-400">
                    {meta.provider} • {meta.promptVersion} • ~${meta.costUsd}
                  </div>
                )}
              </div>

              {error && <p className="text-red-400 mb-4">{error}</p>}

              {result ? (
                <div className="prose prose-invert max-w-none whitespace-pre-wrap text-[17px] leading-relaxed">
                  {result}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 italic">
                  Здесь появится улучшенная версия вашего текста
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
