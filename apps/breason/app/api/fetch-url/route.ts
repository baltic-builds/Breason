import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
    }

    // Используем Jina AI Reader (r.jina.ai)
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        "Accept": "application/json",
        "X-Return-Format": "text", // Нам нужен чистый текст для анализа
        "X-Retain-Images": "none"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) throw new Error(`Jina Reader HTTP ${res.status}`);
    
    const data = await res.json();
    const content = data.data.content;
    const domain = new URL(url).hostname;

    return NextResponse.json({
      text: content.slice(0, 15000), // Защита от переполнения токенов (отдаем первые 15к символов)
      domain: domain,
      charCount: content.length,
      truncated: content.length > 15000
    });

  } catch (error: any) {
    console.error("❌ Fetch URL Error:", error.message);
    return NextResponse.json({ error: "Не удалось извлечь текст страницы. Возможно, сайт блокирует ботов." }, { status: 500 });
  }
}
