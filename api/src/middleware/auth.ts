import type { MiddlewareHandler } from 'hono';
import { getValidKeyHashes, hashKey } from '../services/keys.js';

// Static keys from env var (fallback / admin keys) — stored as hashes in memory
const rawKeys = process.env.API_KEYS || '';
const STATIC_KEY_HASHES = new Set(
  rawKeys.split(',').map(k => k.trim()).filter(Boolean).map(k => hashKey(k))
);

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('X-API-Key') || c.req.query('api_key');

  if (!key) {
    return c.json({ error: 'Missing API key. Pass X-API-Key header.' }, 401);
  }

  const incomingHash = hashKey(key);

  // Check static keys first (fast path)
  if (STATIC_KEY_HASHES.has(incomingHash)) {
    await next();
    return;
  }

  // Check R2-stored key hashes
  try {
    const dynamicHashes = await getValidKeyHashes();
    if (dynamicHashes.has(incomingHash)) {
      await next();
      return;
    }
  } catch {
    // R2 unavailable — fall through to rejection
  }

  return c.json({ error: 'Invalid API key.' }, 401);
};
