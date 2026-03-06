import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';
import { Document, Packer, Paragraph, TextRun, PageBreak } from 'docx';
import { parseCSV, rowsToCSV } from '../utils/csv.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const convertRoutes = new Hono();

// POST /v1/convert/spreadsheet - CSV <-> Excel conversion
convertRoutes.post('/spreadsheet', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;

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

// POST /v1/convert/image - Convert between PNG, JPEG, WebP, AVIF, TIFF, GIF
const IMAGE_FORMATS = ['png', 'jpeg', 'jpg', 'webp', 'avif', 'tiff', 'gif'] as const;
const IMAGE_MIMES: Record<string, string> = {
  png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg',
  webp: 'image/webp', avif: 'image/avif', tiff: 'image/tiff', gif: 'image/gif',
};

convertRoutes.post('/image', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  let format = typeof body['format'] === 'string' ? body['format'].toLowerCase() : '';
  const quality = typeof body['quality'] === 'string' ? Math.min(100, Math.max(1, parseInt(body['quality']))) : 80;
  const width = typeof body['width'] === 'string' ? parseInt(body['width']) : undefined;
  const height = typeof body['height'] === 'string' ? parseInt(body['height']) : undefined;

  if (!file) {
    return c.json({ error: 'Upload an image as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }
  if (format === 'jpg') format = 'jpeg';
  if (!format || !IMAGE_FORMATS.includes(format as any)) {
    return c.json({ error: `Specify "format" as one of: ${IMAGE_FORMATS.join(', ')}` }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(buffer);

  // Optional resize
  if (width || height) {
    pipeline = pipeline.resize(width || null, height || null, { fit: 'inside', withoutEnlargement: true });
  }

  // Convert
  const outputFormat = format as 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff' | 'gif';
  if (outputFormat === 'jpeg') pipeline = pipeline.jpeg({ quality });
  else if (outputFormat === 'png') pipeline = pipeline.png();
  else if (outputFormat === 'webp') pipeline = pipeline.webp({ quality });
  else if (outputFormat === 'avif') pipeline = pipeline.avif({ quality });
  else if (outputFormat === 'tiff') pipeline = pipeline.tiff({ quality });
  else if (outputFormat === 'gif') pipeline = pipeline.gif();

  const output = await pipeline.toBuffer();
  const metadata = await sharp(buffer).metadata();
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = format === 'jpeg' ? 'jpg' : format;

  return new Response(new Uint8Array(output), {
    headers: {
      'Content-Type': IMAGE_MIMES[format],
      'Content-Disposition': `attachment; filename="${baseName}.${ext}"`,
      'X-Original-Size': String(buffer.length),
      'X-Output-Size': String(output.length),
      'X-Original-Dimensions': `${metadata.width}x${metadata.height}`,
    },
  });
});

// POST /v1/convert/document - PDF text extraction, PDF -> DOCX
convertRoutes.post('/document', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'] instanceof File ? body['file'] : null;
  let format = typeof body['format'] === 'string' ? body['format'].toLowerCase() : '';

  if (!file) {
    return c.json({ error: 'Upload a document as "file" form field.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File exceeds 50MB limit.' }, 400);
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.[^.]+$/, '');

  if (name.endsWith('.pdf')) {
    if (!format) format = 'txt';

    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    const fullText = textResult.text;
    const numPages = textResult.total;

    if (format === 'txt') {
      await parser.destroy();
      return new Response(fullText, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${baseName}.txt"`,
          'X-Pages': String(numPages),
        },
      });
    }

    if (format === 'docx') {
      await parser.destroy();
      const pages = fullText.split(/\f/);
      const children: Paragraph[] = [];

      for (let i = 0; i < pages.length; i++) {
        const lines = pages[i].split('\n');
        for (const line of lines) {
          children.push(new Paragraph({ children: [new TextRun(line)] }));
        }
        if (i < pages.length - 1) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }
      }

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const docxBuf = await Packer.toBuffer(doc);

      return new Response(new Uint8Array(docxBuf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${baseName}.docx"`,
          'X-Pages': String(numPages),
        },
      });
    }

    if (format === 'json') {
      await parser.destroy();
      return c.json({
        fileName: file.name,
        pages: numPages,
        info: infoResult,
        text: fullText,
      });
    }

    await parser.destroy();
    return c.json({ error: 'Supported output formats for PDF: txt, docx, json' }, 400);
  }

  return c.json({ error: 'Supported input formats: .pdf. Upload a PDF file.' }, 400);
});
