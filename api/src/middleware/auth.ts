import type { MiddlewareHandler } from 'hono';
import { getValidKeys } from '../services/keys.js';

// Static keys from env var (fallback / admin keys)
const rawKeys = process.env.API_KEYS || '';
const STATIC_KEYS = new Set(rawKeys.split(',').map(k => k.trim()).filter(Boolean));

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key') || c.req.query('api_key');

  if (!key) {
    return c.json({ error: 'Missing API key. Pass X-API-Key header.' }, 401);
  }

  // Check static keys first (fast path)
  if (STATIC_KEYS.has(key)) {
    await next();
    return;
  }

  // Check R2-stored keys
  try {
    const dynamicKeys = await getValidKeys();
    if (dynamicKeys.has(key)) {
      await next();
      return;
    }
  } catch {
    // R2 unavailable — fall through to rejection
  }

  return c.json({ error: 'Invalid API key.' }, 401);
};
