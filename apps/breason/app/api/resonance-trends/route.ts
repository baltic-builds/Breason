import { NextRequest } from 'next/server';
import { resonanceTrends } from '@breason/shared';
import type { ResonanceTrendsResponse } from '@breason/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = (searchParams.get('market') ?? 'brazil') as string;

    const result: ResonanceTrendsResponse = await resonanceTrends(market);

    return Response.json(result);
  } catch (error) {
    console.error('Resonance trends error:', error);
    return Response.json(
      { error: 'Не удалось получить тренды. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
