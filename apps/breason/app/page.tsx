'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/resonance-trends', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('404 Not Found');
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Сервис временно недоступен или маршрут не найден.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#64748B]">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="bg-[#84CC16] text-[#FFFFFF] w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold transition-transform group-hover:scale-105">
            B
          </div>
          <span className="text-[#7C3AED] text-2xl font-black">
            Breason
          </span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto pt-20 px-6">
        {/* Индикаторы шагов - теперь яркие и четкие */}
        <div className="space-y-4 mb-10">
          <div className="flex items-center gap-3">
            <span className="text-[#84CC16] font-black text-lg uppercase tracking-wider">Шаг 1 · Искать</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#84CC16] font-black text-lg uppercase tracking-wider">Шаг 2 · Проверять</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#84CC16] font-black text-lg uppercase tracking-wider">Шаг 3 · Сделать красиво</span>
          </div>
        </div>

        <button
          onClick={fetchTrends}
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-[#7C3AED] text-white font-bold py-4 rounded-2xl transition-colors shadow-lg shadow-orange-200"
        >
          {loading ? 'AI изучает рынок...' : 'Найти тренды'}
        </button>

        {/* Результаты */}
        <div className="mt-12">
          {loading && (
            <div className="flex items-center justify-center space-x-2 animate-bounce">
              <div className="w-2 h-2 bg-[#7DD3FC] rounded-full"></div>
              <div className="w-2 h-2 bg-[#7DD3FC] rounded-full"></div>
              <div className="w-2 h-2 bg-[#7DD3FC] rounded-full"></div>
            </div>
          )}
          
          {result && (
            <div className={`p-6 rounded-2xl border-2 ${result.error ? 'border-[#F97316]' : 'border-[#7DD3FC] bg-blue-50/30'}`}>
              <p className="font-medium text-[#64748B]">
                {result.error || JSON.stringify(result.data)}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
