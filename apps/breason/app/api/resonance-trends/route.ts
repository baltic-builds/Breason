import { NextResponse } from 'next/server';

export async function POST() {
  // Имитация работы AI
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return NextResponse.json({
    status: 'success',
    trends: [
      { id: 1, name: 'AI Automation', power: 'High' },
      { id: 2, name: 'Sustainable Energy', power: 'Medium' }
    ]
  });
}

// Добавим GET на случай, если ты просто переходишь по ссылке в браузере
export async function GET() {
  return NextResponse.json({ message: "Используйте POST запрос для получения трендов" });
}
