import { NextResponse } from 'next/server';

export async function POST() {
  // Имитация задержки AI
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return NextResponse.json({
    status: 'success',
    data: [
      { trend: "AI Sustainability", strength: "High" },
      { trend: "Modular Architecture", strength: "Medium" }
    ]
  });
}
