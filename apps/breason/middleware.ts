import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Sliding-window rate limiter.
// Architecture is Upstash-compatible: to upgrade, swap the `store` Map for an
// Upstash Redis client and replace `getCount`/`increment` with pipeline calls.
//
// Current limits:
//   /api/analyze           — 20 req / minute per IP (AI-heavy)
//   /api/reduck/process    — 20 req / minute per IP (AI-heavy)
//   all other /api/*       — 60 req / minute per IP

interface Window {
  count: number;
  resetAt: number;
}

// In-memory store. Resets on server restart (fine for single-instance dev/serverless).
// Key: `${ip}:${route_bucket}`
const store = new Map<string, Window>();

const WINDOW_MS = 60_000;

const LIMITS: Array<{ match: (path: string) => boolean; limit: number }> = [
  { match: (p) => p === "/api/analyze" || p === "/api/reduck/process", limit: 20 },
  { match: (p) => p.startsWith("/api/"), limit: 60 },
];

function getBucket(pathname: string): { limit: number; key: string } {
  const rule = LIMITS.find((r) => r.match(pathname));
  const limit = rule?.limit ?? 60;
  // Group paths into buckets so /api/analyze and /api/reduck/process each have their own counter
  const key = pathname.startsWith("/api/analyze") ? "analyze"
    : pathname.startsWith("/api/reduck/process") ? "reduck-process"
    : "default";
  return { limit, key };
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) return NextResponse.next();

  const ip = (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );

  const { limit, key } = getBucket(request.nextUrl.pathname);
  const storeKey = `${ip}:${key}`;
  const now = Date.now();

  const win = store.get(storeKey);
  if (!win || now > win.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (win.count >= limit) {
    const retryAfter = Math.ceil((win.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(win.resetAt / 1000)),
        },
      }
    );
  }

  win.count += 1;
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(limit - win.count));
  return response;
}

export const config = { matcher: "/api/:path*" };
