
import { FileData } from '../types';
import { read, utils } from 'xlsx';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const detectDelimiter = (text: string): string => {
    const lines = text.split(/\r?\n/).filter(x => x.trim()).slice(0, 5);
    if (lines.length === 0) return ',';
    
    const candidates = [',', ';', '\t', '|'];
    let best = ',';
    let maxCount = 0;
    
    // Simple frequency check on first line usually suffices
    const firstLine = lines[0];
    for (const c of candidates) {
        const count = firstLine.split(c).length - 1;
        if (count > maxCount) {
            maxCount = count;
            best = c;
        }
    }
    return best;
};

export const parseCSVLine = (line: string, delimiter = ','): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  
  // Heuristic for malformed "whole row quoted" lines (e.g. "1,2,3" treated as one cell)
  if (result.length === 1 && result[0].includes(delimiter)) {
      const inner = parseCSVLine(result[0], delimiter);
      if (inner.length > 1) return inner;
  }
  
  return result;
};

// Reads the first chunk of a file to extract headers and preview
export const parseCsvPreview = async (file: File): Promise<Partial<FileData>> => {
  return new Promise((resolve, reject) => {
    // Read first 64KB - should be enough for headers and a few rows
    const chunkSize = 64 * 1024; 
    const chunk = file.slice(0, chunkSize);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        reject(new Error("Failed to read file"));
        return;
      }

      const delimiter = detectDelimiter(text);
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      if (lines.length === 0) {
        reject(new Error("File appears empty"));
        return;
      }

      const headers = parseCSVLine(lines[0], delimiter);
      const previewRows = lines.slice(1, 6).map(l => parseCSVLine(l, delimiter));
      
      resolve({
        headers,
        previewRows,
        sizeFormatted: formatFileSize(file.size),
        delimiter
      });
    };

    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsText(chunk);
  });
};

// Parses Excel files for preview
export const parseExcelPreview = async (file: File): Promise<Partial<FileData>> => {
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: 'array', sheetRows: 5 }); // Read only first 5 rows for speed
  if (!wb.SheetNames.length) return { headers: [], previewRows: [] };

  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const json = utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
  
  if (json.length === 0) return { headers: [], previewRows: [] };
  
  const headers = json[0].map(h => String(h));
  const previewRows = json.slice(1).map(row => row.map(c => String(c)));
  
  return {
    headers,
    previewRows,
    sizeFormatted: formatFileSize(file.size),
    delimiter: ',' // Excel converts to comma logic internally usually
  };
};

// Finds the byte offset where the second line begins (to skip header for append)
export const findHeaderOffset = async (file: File): Promise<number> => {
  const CHUNK_SIZE = 16 * 1024;
  let offset = 0;
  
  // Scan up to 1MB for a newline to determine header end. 
  // If no header found in 1MB, assume file is headerless or monolithic.
  const MAX_SCAN = 1024 * 1024; 

  while (offset < file.size && offset < MAX_SCAN) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const text = await chunk.text();
    const newlineIndex = text.indexOf('\n');
    
    if (newlineIndex !== -1) {
      // Return global offset of the character AFTER the newline
      return offset + newlineIndex + 1;
    }
    
    offset += CHUNK_SIZE;
  }
  
  // If we scanned MAX_SCAN and found no newline, or reached EOF, 
  // return 0 (don't skip anything) to be safe against data loss.
  return 0; 
};

// Checks if the file ends with a newline character to prevent merging lines
export const checkTrailingNewline = async (file: File): Promise<boolean> => {
  if (file.size === 0) return true; // Treat empty as safe
  // Read last 1 byte
  const slice = file.slice(Math.max(0, file.size - 1));
  const text = await slice.text();
  return text === '\n' || text === '\r';
};

// Efficiently count lines in a large file without freezing the UI
export const countFileLines = async (file: File): Promise<number> => {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  let count = 0;
  let offset = 0;
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    const view = new Uint8Array(buffer);
    
    for (let i = 0; i < view.length; i++) {
      if (view[i] === 10) count++; // 10 is newline
    }
    
    offset += CHUNK_SIZE;
    // Yield to main thread to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Check if the last part has a line without a trailing newline
  if (file.size > 0) {
      const lastByteChunk = file.slice(Math.max(0, file.size - 1), file.size);
      const lastBuf = await lastByteChunk.arrayBuffer();
      if (lastBuf.byteLength > 0 && new Uint8Array(lastBuf)[0] !== 10) {
          count++;
      }
  }
  
  return count;
};
