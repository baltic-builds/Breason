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
      const res = await fetch('/api/resonance-trends', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: "Ошибка соединения" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#475569]">
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-3 cursor-pointer group">
          <div className="bg-[#84CC16] text-[#FFFFFF] w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold transition-transform group-hover:scale-105">
            B
          </div>
          <span className="text-[#7C3AED] text-2xl font-black">Breason</span>
        </Link>
      </header>

      <main className="max-w-xl mx-auto pt-16 px-6">
        <div className="space-y-6 mb-12">
          {/* Яркий лаймовый для шагов */}
          <h2 className="text-[#84CC16] font-black text-2xl uppercase tracking-tighter">Шаг 1 · Искать</h2>
          <h2 className="text-[#84CC16] font-black text-2xl uppercase tracking-tighter">Шаг 2 · Проверять</h2>
          <h2 className="text-[#84CC16] font-black text-2xl uppercase tracking-tighter">Шаг 3 · Сделать красиво</h2>
        </div>

        <button
          onClick={fetchTrends}
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-[#7C3AED] text-white font-bold py-5 rounded-2xl transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? 'AI изучает рынок...' : 'Найти тренды'}
        </button>

        <div className="mt-10">
          {loading && <p className="text-[#0EA5E9] font-bold text-center animate-pulse">Анализ данных...</p>}
          {result && (
            <div className="p-6 border-2 border-[#0EA5E9] rounded-2xl bg-white shadow-lg">
              <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
