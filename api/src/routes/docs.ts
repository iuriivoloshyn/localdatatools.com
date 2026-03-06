import { Hono } from 'hono';

export const docsRoutes = new Hono();

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'LocalDataTools API',
    version: '1.1.0',
    description: 'Privacy-first CSV processing API. Merge, join, and analyze CSV files via simple HTTP calls. Large files (up to 1GB) are encrypted at rest with AES-256-GCM — even the server operator cannot read them.',
    contact: { url: 'https://localdatatools.com' },
  },
  servers: [
    { url: 'https://localdatatools-api-674880939500.us-south1.run.app', description: 'Production' },
    { url: 'http://localhost:4000', description: 'Local development' },
  ],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
  paths: {
    '/v1/csv/analyze': {
      post: {
        tags: ['Direct (< 50MB)'],
        summary: 'Analyze CSV compatibility',
        description: 'Check if multiple CSV files have matching headers for vertical merge.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  files: { type: 'array', items: { type: 'string', format: 'binary' }, minItems: 2 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Compatibility analysis result' },
          '400': { description: 'Bad request' },
          '401': { description: 'Invalid API key' },
        },
      },
    },
    '/v1/csv/merge': {
      post: {
        tags: ['Direct (< 50MB)'],
        summary: 'Merge (append) CSV files vertically',
        description: 'Stack multiple CSV files. Headers from the first file are kept; subsequent headers are skipped. Returns the merged CSV directly.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  files: { type: 'array', items: { type: 'string', format: 'binary' }, minItems: 2 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Merged CSV file', content: { 'text/csv': {} } },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/csv/join': {
      post: {
        tags: ['Direct (< 50MB)'],
        summary: 'Join two CSV files on a key column',
        description: 'Perform a LEFT or INNER join on two CSV files. Returns the joined CSV directly.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  left: { type: 'string', format: 'binary', description: 'Left CSV file' },
                  right: { type: 'string', format: 'binary', description: 'Right CSV file' },
                  left_key: { type: 'string', description: 'Column name in left file to join on' },
                  right_key: { type: 'string', description: 'Column name in right file to join on' },
                  join_type: { type: 'string', enum: ['left', 'inner'], default: 'left' },
                  case_sensitive: { type: 'string', enum: ['true', 'false'], default: 'true' },
                },
                required: ['left', 'right', 'left_key', 'right_key'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Joined CSV file', content: { 'text/csv': {} } },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/jobs/merge': {
      post: {
        tags: ['Encrypted Jobs (up to 1GB)'],
        summary: 'Large file merge via encrypted storage',
        description: 'Same as /v1/csv/merge but for large files. Result is encrypted with AES-256-GCM and stored temporarily. Returns a jobId + fileKey for download. The fileKey is never stored on the server.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  files: { type: 'array', items: { type: 'string', format: 'binary' }, minItems: 2 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jobId: { type: 'string' },
                    fileKey: { type: 'string', description: 'Decryption key — save this, it is not stored on our servers' },
                    downloadUrl: { type: 'string' },
                    expiresIn: { type: 'string' },
                  },
                },
              },
            },
          },
          '503': { description: 'R2 storage not configured' },
        },
      },
    },
    '/v1/jobs/join': {
      post: {
        tags: ['Encrypted Jobs (up to 1GB)'],
        summary: 'Large file join via encrypted storage',
        description: 'Same as /v1/csv/join but for large files. Result is encrypted and stored temporarily.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  left: { type: 'string', format: 'binary' },
                  right: { type: 'string', format: 'binary' },
                  left_key: { type: 'string' },
                  right_key: { type: 'string' },
                  join_type: { type: 'string', enum: ['left', 'inner'], default: 'left' },
                  case_sensitive: { type: 'string', enum: ['true', 'false'], default: 'true' },
                },
                required: ['left', 'right', 'left_key', 'right_key'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Job created with encrypted result' },
          '503': { description: 'R2 storage not configured' },
        },
      },
    },
    '/v1/jobs/{id}/download': {
      get: {
        tags: ['Encrypted Jobs (up to 1GB)'],
        summary: 'Download and decrypt a job result',
        description: 'Fetches the encrypted file from storage, decrypts it with the provided key, and streams the CSV. File is deleted after download (one-time download).',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Job ID' },
          { name: 'key', in: 'query', required: true, schema: { type: 'string' }, description: 'Decryption fileKey from job creation response' },
        ],
        responses: {
          '200': { description: 'Decrypted CSV file', content: { 'text/csv': {} } },
          '400': { description: 'Missing key or decryption failed' },
          '404': { description: 'File not found or expired' },
        },
      },
    },
  },
};

// JSON spec
docsRoutes.get('/openapi.json', (c) => c.json(OPENAPI_SPEC));

// Simple HTML docs page using Swagger UI CDN
docsRoutes.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html><head>
  <title>LocalDataTools API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head><body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/docs/openapi.json', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body></html>`);
});
