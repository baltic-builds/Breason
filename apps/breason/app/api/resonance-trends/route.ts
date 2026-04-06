import { NextResponse } from 'next/server';

export async function POST() {
  // Эмуляция задержки
  await new Promise(resolve => setTimeout(resolve, 2000));

  return NextResponse.json({
    status: "success",
    message: "Рыночные тренды найдены",
    trends: [
      { id: 1, name: "Eco-Tech Solutions", potential: "High" },
      { id: 2, name: "Hyper-Personalization", potential: "Medium" }
    ]
  });
}
