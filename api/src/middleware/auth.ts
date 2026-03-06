import type { MiddlewareHandler } from 'hono';

// In-memory key store. Replace with DB lookup for production.
// Set API_KEYS env var with comma-separated keys. "demo-key-123" is only for local dev.
const rawKeys = process.env.API_KEYS || (process.env.NODE_ENV === 'production' ? '' : 'demo-key-123');
const API_KEYS = new Set(rawKeys.split(',').map(k => k.trim()).filter(Boolean));

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key') || c.req.query('api_key');

  if (!key || !API_KEYS.has(key)) {
    return c.json({ error: 'Invalid or missing API key. Pass X-API-Key header.' }, 401);
  }

  await next();
};
