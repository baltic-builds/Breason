import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Утилита: стриппинг HTML без зависимостей ─────────────────────────────────
function stripHtml(html: string): string {
  return html
    // Удаляем скрипты, стили, SVG, nav, footer целиком
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Заменяем блочные теги на переносы
    .replace(/<\/?(p|div|section|article|li|h[1-6]|br)[^>]*>/gi, '\n')
    // Убираем все оставшиеся теги
    .replace(/<[^>]+>/g, ' ')
    // HTML entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    // Схлопываем пробелы и переносы
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Извлекаем основной контент из HTML (эвристика)
function extractMainContent(html: string): string {
  // Ищем main/article/content блок
  const mainMatch = html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch) return stripHtml(mainMatch[1]);

  // Ищем div с id/class содержащим content/main/body
  const contentMatch = html.match(/<div[^>]*(?:id|class)=["'][^"']*(?:content|main|article|body|post)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) return stripHtml(contentMatch[1]);

  // Fallback: весь body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return stripHtml(bodyMatch ? bodyMatch[1] : html);
}

// ── Стратегия 1: Native fetch с хорошими заголовками ─────────────────────────
async function fetchNative(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'ru,en;q=0.9,de;q=0.8',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const html = await res.text();
  const text = extractMainContent(html);
  if (text.length < 100) throw new Error('Extracted content too short');
  return text;
}

// ── Стратегия 2: Jina AI Reader (исправленные заголовки) ─────────────────────
async function fetchJina(url: string): Promise<string> {
  // Jina принимает URL без encodeURIComponent
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
      'X-Return-Format': 'text',
      'X-Retain-Images': 'none',
      'X-Timeout': '8',
      // Без X-API-Key работает на бесплатном тире (~200 req/day)
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const text = await res.text();
  if (!text || text.length < 50) throw new Error('Empty Jina response');
  return text;
}

// ── Стратегия 3: Microlink API (50 req/day бесплатно) ─────────────────────────
async function fetchMicrolink(url: string): Promise<string> {
  const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false&video=false&audio=false`;
  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Microlink HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'success') throw new Error(`Microlink: ${data.message || 'failed'}`);

  // Microlink возвращает description, title + иногда content
  const parts = [
    data.data?.title,
    data.data?.description,
    data.data?.content,
  ].filter(Boolean);

  if (!parts.length) throw new Error('No content from Microlink');
  return parts.join('\n\n');
}

// ── Главный обработчик с каскадом ────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !/^https?:\/\/.+/.test(url)) {
      return NextResponse.json({ error: 'Некорректный URL. Убедитесь, что ссылка начинается с https://' }, { status: 400 });
    }

    const domain = new URL(url).hostname;
    let text = '';
    let usedMethod = '';
    const errors: string[] = [];

    // Попытка 1: native fetch (самый быстрый, работает для большинства сайтов)
    try {
      text = await fetchNative(url);
      usedMethod = 'direct';
      console.log(`✅ Native fetch success for ${domain}`);
    } catch (e: any) {
      errors.push(`Native: ${e.message}`);
      console.warn(`⚠️ Native fetch failed: ${e.message}`);
    }

    // Попытка 2: Jina AI
    if (!text) {
      try {
        text = await fetchJina(url);
        usedMethod = 'jina';
        console.log(`✅ Jina fetch success for ${domain}`);
      } catch (e: any) {
        errors.push(`Jina: ${e.message}`);
        console.warn(`⚠️ Jina failed: ${e.message}`);
      }
    }

    // Попытка 3: Microlink
    if (!text) {
      try {
        text = await fetchMicrolink(url);
        usedMethod = 'microlink';
        console.log(`✅ Microlink success for ${domain}`);
      } catch (e: any) {
        errors.push(`Microlink: ${e.message}`);
        console.warn(`⚠️ Microlink failed: ${e.message}`);
      }
    }

    if (!text) {
      console.error('❌ All methods failed:', errors);
      return NextResponse.json({
        error: `Не удалось извлечь текст страницы. Возможные причины: сайт требует авторизацию, использует JavaScript-рендеринг (SPA), или закрыт от ботов. Попробуйте скопировать текст вручную.`,
        technicalDetails: errors.join(' | '),
      }, { status: 422 });
    }

    const trimmedText = text.slice(0, 15000);

    return NextResponse.json({
      text: trimmedText,
      domain,
      charCount: text.length,
      truncated: text.length > 15000,
      method: usedMethod,
    });

  } catch (error: any) {
    console.error('❌ Fetch URL fatal error:', error.message);
    return NextResponse.json({
      error: 'Внутренняя ошибка сервера. Попробуйте позже.',
    }, { status: 500 });
  }
}
