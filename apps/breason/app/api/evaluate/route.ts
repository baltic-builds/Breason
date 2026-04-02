import { NextResponse } from "next/server";
import { analyzeMarketing } from "@breason/shared";
import type { AnalyzeRequest } from "@breason/types";

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeRequest;
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  const result = await analyzeMarketing(body.text, body.market);
  return NextResponse.json(result);
}
