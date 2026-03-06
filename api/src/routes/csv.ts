import { Hono } from 'hono';
import { parseCSV, parseCSVLine, safeCsvField, detectDelimiter, rowsToCSV } from '../utils/csv.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

export const csvRoutes = new Hono();

// POST /v1/csv/analyze - Check if files are compatible for merge
csvRoutes.post('/analyze', async (c) => {
  const body = await c.req.parseBody({ all: true });
  const files = (Array.isArray(body['files']) ? body['files'] : [body['files']]).filter(
    (f): f is File => f instanceof File
  );

  if (files.length < 2) {
    return c.json({ error: 'Upload at least 2 CSV files as "files" form field.' }, 400);
  }

  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return c.json({ error: `File "${f.name}" exceeds 50MB limit.` }, 400);
    }
  }

  const primary = parseCSV(await files[0].text());
  const results = [];

  for (let i = 1; i < files.length; i++) {
    const other = parseCSV(await files[i].text());
    const headersMatch = JSON.stringify(primary.headers) === JSON.stringify(other.headers);
    let reason = 'Compatible';
    if (!headersMatch) {
      reason = primary.headers.length !== other.headers.length
        ? `Column count mismatch (${other.headers.length} vs ${primary.headers.length})`
        : 'Header name or order mismatch';
    }
    results.push({ file: files[i].name, compatible: headersMatch, reason });
  }

  return c.json({
    primary: files[0].name,
    primaryHeaders: primary.headers,
    results,
    canMerge: results.every(r => r.compatible),
  });
});

// POST /v1/csv/merge - Append (stack) CSV files vertically
csvRoutes.post('/merge', async (c) => {
  const body = await c.req.parseBody({ all: true });
  const files = (Array.isArray(body['files']) ? body['files'] : [body['files']]).filter(
    (f): f is File => f instanceof File
  );

  if (files.length < 2) {
    return c.json({ error: 'Upload at least 2 CSV files as "files" form field.' }, 400);
  }

  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return c.json({ error: `File "${f.name}" exceeds 50MB limit.` }, 400);
    }
  }

  // Parse primary file fully
  const primaryText = await files[0].text();
  const primaryDelimiter = detectDelimiter(primaryText);
  const primaryLines = primaryText.split(/\r?\n/).filter(l => l.trim());
  const outputParts: string[] = [primaryText.trimEnd()];

  // Append remaining files (skip their headers)
  for (let i = 1; i < files.length; i++) {
    const text = await files[i].text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 1) {
      outputParts.push(lines.slice(1).join('\n'));
    }
  }

  const merged = outputParts.join('\n') + '\n';

  return new Response(merged, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="merged.csv"',
      'X-Rows-Total': String(merged.split('\n').filter(l => l.trim()).length - 1),
    },
  });
});

// POST /v1/csv/join - Join two CSV files on a key column
csvRoutes.post('/join', async (c) => {
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
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  const dataA = parseCSV(await fileA.text());
  const dataB = parseCSV(await fileB.text());

  const keyIndexA = dataA.headers.indexOf(keyA);
  const keyIndexB = dataB.headers.indexOf(keyB);

  if (keyIndexA === -1) return c.json({ error: `Column "${keyA}" not found in left file.` }, 400);
  if (keyIndexB === -1) return c.json({ error: `Column "${keyB}" not found in right file.` }, 400);

  // Build lookup from right table
  const bHeaders = dataB.headers.filter((_, i) => i !== keyIndexB);
  const mapB = new Map<string, string[]>();
  for (const row of dataB.rows) {
    let key = row[keyIndexB] || '';
    if (!caseSensitive) key = key.toLowerCase();
    // Keep first match only
    if (!mapB.has(key)) {
      mapB.set(key, row.filter((_, i) => i !== keyIndexB));
    }
  }

  // Join
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

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="joined.csv"',
      'X-Rows-Total': String(outputRows.length),
      'X-Join-Type': joinType,
    },
  });
});
