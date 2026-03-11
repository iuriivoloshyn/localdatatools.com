export const detectDelimiter = (text: string): string => {
  const lines = text.split(/\r?\n/).filter(x => x.trim()).slice(0, 5);
  if (lines.length === 0) return ',';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let maxCount = 0;
  for (const c of candidates) {
    const count = lines[0].split(c).length - 1;
    if (count > maxCount) { maxCount = count; best = c; }
  }
  return best;
};

export const parseCSVLine = (line: string, delimiter = ','): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
    else current += char;
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

export const safeCsvField = (field: string | undefined | null): string => {
  if (field === undefined || field === null) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

export const parseCSV = (text: string, delimiter?: string): { headers: string[]; rows: string[][] } => {
  const del = delimiter || detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0], del);
  const rows = lines.slice(1).map(l => parseCSVLine(l, del));
  return { headers, rows };
};

export const rowsToCSV = (headers: string[], rows: string[][]): string => {
  const headerLine = headers.map(safeCsvField).join(',');
  const dataLines = rows.map(row => row.map(safeCsvField).join(','));
  return [headerLine, ...dataLines].join('\n') + '\n';
};
