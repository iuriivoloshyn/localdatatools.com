import type { MiddlewareHandler } from 'hono';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // 30 requests per minute

export const rateLimiter: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key') || c.req.query('api_key') || 'anonymous';
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;

  c.header('X-RateLimit-Limit', String(MAX_REQUESTS));
  c.header('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - bucket.count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_REQUESTS) {
    return c.json({ error: 'Rate limit exceeded. Try again later.' }, 429);
  }

  await next();
};
