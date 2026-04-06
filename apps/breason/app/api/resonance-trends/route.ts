import { NextResponse } from 'next/server';

export async function POST() {
  // Эмуляция задержки для отображения "AI изучает рынок..."
  await new Promise(resolve => setTimeout(resolve, 2500));

  return NextResponse.json({
    status: 'success',
    message: 'Тренды успешно проанализированы',
    data: [
      { market: 'Global', trend: 'Growing', AI_Impact: 'High' }
    ]
  });
}
