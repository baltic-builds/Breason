import { NextResponse } from "next/server";
import type { MarketKey } from "@breason/types";
import { resonanceTrends } from "@breason/shared";

async function fromTavily(_market: MarketKey) {
  if (!process.env.TAVILY_API_KEY) return null;
  return null;
}

async function fromGeminiGrounding(_market: MarketKey) {
  if (process.env.GEMINI_GROUNDING_ENABLED !== "true") return null;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = (searchParams.get("market") ?? "brazil") as MarketKey;

  const tavily = await fromTavily(market);
  if (tavily) return NextResponse.json(tavily);

  const grounded = await fromGeminiGrounding(market);
  if (grounded) return NextResponse.json(grounded);

  const fallback = await resonanceTrends(market);
  return NextResponse.json(fallback);
}
