import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_CHARS = 8000;
const BLOCKED_DOMAINS = ['twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'linkedin.com', 'tiktok.com'];

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

function cleanText(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*[-*>]\s/gm, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL обязателен' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      parsedUrl = new URL(normalized);
    } catch {
      return NextResponse.json({ error: 'Некорректный формат URL' }, { status: 400 });
    }

    const domain = extractDomain(parsedUrl.href);

    if (BLOCKED_DOMAINS.some(d => domain.includes(d))) {
      return NextResponse.json({
        error: `${domain} требует авторизации и не может быть прочитан. Вставьте текст вручную.`
      }, { status: 422 });
    }

    console.log(`🌐 Jina fetch: ${parsedUrl.href}`);

    const jinaUrl = `https://r.jina.ai/${parsedUrl.href}`;

    const jinaRes = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        ...(process.env.JINA_API_KEY
          ? { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` }
          : {}
        ),
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!jinaRes.ok) {
      return NextResponse.json({
        error: `Не удалось загрузить страницу (${jinaRes.status}). Попробуйте вставить текст вручную.`
      }, { status: 422 });
    }

    const rawText = await jinaRes.text();

    if (!rawText || rawText.length < 100) {
      return NextResponse.json({
        error: 'Страница пустая или требует авторизации. Вставьте текст вручную.'
      }, { status: 422 });
    }

    const cleaned   = cleanText(rawText);
    const truncated = cleaned.length > MAX_CHARS
      ? cleaned.slice(0, MAX_CHARS) + '\n\n[Текст обрезан для анализа]'
      : cleaned;

    return NextResponse.json({
      text:      truncated,
      url:       parsedUrl.href,
      domain:    domain,
      charCount: truncated.length,
      truncated: cleaned.length > MAX_CHARS,
    });

  } catch (error: any) {
    console.error('❌ fetch-url error:', error.message);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json({
        error: 'Превышено время ожидания. Сайт слишком медленный или блокирует запросы. Вставьте текст вручную.'
      }, { status: 504 });
    }

    return NextResponse.json({
      error: 'Не удалось загрузить страницу. Вставьте текст вручную.',
      details: error.message
    }, { status: 500 });
  }
}
