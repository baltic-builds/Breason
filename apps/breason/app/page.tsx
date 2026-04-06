'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Фирменные цвета:
  // Фиолетовый: #7C3AED
  // Воздушный Голубой: #7DD3FC
  // Уверенный Металл: #64748B
  // Чистый Белый: #FFFFFF
  // Теплый Оранжевый: #F97316
  // Энергичный Лайм: #84CC16

  const fetchTrends = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/resonance-trends', { method: 'POST' });
      if (!res.ok) throw new Error('Ошибка API');
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Не удалось загрузить тренды' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#64748B] font-sans">
      
      {/* Header */}
      <header className="p-6 flex items-center">
        <Link href="/" className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity">
          {/* Иконка B на лаймовом фоне */}
          <div className="bg-[#84CC16] text-[#FFFFFF] w-12 h-12 flex items-center justify-center rounded-xl text-2xl font-bold">
            B
          </div>
          {/* Надпись Breason */}
          <span className="text-[#7C3AED] text-2xl font-extrabold tracking-wide">
            Breason
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-6 mt-10">
        
        {/* Шаги - сделаны яркими за счет font-black и 100% opacity */}
        <div className="flex flex-col gap-4 mb-12">
          <div className="text-[#84CC16] font-black text-xl drop-shadow-sm">Шаг 1 · Искать</div>
          <div className="text-[#84CC16] font-black text-xl drop-shadow-sm">Шаг 2 · Проверять</div>
          <div className="text-[#84CC16] font-black text-xl drop-shadow-sm">Шаг 3 · Сделать красиво</div>
        </div>

        {/* Кнопка */}
        <button
          onClick={fetchTrends}
          disabled={loading}
          className="bg-[#F97316] text-[#FFFFFF] px-8 py-4 rounded-xl font-bold text-lg hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          Найти тренды
        </button>

        {/* Результат */}
        <div className="mt-10 min-h-[120px]">
          {loading && (
            <div className="text-[#7DD3FC] font-bold text-xl animate-pulse">
              AI изучает рынок...
            </div>
          )}
          
          {!loading && result && (
            <div className="p-6 border-l-4 border-[#7C3AED] bg-[#FFFFFF] shadow-sm rounded-r-xl">
              {result.error ? (
                <p className="text-red-500 font-bold">{result.error}</p>
              ) : (
                <div className="text-[#64748B]">
                  <h3 className="text-[#7C3AED] font-bold text-xl mb-2">{result.message}</h3>
                  <pre className="bg-[#F8FAFC] p-4 rounded-lg text-sm overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
