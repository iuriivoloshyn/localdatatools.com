import React, { useState, useEffect, useRef } from 'react';
import FileUploader from '../FileUploader';
import ToolHeader from '../layout/ToolHeader';
import { FileData } from '../../types';
import { Download, Play, AlertCircle, VenetianMask, Shuffle, ArrowRight, Database, Type, Shield, FileKey, RefreshCw, Archive, Check, Upload } from 'lucide-react';
import { useLanguage } from '../../App';
import JSZip from 'jszip';
import { parseCSVLine } from '../../utils/csvHelpers';
import { read, utils, write } from 'xlsx';

const CATEGORIES = {
  colors: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan', 'Magenta', 'Lime', 'Teal', 'Indigo', 'Violet', 'Gold', 'Silver', 'Bronze', 'Crimson', 'Azure', 'Beige', 'Brown', 'Coral', 'Ivory', 'Khaki', 'Lavender', 'Maroon', 'Navy', 'Olive', 'Peach', 'Salmon', 'Tan', 'White', 'Black', 'Gray'],
  animals: ['Lion', 'Tiger', 'Bear', 'Wolf', 'Fox', 'Eagle', 'Hawk', 'Shark', 'Whale', 'Dolphin', 'Panda', 'Koala', 'Leopard', 'Cheetah', 'Elephant', 'Giraffe', 'Zebra', 'Rhino', 'Hippo', 'Kangaroo', 'Penguin', 'Owl', 'Falcon', 'Panther', 'Cobra', 'Python', 'Viper', 'Lynx', 'Jaguar', 'Bison', 'Moose', 'Elk'],
  fruits: ['Apple', 'Banana', 'Orange', 'Grape', 'Strawberry', 'Blueberry', 'Raspberry', 'Mango', 'Pineapple', 'Kiwi', 'Peach', 'Pear', 'Plum', 'Cherry', 'Lemon', 'Lime', 'Grapefruit', 'Watermelon', 'Melon', 'Papaya', 'Fig', 'Date', 'Apricot', 'Blackberry', 'Cranberry', 'Coconut', 'Lychee', 'Olive', 'Pomegranate', 'Tangerine'],
  cities: ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Moscow', 'Beijing', 'Sydney', 'Toronto', 'Dubai', 'Rome', 'Madrid', 'Mumbai', 'Cairo', 'Rio', 'Seoul', 'Bangkok', 'Singapore', 'Istanbul', 'Chicago', 'Los Angeles', 'Houston', 'Phoenix', 'Lima', 'Bogota', 'Mexico City', 'Jakarta', 'Delhi', 'Lagos', 'Kinshasa'],
  tech: ['Quantum', 'Cyber', 'Nano', 'Hyper', 'Mega', 'Giga', 'Tera', 'Peta', 'Exa', 'Zetta', 'Yotta', 'Flux', 'Plasma', 'Laser', 'Sonic', 'Astro', 'Cosmo', 'Stellar', 'Solar', 'Lunar', 'Galactic', 'Orbital', 'Digital', 'Analog', 'Virtual', 'Neural', 'Binary', 'Logic', 'Data', 'Code'],
  nato: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu']
};

