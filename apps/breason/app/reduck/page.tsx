```tsx
'use client';

import { useState } from 'react';
import { ReDuckProcessRequest, ReDuckProcessResult } from '@breason/types';

export default function ReDuckPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReDuckProcessResult | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('gemini-2.5-flash');

  const handleProcess = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    setStreamingText('');
    setResult(null);

    const payload: ReDuckProcessRequest = {
      systemPrompt: 'You are a world-class marketing copywriter...',
      text,
      providerId: selectedProvider,
      modelId: 'latest',
      promptVersion: 'reduck/lead-magnet@1',
    };

    const res = await fetch('/api/reduck/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      setStreamingText((prev) => prev + chunk);
    }

    // Финальный результат после стриминга
    setResult({
      processedText: streamingText,
      provider: selectedProvider as any,
      promptVersion: payload.promptVersion!,
      latencyMs: 0,
      requestedAt: new Date().toISOString(),
    });

    setIsLoading(false);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 border-r p-6">
        {/* ... твои пресеты и провайдеры ... */}
        <button
          onClick={handleProcess}
          disabled={isLoading}
          className="w-full bg-lime-500 text-white py-4 rounded-2xl font-semibold"
        >
          {isLoading ? 'Processing...' : 'Refine with ReDuck'}
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 p-8 overflow-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-64 p-4 border rounded-3xl"
          placeholder="Вставь текст для улучшения..."
        />

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Result</h2>
          <div className="prose max-w-none">
            {streamingText || result?.processedText}
          </div>
        </div>
      </div>
    </div>
  );
}
