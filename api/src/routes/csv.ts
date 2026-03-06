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

// Category word pools for anonymization mapping
const ANON_CATEGORIES: Record<string, string[]> = {
  colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan', 'Magenta', 'Lime', 'Teal', 'Indigo', 'Violet', 'Gold', 'Silver', 'Bronze', 'Crimson', 'Azure', 'Beige', 'Brown', 'Coral', 'Ivory', 'Khaki', 'Lavender', 'Maroon', 'Navy', 'Olive', 'Peach', 'Salmon', 'Tan'],
  animals: ['Lion', 'Tiger', 'Bear', 'Wolf', 'Fox', 'Eagle', 'Hawk', 'Shark', 'Whale', 'Dolphin', 'Panda', 'Koala', 'Leopard', 'Cheetah', 'Elephant', 'Giraffe', 'Zebra', 'Rhino', 'Hippo', 'Kangaroo', 'Penguin', 'Owl', 'Falcon', 'Panther', 'Cobra', 'Python', 'Viper', 'Lynx', 'Jaguar', 'Bison'],
  fruits: ['Apple', 'Banana', 'Orange', 'Grape', 'Strawberry', 'Blueberry', 'Raspberry', 'Mango', 'Pineapple', 'Kiwi', 'Peach', 'Pear', 'Plum', 'Cherry', 'Lemon', 'Lime', 'Grapefruit', 'Watermelon', 'Melon', 'Papaya', 'Fig', 'Date', 'Apricot', 'Blackberry', 'Cranberry', 'Coconut', 'Lychee', 'Olive', 'Pomegranate', 'Tangerine'],
  cities: ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Moscow', 'Beijing', 'Sydney', 'Toronto', 'Dubai', 'Rome', 'Madrid', 'Mumbai', 'Cairo', 'Rio', 'Seoul', 'Bangkok', 'Singapore', 'Istanbul', 'Chicago', 'Los Angeles', 'Houston', 'Phoenix', 'Lima', 'Bogota', 'Mexico City', 'Jakarta', 'Delhi', 'Lagos', 'Kinshasa'],
  tech: ['Quantum', 'Cyber', 'Nano', 'Hyper', 'Mega', 'Giga', 'Tera', 'Peta', 'Exa', 'Zetta', 'Yotta', 'Flux', 'Plasma', 'Laser', 'Sonic', 'Astro', 'Cosmo', 'Stellar', 'Solar', 'Lunar', 'Galactic', 'Orbital', 'Digital', 'Analog', 'Virtual', 'Neural', 'Binary', 'Logic', 'Data', 'Code'],
  nato: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'],
};

interface ColumnConfigInput {
  action: 'keep' | 'shuffle' | 'map';
  category?: string;
  rename?: string;
}

