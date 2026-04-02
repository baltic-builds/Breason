import { NextResponse } from "next/server";
import { featureFlags } from "@/lib/flags";

export async function GET() {
  return NextResponse.json(featureFlags);
}