const TEXT = {
  // ... (Dictionary remains same)
  en: {
    title: "Data Anonymizer",
    desc: "Securely anonymize datasets for external analysis and restore them with precision. Generates a cryptographic-like key file for 1-to-1 restoration.",
    instr: [
      "Mode 1: Anonymize - Upload source, map columns, and download clean data + key.",
      "Mode 2: Restore - Upload the analyzed report (CSV or XLSX) and your private key file to reconstruct original identities.",
      "Supports multi-sheet XLSX restoration."
    ],
    sanitize: "Sanitize",
    restore: "Restore",
    source: "Source Dataset",
    colConfig: "Column Configuration",
    colsDetected: "Columns Detected",
    renamePlaceholder: "Rename (optional)",
    keep: "Keep",
    shuffle: "Shuffle",
    map: "Map",
    anonymizeBtn: "Anonymize & Download",
    reportFile: "1. Analyzed Report (CSV/XLSX)",
    keyFile: "2. Key File (JSON)",
    dropKey: "Drop JSON Key Here",
    uploadKey: "Upload Key File",
    keyValid: "Key Validated",
    restoreMapping: "Restoration Mapping",
    keySource: "Key Source",
    restoreBtn: "Restore Original Data",
    packageReady: "Package Ready",
    restoreComplete: "Restoration Complete",
    packageDesc: "Includes sanitized CSV and your private restoration key.",
    restoreDesc: "Data successfully mapped back to original values.",
    startOver: "Start Over",
    download: "Download Result",
    mapOriginal: "Map to Original Key",
    restoreName: "Restore Name",
    doNotRestore: "(Do not restore)"
  },
  ru: {
    title: "Анонимайзер Данных",
    desc: "Безопасная анонимизация наборов данных для внешнего анализа и точное восстановление. Генерирует криптографический файл-ключ для восстановления 1-к-1.",
    instr: [
      "Режим 1: Анонимизация - Загрузите источник, настройте колонки и скачайте чистые данные + ключ.",
      "Режим 2: Восстановление - Загрузите отчет (CSV/XLSX) и ваш приватный ключ для восстановления исходных данных.",
      "Поддерживает восстановление многостраничных XLSX."
    ],
    sanitize: "Анонимизация",
    restore: "Восстановление",
    source: "Исходный датасет",
    colConfig: "Настройка колонок",
    colsDetected: "Колонок обнаружено",
    renamePlaceholder: "Переим. (опц.)",
    keep: "Оставить",
    shuffle: "Смешать",
    map: "Заменить",
    anonymizeBtn: "Анонимизировать и Скачать",
    reportFile: "1. Аналитический отчет (CSV/XLSX)",
    keyFile: "2. Файл-ключ (JSON)",
    dropKey: "Перетащите ключ сюда",
    uploadKey: "Загрузить ключ",
    keyValid: "Ключ принят",
    restoreMapping: "Карта восстановления",
    keySource: "Источник ключа",
    restoreBtn: "Восстановить данные",
    packageReady: "Пакет готов",
    restoreComplete: "Восстановление завершено",
    packageDesc: "Включает очищенный CSV и ваш приватный ключ восстановления.",
    restoreDesc: "Данные успешно сопоставлены с исходными значениями.",
    startOver: "Начать заново",
    download: "Скачать результат",
    mapOriginal: "Сопоставить с ключом",
    restoreName: "Вернуть имя",
    doNotRestore: "(Не восстанавливать)"
  }
};

