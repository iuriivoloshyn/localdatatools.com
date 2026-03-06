import { Hono } from 'hono';
import { gzipSync, gunzipSync, deflateSync, inflateSync } from 'node:zlib';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for compression

export const compressRoutes = new Hono();

// POST /v1/compress - Compress or decompress files
compressRoutes.post('/', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  const action = typeof body['action'] === 'string' ? body['action'].toLowerCase() : 'compress';
  const format = typeof body['format'] === 'string' ? body['format'].toLowerCase() : 'gzip';

  if (!file) {
    return c.json({ error: 'Upload a file as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 100MB limit.' }, 400);
  }
  if (!['gzip', 'deflate'].includes(format)) {
    return c.json({ error: 'Supported formats: gzip, deflate' }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (action === 'decompress') {
    try {
      const decompressed = format === 'gzip' ? gunzipSync(buffer) : inflateSync(buffer);
      const originalName = file.name.replace(/\.(gz|gzip|zz|deflate)$/i, '') || 'decompressed';
      return new Response(decompressed, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${originalName}"`,
          'X-Original-Size': String(buffer.length),
          'X-Decompressed-Size': String(decompressed.length),
        },
      });
    } catch {
      return c.json({ error: 'Decompression failed. File may not be in the specified format.' }, 400);
    }
  }

  // Compress
  const compressed = format === 'gzip' ? gzipSync(buffer) : deflateSync(buffer);
  const ext = format === 'gzip' ? '.gz' : '.zz';
  const ratio = buffer.length > 0 ? +((1 - compressed.length / buffer.length) * 100).toFixed(1) : 0;

  return new Response(compressed, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.name}${ext}"`,
      'X-Original-Size': String(buffer.length),
      'X-Compressed-Size': String(compressed.length),
      'X-Compression-Ratio': `${ratio}%`,
    },
  });
});
