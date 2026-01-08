
import React, { useState, useEffect, useRef } from 'react';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { 
    Fingerprint, Lock, FileImage, Download, RefreshCw, Info, CheckCircle2, 
    ShieldAlert, Cpu, List, ArrowUp, ArrowDown, Trash2, Calendar, FileType, 
    Hash, Archive, ChevronRight, X, ArrowRight, GripVertical, Copy, Upload, 
    ShieldCheck, Layers, ChevronLeft, AlertTriangle, Menu, ArrowRightLeft
} from 'lucide-react';
import { FileData } from '../../types';
import exifr from 'exifr';
import JSZip from 'jszip';
import { useLanguage } from '../../App';

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  originalHash: string;
  status: 'idle' | 'processing' | 'done';
  exifData: Record<string, any>;
}

interface ProcessedItem {
  id: string; 
  originalId: string;
  file: File; 
  originalName: string;
  newName: string;
  previewUrl: string;
  originalHash: string;
  newHash: string;
  batchIndex: number;
  newDate: Date;
  isUnique: boolean;
  exifData: Record<string, any>;
}

const MetadataTool: React.FC = () => {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<ImageItem[]>([]);
  const [results, setResults] = useState<ProcessedItem[]>([]);
  const [viewMode, setViewMode] = useState<'input' | 'results'>('input');
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentBatchPage, setCurrentBatchPage] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Configuration
  const [baseFilename, setBaseFilename] = useState("");
  const [shouldScramble, setShouldScramble] = useState(true);
  const [shouldRandomizeDate, setShouldRandomizeDate] = useState(false);
  const [copies, setCopies] = useState<number | string>(1);
  
  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [zipSize, setZipSize] = useState<string>("");

  const currentList = viewMode === 'input' 
    ? queue 
    : results.filter(r => r.batchIndex === currentBatchPage);

  const selectedItem = viewMode === 'input'
    ? queue.find(i => i.id === selectedId)
    : results.find(r => r.id === selectedId);

  // Calculate max batches dynamically based on view mode
  const lastResult = results.length > 0 ? results[results.length - 1] : null;
  const maxBatches = viewMode === 'results' && lastResult 
    ? lastResult.batchIndex 
    : (Number(copies) || 1);

  // Stats
  const totalProcessed = results.length;
  const totalUnique = results.filter(r => r.isUnique).length;
  const totalDuplicates = totalProcessed - totalUnique;

  const calculateHash = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const changeBatchPage = (delta: number) => {
      const newPage = currentBatchPage + delta;
      if (newPage < 1 || newPage > maxBatches) return;
      setCurrentBatchPage(newPage);
      
      // Auto-select first item of the new batch to keep preview in sync
      const firstInBatch = results.find(r => r.batchIndex === newPage);
      if (firstInBatch) {
          setSelectedId(firstInBatch.id);
      }
  };

  const handleFiles = async (files: File[]) => {
    if (viewMode === 'results') {
        setViewMode('input');
        setDownloadUrl(null);
    }

    const newItems: ImageItem[] = [];
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const id = Math.random().toString(36).substr(2, 9);
        const url = URL.createObjectURL(file);
        
        calculateHash(file).then(h => {
            setQueue(prev => prev.map(i => i.id === id ? { ...i, originalHash: h } : i));
        });
        
        exifr.parse(file).then(e => {
            setQueue(prev => prev.map(i => i.id === id ? { ...i, exifData: e || {} } : i));
        }).catch(() => {});

        newItems.push({
            id,
            file,
            previewUrl: url,
            originalHash: 'Calculating...',
            status: 'idle',
            exifData: {}
        });
    }
    
    setQueue(prev => [...prev, ...newItems]);
    if (newItems.length > 0) {
      if (!selectedId) setSelectedId(newItems[0].id);
    }
  };

  // Drag and Drop Handlers for Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (viewMode !== 'input') return;
    setDraggedIndex(index);
    // Required for Firefox
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    if (viewMode !== 'input') return;
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to main container
    
    // Only allow dropping if dragging an item from the list
    if (draggedIndex !== null && draggedIndex !== index) {
       e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDropItem = (e: React.DragEvent, dropIndex: number) => {
    if (viewMode !== 'input') return;
    e.preventDefault();
    e.stopPropagation();
    
    const dragIdxStr = e.dataTransfer.getData("text/plain");
    const dragIdx = parseInt(dragIdxStr, 10);

    if (isNaN(dragIdx) || dragIdx === dropIndex) return;
    
    const newQueue = [...queue];
    const [movedItem] = newQueue.splice(dragIdx, 1);
    newQueue.splice(dropIndex, 0, movedItem);
    
    setQueue(newQueue);
    setDraggedIndex(null);
  };

  const processBatch = async () => {
      if (queue.length === 0) return;
      setIsProcessing(true);
      setProgress(0);
      setDownloadUrl(null);

      const zip = new JSZip();
      const numCopies = Number(copies) || 1;
      const totalOperations = queue.length * numCopies;
      let completedOperations = 0;
      const tempResults: ProcessedItem[] = [];
      const hashCounts: Record<string, number> = {};

      // 1. Pre-fill hash counts with ORIGINAL files to detect if a copy duplicates an original
      for (const item of queue) {
          if (item.originalHash && item.originalHash !== 'Calculating...') {
              hashCounts[item.originalHash] = (hashCounts[item.originalHash] || 0) + 1;
          } else {
              // Fallback if not ready, calculate explicitly
              const h = await calculateHash(item.file);
              hashCounts[h] = (hashCounts[h] || 0) + 1;
          }
      }

      for (let batchIdx = 1; batchIdx <= numCopies; batchIdx++) {
          const folder = numCopies > 1 ? zip.folder(`Batch_${batchIdx}`) : zip;
          for (let i = 0; i < queue.length; i++) {
              const item = queue[i];
              const ext = item.file.name.split('.').pop() || 'jpg';
              let newName = baseFilename.trim() ? `${baseFilename.trim()}_b${batchIdx}_${i + 1}.${ext}` : `b${batchIdx}_img${i + 1}.${ext}`;
              
              let finalBlob: Blob = item.file;
              let finalDate = shouldRandomizeDate ? new Date(Date.now() - Math.random() * 604800000) : new Date(item.file.lastModified);

              if (shouldScramble) {
                  await new Promise<void>((resolve) => {
                      const img = new Image();
                      img.src = item.previewUrl;
                      img.onload = () => {
                          const canvas = document.createElement('canvas');
                          canvas.width = img.width; canvas.height = img.height;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                              ctx.drawImage(img, 0, 0);
                              
                              // 1. Pixel Noise: Add slightly visible noise to multiple pixels to affect image data
                              for(let n=0; n<3; n++) {
                                  ctx.fillStyle = `rgba(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, 0.01)`;
                                  ctx.fillRect(Math.random() * img.width, Math.random() * img.height, 1, 1);
                              }

                              // Variable quality for JPEG to ensure different compression artifacts
                              const q = item.file.type === 'image/jpeg' ? 0.90 + (Math.random() * 0.09) : undefined;

                              canvas.toBlob((blob) => { 
                                  if (blob) {
                                      // 2. Binary Append: The ultimate guarantee for hash uniqueness.
                                      // We append 32 bytes of random data to the end of the file.
                                      const uniquePad = new Uint8Array(32); 
                                      crypto.getRandomValues(uniquePad);
                                      finalBlob = new Blob([blob, uniquePad], { type: blob.type }); 
                                  }
                                  resolve(); 
                              }, item.file.type || 'image/png', q);
                          } else resolve();
                      };
                      img.onerror = () => resolve();
                  });
              }

              if (folder) folder.file(newName, finalBlob, { date: finalDate });
              const computedNewHash = await calculateHash(finalBlob);
              hashCounts[computedNewHash] = (hashCounts[computedNewHash] || 0) + 1;

              tempResults.push({
                  id: `${batchIdx}-${item.id}`,
                  originalId: item.id,
                  file: new File([finalBlob], newName, { type: finalBlob.type, lastModified: finalDate.getTime() }),
                  originalName: item.file.name,
                  newName,
                  previewUrl: item.previewUrl,
                  originalHash: item.originalHash,
                  newHash: computedNewHash,
                  batchIndex: batchIdx,
                  newDate: finalDate,
                  isUnique: false, // Calculated after loop
                  exifData: item.exifData
              });

              completedOperations++;
              setProgress(Math.round((completedOperations / totalOperations) * 100));
          }
      }

      setResults(tempResults.map(r => ({ ...r, isUnique: hashCounts[r.newHash] === 1 })));
      setViewMode('results');
      setCurrentBatchPage(1); // Reset to first batch view
      const content = await zip.generateAsync({ type: 'blob' });
      setDownloadUrl(URL.createObjectURL(content));
      setZipSize((content.size / 1024 / 1024).toFixed(2) + ' MB');
      setIsProcessing(false);
      
      // Ensure the first item of the result set is selected
      if (tempResults.length > 0) setSelectedId(tempResults[0].id);
  };

  const handleReset = () => {
      setQueue([]); setResults([]); setSelectedId(null); setDownloadUrl(null); setProgress(0); setViewMode('input'); setCurrentBatchPage(1); setDraggedIndex(null);
  };

  return (
    <div 
      className="flex flex-col relative flex-1 min-h-0 h-full pb-4"
      onDragOver={(e) => { 
        e.preventDefault(); 
        // Only show drop zone if user is dragging FILES, not reordering internal items
        if (queue.length > 0 && e.dataTransfer.types.includes('Files')) {
            setIsDraggingOver(true); 
        }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => { 
        e.preventDefault(); 
        setIsDraggingOver(false); 
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(Array.from(e.dataTransfer.files)); 
        }
      }}
    >
      {isDraggingOver && (
          <div className="fixed inset-0 z-[200] bg-amber-500/20 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in pointer-events-none">
              <div className="bg-gray-950/90 p-8 rounded-3xl border-2 border-dashed border-amber-400 flex flex-col items-center shadow-2xl">
                  <Upload className="text-amber-400 w-16 h-16 mb-4 animate-bounce" />
                  <h3 className="text-2xl font-bold text-white drop-shadow-md">Drop to add more images</h3>
              </div>
          </div>
      )}

      <ToolHeader 
          title="Metadata & Hash"
          description="Advanced image processor. Edit metadata, scramble hashes, rename in sequence, and randomize timestamps. Every copy generated is guaranteed to have a unique SHA-256 hash."
          instructions={[
            "Upload images to view EXIF and camera metadata",
            "Select number of copies to generate unique variants",
            "Scramble Hash ensures invisible unique signatures for every file",
            "Use the batch switcher to verify hashes across generated sets"
          ]}
          icon={Fingerprint}
          colorClass="text-amber-400"
          onReset={handleReset}
      />

      {queue.length === 0 ? (
          <div className="max-w-2xl mx-auto w-full">
                <FileUploader onFilesSelected={handleFiles} multiple={true} theme="amber" accept=".jpg,.jpeg,.png,.webp" limitText="Multiple Images (JPG, PNG, WEBP)" disabled={isProcessing} />
          </div>
      ) : (
          <div className="flex flex-col lg:flex-row bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex-1 min-h-0">
            {/* SIDEBAR */}
            <div className={`
                flex-shrink-0 bg-gray-950 border-gray-800 transition-all duration-300 flex flex-col overflow-hidden
                border-b lg:border-b-0 lg:border-r 
                ${sidebarOpen ? 'lg:w-72 w-full h-[400px] lg:h-auto' : 'lg:w-0 w-full h-0 lg:h-auto'}
            `}>
                <div className="p-3 border-b border-gray-800 flex items-center justify-between overflow-hidden">
                    <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                        <button onClick={() => setViewMode('input')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'input' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Input</button>
                        <button onClick={() => setViewMode('results')} disabled={results.length === 0} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'results' ? 'bg-amber-600/20 text-amber-400' : 'text-gray-500'}`}>Result</button>
                    </div>
                    <button onClick={() => handleReset()} className="p-1.5 hover:text-red-400 text-gray-500"><Trash2 size={14}/></button>
                </div>

                {/* BATCH SWITCHER (Results Mode Only) */}
                {viewMode === 'results' && (
                    <div className="bg-gray-900/50 border-b border-gray-800 flex flex-col">
                        {/* Stats Panel */}
                        <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between text-[9px] font-mono">
                            <div className="flex flex-col">
                                <span className="text-gray-500 uppercase">Total Files</span>
                                <span className="text-gray-200">{totalProcessed}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-gray-500 uppercase">Unique</span>
                                <span className={totalUnique === totalProcessed ? 'text-emerald-400' : 'text-amber-400'}>
                                    {totalUnique} <span className="text-gray-600">/</span> {totalProcessed}
                                </span>
                            </div>
                        </div>

                        {maxBatches > 1 && (
                            <div className="px-3 py-2 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Select Batch</span>
                                    <span className="text-[9px] font-mono text-amber-500">{currentBatchPage} / {maxBatches}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        type="button"
                                        disabled={currentBatchPage === 1}
                                        onClick={(e) => { e.preventDefault(); changeBatchPage(-1); }}
                                        className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-400 transition-colors"
                                    >
                                        <ChevronLeft size={14} className="mx-auto" />
                                    </button>
                                    <button 
                                        type="button"
                                        disabled={currentBatchPage === maxBatches}
                                        onClick={(e) => { e.preventDefault(); changeBatchPage(1); }}
                                        className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded text-gray-400 transition-colors"
                                    >
                                        <ChevronRight size={14} className="mx-auto" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {currentList.map((item, idx) => (
                        <div 
                            key={item.id} 
                            draggable={viewMode === 'input'}
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOverItem(e, idx)}
                            onDrop={(e) => handleDropItem(e, idx)}
                            onClick={() => setSelectedId(item.id)} 
                            className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${selectedId === item.id ? 'bg-amber-500/10 border-amber-500/30' : 'border-transparent hover:bg-white/5'} ${draggedIndex === idx ? 'opacity-40 border-dashed border-gray-600' : ''}`}
                        >
                            {viewMode === 'input' && (
                                <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 p-1 flex items-center justify-center">
                                    <GripVertical size={14} />
                                </div>
                            )}
                            <img src={item.previewUrl} className="w-10 h-10 object-cover rounded-lg bg-black shrink-0 pointer-events-none" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <p className={`text-[11px] font-medium truncate ${selectedId === item.id ? 'text-white' : 'text-gray-400'}`}>{viewMode === 'input' ? item.file.name : (item as ProcessedItem).newName}</p>
                                    {viewMode === 'results' && (
                                        (item as ProcessedItem).isUnique 
                                        ? <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                                        : <AlertTriangle size={12} className="text-red-500 shrink-0" />
                                    )}
                                </div>
                                <p className="text-[9px] text-gray-600">{(item.file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>
                    ))}
                    {currentList.length === 0 && (
                        <div className="p-8 text-center text-gray-600 text-xs italic">No items in this view.</div>
                    )}
                </div>

                {viewMode === 'input' && (
                    <div className="p-4 border-t border-gray-800 bg-gray-900/50 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                 <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Copies</label>
                                 <input type="number" min="1" max="100" value={copies} onChange={e => setCopies(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-amber-400 font-mono focus:border-amber-500 outline-none" />
                             </div>
                             <div className="space-y-1">
                                 <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Prefix</label>
                                 <input type="text" placeholder="img_" value={baseFilename} onChange={e => setBaseFilename(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-amber-400 font-mono focus:border-amber-500 outline-none" />
                             </div>
                        </div>
                        <button onClick={processBatch} disabled={isProcessing || queue.length === 0} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-30">
                            {isProcessing ? <><RefreshCw size={14} className="animate-spin" /> {progress}%</> : <><Cpu size={14} /> Process {queue.length * Number(copies || 1)} Files</>}
                        </button>
                    </div>
                )}
                {downloadUrl && (
                    <div className="p-4 border-t border-gray-800 bg-emerald-500/5">
                        <a href={downloadUrl} download="unique_processed_batch.zip" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2">
                            <Archive size={14} /> Download {zipSize} ZIP ({results.length} files)
                        </a>
                    </div>
                )}
            </div>

            {/* MAIN VIEWER */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14]">
                <div className="border-b border-gray-800 flex flex-col bg-gray-900/50">
                    <div className="h-12 flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-gray-500 hover:text-white"><Menu size={18}/></button>
                            <span className="text-xs font-bold text-gray-200 truncate">{selectedItem ? (viewMode === 'input' ? selectedItem.file.name : (selectedItem as ProcessedItem).newName) : 'Select Image'}</span>
                        </div>
                        {viewMode === 'results' && selectedItem && (
                            <div className="flex items-center gap-2">
                                <div className="text-[9px] font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">Batch { (selectedItem as ProcessedItem).batchIndex }</div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                    <ShieldCheck size={10} className="text-emerald-500"/> Processed
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {selectedItem && (
                        <div className="px-4 py-2 border-t border-gray-800 bg-black/40 space-y-2">
                            {viewMode === 'input' ? (
                                <div className="flex flex-col">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Source SHA-256 Hash</span>
                                        <button onClick={() => navigator.clipboard.writeText(selectedItem.originalHash)} className="text-gray-600 hover:text-white"><Copy size={10}/></button>
                                    </div>
                                    <div className="text-[10px] font-mono text-amber-400/80 break-all bg-gray-950/50 p-2 rounded border border-white/5 select-all leading-tight">
                                        {selectedItem.originalHash}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Before (Original)</span>
                                        </div>
                                        <div className="text-[9px] font-mono text-gray-500 break-all bg-gray-950/30 p-2 rounded border border-white/5 opacity-60 leading-tight">
                                            {selectedItem.originalHash}
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                                After (Unique Variant) <ArrowRightLeft size={8}/>
                                            </span>
                                            <button onClick={() => navigator.clipboard.writeText((selectedItem as ProcessedItem).newHash)} className="text-amber-600 hover:text-amber-400"><Copy size={10}/></button>
                                        </div>
                                        <div className="text-[9px] font-mono text-amber-400 break-all bg-amber-500/5 p-2 rounded border border-amber-500/20 shadow-inner leading-tight font-bold">
                                            {(selectedItem as ProcessedItem).newHash}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    {/* IMAGE PREVIEW AREA */}
                    <div className="flex-1 bg-[#0d0d0d] flex items-center justify-center p-8 overflow-auto">
                        {selectedItem ? (
                            <div className="relative group max-w-full max-h-full">
                                <img src={selectedItem.previewUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]" />
                            </div>
                        ) : (
                            <div className="text-center text-gray-600 space-y-2">
                                <FileImage size={48} className="mx-auto opacity-20" />
                                <p className="text-sm">Select an image from the sidebar</p>
                            </div>
                        )}
                    </div>

                    {/* METADATA PANEL */}
                    {selectedItem && (
                        <div className="w-full lg:w-80 bg-gray-950/50 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col h-64 lg:h-auto overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center gap-2 text-gray-400 shrink-0">
                                <Info size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Metadata Tags</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                <div className="space-y-1">
                                    {Object.keys(selectedItem.exifData).length > 0 ? (
                                        Object.entries(selectedItem.exifData).map(([key, val]) => (
                                            <div key={key} className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5">
                                                <p className="text-[9px] font-bold text-gray-500 uppercase truncate">{key}</p>
                                                <p className="text-xs text-gray-300 font-mono break-all leading-relaxed">{String(val)}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-gray-600 text-[10px] italic">No EXIF data found.</div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-900/50 border-t border-gray-800 shrink-0">
                                 <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mb-2 uppercase">
                                     <span>Processing Config</span>
                                     {viewMode === 'results' && (selectedItem as ProcessedItem).isUnique && (
                                         <span className="text-emerald-500 flex items-center gap-1"><ShieldCheck size={10}/> Unique</span>
                                     )}
                                     {viewMode === 'results' && !(selectedItem as ProcessedItem).isUnique && (
                                         <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={10}/> Duplicate</span>
                                     )}
                                 </div>
                                 <div className="space-y-3">
                                     <label className="flex items-center gap-2 cursor-pointer group">
                                         <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${shouldScramble ? 'bg-amber-500 border-amber-500' : 'border-gray-700'}`}>
                                             {shouldScramble && <CheckCircle2 size={12} className="text-black" />}
                                         </div>
                                         <input type="checkbox" className="hidden" checked={shouldScramble} onChange={e => setShouldScramble(e.target.checked)} />
                                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Scramble Hash (Invisible Noise)</span>
                                     </label>
                                     <label className="flex items-center gap-2 cursor-pointer group">
                                         <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${shouldRandomizeDate ? 'bg-amber-500 border-amber-500' : 'border-gray-700'}`}>
                                             {shouldRandomizeDate && <CheckCircle2 size={12} className="text-black" />}
                                         </div>
                                         <input type="checkbox" className="hidden" checked={shouldRandomizeDate} onChange={e => setShouldRandomizeDate(e.target.checked)} />
                                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Randomize Creation Date</span>
                                     </label>
                                 </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default MetadataTool;
