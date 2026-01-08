import React, { useState, useEffect, useRef } from 'react';
import FileUploader from '../FileUploader';
import ToolHeader from '../layout/ToolHeader';
import { FileData } from '../../types';
import { 
  Sparkles, Play, Download, Trash2, Undo2, AlertCircle, Table, BrainCircuit, 
  Code, RefreshCw, Eye, EyeOff, Shield, RotateCcw, History, Save, ZapOff,
  Terminal, ShieldCheck, Database, Loader2, Cpu, Lock, CheckCircle, List,
  FileSpreadsheet, SaveAll
} from 'lucide-react';
import { useLanguage } from '../../App';
import { useGemma } from '../../contexts/GemmaContext';

const MAX_PREVIEW_ROWS = 100;
const LARGE_DATA_THRESHOLD = 300000; 

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
    else current += char;
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

const parseCsvChunked = async (file: File, onProgress: (pct: number) => void): Promise<{ data: any[], headers: string[] }> => {
    const CHUNK_SIZE = 5 * 1024 * 1024; 
    const fileSize = file.size;
    let offset = 0;
    let leftover = '';
    const results: any[] = [];
    let headers: string[] = [];
    let isFirstChunk = true;
    
    while (offset < fileSize) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const text = await chunk.text();
        const fullText = leftover + text;
        let lines = fullText.split(/\r?\n/);
        if (offset + CHUNK_SIZE < fileSize) {
            leftover = lines.pop() || '';
        } else {
            leftover = '';
        }
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (isFirstChunk && i === 0) {
                headers = parseCSVLine(line).map(h => h.toLowerCase());
                isFirstChunk = false;
                continue;
            }
            const values = parseCSVLine(line);
            const row: any = {};
            for (let h = 0; h < headers.length; h++) {
                row[headers[h]] = values[h];
            }
            results.push(row);
        }
        offset += CHUNK_SIZE;
        onProgress(Math.round((offset / fileSize) * 100));
        await new Promise(r => setTimeout(r, 0));
    }
    return { data: results, headers };
};

