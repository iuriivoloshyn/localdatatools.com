import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiKeyAuth } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { csvRoutes } from './routes/csv.js';
import { jobRoutes } from './routes/jobs.js';
import { docsRoutes } from './routes/docs.js';
import { keyRoutes } from './routes/keys.js';
import { serve } from '@hono/node-server';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({ origin: '*' }));

// Health check (no auth)
app.get('/', (c) => c.json({
  name: 'LocalDataTools API',
  version: '1.0.0',
  docs: '/docs',
  endpoints: [
    'POST /v1/csv/merge   - Append (stack) CSV files vertically (< 50MB)',
    'POST /v1/csv/join    - Join two CSV files on a key column (< 50MB)',
    'POST /v1/csv/analyze - Analyze CSV compatibility',
    'POST /v1/jobs/merge  - Large file merge via encrypted R2 storage (up to 1GB)',
    'POST /v1/jobs/join   - Large file join via encrypted R2 storage (up to 1GB)',
    'GET  /v1/jobs/:id/download?key=... - Download encrypted result',
  ],
}));

// Key generation (no auth, but rate limited) — must be before /v1/* auth
app.use('/v1/keys', rateLimiter);
app.route('/v1/keys', keyRoutes);

// API routes (with auth + rate limiting)
app.use('/v1/*', apiKeyAuth);
app.use('/v1/*', rateLimiter);
app.route('/v1/csv', csvRoutes);
app.route('/v1/jobs', jobRoutes);

// Docs (no auth)
app.route('/docs', docsRoutes);

const port = Number(process.env.PORT) || 4000;
console.log(`LocalDataTools API running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
