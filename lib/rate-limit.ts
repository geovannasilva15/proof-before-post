import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as typeof globalThis & {
  __proofBeforePostRateLimits?: Map<string, Bucket>;
};

const buckets = globalBuckets.__proofBeforePostRateLimits ??= new Map<string, Bucket>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(candidate).digest("hex").slice(0, 24);
}

export function checkRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${clientKey(request)}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
