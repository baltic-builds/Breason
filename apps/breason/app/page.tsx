'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Цвета:
  // Фиолетовый (Забота): #7C3AED | Воздушный Голубой (Доверие): #7DD3FC
  // Уверенный Металл (Надежность): #64748B | Чистый Белый (Творчество): #FFFFFF
  // Теплый Оранжевый (Оптимизм): #F97316 | Энергичный Лайм (Энергия): #84CC16

  const fetchTrends = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/resonance-trends', { method: 'POST' });
      if (!res.ok) throw new Error('404');
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: 'Ошибка API. Проверьте наличие route.ts' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#64748B]">
      {/* Header: Кликабельный логотип и текст */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="bg-[#84CC16] text-[#FFFFFF] w-10 h-10 flex items-center justify-center rounded-lg text-xl font-black transition-transform group-hover:scale-105">
            B
          </div>
          <span className="text-[#7C3AED] text-2xl font-black">
            Breason
          </span>
        </Link>
      </header>

      <main className="max-w-xl mx-auto pt-16 px-6">
        {/* Шаги: Яркий Энергичный Лайм */}
        <div className="space-y-6 mb-12">
          <div className="text-[#84CC16] font-black text-2xl uppercase tracking-tight">
            Шаг 1 · Искать
          </div>
          <div className="text-[#84CC16] font-black text-2xl uppercase tracking-tight">
            Шаг 2 · Проверять
          </div>
          <div className="text-[#84CC16] font-black text-2xl uppercase tracking-tight">
            Шаг 3 · Сделать красиво
          </div>
        </div>

        {/* Кнопка: Теплый Оранжевый */}
        <button
          onClick={fetchTrends}
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-[#7C3AED] text-white font-bold py-5 rounded-2xl transition-all shadow-xl disabled:opacity-50"
        >
          {loading ? 'AI изучает рынок...' : 'Найти тренды'}
        </button>

        {/* Результат: Воздушный Голубой */}
        <div className="mt-10">
          {loading && (
            <p className="text-[#7DD3FC] font-bold text-center animate-pulse text-lg">
              AI изучает рынок...
            </p>
          )}
          {result && (
            <div className="p-6 border-2 border-[#7DD3FC] rounded-2xl bg-[#FFFFFF] shadow-lg">
              <pre className="text-sm overflow-auto text-[#64748B]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
