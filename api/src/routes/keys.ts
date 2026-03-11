import { Hono } from 'hono';
import { createKey } from '../services/keys.js';
import { isR2Configured } from '../services/r2.js';

export const keyRoutes = new Hono();

// POST /v1/keys — generate an API key (no auth required)
keyRoutes.post('/', async (c) => {
  if (!isR2Configured()) {
    return c.json({ error: 'Key generation is not available.' }, 503);
  }

  const body = await c.req.parseBody();
  const email = (body.email as string || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Valid email is required.' }, 400);
  }

  const key = await createKey(email);

  return c.json({
    apiKey: key,
    message: 'Save this key — it is hashed on our end and cannot be recovered. Generating a new key invalidates the previous one.',
  });
});
