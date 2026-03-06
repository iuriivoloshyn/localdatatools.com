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
    { url: 'https://api.localdatatools.com', description: 'Production' },
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
    '/v1/csv/diff': {
      post: {
        tags: ['Direct (< 50MB)'],
        summary: 'Compare two CSV files',
        description: 'Find added, removed, and changed rows between two CSV files. Optionally specify a key column for row-level matching.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  left: { type: 'string', format: 'binary', description: 'Left (original) CSV file' },
                  right: { type: 'string', format: 'binary', description: 'Right (updated) CSV file' },
                  key: { type: 'string', description: 'Optional key column for row-level matching' },
                },
                required: ['left', 'right'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Diff result with added, removed, and changed rows' },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/csv/metadata': {
      post: {
        tags: ['Direct (< 50MB)'],
        summary: 'Extract CSV metadata and statistics',
        description: 'Analyze a CSV file to extract column types, row counts, null rates, and summary statistics (min, max, mean, median for numeric columns).',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'CSV file to analyze' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Metadata with column types, stats, and null rates' },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/csv/anonymize': {
      post: {
        tags: ['Direct (< 50MB)'],
        summary: 'Mask or redact PII in CSV columns',
        description: 'Auto-detects or manually targets columns containing PII (emails, phone numbers, names, SSNs) and masks or redacts them.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'CSV file to anonymize' },
                  columns: { type: 'string', description: 'Comma-separated column names to mask (auto-detect if omitted)' },
                  mode: { type: 'string', enum: ['mask', 'redact'], default: 'mask', description: 'mask = partial hiding, redact = full replacement' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Anonymized CSV file', content: { 'text/csv': {} } },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/convert/spreadsheet': {
      post: {
        tags: ['File Conversion'],
        summary: 'Convert between CSV and Excel',
        description: 'Upload a CSV to get an Excel file (.xlsx), or upload an Excel file to get CSV. Auto-detects direction based on file extension.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'CSV or Excel file' },
                  sheet: { type: 'string', description: 'Sheet name for Excel input (defaults to first sheet)' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Converted file (CSV or Excel)' },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/convert/image': {
      post: {
        tags: ['File Conversion'],
        summary: 'Convert between image formats',
        description: 'Convert images between PNG, JPEG, WebP, AVIF, TIFF, and GIF. Optionally resize.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Image file to convert' },
                  format: { type: 'string', enum: ['png', 'jpeg', 'webp', 'avif', 'tiff', 'gif'], description: 'Target format' },
                  quality: { type: 'string', description: 'Output quality 1-100 (default 80, applies to jpeg/webp/avif)' },
                  width: { type: 'string', description: 'Resize width in pixels (maintains aspect ratio)' },
                  height: { type: 'string', description: 'Resize height in pixels (maintains aspect ratio)' },
                },
                required: ['file', 'format'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Converted image file' },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/convert/document': {
      post: {
        tags: ['File Conversion'],
        summary: 'Convert PDF to text, DOCX, or JSON',
        description: 'Extract text from PDF files. Output as plain text, DOCX document, or structured JSON with metadata.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'PDF file' },
                  format: { type: 'string', enum: ['txt', 'docx', 'json'], default: 'txt', description: 'Output format' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Converted document' },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/v1/compress': {
      post: {
        tags: ['File Conversion'],
        summary: 'Compress or decompress files',
        description: 'Compress any file with gzip or deflate, or decompress a .gz/.zz file.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'File to compress or decompress' },
                  action: { type: 'string', enum: ['compress', 'decompress'], default: 'compress' },
                  format: { type: 'string', enum: ['gzip', 'deflate'], default: 'gzip' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Compressed or decompressed file' },
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

// Redirect /docs to website docs page
docsRoutes.get('/', (c) => {
  return c.redirect('https://localdatatools.com/api-docs');
});