const safeCsvField = (field: string | number | undefined | null): string => {
  if (field === undefined || field === null) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

type ColumnAction = 'keep' | 'shuffle' | 'map';
type CategoryKey = keyof typeof CATEGORIES;
type Mode = 'anonymize' | 'deanonymize';

interface ColumnConfig {
  action: ColumnAction;
  category?: CategoryKey;
  renameTo?: string;
}

interface DeanonymizeConfig {
  targetColumn: string; // The column in the uploaded file
  keyId: string | null; // The ID of the original column from the key file
  restoreName: boolean;
}

interface KeyFileStructure {
  meta: {
    timestamp: number;
    originalFileName: string;
  };
  mappings: Record<string, Record<string, string>>; // ColName -> { Original: Anon }
  renames: Record<string, string>; // OriginalColName -> NewColName
}

const AnonymizerTool: React.FC = () => {
  const { lang } = useLanguage();
  const txt = TEXT[lang];
  const [mode, setMode] = useState<Mode>('anonymize');
  
  // Anonymize State
  const [file, setFile] = useState<FileData | undefined>();
  const [columns, setColumns] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, ColumnConfig>>({});
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalRows: number, columnsModified: number } | null>(null);

  // Deanonymize State
  const [reportFile, setReportFile] = useState<FileData | undefined>();
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [keyData, setKeyData] = useState<KeyFileStructure | null>(null);
  const [deanonymizeConfigs, setDeanonymizeConfigs] = useState<Record<string, DeanonymizeConfig>>({});
  
  // --- ANONYMIZE LOGIC ---

  useEffect(() => {
    if (file) {
      setColumns(file.headers);
      const initialConfigs: Record<string, ColumnConfig> = {};
      file.headers.forEach(h => {
        initialConfigs[h] = { action: 'keep', category: 'colors', renameTo: h };
      });
      setConfigs(initialConfigs);
      setDownloadUrl(null);
      setStats(null);
    }
  }, [file]);

  const updateConfig = (header: string, updates: Partial<ColumnConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [header]: { ...prev[header], ...updates }
    }));
  };

  const processAnonymization = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setError(null);
    setStats(null);

    try {
      // ... (Implementation remains same, hidden for brevity)
      // Logic from previous turn...
      const chunkSize = 1024 * 1024 * 2; // 2MB chunks
      const fileSize = file.file.size;
      let offset = 0;
      let leftover = '';
      let isHeaderProcessed = false;
      
      const mapCollectors: Record<string, Set<string>> = {};
      const shuffleCollectors: Record<string, string[]> = {};
      
      columns.forEach(col => {
        if (configs[col].action === 'map') mapCollectors[col] = new Set();
        if (configs[col].action === 'shuffle') shuffleCollectors[col] = [];
      });

      // Pass 1: Analysis
      while (offset < fileSize) {
        const chunk = file.file.slice(offset, offset + chunkSize);
        const text = await chunk.text();
        const rawData = leftover + text;
        const lines = rawData.split(/\r?\n/);
        leftover = (offset + chunkSize < fileSize) ? (lines.pop() || '') : '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          if (!isHeaderProcessed && i === 0) { isHeaderProcessed = true; continue; }
          const cols = parseCSVLine(line);
          columns.forEach((header, idx) => {
            const val = cols[idx] || '';
            if (configs[header].action === 'map') mapCollectors[header].add(val);
            if (configs[header].action === 'shuffle') shuffleCollectors[header].push(val);
          });
        }
        offset += chunkSize;
        setProgress(Math.min(40, Math.round((offset / fileSize) * 40)));
        await new Promise(r => setTimeout(r, 0));
      }

      // Generate Maps
      const generatedMaps: Record<string, Map<string, string>> = {};
      const keyFileMappings: Record<string, Record<string, string>> = {};
      
      columns.forEach(col => {
        if (configs[col].action === 'map') {
          const uniqueVals = Array.from(mapCollectors[col]);
          const category = configs[col].category || 'colors';
          const pool = CATEGORIES[category];
          const map = new Map<string, string>();
          const keyMap: Record<string, string> = {}; 
          const usedAnonValues = new Set<string>();
          
          uniqueVals.forEach((val) => {
            let anonVal = '';
            let attempts = 0;
            
            while (true) {
                const word = pool[Math.floor(Math.random() * pool.length)];
                const num = Math.floor(Math.random() * 999900) + 100; 
                const candidate = `${word}${num}`;
                
                if (!usedAnonValues.has(candidate)) {
                    anonVal = candidate;
                    break;
                }
                attempts++;
                if (attempts > 50) {
                    const fallbackSuffix = Math.random().toString(36).substr(2, 6);
                    anonVal = `${word}${num}_${fallbackSuffix}`;
                    break;
                }
            }

            usedAnonValues.add(anonVal);
            map.set(val, anonVal);
            keyMap[val] = anonVal;
          });
          generatedMaps[col] = map;
          keyFileMappings[col] = keyMap;
        }
        
        if (configs[col].action === 'shuffle') {
          const arr = shuffleCollectors[col];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
        }
      });

      const keyFileStruct: KeyFileStructure = {
        meta: { timestamp: Date.now(), originalFileName: file.file.name },
        mappings: keyFileMappings,
        renames: {}
      };
      
      columns.forEach(col => {
        if (configs[col].renameTo && configs[col].renameTo !== col) {
          keyFileStruct.renames[col] = configs[col].renameTo!;
        }
      });

      offset = 0; leftover = ''; isHeaderProcessed = false;
      let totalRows = 0;
      const outputChunks: string[] = [];
      const newHeaders = columns.map(h => configs[h].renameTo || h);
      let buffer = newHeaders.map(v => safeCsvField(v)).join(',') + '\n';
      
      const shuffleCounters: Record<string, number> = {};
      columns.forEach(col => shuffleCounters[col] = 0);

      while (offset < fileSize) {
        const chunk = file.file.slice(offset, offset + chunkSize);
        const text = await chunk.text();
        const rawData = leftover + text;
        const lines = rawData.split(/\r?\n/);
        leftover = (offset + chunkSize < fileSize) ? (lines.pop() || '') : '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          if (!isHeaderProcessed && i === 0) { isHeaderProcessed = true; continue; }

          const cols = parseCSVLine(line);
          const newRow = columns.map((header, idx) => {
            const originalVal = cols[idx] || '';
            const config = configs[header];
            
            if (config.action === 'map') return generatedMaps[header]?.get(originalVal) || originalVal;
            if (config.action === 'shuffle') return shuffleCollectors[header][shuffleCounters[header]++];
            return originalVal;
          });

          buffer += newRow.map(v => safeCsvField(v)).join(',') + '\n';
          totalRows++;

          if (buffer.length > 5 * 1024 * 1024) { outputChunks.push(buffer); buffer = ''; }
        }
        offset += chunkSize;
        setProgress(Math.min(100, 40 + Math.round((offset / fileSize) * 60)));
        await new Promise(r => setTimeout(r, 0));
      }
      if (buffer) outputChunks.push(buffer);

      const zip = new JSZip();
      zip.file('anonymized_data.csv', new Blob(outputChunks, { type: 'text/csv' }));
      zip.file('deanonymization_key.json', JSON.stringify(keyFileStruct, null, 2));
      
      const zipContent = await zip.generateAsync({ type: 'blob' });
      setDownloadUrl(URL.createObjectURL(zipContent));
      setStats({
        totalRows,
        columnsModified: (Object.values(configs) as ColumnConfig[]).filter(c => c.action !== 'keep' || c.renameTo !== undefined).length
      });
      setProgress(100);

    } catch (e: any) {
      setError(e.message || "Anonymization failed");
    } finally {
      setProcessing(false);
    }
  };

  // --- DEANONYMIZE LOGIC ---

  const processKeyFile = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setKeyFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.mappings) throw new Error("Invalid Key File format");
        setKeyData(json as KeyFileStructure);
      } catch (err) {
        setError("Failed to parse Key File. Ensure it is a valid JSON generated by this tool.");
      }
    };
    reader.readAsText(f);
  };

  // Auto-match columns when both files are loaded
  useEffect(() => {
    if (reportFile && keyData) {
      const newConfigs: Record<string, DeanonymizeConfig> = {};
      const reverseRenames: Record<string, string> = {};
      const renamesMap = keyData.renames;
      Object.entries(renamesMap).forEach(([orig, newly]) => {
          reverseRenames[String(newly)] = orig;
      });

      (reportFile.headers as string[]).forEach((header: string) => {
        let matchedKey: string | null = null;
        if (keyData.mappings[header]) {
          matchedKey = header;
        } else if (reverseRenames[header] && keyData.mappings[reverseRenames[header]]) {
          matchedKey = reverseRenames[header];
        }
        newConfigs[header] = {
          targetColumn: header,
          keyId: matchedKey,
          restoreName: !!matchedKey 
        };
      });
      setDeanonymizeConfigs(newConfigs);
    }
  }, [reportFile, keyData]);

  const updateDeanonymizeConfig = (header: string, updates: Partial<DeanonymizeConfig>) => {
    setDeanonymizeConfigs(prev => ({
      ...prev,
      [header]: { ...prev[header], ...updates }
    }));
  };

  const processDeanonymization = async () => {
    if (!reportFile || !keyData) return;
    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const reverseMaps: Record<string, Map<string, string>> = {};
      (Object.values(deanonymizeConfigs) as DeanonymizeConfig[]).forEach(cfg => {
        if (cfg.keyId && keyData.mappings[cfg.keyId]) {
          const forwardMap = keyData.mappings[cfg.keyId];
          const revMap = new Map<string, string>();
          Object.entries(forwardMap).forEach(([orig, anon]) => revMap.set(String(anon), orig));
          reverseMaps[cfg.keyId] = revMap;
        }
      });

      Object.keys(keyData.mappings).forEach(key => {
          if (!reverseMaps[key]) {
              const forwardMap = keyData.mappings[key];
              const revMap = new Map<string, string>();
              Object.entries(forwardMap).forEach(([orig, anon]) => revMap.set(String(anon), orig));
              reverseMaps[key] = revMap;
          }
      });

      const isExcel = reportFile.file.name.toLowerCase().endsWith('.xlsx') || reportFile.file.name.toLowerCase().endsWith('.xls');

      if (isExcel) {
          const buffer = await reportFile.file.arrayBuffer();
          const workbook = read(buffer, { type: 'array' });
          const newWorkbook = utils.book_new();
          
          let sheetsProcessed = 0;
          for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const jsonData = utils.sheet_to_json<any[]>(sheet, { header: 1 });
              if (jsonData.length === 0) continue;
              
              const headers = jsonData[0]; 
              const dataRows = jsonData.slice(1);
              const headerMap: { index: number, keyId: string, restoreName: boolean }[] = [];
              const newHeaders = headers.map((h, idx) => {
                  const hStr = String(h);
                  const cfg = deanonymizeConfigs[hStr];
                  if (cfg && cfg.keyId) {
                      headerMap.push({ index: idx, keyId: cfg.keyId, restoreName: cfg.restoreName });
                      return cfg.restoreName ? cfg.keyId : hStr;
                  }
                  if (reverseMaps[hStr]) {
                      headerMap.push({ index: idx, keyId: hStr, restoreName: true });
                      return hStr;
                  }
                  return hStr;
              });

              const newRows = dataRows.map(row => {
                  const newRow = [...row];
                  headerMap.forEach(({ index, keyId }) => {
                      const val = row[index];
                      if (val !== undefined && val !== null) {
                          const original = reverseMaps[keyId]?.get(String(val));
                          if (original !== undefined) {
                              newRow[index] = original;
                          }
                      }
                  });
                  return newRow;
              });

              const newSheet = utils.aoa_to_sheet([newHeaders, ...newRows]);
              utils.book_append_sheet(newWorkbook, newSheet, sheetName);
              sheetsProcessed++;
              setProgress(Math.round((sheetsProcessed / workbook.SheetNames.length) * 100));
              await new Promise(r => setTimeout(r, 0));
          }
          
          const wbOut = write(newWorkbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          setDownloadUrl(URL.createObjectURL(blob));

      } else {
          const chunkSize = 1024 * 1024 * 2;
          const fileSize = reportFile.file.size;
          let offset = 0; let leftover = ''; let isHeaderProcessed = false;
          const outputChunks: string[] = [];
          
          const finalHeaders = reportFile.headers.map(h => {
            const cfg = deanonymizeConfigs[h] as DeanonymizeConfig | undefined;
            if (cfg && cfg.keyId && cfg.restoreName) return cfg.keyId;
            return h;
          });
          
          let buffer = finalHeaders.map(v => safeCsvField(v)).join(',') + '\n';

          while (offset < fileSize) {
            const chunk = reportFile.file.slice(offset, offset + chunkSize);
            const text = await chunk.text();
            const rawData = leftover + text;
            const lines: string[] = rawData.split(/\r?\n/);
            leftover = (offset + chunkSize < fileSize) ? (lines.pop() || '') : '';

            for (let i = 0; i < lines.length; i++) {
              const line: string = lines[i].trim();
              if (!line) continue;
              if (!isHeaderProcessed && i === 0) { isHeaderProcessed = true; continue; }

              const cols = parseCSVLine(line);
              const newRow = reportFile.headers.map((header, idx) => {
                const val = cols[idx] || '';
                const cfg = deanonymizeConfigs[header] as DeanonymizeConfig | undefined;
                
                if (cfg && cfg.keyId && reverseMaps[cfg.keyId]) {
                  const original = reverseMaps[cfg.keyId].get(val);
                  return original !== undefined ? original : val;
                }
                return val;
              });

              buffer += newRow.map(v => safeCsvField(v)).join(',') + '\n';
              if (buffer.length > 5 * 1024 * 1024) { outputChunks.push(buffer); buffer = ''; }
            }
            offset += chunkSize;
            setProgress(Math.min(100, Math.round((offset / fileSize) * 100)));
            await new Promise(r => setTimeout(r, 0));
          }
          if (buffer) outputChunks.push(buffer);

          const blob = new Blob(outputChunks, { type: 'text/csv' });
          setDownloadUrl(URL.createObjectURL(blob));
      }
      
      setStats({ totalRows: 0, columnsModified: 0 }); // Just to trigger success UI
      setProgress(100);

    } catch (e: any) {
      setError(e.message || "Restoration failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <ToolHeader 
        title={txt.title}
        description={txt.desc}
        instructions={txt.instr}
        icon={mode === 'anonymize' ? VenetianMask : FileKey}
        colorClass="text-zinc-400"
        onReset={() => { setDownloadUrl(null); setFile(undefined); setReportFile(undefined); setKeyFile(null); }}
      />

      {/* Mode Switcher */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-900/50 p-1.5 rounded-xl border border-gray-700 flex gap-2">
          <button 
            onClick={() => { setMode('anonymize'); setDownloadUrl(null); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'anonymize' ? 'bg-zinc-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <VenetianMask size={16} /> {txt.sanitize}
          </button>
          <button 
            onClick={() => { setMode('deanonymize'); setDownloadUrl(null); }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'deanonymize' ? 'bg-zinc-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <FileKey size={16} /> {txt.restore}
          </button>
        </div>
      </div>

      {mode === 'anonymize' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <div className="max-w-2xl mx-auto mb-8">
            <FileUploader 
              label={txt.source}
              onFileLoaded={setFile} 
              fileData={file} 
              disabled={processing} 
              theme="gray" 
            />
          </div>

          {file && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-800 bg-gray-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Database size={18} />
                  <span className="font-bold text-sm">{txt.colConfig}</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">{columns.length} {txt.colsDetected}</span>
              </div>
              
              <div className="divide-y divide-gray-800/50 max-h-[500px] overflow-y-auto custom-scrollbar">
                {columns.map((col, idx) => (
                  <div key={col} className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-800/20 transition-colors group">
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                        <h4 className="font-medium text-gray-200 truncate" title={col}>{col}</h4>
                      </div>
                      
                      {/* Rename Input */}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <ArrowRight size={12} className="text-gray-600" />
                        <input 
                          type="text" 
                          placeholder={txt.renamePlaceholder}
                          value={configs[col]?.renameTo || col}
                          onChange={(e) => updateConfig(col, { renameTo: e.target.value })}
                          className="bg-transparent border-b border-gray-700 focus:border-blue-500 outline-none text-blue-300 w-full max-w-[150px] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
                        <button onClick={() => updateConfig(col, { action: 'keep' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${configs[col]?.action === 'keep' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Shield size={12} /> {txt.keep}</button>
                        <button onClick={() => updateConfig(col, { action: 'shuffle' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${configs[col]?.action === 'shuffle' ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-gray-500 hover:text-amber-400/70'}`}><Shuffle size={12} /> {txt.shuffle}</button>
                        <button onClick={() => updateConfig(col, { action: 'map' })} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${configs[col]?.action === 'map' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-blue-400/70'}`}><Type size={12} /> {txt.map}</button>
                      </div>

                      {configs[col]?.action === 'map' && (
                        <div className="relative animate-in fade-in slide-in-from-left-2 duration-200">
                          <select 
                            value={configs[col].category}
                            onChange={(e) => updateConfig(col, { category: e.target.value as CategoryKey })}
                            className="appearance-none bg-gray-900 border border-gray-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-none cursor-pointer w-32"
                          >
                            <option value="colors">Colors</option>
                            <option value="animals">Animals</option>
                            <option value="fruits">Fruits</option>
                            <option value="cities">Cities</option>
                            <option value="tech">Tech Terms</option>
                            <option value="nato">NATO</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {file && !downloadUrl && (
            <div className="flex justify-center">
              <button 
                onClick={processAnonymization} 
                disabled={processing}
                className={`flex items-center gap-3 px-10 py-4 rounded-full font-bold uppercase tracking-widest shadow-xl transition-all ${processing ? 'bg-gray-800 text-gray-500' : 'bg-gradient-to-r from-zinc-600 to-slate-600 hover:from-zinc-500 text-white hover:scale-105'}`}
              >
                {processing ? (
                  <><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>Processing {progress}%</>
                ) : (
                  <><VenetianMask size={20} /> {txt.anonymizeBtn}</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'deanonymize' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <FileUploader 
              label={txt.reportFile}
              onFileLoaded={setReportFile} 
              fileData={reportFile} 
              disabled={processing} 
              theme="gray" 
            />
            <div className="flex flex-col gap-2 w-full">
              <FileUploader 
                label={txt.keyFile}
                onFilesSelected={processKeyFile}
                multiple={false}
                disabled={processing}
                theme="zinc"
                accept=".json"
                limitText="deanonymization_key.json"
                fileData={keyFile ? { 
                    file: keyFile, 
                    id: 'key', 
                    headers: [], 
                    previewRows: [], 
                    sizeFormatted: '' 
                } : undefined}
              />
            </div>
          </div>

          {reportFile && keyData && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-lg max-w-5xl mx-auto">
              {/* ... Mapping UI remains same ... */}
              <div className="px-6 py-4 border-b border-gray-800 bg-gray-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300">
                  <RefreshCw size={18} />
                  <span className="font-bold text-sm">{txt.restoreMapping}</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {txt.keySource}: {keyData.meta.originalFileName} ({new Date(keyData.meta.timestamp).toLocaleDateString()})
                </span>
              </div>
              
              <div className="divide-y divide-gray-800/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                {reportFile.headers.map((col, idx) => (
                  <div key={col} className="px-6 py-3 flex items-center gap-6 hover:bg-gray-800/20">
                    <div className="w-1/3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">Report Column</p>
                      <p className="text-sm font-medium text-white truncate" title={col}>{col}</p>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <ArrowRight size={16} className="text-gray-600" />
                    </div>

                    <div className="flex-1 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-0.5">{txt.mapOriginal}</p>
                        <select 
                          value={deanonymizeConfigs[col]?.keyId || ''} 
                          onChange={(e) => updateDeanonymizeConfig(col, { keyId: e.target.value || null })}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-zinc-500 outline-none"
                        >
                          <option value="">{txt.doNotRestore}</option>
                          {Object.keys(keyData.mappings).map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      
                      {deanonymizeConfigs[col]?.keyId && (
                        <label className="flex items-center gap-2 cursor-pointer mt-4">
                          <input 
                            type="checkbox" 
                            checked={deanonymizeConfigs[col]?.restoreName}
                            onChange={(e) => updateDeanonymizeConfig(col, { restoreName: e.target.checked })}
                            className="rounded border-gray-700 bg-gray-900 text-zinc-500 focus:ring-0"
                          />
                          <span className="text-xs text-gray-400">{txt.restoreName}</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportFile && keyData && !downloadUrl && (
            <div className="flex justify-center">
              <button 
                onClick={processDeanonymization} 
                disabled={processing}
                className={`flex items-center gap-3 px-10 py-4 rounded-full font-bold uppercase tracking-widest shadow-xl transition-all ${processing ? 'bg-gray-800 text-gray-500' : 'bg-zinc-600 hover:bg-zinc-500 text-white hover:scale-105 shadow-zinc-900/20'}`}
              >
                {processing ? (
                  <><div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>Processing {progress}%</>
                ) : (
                  <><FileKey size={20} /> {txt.restoreBtn}</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="max-w-3xl mx-auto bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {downloadUrl && (
        <div className="w-full max-w-xl mx-auto bg-zinc-500/10 border border-zinc-500/20 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-zinc-500/20 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-zinc-900/20">
            {mode === 'anonymize' ? <Archive size={32} /> : <Check size={32} />}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">{mode === 'anonymize' ? txt.packageReady : txt.restoreComplete}</h3>
          <p className="text-zinc-200/70 text-sm mb-8">
            {mode === 'anonymize' 
              ? txt.packageDesc
              : txt.restoreDesc}
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => { setDownloadUrl(null); setFile(undefined); setReportFile(undefined); setKeyFile(null); }}
              className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
            >
              {txt.startOver}
            </button>
            <a 
              href={downloadUrl} 
              download={mode === 'anonymize' ? 'safe_data_package.zip' : (reportFile?.file.name.replace(/\.[^/.]+$/, "") + '_restored.xlsx')}
              className="flex items-center gap-2 bg-zinc-600 hover:bg-zinc-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-zinc-900/20 transition-all hover:-translate-y-1"
            >
              <Download size={18} /> {txt.download}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnonymizerTool;