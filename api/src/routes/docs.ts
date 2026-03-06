import { Hono } from 'hono';

export const docsRoutes = new Hono();

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'LocalDataTools API',
    version: '1.0.0',
    description: 'Privacy-first CSV processing API. Merge, join, and analyze CSV files via simple HTTP calls.',
    contact: { url: 'https://localdatatools.com' },
  },
  servers: [
    { url: 'https://api.localdatatools.com', description: 'Production' },
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
        summary: 'Merge (append) CSV files vertically',
        description: 'Stack multiple CSV files on top of each other. Headers from the first file are kept; headers from subsequent files are skipped.',
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
        summary: 'Join two CSV files on a key column',
        description: 'Perform a LEFT or INNER join on two CSV files using matching key columns.',
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
