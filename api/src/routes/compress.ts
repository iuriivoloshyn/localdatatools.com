import { Hono } from 'hono';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createWriteStream, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import archiver from 'archiver';
import sharp from 'sharp';
import { isR2Configured, storeEncrypted } from '../services/r2.js';

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const LARGE_FILE_MAX = 1024 * 1024 * 1024;

export const compressRoutes = new Hono();

// POST /v1/compress - Compress or decompress files
// Modes: gzip (per-file), zip (archive multiple files), image (lossy image compression)
compressRoutes.post('/', async (c) => {
  const body = await c.req.parseBody({ all: true });

  const mode = typeof body['mode'] === 'string' ? body['mode'].toLowerCase() : 'gzip';
  const action = typeof body['action'] === 'string' ? body['action'].toLowerCase() : 'compress';

  // --- GZIP mode: single file compress/decompress ---
  if (mode === 'gzip') {
    const file = (Array.isArray(body['file']) ? body['file'][0] : body['file']);
    if (!(file instanceof File)) {
      return c.json({ error: 'Upload a file as "file" form field.' }, 400);
    }
    if (file.size > LARGE_FILE_MAX) {
      return c.json({ error: 'File exceeds 1GB limit.' }, 400);
    }
    const isLargeGzip = file.size > MAX_FILE_SIZE;
    if (isLargeGzip && !isR2Configured()) {
      return c.json({ error: 'Large file storage not configured.' }, 503);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (action === 'decompress') {
      try {
        const decompressed = gunzipSync(buffer);
        const originalName = file.name.replace(/\.(gz|gzip)$/i, '') || 'decompressed';
        if (isLargeGzip) {
          const { jobId, fileKey } = await storeEncrypted(decompressed, { contentType: 'application/octet-stream', fileName: originalName });
          return c.json({ jobId, fileKey, downloadUrl: `/v1/jobs/${jobId}/download?key=${fileKey}`, expiresIn: '24 hours', size: decompressed.length, note: 'File is encrypted at rest. The fileKey is required to decrypt — it is not stored on our servers.' });
        }
        return new Response(new Uint8Array(decompressed), {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${originalName}"`,
            'X-Original-Size': String(buffer.length),
            'X-Decompressed-Size': String(decompressed.length),
          },
        });
      } catch {
        return c.json({ error: 'Decompression failed. File may not be gzip format.' }, 400);
      }
    }

    const compressed = gzipSync(buffer, { level: 6 });
    const ratio = buffer.length > 0 ? +((1 - compressed.length / buffer.length) * 100).toFixed(1) : 0;

    if (isLargeGzip) {
      const { jobId, fileKey } = await storeEncrypted(compressed, { contentType: 'application/gzip', fileName: `${file.name}.gz` });
      return c.json({ jobId, fileKey, downloadUrl: `/v1/jobs/${jobId}/download?key=${fileKey}`, expiresIn: '24 hours', size: compressed.length, note: 'File is encrypted at rest. The fileKey is required to decrypt — it is not stored on our servers.' });
    }

    return new Response(new Uint8Array(compressed), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${file.name}.gz"`,
        'X-Original-Size': String(buffer.length),
        'X-Compressed-Size': String(compressed.length),
        'X-Compression-Ratio': `${ratio}%`,
      },
    });
  }

  // --- ZIP mode: archive multiple files ---
  if (mode === 'zip') {
    const rawFiles = body['files'];
    const files = (Array.isArray(rawFiles) ? rawFiles : [rawFiles]).filter(
      (f): f is File => f instanceof File
    );

    if (files.length === 0) {
      return c.json({ error: 'Upload files as "files" form field.' }, 400);
    }

    let totalSize = 0;
    for (const f of files) {
      totalSize += f.size;
      if (totalSize > LARGE_FILE_MAX) {
        return c.json({ error: 'Total file size exceeds 1GB limit.' }, 400);
      }
    }
    const isLargeZip = totalSize > MAX_FILE_SIZE;
    if (isLargeZip && !isR2Configured()) {
      return c.json({ error: 'Large file storage not configured.' }, 503);
    }

    // Create ZIP in temp file
    const tmpPath = join(tmpdir(), `ldt-${randomBytes(8).toString('hex')}.zip`);
    const output = createWriteStream(tmpPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    const done = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      archive.append(buf, { name: f.name });
    }
    await archive.finalize();
    await done;

    const zipBuffer = readFileSync(tmpPath);
    unlinkSync(tmpPath);

    const originalTotal = files.reduce((s, f) => s + f.size, 0);
    const ratio = originalTotal > 0 ? +((1 - zipBuffer.length / originalTotal) * 100).toFixed(1) : 0;

    if (isLargeZip) {
      const { jobId, fileKey } = await storeEncrypted(zipBuffer, { contentType: 'application/zip', fileName: 'archive.zip' });
      return c.json({ jobId, fileKey, downloadUrl: `/v1/jobs/${jobId}/download?key=${fileKey}`, expiresIn: '24 hours', size: zipBuffer.length, note: 'File is encrypted at rest. The fileKey is required to decrypt — it is not stored on our servers.' });
    }

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="archive.zip"`,
        'X-Files-Count': String(files.length),
        'X-Original-Size': String(originalTotal),
        'X-Compressed-Size': String(zipBuffer.length),
        'X-Compression-Ratio': `${ratio}%`,
      },
    });
  }

  // --- Image mode: lossy image compression ---
  if (mode === 'image') {
    const file = (Array.isArray(body['file']) ? body['file'][0] : body['file']);
    if (!(file instanceof File)) {
      return c.json({ error: 'Upload an image as "file" form field.' }, 400);
    }
    if (file.size > LARGE_FILE_MAX) {
      return c.json({ error: 'File exceeds 1GB limit.' }, 400);
    }
    const isLargeImgCompress = file.size > MAX_FILE_SIZE;
    if (isLargeImgCompress && !isR2Configured()) {
      return c.json({ error: 'Large file storage not configured.' }, 503);
    }

    const quality = typeof body['quality'] === 'string' ? Math.min(100, Math.max(1, parseInt(body['quality']))) : 70;
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const format = metadata.format;

    let pipeline = sharp(buffer);

    // Compress based on detected format
    if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (format === 'avif') {
      pipeline = pipeline.avif({ quality });
    } else if (format === 'tiff') {
      pipeline = pipeline.tiff({ quality });
    } else {
      // Default to JPEG for everything else
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    }

    const output = await pipeline.toBuffer();

    // No-growth policy: return original if compressed is larger
    const finalOutput = output.length >= buffer.length ? buffer : output;
    const contentType = file.type || 'application/octet-stream';

    if (isLargeImgCompress) {
      const { jobId, fileKey } = await storeEncrypted(finalOutput, { contentType, fileName: file.name });
      return c.json({ jobId, fileKey, downloadUrl: `/v1/jobs/${jobId}/download?key=${fileKey}`, expiresIn: '24 hours', size: finalOutput.length, note: 'File is encrypted at rest. The fileKey is required to decrypt — it is not stored on our servers.' });
    }

    if (output.length >= buffer.length) {
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${file.name}"`,
          'X-Original-Size': String(buffer.length),
          'X-Compressed-Size': String(buffer.length),
          'X-Compression-Ratio': '0%',
          'X-Note': 'File already optimally compressed',
        },
      });
    }

    const ratio = +((1 - output.length / buffer.length) * 100).toFixed(1);

    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${file.name}"`,
        'X-Original-Size': String(buffer.length),
        'X-Compressed-Size': String(output.length),
        'X-Compression-Ratio': `${ratio}%`,
        'X-Quality': String(quality),
      },
    });
  }

  return c.json({ error: 'Supported modes: gzip, zip, image' }, 400);
});