// POST /v1/csv/anonymize - Anonymize CSV columns with mapping, shuffling, or keeping
csvRoutes.post('/anonymize', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  const configParam = typeof body['config'] === 'string' ? body['config'] : '';

  if (!file) {
    return c.json({ error: 'Upload a CSV file as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }
  if (!configParam) {
    return c.json({ error: 'Provide a "config" JSON field. Example: {"name":{"action":"map","category":"animals"},"age":{"action":"shuffle"}}' }, 400);
  }

  let config: Record<string, ColumnConfigInput>;
  try {
    config = JSON.parse(configParam);
  } catch {
    return c.json({ error: 'Invalid JSON in "config" field.' }, 400);
  }

  const data = parseCSV(await file.text());

  // Validate config columns exist
  for (const col of Object.keys(config)) {
    if (!data.headers.includes(col)) {
      return c.json({ error: `Column "${col}" not found. Available: ${data.headers.join(', ')}` }, 400);
    }
    const action = config[col].action;
    if (!['keep', 'shuffle', 'map'].includes(action)) {
      return c.json({ error: `Invalid action "${action}" for column "${col}". Use: keep, shuffle, map` }, 400);
    }
    if (action === 'map') {
      const cat = config[col].category || 'colors';
      if (!ANON_CATEGORIES[cat]) {
        return c.json({ error: `Invalid category "${cat}". Available: ${Object.keys(ANON_CATEGORIES).join(', ')}` }, 400);
      }
    }
  }

  // Collect unique values for map columns, collect values for shuffle columns
  const mapCollectors: Record<string, Set<string>> = {};
  const shuffleCollectors: Record<string, string[]> = {};

  for (const [col, cfg] of Object.entries(config)) {
    const idx = data.headers.indexOf(col);
    if (cfg.action === 'map') {
      mapCollectors[col] = new Set<string>();
      for (const row of data.rows) mapCollectors[col].add(row[idx] || '');
    }
    if (cfg.action === 'shuffle') {
      shuffleCollectors[col] = data.rows.map(r => r[idx] || '');
    }
  }

  // Generate mappings for map columns
  const generatedMaps: Record<string, Map<string, string>> = {};
  const keyFileMappings: Record<string, Record<string, string>> = {};

  for (const [col, cfg] of Object.entries(config)) {
    if (cfg.action === 'map') {
      const uniqueVals = Array.from(mapCollectors[col]);
      const category = cfg.category || 'colors';
      const pool = ANON_CATEGORIES[category];
      const map = new Map<string, string>();
      const keyMap: Record<string, string> = {};
      const usedValues = new Set<string>();

      for (const val of uniqueVals) {
        let anonVal = '';
        let attempts = 0;
        while (true) {
          const word = pool[Math.floor(Math.random() * pool.length)];
          const num = Math.floor(Math.random() * 999900) + 100;
          const candidate = `${word}${num}`;
          if (!usedValues.has(candidate)) { anonVal = candidate; break; }
          attempts++;
          if (attempts > 50) { anonVal = `${word}${num}_${Math.random().toString(36).substring(2, 8)}`; break; }
        }
        usedValues.add(anonVal);
        map.set(val, anonVal);
        keyMap[val] = anonVal;
      }
      generatedMaps[col] = map;
      keyFileMappings[col] = keyMap;
    }

    if (cfg.action === 'shuffle') {
      const arr = shuffleCollectors[col];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
  }

  // Build key file
  const renames: Record<string, string> = {};
  for (const [col, cfg] of Object.entries(config)) {
    if (cfg.rename && cfg.rename !== col) renames[col] = cfg.rename;
  }

  const keyFileStruct = {
    meta: { timestamp: Date.now(), originalFileName: file.name },
    mappings: keyFileMappings,
    renames,
  };

  // Build anonymized CSV
  const newHeaders = data.headers.map(h => {
    const cfg = config[h];
    return (cfg && cfg.rename) ? cfg.rename : h;
  });

  const shuffleCounters: Record<string, number> = {};
  for (const col of Object.keys(config)) shuffleCounters[col] = 0;

  const anonymizedRows = data.rows.map(row =>
    data.headers.map((header, idx) => {
      const val = row[idx] || '';
      const cfg = config[header];
      if (!cfg || cfg.action === 'keep') return val;
      if (cfg.action === 'map') return generatedMaps[header]?.get(val) || val;
      if (cfg.action === 'shuffle') return shuffleCollectors[header][shuffleCounters[header]++];
      return val;
    })
  );

  const anonymizedCsv = rowsToCSV(newHeaders, anonymizedRows);
  const keyJson = JSON.stringify(keyFileStruct, null, 2);

  // Build ZIP using archiver
  const archiver = (await import('archiver')).default;

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    archive.append(anonymizedCsv, { name: 'anonymized_data.csv' });
    archive.append(keyJson, { name: 'deanonymization_key.json' });
    archive.finalize();
  });

  const baseName = file.name.replace(/\.[^.]+$/, '');

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${baseName}_anonymized.zip"`,
      'X-Columns-Modified': String(Object.values(config).filter(c => c.action !== 'keep').length),
      'X-Rows': String(data.rows.length),
    },
  });
});

// POST /v1/csv/deanonymize - Restore anonymized CSV using key file
csvRoutes.post('/deanonymize', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  const keyFile = body['key'] instanceof File ? body['key'] : null;

  if (!file) {
    return c.json({ error: 'Upload the anonymized CSV as "file" form field.' }, 400);
  }
  if (!keyFile) {
    return c.json({ error: 'Upload the key JSON as "key" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  let keyData: { meta: { timestamp: number; originalFileName: string }; mappings: Record<string, Record<string, string>>; renames: Record<string, string> };
  try {
    keyData = JSON.parse(await keyFile.text());
    if (!keyData.mappings) throw new Error('missing mappings');
  } catch {
    return c.json({ error: 'Invalid key file. Upload the deanonymization_key.json generated during anonymization.' }, 400);
  }

  const data = parseCSV(await file.text());

  // Build reverse maps: anon value -> original value
  const reverseMaps: Record<string, Map<string, string>> = {};
  for (const [col, forwardMap] of Object.entries(keyData.mappings)) {
    const revMap = new Map<string, string>();
    for (const [orig, anon] of Object.entries(forwardMap)) {
      revMap.set(anon, orig);
    }
    reverseMaps[col] = revMap;
  }

  // Build reverse renames: renamed -> original
  const reverseRenames: Record<string, string> = {};
  for (const [orig, renamed] of Object.entries(keyData.renames || {})) {
    reverseRenames[renamed] = orig;
  }

  // Match file columns to key columns
  const columnMatches: { headerIdx: number; keyCol: string }[] = [];
  for (let i = 0; i < data.headers.length; i++) {
    const header = data.headers[i];
    if (reverseMaps[header]) {
      columnMatches.push({ headerIdx: i, keyCol: header });
    } else if (reverseRenames[header] && reverseMaps[reverseRenames[header]]) {
      columnMatches.push({ headerIdx: i, keyCol: reverseRenames[header] });
    }
  }

  // Restore headers
  const restoredHeaders = data.headers.map(h => reverseRenames[h] || h);

  // Restore values
  const restoredRows = data.rows.map(row =>
    row.map((val, i) => {
      const match = columnMatches.find(m => m.headerIdx === i);
      if (match) {
        const original = reverseMaps[match.keyCol]?.get(val);
        return original !== undefined ? original : val;
      }
      return val;
    })
  );

  const csv = rowsToCSV(restoredHeaders, restoredRows);
  const baseName = file.name.replace(/\.[^.]+$/, '');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${baseName}_restored.csv"`,
      'X-Columns-Restored': String(columnMatches.length),
      'X-Rows': String(restoredRows.length),
      'X-Original-File': keyData.meta.originalFileName,
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
