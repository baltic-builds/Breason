'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // Фирменные цвета:
  // Фиолетовый (Забота): #7C3AED
  // Воздушный Голубой (Доверие): #0EA5E9
  // Уверенный Металл (Надежность): #475569
  // Чистый Белый (Творчество): #FFFFFF
  // Теплый Оранжевый (Оптимизм): #F97316
  // Энергичный Лайм (Энергия): #84CC16

  const handleSearch = async () => {
    setLoading(true);
    setData(null);
    try {
      const response = await fetch('/api/resonance-trends', { method: 'POST' });
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#475569] font-sans">
      {/* Header - Кликабельный логотип и название */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-4 group cursor-pointer">
          <div className="bg-[#84CC16] text-[#FFFFFF] w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-black transition-transform group-hover:scale-110">
            B
          </div>
          <span className="text-[#7C3AED] text-3xl font-black tracking-tight">
            Breason
          </span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto pt-20 px-6">
        {/* Шаги - Яркий Энергичный Лайм */}
        <div className="flex flex-col gap-6 mb-12">
          <div className="text-[#84CC16] font-extrabold text-2xl tracking-wide drop-shadow-sm">
            Шаг 1 · Искать
          </div>
          <div className="text-[#84CC16] font-extrabold text-2xl tracking-wide drop-shadow-sm">
            Шаг 2 · Проверять
          </div>
          <div className="text-[#84CC16] font-extrabold text-2xl tracking-wide drop-shadow-sm">
            Шаг 3 · Сделать красиво
          </div>
        </div>

        {/* Кнопка - Теплый Оранжевый */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-[#F97316] hover:bg-[#7C3AED] text-white font-black py-5 rounded-3xl text-xl transition-all shadow-xl shadow-orange-100 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'AI изучает рынок...' : 'Найти тренды'}
        </button>

        {/* Результаты - Воздушный Голубой */}
        <div className="mt-12">
          {loading && (
            <div className="flex justify-center items-center gap-2">
              <div className="w-3 h-3 bg-[#0EA5E9] rounded-full animate-bounce" />
              <div className="w-3 h-3 bg-[#0EA5E9] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-3 h-3 bg-[#0EA5E9] rounded-full animate-bounce [animation-delay:-0.3s]" />
            </div>
          )}
          
          {data && (
            <div className="p-8 rounded-3xl border-4 border-[#0EA5E9] bg-[#FFFFFF] shadow-2xl">
              <h3 className="text-[#7C3AED] font-bold text-xl mb-4">Результаты анализа:</h3>
              <pre className="text-sm bg-[#F8FAFC] p-4 rounded-xl overflow-auto text-[#475569]">
                {JSON.stringify(data.trends, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
