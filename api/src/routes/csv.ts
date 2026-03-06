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

// POST /v1/csv/diff - Compare two CSV files
csvRoutes.post('/diff', async (c) => {
  const body = await c.req.parseBody();
  const fileA = body['left'] instanceof File ? body['left'] : null;
  const fileB = body['right'] instanceof File ? body['right'] : null;
  const keyCol = typeof body['key'] === 'string' ? body['key'] : '';

  if (!fileA || !fileB) {
    return c.json({ error: 'Upload two CSV files as "left" and "right" form fields.' }, 400);
  }
  if (fileA.size > MAX_FILE_SIZE || fileB.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  const dataA = parseCSV(await fileA.text());
  const dataB = parseCSV(await fileB.text());

  if (keyCol) {
    // Key-based diff
    const keyIdxA = dataA.headers.indexOf(keyCol);
    const keyIdxB = dataB.headers.indexOf(keyCol);
    if (keyIdxA === -1) return c.json({ error: `Column "${keyCol}" not found in left file.` }, 400);
    if (keyIdxB === -1) return c.json({ error: `Column "${keyCol}" not found in right file.` }, 400);

    const mapA = new Map<string, string[]>();
    for (const row of dataA.rows) mapA.set(row[keyIdxA] || '', row);
    const mapB = new Map<string, string[]>();
    for (const row of dataB.rows) mapB.set(row[keyIdxB] || '', row);

    const added: string[][] = [];
    const removed: string[][] = [];
    const changed: { key: string; left: string[]; right: string[] }[] = [];

    for (const [key, row] of mapA) {
      const match = mapB.get(key);
      if (!match) { removed.push(row); }
      else if (JSON.stringify(row) !== JSON.stringify(match)) {
        changed.push({ key, left: row, right: match });
      }
    }
    for (const [key, row] of mapB) {
      if (!mapA.has(key)) added.push(row);
    }

    return c.json({
      leftHeaders: dataA.headers,
      rightHeaders: dataB.headers,
      keyColumn: keyCol,
      summary: { added: added.length, removed: removed.length, changed: changed.length, unchanged: dataA.rows.length - removed.length - changed.length },
      added, removed, changed,
    });
  }

  // Row-based diff (no key)
  const setA = new Set(dataA.rows.map(r => JSON.stringify(r)));
  const setB = new Set(dataB.rows.map(r => JSON.stringify(r)));
  const added = dataB.rows.filter(r => !setA.has(JSON.stringify(r)));
  const removed = dataA.rows.filter(r => !setB.has(JSON.stringify(r)));

  return c.json({
    leftHeaders: dataA.headers,
    rightHeaders: dataB.headers,
    summary: { added: added.length, removed: removed.length, leftTotal: dataA.rows.length, rightTotal: dataB.rows.length },
    added, removed,
  });
});

// POST /v1/csv/metadata - Extract column types, stats, null rates
csvRoutes.post('/metadata', async (c) => {
  const body = await c.req.parseBody({ all: true });
  const file = (Array.isArray(body['file']) ? body['file'][0] : body['file']);
  if (!(file instanceof File)) {
    return c.json({ error: 'Upload a CSV file as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  const data = parseCSV(await file.text());
  const columns = data.headers.map((header, colIdx) => {
    const values = data.rows.map(r => r[colIdx] || '');
    const nonEmpty = values.filter(v => v !== '');
    const nullCount = values.length - nonEmpty.length;
    const nullRate = values.length > 0 ? +(nullCount / values.length).toFixed(4) : 0;

    // Detect type
    const numericValues = nonEmpty.filter(v => !isNaN(Number(v)) && v.trim() !== '');
    const isNumeric = nonEmpty.length > 0 && numericValues.length / nonEmpty.length > 0.8;

    const uniqueValues = new Set(nonEmpty);
    let type = 'string';
    let stats: Record<string, unknown> = { unique: uniqueValues.size };

    if (isNumeric) {
      const nums = numericValues.map(Number);
      type = nums.every(n => Number.isInteger(n)) ? 'integer' : 'float';
      nums.sort((a, b) => a - b);
      stats = {
        unique: uniqueValues.size,
        min: nums[0],
        max: nums[nums.length - 1],
        mean: +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4),
        median: nums.length % 2 === 0 ? +((nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2).toFixed(4) : nums[Math.floor(nums.length / 2)],
      };
    } else {
      // Check for date-like values
      const dateCount = nonEmpty.filter(v => !isNaN(Date.parse(v)) && v.length > 4).length;
      if (nonEmpty.length > 0 && dateCount / nonEmpty.length > 0.8) type = 'date';
      // Check for boolean
      const boolValues = new Set(nonEmpty.map(v => v.toLowerCase()));
      if (boolValues.size <= 2 && [...boolValues].every(v => ['true', 'false', '0', '1', 'yes', 'no'].includes(v))) type = 'boolean';

      const top5 = [...uniqueValues].map(v => ({ value: v, count: nonEmpty.filter(x => x === v).length }))
        .sort((a, b) => b.count - a.count).slice(0, 5);
      stats = { unique: uniqueValues.size, top5 };
    }

    return { header, type, nullCount, nullRate, ...stats };
  });

  return c.json({
    fileName: file.name,
    rowCount: data.rows.length,
    columnCount: data.headers.length,
    fileSizeBytes: file.size,
    columns,
  });
});

// POST /v1/csv/anonymize - Mask PII in CSV columns
csvRoutes.post('/anonymize', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  const columnsParam = typeof body['columns'] === 'string' ? body['columns'] : '';
  const mode = body['mode'] === 'redact' ? 'redact' : 'mask';

  if (!file) {
    return c.json({ error: 'Upload a CSV file as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  const data = parseCSV(await file.text());
  const targetCols = columnsParam ? columnsParam.split(',').map(s => s.trim()) : [];

  // If no columns specified, auto-detect PII columns
  const piiPatterns = [
    { name: 'email', regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { name: 'phone', regex: /^[\+]?[\d\s\-\(\)]{7,15}$/ },
    { name: 'ssn', regex: /^\d{3}-?\d{2}-?\d{4}$/ },
    { name: 'ip', regex: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/ },
  ];

  const colIndices: number[] = [];
  const detectedTypes: Record<string, string> = {};

  if (targetCols.length > 0) {
    for (const col of targetCols) {
      const idx = data.headers.indexOf(col);
      if (idx === -1) return c.json({ error: `Column "${col}" not found.` }, 400);
      colIndices.push(idx);
    }
  } else {
    // Auto-detect
    for (let i = 0; i < data.headers.length; i++) {
      const headerLower = data.headers[i].toLowerCase();
      if (/email|e-mail|mail/.test(headerLower)) { colIndices.push(i); detectedTypes[data.headers[i]] = 'email (header)'; continue; }
      if (/phone|mobile|cell|tel/.test(headerLower)) { colIndices.push(i); detectedTypes[data.headers[i]] = 'phone (header)'; continue; }
      if (/name|first.?name|last.?name|full.?name/.test(headerLower)) { colIndices.push(i); detectedTypes[data.headers[i]] = 'name (header)'; continue; }
      if (/ssn|social/.test(headerLower)) { colIndices.push(i); detectedTypes[data.headers[i]] = 'ssn (header)'; continue; }
      if (/address|street|city|zip|postal/.test(headerLower)) { colIndices.push(i); detectedTypes[data.headers[i]] = 'address (header)'; continue; }
      // Check content patterns
      const sample = data.rows.slice(0, 20).map(r => r[i] || '').filter(v => v);
      for (const p of piiPatterns) {
        if (sample.length > 0 && sample.filter(v => p.regex.test(v)).length / sample.length > 0.5) {
          colIndices.push(i); detectedTypes[data.headers[i]] = `${p.name} (content)`; break;
        }
      }
    }
  }

  const maskValue = (val: string): string => {
    if (!val) return val;
    if (mode === 'redact') return '[REDACTED]';
    // Mask: keep first and last char, replace middle
    if (val.includes('@')) {
      const [local, domain] = val.split('@');
      return local[0] + '***@' + domain;
    }
    if (val.length <= 2) return '*'.repeat(val.length);
    return val[0] + '*'.repeat(val.length - 2) + val[val.length - 1];
  };

  const anonymized = data.rows.map(row =>
    row.map((val, i) => colIndices.includes(i) ? maskValue(val) : val)
  );

  const csv = rowsToCSV(data.headers, anonymized);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="anonymized.csv"',
      'X-Columns-Masked': String(colIndices.length),
      'X-Detected-PII': JSON.stringify(detectedTypes),
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
