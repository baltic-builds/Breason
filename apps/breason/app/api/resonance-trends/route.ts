import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'brazil';

  // Имитация работы AI аналитика
  const trends = [
    {
      title: "Локализация через сообщества",
      resonanceScore: 92,
      insight: "В B2B Бразилии решения принимаются на основе личных рекомендаций в закрытых группах WhatsApp.",
      narrative_hook: "Перестаньте слать холодные письма — идите туда, где ваши клиенты пьют кофе.",
      marketTension: "Глобальные CRM против локального хаоса связей",
      why_now: "Рынок перенасыщен безличным софтом."
    },
    {
      title: "Эко-логистика 2.0",
      resonanceScore: 85,
      insight: "Растущий запрос на прозрачность углеродного следа в цепочках поставок.",
      narrative_hook: "Ваш экспорт стоит дороже, если он 'зеленый'.",
      marketTension: "Цена vs Экологичность",
      why_now: "Новые регуляции ЕС влияют на импорт из Латинской Америки."
    }
  ];

  return NextResponse.json({ 
    status: "success", 
    trends,
    analyst_note: `Рынок ${market} сейчас находится в фазе активного перехода на гибридные модели доверия.`
  });
}
