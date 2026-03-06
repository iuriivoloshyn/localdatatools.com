import { Hono } from 'hono';
import { isR2Configured, storeEncrypted, fetchDecrypted, deleteFile } from '../services/r2.js';
import { parseCSV, parseCSVLine, safeCsvField, detectDelimiter, rowsToCSV } from '../utils/csv.js';

const SIZE_THRESHOLD = 10 * 1024 * 1024; // 10MB — above this, use R2
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB

export const jobRoutes = new Hono();

// POST /v1/jobs/merge — Large file merge via R2
jobRoutes.post('/merge', async (c) => {
  if (!isR2Configured()) {
    return c.json({ error: 'Large file storage not configured.' }, 503);
  }

  const body = await c.req.parseBody({ all: true });
  const files = (Array.isArray(body['files']) ? body['files'] : [body['files']]).filter(
    (f): f is File => f instanceof File
  );

  if (files.length < 2) {
    return c.json({ error: 'Upload at least 2 CSV files as "files" form field.' }, 400);
  }

  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return c.json({ error: `File "${f.name}" exceeds 1GB limit.` }, 400);
    }
  }

  // Process merge in memory
  const primaryText = await files[0].text();
  const outputParts: string[] = [primaryText.trimEnd()];

  for (let i = 1; i < files.length; i++) {
    const text = await files[i].text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 1) {
      outputParts.push(lines.slice(1).join('\n'));
    }
  }

  const merged = outputParts.join('\n') + '\n';
  const resultBuffer = Buffer.from(merged, 'utf-8');

  // Encrypt and store in R2
  const { jobId, fileKey } = await storeEncrypted(resultBuffer);

  return c.json({
    jobId,
    fileKey,
    downloadUrl: `/v1/jobs/${jobId}/download?key=${fileKey}`,
    expiresIn: '24 hours',
    size: resultBuffer.length,
    note: 'File is encrypted at rest. The fileKey is required to decrypt — it is not stored on our servers.',
  });
});

// POST /v1/jobs/join — Large file join via R2
jobRoutes.post('/join', async (c) => {
  if (!isR2Configured()) {
    return c.json({ error: 'Large file storage not configured.' }, 503);
  }

  const body = await c.req.parseBody();
  const fileA = body['left'] instanceof File ? body['left'] : null;
  const fileB = body['right'] instanceof File ? body['right'] : null;
  const keyA = typeof body['left_key'] === 'string' ? body['left_key'] : '';
  const keyB = typeof body['right_key'] === 'string' ? body['right_key'] : '';
  const joinType = body['join_type'] === 'inner' ? 'inner' : 'left';
  const caseSensitive = body['case_sensitive'] !== 'false';

  if (!fileA || !fileB) {
    return c.json({ error: 'Upload two CSV files as "left" and "right" form fields.' }, 400);
  }
  if (!keyA || !keyB) {
    return c.json({ error: 'Provide "left_key" and "right_key" column names.' }, 400);
  }
  if (fileA.size > MAX_FILE_SIZE || fileB.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 1GB limit.' }, 400);
  }

  const dataA = parseCSV(await fileA.text());
  const dataB = parseCSV(await fileB.text());

  const keyIndexA = dataA.headers.indexOf(keyA);
  const keyIndexB = dataB.headers.indexOf(keyB);

  if (keyIndexA === -1) return c.json({ error: `Column "${keyA}" not found in left file.` }, 400);
  if (keyIndexB === -1) return c.json({ error: `Column "${keyB}" not found in right file.` }, 400);

  const bHeaders = dataB.headers.filter((_, i) => i !== keyIndexB);
  const mapB = new Map<string, string[]>();
  for (const row of dataB.rows) {
    let key = row[keyIndexB] || '';
    if (!caseSensitive) key = key.toLowerCase();
    if (!mapB.has(key)) mapB.set(key, row.filter((_, i) => i !== keyIndexB));
  }

  const outputHeaders = [...dataA.headers, ...bHeaders];
  const emptyB = new Array(bHeaders.length).fill('');
  const outputRows: string[][] = [];

  for (const row of dataA.rows) {
    let key = row[keyIndexA] || '';
    if (!caseSensitive) key = key.toLowerCase();
    const match = mapB.get(key);
    if (joinType === 'inner' && !match) continue;
    outputRows.push([...row, ...(match || emptyB)]);
  }

  const csv = rowsToCSV(outputHeaders, outputRows);
  const resultBuffer = Buffer.from(csv, 'utf-8');

  const { jobId, fileKey } = await storeEncrypted(resultBuffer);

  return c.json({
    jobId,
    fileKey,
    downloadUrl: `/v1/jobs/${jobId}/download?key=${fileKey}`,
    expiresIn: '24 hours',
    size: resultBuffer.length,
    rows: outputRows.length,
    note: 'File is encrypted at rest. The fileKey is required to decrypt — it is not stored on our servers.',
  });
});

// GET /v1/jobs/:id/download?key=... — Decrypt and download
jobRoutes.get('/:id/download', async (c) => {
  const jobId = c.req.param('id');
  const fileKey = c.req.query('key');

  if (!fileKey) {
    return c.json({ error: 'Missing "key" query parameter. This is the fileKey returned when the job was created.' }, 400);
  }

  try {
    const decrypted = await fetchDecrypted(jobId, fileKey);

    // Delete after download (one-time download)
    deleteFile(jobId).catch(() => {}); // fire-and-forget cleanup

    return new Response(new Uint8Array(decrypted), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${jobId}.csv"`,
      },
    });
  } catch (e: any) {
    if (e.name === 'NoSuchKey' || e.Code === 'NoSuchKey') {
      return c.json({ error: 'File not found or expired.' }, 404);
    }
    return c.json({ error: 'Decryption failed. Invalid key or corrupted file.' }, 400);
  }
});
