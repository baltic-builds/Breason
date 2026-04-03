'use client';

import { useState, useRef } from 'react';
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

  const abortControllerRef = useRef<AbortController | null>(null);

  const providers = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'groq', name: 'Groq' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic (Claude)' },
  ];

  const handleRefine = async () => {
    if (!inputText.trim() || isLoading) return;

    // Отменяем предыдущий запрос, если есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Не удалось запустить обработку');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamingText = '';
      let buffer = '';

      if (!reader) throw new Error('Нет тела ответа');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');

        // Последняя часть может быть неполной — оставляем в буфере
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const data = part.slice(6); // убираем "data: "

            if (data === '[DONE]') {
              break;
            }

            streamingText += data;
            setResult(streamingText);
          }
        }
      }

      // Финальные метаданные (можно потом получать с сервера)
      setMeta({
        provider: selectedProvider as any,
        promptVersion,
        latencyMs: 0,
        requestedAt: new Date().toISOString(),
        costUsd: 0.0008,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // пользователь отменил — молча выходим
      }
      setError(err.message || 'Произошла ошибка при обработке');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      // Можно добавить toast, но для MVP оставляем просто alert
      alert('✅ Результат скопирован в буфер обмена');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-5xl font-bold tracking-tight">ReDuck</h1>
          <p className="text-zinc-400 mt-2 text-xl">
            Улучшай маркетинговый копирайтинг с помощью AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Панель ввода */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <label className="block text-sm text-zinc-400 mb-3">Ваш текст</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Вставьте сюда маркетинговый текст, который хотите улучшить..."
                className="w-full h-[420px] bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-lg focus:border-lime-500 focus:outline-none resize-y font-light"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Провайдер</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-white"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Версия промпта</label>
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
            </div>

            <button
              onClick={handleRefine}
              disabled={isLoading || !inputText.trim()}
              className="w-full py-4 bg-lime-500 hover:bg-lime-600 disabled:bg-zinc-700 disabled:text-zinc-400 font-semibold rounded-2xl text-lg transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-pulse">ReDuck думает...</span>
                </>
              ) : (
                'Улучшить текст →'
              )}
            </button>
          </div>

          {/* Панель результата */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 min-h-[560px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Результат ReDuck</h2>
                {meta && (
                  <div className="text-xs px-3 py-1 bg-zinc-800 rounded-full text-lime-400 font-mono">
                    {meta.provider} • {meta.promptVersion}
                  </div>
                )}
                {result && (
                  <button
                    onClick={copyResult}
                    className="text-xs px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-2xl transition-colors"
                  >
                    📋 Копировать
                  </button>
                )}
              </div>

              {error && <p className="text-red-400 mb-6">{error}</p>}

              {result ? (
                <div className="prose prose-invert max-w-none text-[17px] leading-relaxed whitespace-pre-wrap flex-1 overflow-auto">
                  {result}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center">
                  <p className="text-zinc-500 italic max-w-md">
                    Нажмите кнопку «Улучшить текст», чтобы увидеть улучшенную версию
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
