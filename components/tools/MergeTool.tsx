
import React, { useState, useEffect } from 'react';
import FileUploader from '../FileUploader';
import AnalysisPanel from '../AnalysisPanel';
import ToolHeader from '../layout/ToolHeader';
import { FileData, AnalysisResult, MergeStatus } from '../../types';
import { analyzeBatch } from '../../services/localAnalysisService';
import { findHeaderOffset, checkTrailingNewline } from '../../utils/csvHelpers';
import { Download, RefreshCw, Zap, Trash2, Plus, FileStack, ArrowRightLeft, ArrowDown, Columns, Rows, AlertCircle, Settings, ChevronDown, ChevronUp, Check, List, CheckSquare, Square, SlidersHorizontal, Info, Layers } from 'lucide-react';
import { useLanguage } from '../../App';

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

const safeCsvField = (field: string | number | undefined | null): string => {
  if (field === undefined || field === null) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

type MergeMode = 'append' | 'join';
type JoinType = 'left' | 'inner';

const MergeTool: React.FC = () => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<MergeMode>('join');
  const [primaryFile, setPrimaryFile] = useState<FileData | undefined>();
  const [appendQueue, setAppendQueue] = useState<FileData[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileA, setFileA] = useState<FileData | undefined>();
  const [fileB, setFileB] = useState<FileData | undefined>();
  const [keyA, setKeyA] = useState<string>('');
  const [keyB, setKeyB] = useState<string>('');
  const [joinType, setJoinType] = useState<JoinType>('left');
  const [matchCase, setMatchCase] = useState<boolean>(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [selectedColsA, setSelectedColsA] = useState<Set<string>>(new Set());
  const [selectedColsB, setSelectedColsB] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<MergeStatus>(MergeStatus.IDLE);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [processTime, setProcessTime] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Swap animation state
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => { if (fileA) setSelectedColsA(new Set(fileA.headers)); else setSelectedColsA(new Set()); }, [fileA]);
  useEffect(() => { if (fileB) { const cols = new Set(fileB.headers); if (keyB && cols.has(keyB)) cols.delete(keyB); setSelectedColsB(cols); } else setSelectedColsB(new Set()); }, [fileB, keyB]);
  useEffect(() => { if (status !== MergeStatus.MERGING && status !== MergeStatus.COMPLETED) { setAnalysis(null); setStatus(MergeStatus.IDLE); setDownloadUrl(null); setError(null); setProgress(0); } }, [primaryFile?.id, appendQueue.length, fileA?.id, fileB?.id, mode, joinType, matchCase, selectedColsA, selectedColsB]);

  const toggleColA = (col: string) => { const next = new Set(selectedColsA); if (next.has(col)) next.delete(col); else next.add(col); setSelectedColsA(next); };
  const toggleColB = (col: string) => { const next = new Set(selectedColsB); if (next.has(col)) next.delete(col); else next.add(col); setSelectedColsB(next); };
  const toggleAllA = () => { if (fileA) { if (selectedColsA.size === fileA.headers.length) setSelectedColsA(new Set()); else setSelectedColsA(new Set(fileA.headers)); } };
  const toggleAllB = () => { if (fileB) { if (selectedColsB.size === fileB.headers.length) setSelectedColsB(new Set()); else setSelectedColsB(new Set(fileB.headers)); } };

  const addToQueue = (newFile: FileData) => { 
      if (primaryFile?.file.name === newFile.file.name) {
          setError(`File "${newFile.file.name}" is already the Primary Source.`);
          return;
      }
      if (appendQueue.some(f => f.file.name === newFile.file.name)) {
          setError(`File "${newFile.file.name}" is already in the queue.`);
          return;
      }
      setError(null);
      setAppendQueue(prev => [...prev, newFile]); 
  };
  
  const removeFromQueue = (id: string) => { setAppendQueue(prev => prev.filter(f => f.id !== id)); };

  const handleSwapFiles = () => {
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 500);

    if (mode === 'join') {
        const temp = fileA;
        setFileA(fileB);
        setFileB(temp);
        // Reset keys to avoid mismatch
        setKeyA('');
        setKeyB('');
    } else {
        // Swap primary with the first item in queue
        if (primaryFile && appendQueue.length > 0) {
            const firstQueue = appendQueue[0];
            const remainingQueue = appendQueue.slice(1);
            setAppendQueue([primaryFile, ...remainingQueue]);
            setPrimaryFile(firstQueue);
        }
    }
  };

  const handleAnalyzeAppend = async () => { if (!primaryFile || appendQueue.length === 0) return; setStatus(MergeStatus.ANALYZING); try { const result = await analyzeBatch(primaryFile, appendQueue); setAnalysis(result); setStatus(MergeStatus.READY); } catch (e) { setStatus(MergeStatus.ERROR); } };

  const handleAppendMerge = async () => {
    if (!primaryFile || appendQueue.length === 0) return;
    setStatus(MergeStatus.MERGING);
    const startTime = performance.now();
    try {
      const blobParts: BlobPart[] = [primaryFile.file];
      let lastFile = primaryFile.file;
      for (const fileData of appendQueue) {
          const hasNewline = await checkTrailingNewline(lastFile);
          if (!hasNewline) blobParts.push("\n");
          const offset = await findHeaderOffset(fileData.file);
          blobParts.push(fileData.file.slice(offset));
          lastFile = fileData.file;
      }
      const mergedBlob = new Blob(blobParts, { type: 'text/csv' });
      setDownloadUrl(URL.createObjectURL(mergedBlob));
      setProcessTime(Math.round(performance.now() - startTime));
      setStatus(MergeStatus.COMPLETED);
    } catch (e) { setStatus(MergeStatus.ERROR); }
  };

  const handleJoinMerge = async () => {
    if (!fileA || !fileB || !keyA || !keyB) return;
    setStatus(MergeStatus.MERGING); setProgress(0); setError(null);
    const startTime = performance.now();
    try {
        const targetHeadersA = fileA.headers.filter(h => selectedColsA.has(h));
        const targetIndicesA = targetHeadersA.map(h => fileA.headers.indexOf(h));
        const targetHeadersB = fileB.headers.filter(h => selectedColsB.has(h));
        const targetIndicesB = targetHeadersB.map(h => fileB.headers.indexOf(h));
        const mapB = new Map<string, string>();
        const chunkSize = 1024 * 1024 * 5; 
        let offset = 0; let leftover = ''; let headersB: string[] = []; let keyIndexB = -1;
        const sizeB = fileB.file.size;
        while (offset < sizeB) {
            const chunk = fileB.file.slice(offset, offset + chunkSize);
            const text = await chunk.text(); const rawData = leftover + text; const lines = rawData.split(/\r?\n/);
            leftover = (offset + chunkSize < sizeB) ? (lines.pop() || '') : '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim(); if (!line) continue; const cols = parseCSVLine(line);
                if (headersB.length === 0) { headersB = cols; keyIndexB = headersB.indexOf(keyB); continue; }
                let keyVal = cols[keyIndexB]; if (keyVal === undefined) continue;
                if (!matchCase) keyVal = keyVal.toLowerCase();
                mapB.set(keyVal, targetIndicesB.map(idx => cols[idx]).map(safeCsvField).join(','));
            }
            offset += chunkSize; setProgress(Math.round((offset / sizeB) * 40));
            await new Promise(r => setTimeout(r, 0));
        }
        offset = 0; leftover = ''; const sizeA = fileA.file.size; let headersA: string[] = []; let keyIndexA = -1;
        const outputChunks: string[] = []; let outputBuffer = ''; const BUFFER_SIZE = 5000; let rowCount = 0;
        while (offset < sizeA) {
            const chunk = fileA.file.slice(offset, offset + chunkSize);
            const text = await chunk.text(); const rawData = leftover + text; const lines = rawData.split(/\r?\n/);
            leftover = (offset + chunkSize < sizeA) ? (lines.pop() || '') : '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim(); if (!line) continue; const cols = parseCSVLine(line);
                if (headersA.length === 0) { headersA = cols; keyIndexA = headersA.indexOf(keyA); outputChunks.push([...targetHeadersA, ...targetHeadersB].map(safeCsvField).join(',') + '\n'); continue; }
                let keyVal = cols[keyIndexA]; if (!matchCase && keyVal) keyVal = keyVal.toLowerCase();
                const matchB = mapB.get(keyVal || ''); if (joinType === 'inner' && !matchB) continue;
                const rowAStr = targetIndicesA.map(idx => cols[idx]).map(safeCsvField).join(',');
                outputBuffer += (matchB ? rowAStr + ',' + matchB : rowAStr + ',' + new Array(targetHeadersB.length).fill('').join(',')) + '\n';
                rowCount++; if (rowCount >= BUFFER_SIZE) { outputChunks.push(outputBuffer); outputBuffer = ''; rowCount = 0; }
            }
            offset += chunkSize; setProgress(40 + Math.round((offset / sizeA) * 60));
            await new Promise(r => setTimeout(r, 0));
        }
        if (outputBuffer) outputChunks.push(outputBuffer);
        const mergedBlob = new Blob(outputChunks, { type: 'text/csv' });
        setDownloadUrl(URL.createObjectURL(mergedBlob));
        setProcessTime(Math.round(performance.now() - startTime));
        setStatus(MergeStatus.COMPLETED); setProgress(100);
    } catch (e: any) { setError(e.message || "Join error"); setStatus(MergeStatus.ERROR); }
  };

  const reset = () => { setPrimaryFile(undefined); setAppendQueue([]); setFileA(undefined); setFileB(undefined); setKeyA(''); setKeyB(''); setAnalysis(null); setStatus(MergeStatus.IDLE); setDownloadUrl(null); setError(null); setProgress(0); };

  return (
    <div className="space-y-6">
      <ToolHeader 
        title="CSV Fusion"
        description="The ultimate engine for high-speed CSV operations. Merge datasets horizontally with lookups or stack them vertically for bulk log analysis."
        instructions={[
          "Select 'Column Join' (SQL-Style) or 'Row Append' (Stacking)",
          "Upload your primary source and target files",
          "For Joins: Select matching columns and toggle output fields",
          "Execute merge and download the processed dataset locally"
        ]}
        icon={Layers}
        colorClass="text-cyan-400"
        onReset={reset}
      />

      <div className="flex justify-center mb-10">
         <div className="bg-gray-900/50 p-1.5 rounded-2xl border border-white/[0.06] flex gap-2">
            <button onClick={() => { setMode('join'); reset(); }} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'join' ? 'bg-cyan-600 text-white shadow-xl shadow-cyan-900/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}><Columns size={16} />{t('column_join')}</button>
            <button onClick={() => { setMode('append'); reset(); }} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'append' ? 'bg-cyan-600 text-white shadow-xl shadow-cyan-900/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}><Rows size={16} />{t('row_append')}</button>
         </div>
      </div>

      {mode === 'join' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative max-w-5xl mx-auto">
                <div className="hidden md:flex absolute left-1/2 top-32 -translate-x-1/2 -translate-y-1/2 z-10">
                    <button 
                        onClick={handleSwapFiles}
                        className={`bg-gray-950 p-2.5 rounded-full border border-gray-800 text-cyan-500 shadow-xl hover:scale-110 hover:border-cyan-500/50 transition-all duration-500 ${isSwapping ? 'rotate-180' : ''}`}
                        title="Swap Files"
                    >
                        <ArrowRightLeft size={20} />
                    </button>
                </div>
                <div className="space-y-4">
                    <FileUploader label={t('left_table')} onFileLoaded={setFileA} fileData={fileA} disabled={status === MergeStatus.MERGING || status === MergeStatus.COMPLETED} theme="cyan" />
                    {fileA && <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]"><label className="block text-xs font-semibold text-gray-500 uppercase mb-2 tracking-widest">{t('join_key')}</label><div className="relative"><select value={keyA} onChange={(e) => setKeyA(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-3 pr-8 py-3 appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"><option value="" disabled>Select...</option>{fileA.headers.map(h => (<option key={h} value={h}>{h}</option>))}</select><ArrowDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" /></div></div>}
                </div>
                <div className="space-y-4">
                    <FileUploader label={t('right_table')} onFileLoaded={setFileB} fileData={fileB} disabled={status === MergeStatus.MERGING || status === MergeStatus.COMPLETED} theme="cyan" />
                    {fileB && <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]"><label className="block text-xs font-semibold text-gray-500 uppercase mb-2 tracking-widest">{t('join_key')}</label><div className="relative"><select value={keyB} onChange={(e) => setKeyB(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-3 pr-8 py-3 appearance-none focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"><option value="" disabled>Select...</option>{fileB.headers.map(h => (<option key={h} value={h}>{h}</option>))}</select><ArrowDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" /></div></div>}
                </div>
            </div>
            {fileA && fileB && keyA && keyB && (
            <div className="max-w-4xl mx-auto mt-8 animate-in slide-in-from-top-2 fade-in">
                <div className="w-full bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between p-5 bg-white/[0.01] cursor-pointer border-b border-white/[0.06]" onClick={() => setIsConfigOpen(!isConfigOpen)}><div className="flex items-center gap-3 text-cyan-100 font-bold"><SlidersHorizontal size={18} className="text-cyan-400" /><span>{t('configuration')}</span></div>{isConfigOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                    {isConfigOpen && (
                    <div className="p-6 space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-white/[0.06]"><div className="space-y-3"><label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2"><ArrowRightLeft size={12} /> {t('strategy')}</label><div className="grid grid-cols-2 gap-2"><button onClick={() => setJoinType('left')} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${joinType === 'left' ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300' : 'bg-gray-900/50 border-gray-800 text-gray-500'}`}>{joinType === 'left' && <Check size={12} />}Left Join</button><button onClick={() => setJoinType('inner')} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${joinType === 'inner' ? 'bg-purple-500/10 border-purple-500/50 text-purple-300' : 'bg-gray-900/50 border-gray-800 text-gray-500'}`}>{joinType === 'inner' && <Check size={12} />}Inner Join</button></div></div><div className="space-y-3"><label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2"><Settings size={12} /> {t('options')}</label><div className="flex items-center justify-between bg-gray-950/50 p-3 rounded-xl border border-gray-800"><div className="flex flex-col"><span className="text-sm text-gray-300 font-bold">{t('case_sensitive')}</span><span className="text-[10px] text-gray-600">Strict matching (A ≠ a)</span></div><button onClick={() => setMatchCase(!matchCase)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all ${matchCase ? 'bg-cyan-600' : 'bg-gray-700'}`}><span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${matchCase ? 'translate-x-5' : 'translate-x-1'}`} /></button></div></div></div>
                        <div><label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4"><List size={12} /> {t('output_fields')}</label><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-gray-950/60 rounded-xl border border-white/[0.06] flex flex-col h-64"><div className="p-3 border-b border-white/[0.06] bg-white/[0.01] rounded-t-xl flex justify-between items-center"><span className="text-xs font-black text-cyan-400 uppercase tracking-widest">{t('left_table')}</span><button onClick={toggleAllA} className="text-[10px] text-gray-500 hover:text-white uppercase font-bold">{selectedColsA.size === fileA.headers.length ? 'None' : 'All'}</button></div><div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">{fileA.headers.map(col => (<div key={`a-${col}`} onClick={() => toggleColA(col)} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-all ${selectedColsA.has(col) ? 'bg-cyan-500/10 text-gray-200' : 'text-gray-600 hover:bg-gray-800'}`}>{selectedColsA.has(col) ? <CheckSquare size={14} className="text-cyan-500" /> : <Square size={14} />}<span className="truncate">{col}</span></div>))}</div></div><div className="bg-gray-950/60 rounded-xl border border-white/[0.06] flex flex-col h-64"><div className="p-3 border-b border-white/[0.06] bg-white/[0.01] rounded-t-xl flex justify-between items-center"><span className="text-xs font-black text-purple-400 uppercase tracking-widest">{t('right_table')}</span><button onClick={toggleAllB} className="text-[10px] text-gray-500 hover:text-white uppercase font-bold">{selectedColsB.size === fileB.headers.length ? 'None' : 'All'}</button></div><div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">{fileB.headers.map(col => (<div key={`b-${col}`} onClick={() => toggleColB(col)} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-all ${selectedColsB.has(col) ? 'bg-purple-500/10 text-gray-200' : 'text-gray-600 hover:bg-gray-800'}`}>{selectedColsB.has(col) ? <CheckSquare size={14} className="text-purple-500" /> : <Square size={14} />}<span className="truncate">{col}</span></div>))}</div></div></div></div>
                    </div>
                    )}
                </div>
            </div>
            )}
            {fileA && fileB && keyA && keyB && status === MergeStatus.IDLE && (<div className="flex flex-col items-center gap-4 mt-8"><button onClick={handleJoinMerge} className="flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-12 py-4 rounded-full font-black uppercase tracking-widest shadow-2xl shadow-cyan-900/40 transition-all hover:scale-105 active:scale-95"><Zap size={20} fill="currentColor" />{t('merge_tables')}</button></div>)}
        </div>
      )}

      {mode === 'append' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 animate-in fade-in slide-in-from-bottom-2 relative max-w-5xl mx-auto">
            <div className="hidden md:flex absolute left-1/2 top-32 -translate-x-1/2 -translate-y-1/2 z-10">
                <button 
                    onClick={handleSwapFiles}
                    className={`bg-gray-950 p-2.5 rounded-full border border-gray-800 text-cyan-500 shadow-xl hover:scale-110 hover:border-cyan-500/50 transition-all duration-500 ${isSwapping ? 'rotate-180' : ''}`}
                    title="Swap Files"
                >
                    <ArrowRightLeft size={20} />
                </button>
            </div>
            <div className="space-y-4"><FileUploader label={t('primary_source')} onFileLoaded={setPrimaryFile} fileData={primaryFile} disabled={status === MergeStatus.MERGING || status === MergeStatus.COMPLETED} theme="cyan" />{primaryFile && <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-xl p-4 text-xs text-cyan-400/80 leading-relaxed">This file defines the master column sequence. All rows from subsequent files will align to this schema.</div>}</div>
            
            <div className="space-y-4">
                <div className="relative">
                    <FileUploader 
                        label={t('additional_datasets')} 
                        onFileLoaded={addToQueue} 
                        fileData={undefined} 
                        disabled={status === MergeStatus.MERGING || status === MergeStatus.COMPLETED} 
                        theme="cyan" 
                        multiple={true}
                    />
                </div>
                {appendQueue.length > 0 && (<div className="bg-gray-900/50 rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl"><div className="px-4 py-3 bg-gray-900 border-b border-white/[0.06] flex items-center justify-between"><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('queue')} ({appendQueue.length})</span><button onClick={() => setAppendQueue([])} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest">{t('reset')}</button></div><div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-2">{appendQueue.map((file) => (<div key={file.id} className="group flex items-center justify-between bg-gray-800/40 p-3 rounded-xl border border-white/[0.04] hover:border-cyan-500/30 transition-all"><div className="flex items-center gap-3 overflow-hidden"><div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 text-gray-500 border border-gray-700"><FileStack size={16} /></div><div className="min-w-0"><p className="text-xs text-gray-200 truncate font-bold">{file.file.name}</p><p className="text-[10px] text-gray-600 font-mono">{file.sizeFormatted} • {file.headers.length} cols</p></div></div><button onClick={() => removeFromQueue(file.id)} className="p-1.5 text-gray-600 hover:text-red-400 rounded transition-colors"><Trash2 size={16} /></button></div>))}</div></div>)}
            </div>
            
            {primaryFile && appendQueue.length > 0 && status === MergeStatus.IDLE && (<div className="col-span-1 md:col-span-2 flex justify-center mt-4"><button onClick={handleAnalyzeAppend} className="flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-10 py-4 rounded-full font-black uppercase tracking-widest shadow-2xl shadow-cyan-900/40 transition-all hover:scale-105 active:scale-95"><Zap size={20} />{t('analyze_all')} ({appendQueue.length + 1} Files)</button></div>)}
        </div>
      )}

      {status === MergeStatus.ANALYZING && <div className="text-center py-12"><div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent"></div><p className="mt-4 text-gray-500 font-bold uppercase text-xs tracking-widest">{t('analyzing')}</p></div>}
      {status === MergeStatus.MERGING && <div className="w-full max-w-md mx-auto space-y-4 py-12"><div className="flex justify-between text-xs text-gray-500 uppercase font-black tracking-widest"><span>{t('processing')}</span><span>{progress}%</span></div><div className="h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }}></div></div></div>}
      {error && <div className="max-w-2xl mx-auto bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 animate-in fade-in"><AlertCircle className="text-red-500" /><p className="text-red-300 text-sm font-medium">{error}</p></div>}
      {mode === 'append' && analysis && primaryFile && (status === MergeStatus.READY || status === MergeStatus.COMPLETED) && (<div className="space-y-8"><AnalysisPanel analysis={analysis} />{status === MergeStatus.READY && (<div className="flex justify-center"><button onClick={handleAppendMerge} disabled={!analysis.canMerge} className={`flex items-center gap-3 px-12 py-4 rounded-full font-black uppercase tracking-widest shadow-2xl transition-all ${analysis.canMerge ? 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}><Zap size={20} fill="currentColor" />{analysis.canMerge ? t('commit_append') : t('schema_mismatch')}</button></div>)}</div>)}
      {status === MergeStatus.COMPLETED && downloadUrl && (<div className="animate-in fade-in slide-in-from-bottom-8 duration-500 bg-gray-900/60 border border-white/[0.06] rounded-3xl p-10 text-center max-w-2xl mx-auto shadow-2xl mt-12"><div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-400 border border-cyan-500/20"><Download size={40} /></div><h2 className="text-3xl font-black text-white mb-2">{t('analysis_complete')}</h2><p className="text-gray-500 font-mono text-sm mb-8">Generated in {processTime}ms</p><div className="flex flex-col sm:flex-row gap-4 justify-center"><a href={downloadUrl} download="forge_output.csv" className="bg-white text-black hover:bg-cyan-50 px-10 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl shadow-cyan-500/10">{t('download_csv')}</a><button onClick={reset} className="bg-gray-800 text-gray-300 hover:bg-gray-700 px-10 py-4 rounded-xl font-bold uppercase tracking-widest transition-all">{t('clear')}</button></div></div>)}
    </div>
  );
};

export default MergeTool;
