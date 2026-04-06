import { NextResponse } from 'next/server';

export async function POST() {
  // Эмуляция задержки для UI
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return NextResponse.json({
    status: 'success',
    data: [
      { id: 1, trend: "AI Generated Content", resonance: "High" },
      { id: 2, trend: "Sustainability Tech", resonance: "Medium" }
    ]
  });
}
