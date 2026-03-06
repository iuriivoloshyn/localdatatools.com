import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { parseCSV, rowsToCSV } from '../utils/csv.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const convertRoutes = new Hono();

// POST /v1/convert/spreadsheet - CSV <-> Excel conversion
convertRoutes.post('/spreadsheet', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  const outputFormat = typeof body['format'] === 'string' ? body['format'].toLowerCase() : '';

  if (!file) {
    return c.json({ error: 'Upload a file as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  const name = file.name.toLowerCase();
  const isExcelInput = name.endsWith('.xlsx') || name.endsWith('.xls');
  const isCsvInput = name.endsWith('.csv') || name.endsWith('.tsv');

  if (!isExcelInput && !isCsvInput) {
    return c.json({ error: 'Unsupported file type. Upload .csv, .tsv, .xlsx, or .xls' }, 400);
  }

  if (isExcelInput) {
    // Excel -> CSV
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheetName = typeof body['sheet'] === 'string' ? body['sheet'] : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return c.json({ error: `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}` }, 400);
    }
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const baseName = file.name.replace(/\.(xlsx|xls)$/i, '');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        'X-Sheet-Name': sheetName,
        'X-Total-Sheets': String(workbook.SheetNames.length),
      },
    });
  }

  // CSV -> Excel
  const text = await file.text();
  const data = parseCSV(text);
  const wsData = [data.headers, ...data.rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const baseName = file.name.replace(/\.(csv|tsv)$/i, '');

  return new Response(xlsxBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
      'X-Rows': String(data.rows.length),
      'X-Columns': String(data.headers.length),
    },
  });
});
