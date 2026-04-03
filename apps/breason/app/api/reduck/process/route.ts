import { NextRequest } from 'next/server';
import { callAiWithFallback } from '@breason/shared';
import { ReDuckProcessRequest } from '@breason/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ReDuckProcessRequest;
    const { text, providerId, modelId, promptVersion = 'reduck/lead-magnet@1' } = body;

    if (!text?.trim()) {
      return Response.json({ error: 'Текст обязателен' }, { status: 400 });
    }

    const requestId = `reduck_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Используем промпт из packages/prompts (по версии)
    const aiResult = await callAiWithFallback({
      prompt: text,
      promptVersion,
      providerId,
      modelId,
      requestId,
      temperature: 0.75,
      maxTokens: 2000,
    });

    const fullText = aiResult.text || aiResult.content || '';

    // Реальный SSE streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Разбиваем на небольшие чанки для красивого потока
          const chunks = fullText.match(/.{1,120}/g) || [fullText];

          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
            // Небольшая задержка для плавности (можно убрать)
            await new Promise((r) => setTimeout(r, 8));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('ReDuck API error:', error);
    return Response.json(
      { error: 'Произошла ошибка при обработке запроса' },
      { status: 500 }
    );
  }
}
