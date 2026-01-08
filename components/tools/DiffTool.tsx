
import React, { useState, useEffect, useRef } from 'react';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { GitCompare, ArrowRightLeft, AlertCircle, Loader2, Play, CheckCircle2, XCircle, AlertTriangle, FileDiff, Download, Plus, X, Key, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { FileData } from '../../types';
import { useLanguage } from '../../App';
import { parseCSVLine } from '../../utils/csvHelpers';

// --- TYPES ---

type DiffType = 'added' | 'removed' | 'modified';

interface DiffRow {
  key: string;
  type: DiffType;
  newRow: string[]; 
  oldRow?: string[]; 
  diffIndices?: number[];
}

// --- WORKER CODE ---

const createWorkerBlob = () => {
  const code = `
    // --- HELPERS ---
    const parseCSVLine = (line, delimiter = ',') => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === delimiter && !inQuotes) { 
                result.push(current.trim().replace(/^"|"$/g, '')); 
                current = ''; 
            }
            else current += char;
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        
        // Handle malformed "entirely quoted" rows
        if (result.length === 1 && result[0].includes(delimiter)) {
             const inner = parseCSVLine(result[0], delimiter);
             if (inner.length > 1) return inner;
        }
        return result;
    };

    // Modified DJB2 hash for better distribution
    const quickHash = (str) => {
        let hash = 5381;
        let i = str.length;
        while(i) {
            hash = (hash * 33) ^ str.charCodeAt(--i);
        }
        return hash >>> 0;
    };

    const readRowAtOffset = async (file, offset, length, delimiter) => {
        // Safety check to prevent reading out of bounds if offset is bad
        if (offset < 0 || offset >= file.size) return [];
        const blob = file.slice(offset, offset + length);
        const text = await blob.text();
        return parseCSVLine(text.trim(), delimiter);
    };

    // Reorders raw row data to match the New File's schema
    const alignRow = (rawRow, mapping) => {
        // mapping[i] contains the index in rawRow for the i-th column of New File
        return mapping.map(idx => (idx !== -1 && rawRow[idx] !== undefined) ? rawRow[idx] : null);
    };

    // --- MAIN LOGIC ---
    self.onmessage = async (e) => {
        const { 
            fileOld, fileNew, 
            keyIndicesOld, keyIndicesNew, 
            columnMapping, // Array where index i is the Old File index for New File column i
            CHUNK_SIZE, 
            delimiterOld, delimiterNew,
            areHeadersIdentical // Boolean optimization flag
        } = e.data;
        
        try {
            const oldIndex = new Map();
            let added = 0, removed = 0, modified = 0;
            const textDecoder = new TextDecoder();
            
            // --- PHASE 1: INDEX OLD FILE ---
            self.postMessage({ type: 'status', msg: 'Indexing original file (Phase 1/3)...', progress: 0 });
            
            let offset = 0;
            let leftover = null;
            let isFirstRow = true;
            let inQuotes = false;
            const sizeOld = fileOld.size;

            while (offset < sizeOld) {
                const chunkBlob = fileOld.slice(offset, offset + CHUNK_SIZE);
                const buffer = await chunkBlob.arrayBuffer();
                let data = new Uint8Array(buffer);

                // Correctly calculate the start position of 'data' relative to the file
                // If we have leftover, 'data' effectively starts 'leftover.length' BEFORE 'offset'
                let chunkStartOffset = offset;
                
                if (leftover) {
                    chunkStartOffset = offset - leftover.length;
                    const temp = new Uint8Array(leftover.length + data.length);
                    temp.set(leftover);
                    temp.set(data, leftover.length);
                    data = temp;
                    leftover = null;
                }

                let start = 0;
                const dataLen = data.length;

                for (let i = 0; i < dataLen; i++) {
                    if (data[i] === 34) { // Quote "
                        inQuotes = !inQuotes;
                    }
                    if (data[i] === 10 && !inQuotes) { // Newline and NOT inside quotes
                        const lineBytes = data.subarray(start, i);
                        
                        // FIX: Global offset is the chunk start position + index within chunk
                        const rowGlobalOffset = chunkStartOffset + start;
                        
                        start = i + 1;

                        if (isFirstRow) { isFirstRow = false; continue; }
                        
                        const lineStr = textDecoder.decode(lineBytes).trim(); 
                        if (!lineStr) continue;

                        const cols = parseCSVLine(lineStr, delimiterOld);
                        
                        let key = "";
                        for(let k=0; k < keyIndicesOld.length; k++) {
                            const val = cols[keyIndicesOld[k]];
                            key += (val ? String(val).trim() : "") + "|";
                        }
                        
                        if (key && key !== "|") {
                            const rowHash = quickHash(cols.join('\\u0000'));
                            
                            oldIndex.set(key, { 
                                offset: rowGlobalOffset, 
                                length: lineBytes.byteLength, 
                                hash: rowHash, 
                                visited: false
                            });
                        }
                    }
                }

                if (start < dataLen) {
                    leftover = data.slice(start);
                }
                
                offset += CHUNK_SIZE;
                self.postMessage({ type: 'progress', value: Math.min(40, Math.round((offset / sizeOld) * 40)) });
            }
            
            // Handle last line Phase 1
            if (leftover && leftover.length > 0) {
                 const lineStr = textDecoder.decode(leftover).trim();
                 if (lineStr) {
                     const cols = parseCSVLine(lineStr, delimiterOld);
                     let key = "";
                     for(let k=0; k < keyIndicesOld.length; k++) { 
                         const val = cols[keyIndicesOld[k]];
                         key += (val ? String(val).trim() : "") + "|"; 
                     }
                     if (key && key !== "|") {
                         const rowHash = quickHash(cols.join('\\u0000'));
                         oldIndex.set(key, { 
                             offset: sizeOld - leftover.length, 
                             length: leftover.length, 
                             hash: rowHash,
                             visited: false
                         });
                     }
                 }
            }

            // --- PHASE 2: STREAM NEW FILE & COMPARE ---
            self.postMessage({ type: 'status', msg: 'Comparing new data (Phase 2/3)...', progress: 40 });
            
            offset = 0;
            leftover = null;
            isFirstRow = true;
            inQuotes = false; // Reset for new file
            const sizeNew = fileNew.size;
            let resultsBatch = [];

            while (offset < sizeNew) {
                const chunkBlob = fileNew.slice(offset, offset + CHUNK_SIZE);
                const buffer = await chunkBlob.arrayBuffer();
                let data = new Uint8Array(buffer);

                if (leftover) {
                    const temp = new Uint8Array(leftover.length + data.length);
                    temp.set(leftover);
                    temp.set(data, leftover.length);
                    data = temp;
                    leftover = null;
                }

                let start = 0;
                const dataLen = data.length;

                for (let i = 0; i < dataLen; i++) {
                    if (data[i] === 34) { 
                        inQuotes = !inQuotes;
                    }
                    if (data[i] === 10 && !inQuotes) { 
                        const lineBytes = data.subarray(start, i);
                        start = i + 1;

                        if (isFirstRow) { isFirstRow = false; continue; }

                        const lineStr = textDecoder.decode(lineBytes).trim();
                        if (!lineStr) continue;

                        const cols = parseCSVLine(lineStr, delimiterNew);
                        
                        let key = "";
                        for(let k=0; k < keyIndicesNew.length; k++) { 
                            const val = cols[keyIndicesNew[k]];
                            key += (val ? String(val).trim() : "") + "|";
                        }

                        if (key && key !== "|") {
                            const entry = oldIndex.get(key);
                            if (!entry) {
                                // ADDED
                                resultsBatch.push({ key: key.slice(0, -1).replace(/\|/g, ', '), type: 'added', newRow: cols });
                                added++;
                            } else {
                                entry.visited = true; 
                                
                                // OPTIMIZATION: Check Hash First
                                let skip = false;
                                if (areHeadersIdentical) {
                                    const newRowHash = quickHash(cols.join('\\u0000'));
                                    if (entry.hash === newRowHash) skip = true;
                                }

                                if (!skip) {
                                    const rawOldRow = await readRowAtOffset(fileOld, entry.offset, entry.length, delimiterOld);
                                    
                                    if (rawOldRow && rawOldRow.length > 0) {
                                        const oldRow = alignRow(rawOldRow, columnMapping);
                                        const diffIndices = [];
                                        const maxLen = Math.max(oldRow.length, cols.length);
                                        let isDifferent = false;
                                        
                                        for(let c=0; c<maxLen; c++) {
                                            const vOld = oldRow[c] || '';
                                            const vNew = cols[c] || '';
                                            if (vOld !== vNew) {
                                                diffIndices.push(c);
                                                isDifferent = true;
                                            }
                                        }

                                        if (isDifferent) {
                                            resultsBatch.push({ 
                                                key: key.slice(0, -1).replace(/\|/g, ', '), 
                                                type: 'modified', 
                                                newRow: cols, 
                                                oldRow: oldRow,
                                                diffIndices
                                            });
                                            modified++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (start < dataLen) {
                    leftover = data.slice(start);
                }

                // Flush batch periodically
                if (resultsBatch.length > 500) {
                    self.postMessage({ type: 'batch', results: resultsBatch });
                    resultsBatch = [];
                }

                offset += CHUNK_SIZE;
                self.postMessage({ type: 'progress', value: 40 + Math.min(40, Math.round((offset / sizeNew) * 40)) });
            }
            
            // Handle last line Phase 2
            if (leftover && leftover.length > 0) {
                 const lineStr = textDecoder.decode(leftover).trim();
                 if (lineStr) {
                     const cols = parseCSVLine(lineStr, delimiterNew);
                     let key = "";
                     for(let k=0; k < keyIndicesNew.length; k++) { 
                         const val = cols[keyIndicesNew[k]];
                         key += (val ? String(val).trim() : "") + "|";
                     }
                     if (key && key !== "|") {
                         const entry = oldIndex.get(key);
                         if (!entry) {
                             resultsBatch.push({ key: key.slice(0, -1).replace(/\|/g, ', '), type: 'added', newRow: cols });
                             added++;
                         } else {
                             entry.visited = true;
                             let skip = false;
                             if (areHeadersIdentical) {
                                 const newRowHash = quickHash(cols.join('\\u0000'));
                                 if (entry.hash === newRowHash) skip = true;
                             }

                             if (!skip) {
                                const rawOldRow = await readRowAtOffset(fileOld, entry.offset, entry.length, delimiterOld);
                                const oldRow = alignRow(rawOldRow, columnMapping);
                                const diffIndices = [];
                                const maxLen = Math.max(oldRow.length, cols.length);
                                let isDifferent = false;
                                for(let c=0; c<maxLen; c++) { 
                                    const vOld = oldRow[c] || '';
                                    const vNew = cols[c] || '';
                                    if (vOld !== vNew) {
                                        diffIndices.push(c);
                                        isDifferent = true;
                                    }
                                }
                                if (isDifferent) {
                                    resultsBatch.push({ key: key.slice(0, -1).replace(/\|/g, ', '), type: 'modified', newRow: cols, oldRow: oldRow, diffIndices });
                                    modified++;
                                }
                             }
                         }
                     }
                 }
            }
            
            // Flush remaining adds/mods
            if (resultsBatch.length > 0) {
                self.postMessage({ type: 'batch', results: resultsBatch });
                resultsBatch = [];
            }

            // --- PHASE 3: IDENTIFY REMOVED ---
            self.postMessage({ type: 'status', msg: 'Checking for removals (Phase 3/3)...', progress: 80 });
            
            let processedEntries = 0;
            const totalEntries = oldIndex.size;
            
            for (const [key, entry] of oldIndex.entries()) {
                if (!entry.visited) {
                    const rawOldRow = await readRowAtOffset(fileOld, entry.offset, entry.length, delimiterOld);
                    const oldRow = alignRow(rawOldRow, columnMapping);
                    resultsBatch.push({ key: key.slice(0, -1).replace(/\|/g, ', '), type: 'removed', newRow: [], oldRow: oldRow });
                    removed++;
                }
                
                if (resultsBatch.length > 500) {
                    self.postMessage({ type: 'batch', results: resultsBatch });
                    resultsBatch = [];
                }
                
                processedEntries++;
                if (processedEntries % 5000 === 0) {
                    self.postMessage({ type: 'progress', value: 80 + Math.round((processedEntries / totalEntries) * 20) });
                }
            }
            
            if (resultsBatch.length > 0) {
                self.postMessage({ type: 'batch', results: resultsBatch });
            }

            self.postMessage({ type: 'done', stats: { added, removed, modified } });

        } catch (e) {
            self.postMessage({ type: 'error', error: e.message });
        }
    };
  `;
  return new Blob([code], { type: 'application/javascript' });
};

// --- COMPONENT ---

const DiffTool: React.FC = () => {
  const { t } = useLanguage();
  const [fileOld, setFileOld] = useState<FileData | undefined>();
  const [fileNew, setFileNew] = useState<FileData | undefined>();
  
  // Multi-key support
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isSwapping, setIsSwapping] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [diffResults, setDiffResults] = useState<DiffRow[]>([]);
  const [stats, setStats] = useState({ added: 0, removed: 0, modified: 0 });
  const [isDone, setIsDone] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRows, setVisibleRows] = useState(50);

  // Auto-detect Keys (First common column if empty)
  useEffect(() => {
    if (fileOld && fileNew && selectedKeys.length === 0) {
      const common = fileOld.headers.filter(h => fileNew.headers.includes(h));
      // Prioritize Index/ID columns
      const priority = ['index', 'id', '_id', 'no', 'uuid', 'guid', 'email', 'sku', 'code', 'key', 'user_id', 'order_id'];
      const best = common.find(c => priority.includes(c.toLowerCase()));
      if (best) setSelectedKeys([best]);
      else if (common.length > 0) setSelectedKeys([common[0]]);
    }
  }, [fileOld, fileNew]);

  const handleKeySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val && !selectedKeys.includes(val)) {
          setSelectedKeys([...selectedKeys, val]);
      }
      e.target.value = ""; // Reset select
  };

  const removeKey = (key: string) => {
      setSelectedKeys(selectedKeys.filter(k => k !== key));
  };

  const handleSwapFiles = () => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 500);
    const temp = fileOld;
    setFileOld(fileNew);
    setFileNew(temp);
    // Clear results when swapping inputs
    if (isDone || diffResults.length > 0) {
        setDiffResults([]);
        setIsDone(false);
        setStats({ added: 0, removed: 0, modified: 0 });
    }
  };

  const handleBack = () => {
    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }
    setDiffResults([]);
    setIsDone(false);
    setProgress(0);
    setError(null);
    setStatusMsg('');
    setIsProcessing(false);
    setStats({ added: 0, removed: 0, modified: 0 });
  };

  const handleReset = () => {
    if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
    }
    setFileOld(undefined);
    setFileNew(undefined);
    setSelectedKeys([]);
    setDiffResults([]);
    setIsDone(false);
    setProgress(0);
    setError(null);
    setStatusMsg('');
    setIsProcessing(false);
    setStats({ added: 0, removed: 0, modified: 0 });
  };

  const processDiff = async () => {
    if (!fileOld || !fileNew || selectedKeys.length === 0) return;
    
    // Terminate existing worker
    if (workerRef.current) workerRef.current.terminate();

    setIsProcessing(true);
    setProgress(0);
    setDiffResults([]);
    setStats({ added: 0, removed: 0, modified: 0 });
    setError(null);

    const idIndicesOld = selectedKeys.map(k => fileOld.headers.indexOf(k));
    const idIndicesNew = selectedKeys.map(k => fileNew.headers.indexOf(k));
    
    if (idIndicesOld.includes(-1) || idIndicesNew.includes(-1)) {
        setError("One or more selected key columns not found in files.");
        setIsProcessing(false);
        return;
    }

    // Build Column Mapping (Index in Old File for each column in New File)
    const columnMapping = fileNew.headers.map(h => fileOld.headers.indexOf(h));
    
    // OPTIMIZATION: Check if schema is identical.
    const areHeadersIdentical = JSON.stringify(fileOld.headers) === JSON.stringify(fileNew.headers);

    try {
        const blob = createWorkerBlob();
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        workerRef.current = worker;

        worker.onmessage = (e) => {
            const { type, value, msg, results, stats: finalStats, error: workerError } = e.data;
            
            if (type === 'progress') setProgress(value);
            else if (type === 'status') setStatusMsg(msg);
            else if (type === 'batch') {
                setDiffResults(prev => [...prev, ...results]);
            }
            else if (type === 'done') {
                setStats(finalStats);
                setProgress(100);
                setIsDone(true);
                setIsProcessing(false);
                worker.terminate();
                URL.revokeObjectURL(url);
            }
            else if (type === 'error') {
                setError(workerError);
                setIsProcessing(false);
                worker.terminate();
                URL.revokeObjectURL(url);
            }
        };

        worker.postMessage({
            fileOld: fileOld.file,
            fileNew: fileNew.file,
            keyIndicesOld: idIndicesOld,
            keyIndicesNew: idIndicesNew,
            columnMapping: columnMapping,
            CHUNK_SIZE: 8 * 1024 * 1024,
            delimiterOld: fileOld.delimiter || ',',
            delimiterNew: fileNew.delimiter || ',',
            areHeadersIdentical // Pass boolean to worker
        });

    } catch (e: any) {
        console.error(e);
        setError(e.message || "Comparison failed to start.");
        setIsProcessing(false);
    }
  };

  const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollHeight - scrollTop - clientHeight < 300) {
          setVisibleRows(prev => Math.min(prev + 50, diffResults.length));
      }
  };

  const downloadReport = () => {
      if (diffResults.length === 0) return;
      
      const csvHeaders = ['Status', ...fileNew!.headers];
      let csvContent = csvHeaders.map(h => `"${h}"`).join(',') + '\n';
      
      diffResults.forEach(r => {
          const status = r.type.toUpperCase();
          let rowValues: string[] = [];

          if (r.type === 'added') {
              rowValues = r.newRow;
          } else if (r.type === 'removed') {
              rowValues = r.oldRow || [];
          } else if (r.type === 'modified') {
              // Construct "Old -> New" strings for changed cells
              rowValues = fileNew!.headers.map((_, idx) => {
                  const newVal = r.newRow[idx];
                  if (r.diffIndices?.includes(idx)) {
                      const oldVal = r.oldRow?.[idx] || '';
                      return `[OLD] ${oldVal} -> [NEW] ${newVal}`;
                  }
                  return newVal;
              });
          }

          const line = [status, ...rowValues].map(v => {
              const s = String(v || '');
              return `"${s.replace(/"/g, '""')}"`;
          }).join(',');
          csvContent += line + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diff_report_leader_view_${Date.now()}.csv`;
      a.click();
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      <div className="shrink-0">
        <ToolHeader 
            title="CSV Diff"
            description="Compare two CSV files. Smart streaming technology analyzes files byte-by-byte without crashing. Now supports multi-column keys."
            instructions={[
                "Upload 'Original' and 'New' CSV files",
                "Select one or more columns to form a Unique Key (e.g. FirstName + LastName)",
                "Run Comparison to generate a unified diff view"
            ]}
            icon={GitCompare}
            colorClass="text-orange-400"
            onReset={handleReset}
        />
      </div>

      {!isDone ? (
        <div className="max-w-5xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="hidden md:flex absolute left-1/2 top-32 -translate-x-1/2 -translate-y-1/2 z-10">
                    <button 
                        onClick={handleSwapFiles}
                        className={`bg-gray-950 p-2.5 rounded-full border border-gray-800 text-orange-500 shadow-xl hover:scale-110 hover:border-orange-500/50 transition-all duration-500 ${isSwapping ? 'rotate-180' : ''}`}
                        title="Swap Files"
                        disabled={isProcessing}
                    >
                        <ArrowRightLeft size={20} />
                    </button>
                </div>
                <div className="space-y-4">
                    <FileUploader 
                        label="Original File (Old)"
                        onFileLoaded={setFileOld} 
                        fileData={fileOld} 
                        disabled={isProcessing} 
                        theme="orange" 
                    />
                </div>
                <div className="space-y-4">
                    <FileUploader 
                        label="Target File (New)"
                        onFileLoaded={setFileNew} 
                        fileData={fileNew} 
                        disabled={isProcessing} 
                        theme="orange" 
                    />
                </div>
            </div>

            {fileOld && fileNew && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col items-center gap-6 shadow-xl animate-in slide-in-from-top-2">
                    <div className="w-full max-w-2xl space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                            <Key size={14} /> Unique Identifier Column(s)
                        </label>
                        
                        <div className="bg-gray-950 p-4 rounded-xl border border-gray-700 space-y-3">
                            {/* Selected Tags */}
                            <div className="flex flex-wrap gap-2">
                                {selectedKeys.map(k => (
                                    <span key={k} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-300 rounded-lg text-xs font-bold animate-in zoom-in-95">
                                        {k}
                                        <button onClick={() => removeKey(k)} className="hover:text-white"><X size={12} /></button>
                                    </span>
                                ))}
                                {selectedKeys.length === 0 && (
                                    <span className="text-gray-500 text-xs italic py-1.5">No key selected. Choose columns below.</span>
                                )}
                            </div>

                            <select 
                                value=""
                                onChange={handleKeySelect}
                                className="w-full bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500 transition-colors text-sm"
                            >
                                <option value="">+ Add Key Column...</option>
                                {fileOld.headers.filter(h => fileNew.headers.includes(h) && !selectedKeys.includes(h)).map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-[10px] text-gray-500 text-center">
                            Rows are matched by combining these columns. Example: "First Name" + "Last Name".
                        </p>
                    </div>

                    {isProcessing ? (
                        <div className="w-full text-center space-y-4 pt-2">
                            <div className="flex justify-between text-xs font-black text-orange-400 uppercase tracking-widest px-4">
                                <span>{statusMsg}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full max-w-md mx-auto">
                                <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                            <button 
                                onClick={handleReset}
                                className="mt-4 px-8 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg border border-red-500/20 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                            >
                                <XCircle size={14} /> Cancel Operation
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={processDiff}
                            disabled={selectedKeys.length === 0}
                            className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Play size={18} fill="currentColor" /> Compare Files
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-300 text-sm animate-in fade-in">
                    <AlertCircle size={18} /> {error}
                </div>
            )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            {/* Results Header */}
            <div className="bg-gray-950 border-b border-gray-800 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <FileDiff className="text-orange-400" size={20} />
                        <span className="font-bold text-gray-200">Diff Report</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-mono font-bold border border-green-500/20">+{stats.added} Added</span>
                        <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs font-mono font-bold border border-red-500/20">-{stats.removed} Removed</span>
                        <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-xs font-mono font-bold border border-yellow-500/20">~{stats.modified} Changed</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-bold transition-colors">
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:text-white text-gray-400 rounded-lg text-xs font-bold transition-colors">
                        <ArrowLeft size={14} /> Back
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-auto custom-scrollbar relative" ref={scrollRef} onScroll={handleScroll}>
                {diffResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                        <h3 className="text-lg font-bold text-gray-300">No Differences Found</h3>
                        <p className="text-sm">Both files are identical based on the selected key.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-900 sticky top-0 z-10 shadow-sm">
                            <tr>
                                {fileNew?.headers.map(h => {
                                    const isKey = selectedKeys.includes(h);
                                    return (
                                        <th key={h} className={`p-3 text-[10px] font-black uppercase tracking-widest border-b border-gray-800 whitespace-nowrap border-r border-gray-800/50 ${isKey ? 'bg-orange-500/10 text-orange-400' : 'bg-gray-900 text-gray-500'}`}>
                                            <div className="flex items-center gap-1.5">
                                                {isKey && <Key size={10} />}
                                                {h}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {diffResults.slice(0, visibleRows).map((row, i) => {
                                const isMod = row.type === 'modified';
                                const rowClass = 
                                    row.type === 'added' ? 'bg-green-500/10 hover:bg-green-500/20' : 
                                    row.type === 'removed' ? 'bg-red-500/10 hover:bg-red-500/20' : 
                                    'hover:bg-white/[0.01]'; // Modified/Neutral bg
                                
                                const rowData = row.type === 'removed' ? row.oldRow : row.newRow;

                                return (
                                    <tr key={i} className={`transition-colors ${rowClass}`}>
                                        {fileNew?.headers.map((h, colIdx) => {
                                            const cellVal = rowData?.[colIdx] || '';
                                            const isChangedCell = isMod && row.diffIndices?.includes(colIdx);
                                            // Safe access to old value (it's already aligned by worker)
                                            const oldVal = isChangedCell ? row.oldRow?.[colIdx] : null;
                                            const isKey = selectedKeys.includes(h);

                                            return (
                                                <td key={colIdx} className={`p-3 text-xs border-r border-gray-800/50 font-mono align-top 
                                                    ${isChangedCell ? 'bg-yellow-500/10 border-yellow-500/20' : ''} 
                                                    ${isKey ? 'bg-orange-500/5 border-orange-500/20 font-bold text-orange-200' : ''}
                                                `}>
                                                    {isChangedCell ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-red-400/60 line-through select-all" title="Old Value">
                                                                {oldVal || <span className="opacity-50 italic">empty</span>}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold select-all" title="New Value">
                                                                {cellVal || <span className="opacity-50 italic">empty</span>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className={`truncate max-w-[200px] ${row.type === 'removed' ? 'text-red-300/70' : row.type === 'added' ? 'text-emerald-300' : isKey ? 'text-orange-200' : 'text-gray-500'}`} title={String(cellVal)}>
                                                            {cellVal}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                {visibleRows < diffResults.length && (
                    <div className="p-4 text-center text-xs text-gray-500 italic pb-20">
                        Showing {visibleRows} of {diffResults.length} differences. Scroll to load more...
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default DiffTool;
