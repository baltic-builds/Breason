import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';

  const trends = [
    {
      title: "Локальный B2B WhatsApp-маркетинг",
      resonanceScore: 95,
      insight: "В Бразилии сделки закрываются в мессенджерах быстрее, чем через почту.",
      narrative_hook: "Ваш клиент не читает email. Он ждет голосовое в WhatsApp."
    },
    {
      title: "Скептицизм к ИИ в Польше",
      resonanceScore: 88,
      insight: "Польский рынок ценит человеческую экспертизу выше автоматизации.",
      narrative_hook: "Покажите людей за алгоритмом, или вам не поверят."
    }
  ];

  return NextResponse.json({ trends });
}
