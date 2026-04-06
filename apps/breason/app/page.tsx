'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Фирменная палитра:
  // Фиолетовый (Забота): #7C3AED
  // Воздушный Голубой (Доверие): #0EA5E9
  // Уверенный Металл (Надежность): #475569
  // Чистый Белый (Творчество): #FFFFFF
  // Теплый Оранжевый (Оптимизм): #F97316
  // Энергичный Лайм (Энергия): #84CC16

  const fetchTrends = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/resonance-trends', { method: 'POST' });
      if (!res.ok) throw new Error('Ошибка 404: Маршрут не найден');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: 'Ошибка при получении данных' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#475569]">
      {/* Header с кликабельным логотипом */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-3 group cursor-pointer">
          <div className="bg-[#84CC16] text-[#FFFFFF] w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold transition-transform group-hover:scale-105">
            B
          </div>
          <span className="text-[#7C3AED] text-2xl font-black">
            Breason
          </span>
        </Link>
      </header>

      <main className="max-w-xl mx-auto pt-16 px-6">
        {/* Яркие шаги (Энергичный Лайм) */}
        <div className="space-y-4 mb-10">
          <div className="text-[#84CC16] font-black text-xl uppercase tracking-wider">
            Шаг 1 · Искать
          </div>
          <div className="text-[#84CC16] font-black text-xl uppercase tracking-wider">
            Шаг 2 · Проверять
          </div>
          <div className="text-[#84CC16] font-black text-xl uppercase tracking-wider">
            Шаг 3 · Сделать красиво
          </div>
        </div>

        {/* Кнопка (Теплый Оранжевый) */}
        <button
          onClick={fetchTrends}
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-[#7C3AED] text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading ? 'AI изучает рынок...' : 'Найти тренды'}
        </button>

        {/* Результат */}
        <div className="mt-10">
          {loading && (
            <p className="text-[#0EA5E9] font-bold text-center animate-pulse">
              Анализируем рыночные данные...
            </p>
          )}
          {result && (
            <div className="p-6 rounded-2xl border-2 border-[#0EA5E9] bg-white">
               <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
               </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
