import type { ReDuckProcessRequest } from '@breason/types';
import { NextRequest } from 'next/server';
import { callAiWithFallback } from '@breason/shared';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json() as ReDuckProcessRequest;
    const { text, promptVersion = 'reduck/lead-magnet@1' } = body;

    if (!text?.trim()) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    const requestId = `reduck_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const aiResult = await callAiWithFallback(text, promptVersion, requestId);
    const fullText = aiResult.text ?? '';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chunks = fullText.match(/.{1,120}/g) ?? [fullText];

          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
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
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    console.error('ReDuck API error:', error);
    return Response.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
