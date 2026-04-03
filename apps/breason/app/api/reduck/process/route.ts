import { NextRequest } from 'next/server';
import { callAiWithFallback } from '@breason/shared';
import { ReDuckProcessRequest } from '@breason/types';

export async function POST(req: NextRequest) {
  const { text, providerId, modelId, promptVersion } = (await req.json()) as ReDuckProcessRequest;

  if (!text?.trim()) {
    return new Response('{"error": "Текст обязателен"}', { status: 400 });
  }

  const requestId = `req_${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const prompt = `
Ты — мировой эксперт по маркетинговому копирайтингу.
Улучши следующий текст для целевой аудитории.
Сделай его более убедительным, эмоциональным и продающим.

Текст:
${text}
`;

        const result = await callAiWithFallback(prompt, promptVersion || 'reduck/lead-magnet@1', requestId);

        // Стримим результат по кусочкам (имитируем поток)
        const words = result.text.split(' ');
        for (let i = 0; i < words.length; i++) {
          controller.enqueue(new TextEncoder().encode(words[i] + ' '));
          await new Promise((r) => setTimeout(r, 8)); // плавный поток
        }

        controller.close();
      } catch (err) {
        console.error(err);
        controller.enqueue(new TextEncoder().encode('Ошибка при обработке запроса.'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