const runWorkerTransformation = (data: any[], code: string, onProgress: (pct: number) => void): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const workerCode = `
            let customFunc = null;
            const str = (v) => {
              if (v === null || v === undefined) return "";
              return String(v);
            };
            const num = (v) => {
                if (typeof v === 'number') return v;
                const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
                return isNaN(n) ? 0 : n;
            };

            self.onmessage = function(e) {
                const { type, payload } = e.data;
                if (type === 'init') {
                    try {
                        customFunc = new Function('data', 'str', 'num', 
                            'try { ' + 
                            '  ' + payload.code + '; ' +
                            '  return data; ' +
                            '} catch (e) { throw e; }'
                        );
                        self.postMessage({ success: true });
                    } catch (err) {
                        self.postMessage({ success: false, error: err.toString() });
                    }
                } else if (type === 'process') {
                    try {
                        if (!customFunc) throw new Error("Worker not initialized");
                        const result = customFunc(payload.chunk, str, num);
                        self.postMessage({ success: true, result });
                    } catch (err) {
                        self.postMessage({ success: false, error: err.toString() });
                    }
                }
            };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        const CHUNK_SIZE = 25000; 
        const totalRows = data.length;
        let processedRows = 0;
        let finalResult: any[] = [];

        worker.onmessage = (e) => {
            if (!e.data.success) {
                worker.terminate();
                URL.revokeObjectURL(url);
                reject(new Error(e.data.error));
                return;
            }
            if (e.data.result !== undefined) {
                if (Array.isArray(e.data.result)) {
                     for (let i = 0; i < e.data.result.length; i++) {
                         finalResult.push(e.data.result[i]);
                     }
                }
                processNextChunk();
            } else {
                processNextChunk();
            }
        };

        const processNextChunk = () => {
            if (processedRows >= totalRows) {
                worker.terminate();
                URL.revokeObjectURL(url);
                resolve(finalResult);
                return;
            }
            const end = Math.min(processedRows + CHUNK_SIZE, totalRows);
            const chunk = data.slice(processedRows, end);
            processedRows = end;
            onProgress(processedRows / totalRows);
            worker.postMessage({ type: 'process', payload: { chunk } });
        };

        worker.onerror = (e) => {
            URL.revokeObjectURL(url);
            worker.terminate();
            reject(new Error("Worker Error: " + e.message));
        };

        worker.postMessage({ type: 'init', payload: { code } });
    });
};

const AiCsvEditorTool: React.FC = () => {
  const { t } = useLanguage();
  const { engine, isModelLoaded, isLoading: isModelLoading, progress: modelProgress, progressVal: modelProgressVal, error: modelError, initGemma } = useGemma();

  const [file, setFile] = useState<FileData | undefined>();
  const fullDataRef = useRef<any[]>([]);
  const originalDataRef = useRef<any[]>([]);
  const historyRef = useRef<any[][]>([]); 
  const chatHistoryRef = useRef<any[]>([]); 

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);

  const [activeActions, setActiveActions] = useState<string[]>([]);
  
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [isLowMemoryMode, setIsLowMemoryMode] = useState(false);

  useEffect(() => {
    if (file) {
      const load = async () => {
        setIsProcessing(true);
        setStatusMessage('Parsing CSV...');
        setProgress(0);
        setError(null);
        try {
          const { data: jsonData, headers: headerRow } = await parseCsvChunked(file.file, (pct) => setProgress(pct));
          if (jsonData.length === 0) throw new Error("File appears empty or invalid.");
          fullDataRef.current = jsonData;
          originalDataRef.current = [...jsonData]; 
          historyRef.current = [];
          chatHistoryRef.current = [];
          setHeaders(headerRow);
          setOriginalHeaders(headerRow);
          setPreviewData(jsonData.slice(0, MAX_PREVIEW_ROWS));
          setTotalRows(jsonData.length);
          setIsLowMemoryMode(jsonData.length > LARGE_DATA_THRESHOLD);
          setActiveActions([]);
          setGeneratedCode(null);
          setDownloadReady(false);
        } catch (e: any) {
          setError("Failed to parse CSV: " + e.message);
        } finally {
          setIsProcessing(false);
          setProgress(0);
          setStatusMessage('');
        }
      };
      load();
    }
  }, [file]);

  const updatePreview = (data: any[], newHeaders?: string[]) => {
      setPreviewData(data.slice(0, MAX_PREVIEW_ROWS));
      setTotalRows(data.length);
      if (newHeaders) setHeaders(newHeaders);
  };

  const handleUndo = () => {
    if (historyRef.current.length > 0) {
      const prevData = historyRef.current.pop();
      if (prevData) {
          const lastPrompt = activeActions[activeActions.length - 1];
          if (lastPrompt) {
              setPrompt(lastPrompt);
          }

          fullDataRef.current = prevData;
          chatHistoryRef.current = chatHistoryRef.current.slice(0, -2); 
          setActiveActions(prev => prev.slice(0, -1));
          setHeaders(prevData.length > 0 ? Object.keys(prevData[0]) : originalHeaders);
          updatePreview(prevData);
          setDownloadReady(true);
      }
    }
  };

  const handleReset = () => {
      if (originalDataRef.current.length === 0) return;
      handleClearAll();
  };

  const handleClearAll = () => {
    setFile(undefined);
    fullDataRef.current = [];
    originalDataRef.current = [];
    historyRef.current = [];
    chatHistoryRef.current = [];
    setPreviewData([]);
    setTotalRows(0);
    setHeaders([]);
    setOriginalHeaders([]);
    setActiveActions([]);
    setGeneratedCode(null);
    setDownloadReady(false);
    setPrompt('');
  };

  const handleSave = async () => {
      const data = fullDataRef.current;
      if (!data || data.length === 0) return;
      setIsProcessing(true);
      setStatusMessage('Exporting Data...');
      try {
          const currentHeaders = Object.keys(data[0]);
          const suggestName = `edited_${file?.file.name || 'data.csv'}`;
          if ('showSaveFilePicker' in window) {
              try {
                  const handle = await (window as any).showSaveFilePicker({
                      suggestedName: suggestName,
                      types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(currentHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n');
                  let buffer = '';
                  for (let i = 0; i < data.length; i++) {
                      const row = data[i];
                      let line = currentHeaders.map(h => {
                          const val = row[h];
                          const strVal = String(val === null || val === undefined ? "" : val);
                          return (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) ? `"${strVal.replace(/"/g, '""')}"` : strVal;
                      }).join(',');
                      buffer += line + '\n';
                      if ((i + 1) % 2000 === 0) {
                          await writable.write(buffer);
                          buffer = '';
                          setProgress(Math.round((i / data.length) * 100));
                          await new Promise(r => setTimeout(r, 0));
                      }
                  }
                  if (buffer) await writable.write(buffer);
                  await writable.close();
                  setIsProcessing(false);
                  return;
              } catch (err: any) {
                  if (err.name === 'AbortError') return;
              }
          }
          const blobParts = [currentHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n'];
          let chunk = '';
          for (let i = 0; i < data.length; i++) {
              chunk += currentHeaders.map(h => {
                  const val = data[i][h];
                  const strVal = String(val === null || val === undefined ? "" : val);
                  return (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) ? `"${strVal.replace(/"/g, '""')}"` : strVal;
              }).join(',') + '\n';
              if ((i + 1) % 5000 === 0) {
                  blobParts.push(chunk); chunk = '';
                  setProgress(Math.round((i / data.length) * 100));
                  await new Promise(r => setTimeout(r, 0));
              }
          }
          if (chunk) blobParts.push(chunk);
          const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = suggestName; a.click();
          URL.revokeObjectURL(url);
      } catch (e: any) {
          setError("Save Failed: " + e.message);
      } finally {
          setIsProcessing(false);
          setStatusMessage('');
      }
  };

  const handleApply = async () => {
    if (!prompt.trim() || !fullDataRef.current.length || !isModelLoaded || !engine) return;
    
    if (!isLowMemoryMode) {
        if (historyRef.current.length >= 10) historyRef.current.shift(); 
        historyRef.current.push([...fullDataRef.current]); 
    } else {
        historyRef.current = [];
    }
    
    setIsProcessing(true);
    setStatusMessage('Gemma is generating your logic...');
    setProgress(10);
    setError(null);

    try {
        const sampleJson = JSON.stringify(fullDataRef.current.slice(0, 5), null, 2);
        
        const systemInstruction = `You are a world-class JavaScript data transformation engine.
INPUT: An array of objects called 'data'.
CONTEXT:
- Columns: ${JSON.stringify(headers)} (ALL NAMES ARE LOWERCASE)
- Sample Data: ${sampleJson}

HELPERS:
- str(value): CONVERTS ANYTHING TO STRING. USE THIS BEFORE ANY STRING METHODS like .replace() or .includes()!
- num(value): CONVERTS ANYTHING TO NUMBER. USE THIS FOR MATH OR NUMERIC COMPARISONS (> < ===)!

TASK: Write the code to fulfill the user request. 
RULES:
1. Column names are case-sensitive and are forced to LOWERCASE.
2. USE str() FOR STRING OPERATIONS. Example: row.id = str(row.id).replace("a", "b"); 
3. USE num() FOR MATH. Example: if(num(row.age) > 18) { ... }
4. DO NOT redeclare 'data'. Use 'data = data.map(...)' or 'data = data.filter(...)'.
5. NEVER explain. Output ONLY valid JS.
6. REMEMBER PREVIOUS STEPS. If a column was added in a previous message, you can now populate or modify it.`;

        const messages = [
            { role: "system", content: systemInstruction },
            ...chatHistoryRef.current,
            { role: "user", content: `USER REQUEST: "${prompt}"` }
        ];

        const completion = await engine.chat.completions.create({
            messages,
            temperature: 0.0,
            max_tokens: 1024
        });

        const rawResponse = completion.choices[0].message.content;
        setStatusMessage('Executing locally...');
        
        let cleanedCode = rawResponse.trim();
        const codeMatch = rawResponse.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
        if (codeMatch) {
            cleanedCode = codeMatch[1].trim();
        } else {
            cleanedCode = cleanedCode.replace(/^(Code|Logic|JavaScript|Logic Body):\s*/i, '');
        }

        cleanedCode = cleanedCode.replace(/(^|\n|\s)(const|let|var)\s+data\s*=/g, '$1data =');
        
        if (!cleanedCode.includes('data =') && !cleanedCode.includes('data.forEach') && (cleanedCode.startsWith('data.') || cleanedCode.startsWith('data ='))) {
            if (!cleanedCode.startsWith('data =')) cleanedCode = 'data = ' + cleanedCode;
        }

        setGeneratedCode(cleanedCode);

        const result = await runWorkerTransformation(fullDataRef.current, cleanedCode, (pct) => setProgress(75 + (pct * 24)));
        
        if (!result || !Array.isArray(result)) {
            throw new Error("Transformation failed to return a valid dataset.");
        }

        if (result.length === 0 && !/delete|remove|filter|clear/i.test(prompt)) {
            throw new Error("Logic resulted in zero rows. Check your query condition or column names.");
        }

        chatHistoryRef.current.push({ role: "user", content: `USER REQUEST: "${prompt}"` });
        chatHistoryRef.current.push({ role: "assistant", content: cleanedCode });

        fullDataRef.current = result;
        const newHeaders = result.length > 0 ? Object.keys(result[0]) : headers;
        setHeaders(newHeaders);
        updatePreview(result, newHeaders);
        setActiveActions(prev => [...prev, prompt]);
        setPrompt('');
        setDownloadReady(true);
    } catch (e: any) {
        console.error("Gemma Processing Error:", e);
        setError(e.message || "Logic Error. Gemma generated invalid logic.");
        if (!isLowMemoryMode) {
            const prev = historyRef.current.pop();
            if(prev) fullDataRef.current = prev;
        }
    } finally {
        setIsProcessing(false);
        setStatusMessage('');
    }
  };

  return (
    <div className="space-y-6">
      <ToolHeader 
        title="Smart CSV Editor"
        description="Modify datasets using natural language instructions. Google Gemini translates your text into code. By default, only headers are sent to the AI to ensure data privacy."
        instructions={[]}
        icon={BrainCircuit}
        colorClass="text-fuchsia-400"
        onReset={handleClearAll}
      />

      <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4">
        {!isModelLoaded ? (
          <div className="bg-gray-900 border border-fuchsia-500/20 p-12 rounded-3xl text-center shadow-2xl animate-in fade-in zoom-in-95 max-w-2xl mx-auto">
            <Cpu size={48} className="mx-auto mb-6 text-fuchsia-400" />
            <h2 className="text-2xl font-bold text-white mb-3">Load Local AI Engine</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">Gemma 2 runs entirely in your browser using WebGPU. No data leaves your device.</p>
            {!isModelLoading ? (
              <button onClick={initGemma} className="bg-gradient-to-br from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center gap-3 mx-auto active:scale-95"><Download size={20}/> Load Gemma 2B</button>
            ) : (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="flex justify-between text-xs font-black text-fuchsia-400 uppercase tracking-widest"><span>{modelProgress}</span><span>{Math.round(modelProgressVal * 100)}%</span></div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-fuchsia-500 transition-all duration-300" style={{ width: `${modelProgressVal * 100}%` }} /></div>
              </div>
            )}
            {modelError && <div className="mt-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl text-left text-red-400 text-xs font-mono leading-relaxed">{modelError}</div>}
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in max-w-5xl mx-auto">
            {/* UPLOAD SECTION (Matching Screenshot) */}
            <div className="space-y-4">
                <div className="text-center">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Upload CSV to Edit</h3>
                </div>
                <div className="max-w-2xl mx-auto">
                  <FileUploader onFileLoaded={setFile} fileData={file} disabled={isProcessing} theme="pink" className="border-fuchsia-500/20" />
                </div>
            </div>

            {headers.length > 0 && (
              <div className="max-w-3xl mx-auto space-y-3">
                  <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-[9px] font-black">
                      <List size={12}/> Headers Preview
                  </div>
                  <div className="bg-[#111827]/40 border border-gray-800 rounded-2xl p-4 flex flex-wrap gap-2">
                      {headers.map((h, i) => (
                          <span key={i} className="px-3 py-1.5 bg-[#0d1117] border border-gray-800 rounded-lg text-[10px] font-mono text-gray-400 shadow-sm">
                              {h}
                          </span>
                      ))}
                  </div>
              </div>
            )}

            {/* COMMAND CENTER (Matching Screenshot) */}
            <div className="bg-[#111827] border border-gray-800 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden ring-1 ring-white/[0.02]">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 opacity-40"></div>
                
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                      <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Describe your change (e.g., 'Remove rows where age < 18', 'Rename col first to firstname', 'Create fullname from first + last')"
                          className="w-full h-40 bg-[#0d1117] border border-gray-800 rounded-3xl p-6 text-sm text-gray-100 placeholder-gray-600 focus:border-fuchsia-500/50 outline-none resize-none transition-all custom-scrollbar shadow-inner"
                          disabled={isProcessing || !file}
                      />
                  </div>
                  <div className="flex flex-col gap-3 shrink-0 sm:w-52">
                      <button 
                          onClick={handleApply}
                          disabled={isProcessing || !prompt.trim() || !file}
                          className="flex items-center justify-center gap-3 bg-gradient-to-br from-fuchsia-700 to-purple-800 hover:from-fuchsia-600 hover:to-purple-700 disabled:opacity-20 disabled:hover:scale-100 text-white px-6 py-5 rounded-[1.5rem] shadow-2xl transition-all active:scale-95 font-bold tracking-tight text-sm"
                      >
                          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                          Apply with AI
                      </button>
                      <button onClick={handleUndo} disabled={isProcessing || historyRef.current.length === 0} className="flex items-center justify-center gap-2 py-3.5 bg-gray-800/40 hover:bg-gray-800 rounded-[1.25rem] text-xs font-bold text-gray-300 transition-all disabled:opacity-20"><Undo2 size={16}/> Undo ({historyRef.current.length})</button>
                      <button onClick={handleReset} disabled={isProcessing || originalDataRef.current.length === 0} className="flex items-center justify-center gap-2 py-3.5 bg-gray-800/40 hover:bg-gray-800 rounded-[1.25rem] text-xs font-bold text-gray-300 transition-all disabled:opacity-20"><RotateCcw size={16}/> Reset</button>
                  </div>
                </div>

                {/* BOTTOM STATUS BAR (Matching Screenshot) */}
                <div className="flex flex-wrap items-center justify-between mt-6 pt-5 border-t border-gray-800/50 gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="px-3 py-1.5 bg-gray-800/40 border border-gray-700/50 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <EyeOff size={12} /> Headers Only (Private)
                        </div>
                        
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-[10px] font-black tracking-[0.2em] shadow-sm">
                            <Shield size={12} strokeWidth={3}/> SECURE
                        </div>

                        <div className="w-px h-4 bg-gray-800 hidden xs:block"></div>

                        <div className="hidden xs:flex items-center gap-3">
                           <label className="flex items-center gap-2 cursor-pointer group">
                              <div className="w-4 h-4 rounded-full border border-gray-700 flex items-center justify-center group-hover:border-gray-500">
                                  <div className="w-1.5 h-1.5 rounded-full bg-transparent"></div>
                              </div>
                              <span className="text-[10px] font-bold text-gray-500 group-hover:text-gray-400 uppercase tracking-tighter">Edit Original File</span>
                           </label>

                           <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
                              <Sparkles size={14} className="text-fuchsia-500/30"/> Gemini 2.5 Flash
                           </div>
                        </div>
                    </div>
                    <button onClick={handleClearAll} className="text-[10px] font-black text-gray-600 hover:text-red-400 transition-colors uppercase tracking-[0.2em] flex items-center gap-2">
                        <Trash2 size={14}/> Clear All
                    </button>
                </div>

                {isProcessing && (
                    <div className="mt-6 space-y-3 animate-in fade-in">
                        <div className="flex justify-between text-[10px] font-black text-fuchsia-400 uppercase tracking-[0.2em]">
                            <span>{statusMessage}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-fuchsia-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex gap-4 animate-in slide-in-from-top-2">
                        <AlertCircle size={20} className="shrink-0"/>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-black mb-1 uppercase tracking-widest text-[10px]">Engine Exception</p>
                            <pre className="whitespace-pre-wrap font-mono opacity-80 leading-relaxed text-[11px]">{error}</pre>
                        </div>
                    </div>
                )}
            </div>

            {/* TRANSFORMATIONS & LOGIC (Matching Screenshot) */}
            {(activeActions.length > 0 || generatedCode) && (
                <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-bottom-4">
                    {activeActions.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-[10px] font-black">
                                    <History size={14}/> Applied Transformations
                                </div>
                                <span className="text-[9px] font-mono text-gray-600 uppercase">{activeActions.length} total</span>
                            </div>
                            <div className="bg-[#111827]/40 border border-gray-800 rounded-2xl divide-y divide-gray-800/50 overflow-hidden">
                                {activeActions.map((action, i) => (
                                    <div key={i} className="px-6 py-3.5 flex items-start gap-4 group hover:bg-white/[0.01] transition-colors">
                                        <span className="text-[10px] font-black text-fuchsia-500/50 mt-0.5 whitespace-nowrap uppercase tracking-widest">#{i+1}.</span>
                                        <span className="text-[13px] text-gray-300 leading-snug font-medium">{action}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {generatedCode && !isProcessing && (
                        <div className="space-y-3">
                           <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-[10px] font-black">
                                <Code size={14}/> Generated Logic
                            </div>
                            <div className="bg-[#0d1117] border border-gray-800 rounded-2xl p-6 shadow-xl relative group">
                                 <div className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black text-gray-500 uppercase tracking-widest">Read Only</div>
                                 </div>
                                 <pre className="text-[12px] font-mono text-gray-500 whitespace-pre-wrap leading-[1.8] custom-scrollbar max-h-64 overflow-y-auto">{generatedCode}</pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* LIVE PREVIEW (Matching Screenshot) */}
            {totalRows > 0 && (
                <div className="bg-[#111827] border border-gray-800 rounded-[2rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                    <div className="px-8 py-5 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Table size={20} className="text-fuchsia-500"/>
                            <span className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">Live Preview <span className="text-gray-600 font-mono ml-2">({totalRows.toLocaleString()} rows)</span></span>
                        </div>
                        {downloadReady && (
                            <button onClick={handleSave} disabled={isProcessing} className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-fuchsia-700 hover:from-fuchsia-500 hover:to-fuchsia-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 group">
                                <Save size={16} className="group-hover:scale-110 transition-transform" /> Save CSV
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#0d1117] sticky top-0 z-10 border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-3.5 text-[10px] font-black text-gray-700 border-r border-gray-800/50 w-16 text-center uppercase tracking-widest">#</th>
                                    {headers.map((h, i) => (
                                        <th key={i} className="px-6 py-3.5 text-[10px] font-black text-gray-400 border-r border-gray-800/30 uppercase whitespace-nowrap tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {previewData.map((row, i) => (
                                    <tr key={i} className="hover:bg-fuchsia-500/[0.02] transition-colors group">
                                        <td className="px-6 py-3 text-[11px] font-mono text-gray-700 border-r border-gray-800/50 text-center bg-[#0d1117]/50">{i+1}</td>
                                        {headers.map((h, j) => (
                                            <td key={j} className="px-6 py-3 text-[12px] text-gray-400 border-r border-gray-800/20 truncate max-w-[250px] font-medium leading-relaxed">{String(row[h] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalRows > MAX_PREVIEW_ROWS && (
                        <div className="px-8 py-3 bg-gray-950/50 text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] text-center border-t border-gray-800/50">
                             Viewing first {MAX_PREVIEW_ROWS} rows.
                        </div>
                    )}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiCsvEditorTool;