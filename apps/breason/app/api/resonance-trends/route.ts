import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    trends: [
      { title: "WhatsApp-экономика", resonanceScore: 94, insight: "Прямые продажи в мессенджерах.", narrative_hook: "Ваш бизнес там, где ваш клиент — в WhatsApp." },
      { title: "Зеленый экспорт", resonanceScore: 88, insight: "Эко-сертификация для Европы.", narrative_hook: "Ваш продукт стоит дороже, если он экологичен." }
    ]
  });
}
