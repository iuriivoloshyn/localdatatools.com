
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { 
    Minimize2, Archive, Image as ImageIcon, Database, 
    Zap, Download, RefreshCw, Trash2, X,
    CheckCircle2, FileCode, ShieldCheck, FileText,
    BarChart3, Check, AlertTriangle, Info
} from 'lucide-react';
import { useLanguage } from '../../App';
import imageCompression from 'browser-image-compression';
import * as fflate from 'fflate';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

type Mode = 'general' | 'analyst' | 'media';

interface QueueItem {
    id: string;
    file: File;
    status: 'idle' | 'processing' | 'done' | 'error';
    originalSize: number;
    newSize?: number;
    estimatedSize?: number; // Calculated estimate
    isEstimating?: boolean;
    resultBlob?: Blob;
    resultUrl?: string;
    error?: string;
    mode: Mode;
    // Cache for PDF estimation to avoid re-rendering
    pdfPreviewCanvas?: HTMLCanvasElement;
    pdfPageCount?: number;
}

const CompressorTool: React.FC = () => {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [mode, setMode] = useState<Mode>('general');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Settings
  const [imageQuality, setImageQuality] = useState(0.7);
  
  // Refs for estimation loop
  const processingRef = useRef(false);

  const getPdfJs = async () => {
      const pdfjsModule = await import('pdfjs-dist');
      const pdfjs = (pdfjsModule as any).default?.GlobalWorkerOptions ? (pdfjsModule as any).default : pdfjsModule;
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
      }
      return pdfjs;
  }

  // --- UNIVERSAL ESTIMATION LOGIC ---
  
  // When settings change, invalidate estimates for Media mode
  useEffect(() => {
      if (mode === 'media') {
          setQueue(prev => prev.map(item => 
              item.status === 'idle' ? { ...item, estimatedSize: undefined, isEstimating: false } : item
          ));
      }
  }, [imageQuality]);

  // When mode changes, invalidate all estimates
  useEffect(() => {
      setQueue(prev => prev.map(item => 
          item.status === 'idle' ? { ...item, estimatedSize: undefined, isEstimating: false } : item
      ));
  }, [mode]);

  // Processing loop for estimates
  useEffect(() => {
      const estimateNext = async () => {
          if (processingRef.current) return;
          
          // Find first item needing estimate
          const target = queue.find(q => q.status === 'idle' && q.estimatedSize === undefined && !q.isEstimating);
          if (!target) return;

          processingRef.current = true;
          
          // Mark as estimating
          setQueue(prev => prev.map(q => q.id === target.id ? { ...q, isEstimating: true } : q));

          try {
              let est = target.originalSize;

              if (mode === 'media') {
                  // Explicitly handle 100% quality -> No change
                  if (imageQuality >= 1.0) {
                      est = target.originalSize;
                  } else if (target.file.type.startsWith('image/')) {
                      // Fast estimation for images
                      const options = {
                          maxSizeMB: 50, // High limit so quality drives compression
                          useWebWorker: true,
                          initialQuality: imageQuality,
                      };
                      const compressed = await imageCompression(target.file, options);
                      est = compressed.size;
                  } else if (target.file.name.endsWith('.pdf')) {
                      // PDF Estimation
                      let canvas = target.pdfPreviewCanvas;
                      let pages = target.pdfPageCount || 1;

                      // If canvas isn't cached yet, render it
                      if (!canvas) {
                          const pdfjs = await getPdfJs();
                          const arrayBuffer = await target.file.arrayBuffer();
                          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                          pages = pdf.numPages;
                          const page = await pdf.getPage(1);
                          // Use scale 1.5 to match the execution quality
                          const viewport = page.getViewport({ scale: 1.5 });
                          canvas = document.createElement('canvas');
                          canvas.width = viewport.width;
                          canvas.height = viewport.height;
                          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
                      }

                      // Compress the canvas (Cached or New)
                      const blob = await new Promise<Blob | null>(r => canvas!.toBlob(r, 'image/jpeg', imageQuality));
                      
                      // overhead: ~10% for PDF structure
                      if (blob) est = (blob.size * pages) * 1.1;

                      // Enforce no-growth rule for estimation
                      if (est > target.originalSize) est = target.originalSize;

                      // Update queue with cache if it was newly created
                      if (!target.pdfPreviewCanvas) {
                          setQueue(prev => prev.map(q => q.id === target.id ? { 
                              ...q, 
                              estimatedSize: est, 
                              isEstimating: false,
                              pdfPreviewCanvas: canvas,
                              pdfPageCount: pages
                          } : q));
                          processingRef.current = false;
                          return; // State update triggers next loop, so return here
                      }
                  }
              } else {
                  // Analyst/General: Chunk-based ratio estimation
                  const CHUNK_SIZE = 256 * 1024; // 256KB sample
                  const chunk = target.file.slice(0, CHUNK_SIZE);
                  const buffer = await chunk.arrayBuffer();
                  const uint8 = new Uint8Array(buffer);
                  
                  let compressedChunk: Uint8Array;
                  if (mode === 'analyst') {
                      // GZIP
                      compressedChunk = fflate.gzipSync(uint8, { level: 6 });
                  } else {
                      // ZIP (Deflate)
                      compressedChunk = fflate.deflateSync(uint8, { level: 6 });
                  }
                  
                  const ratio = compressedChunk.length / uint8.length;
                  est = target.originalSize * ratio;
                  
                  // Add minimal overhead for container formats
                  if (mode === 'general') est *= 1.02; // ZIP headers
                  if (mode === 'analyst') est += 20;   // GZIP header
              }

              // Final clamp: Estimation should never show an increase, mirroring execution logic
              if (est > target.originalSize) est = target.originalSize;

              setQueue(prev => prev.map(q => q.id === target.id ? { ...q, estimatedSize: est, isEstimating: false } : q));

          } catch (e) {
              console.warn("Estimation failed", e);
              // Fallback to original size on error
              setQueue(prev => prev.map(q => q.id === target.id ? { ...q, estimatedSize: target.originalSize, isEstimating: false } : q));
          } finally {
              processingRef.current = false;
          }
      };

      // Trigger loop
      const interval = setInterval(estimateNext, 100);
      return () => clearInterval(interval);
  }, [queue, mode, imageQuality]);


  const processGeneral = async (files: File[]) => {
      const zipData: Record<string, fflate.AsyncZippable> = {};
      for (const f of files) {
          zipData[f.name] = [new Uint8Array(await f.arrayBuffer()), { level: 6 }];
      }
      return new Promise<Blob>((resolve, reject) => {
          fflate.zip(zipData, { level: 6 }, (err, data) => {
              if (err) reject(err);
              else resolve(new Blob([data], { type: 'application/zip' }));
          });
      });
  };

  const processAnalyst = async (file: File): Promise<Blob> => {
      const stream = file.stream();
      const compressedReadableStream = stream.pipeThrough(new CompressionStream('gzip'));
      const response = new Response(compressedReadableStream);
      return await response.blob();
  };

  const processPdf = async (file: File): Promise<Blob> => {
      const pdfjs = await getPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      
      const firstPage = await pdf.getPage(1);
      const firstView = firstPage.getViewport({ scale: 1.5 }); // Match estimate scale
      const orientation = firstView.width > firstView.height ? 'l' : 'p';
      
      const newPdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [firstView.width, firstView.height],
          compress: true
      });

      for (let i = 1; i <= pdf.numPages; i++) {
          if (i > 1) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 1.5 });
              newPdf.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? 'l' : 'p');
          }

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error("Canvas context failed");

          await page.render({ canvasContext: context, viewport }).promise;
          const imgData = canvas.toDataURL('image/jpeg', imageQuality);
          const pdfPageWidth = newPdf.internal.pageSize.getWidth();
          const pdfPageHeight = newPdf.internal.pageSize.getHeight();
          newPdf.addImage(imgData, 'JPEG', 0, 0, pdfPageWidth, pdfPageHeight, undefined, 'FAST');
      }

      return newPdf.output('blob');
  };

  const processMedia = async (file: File): Promise<Blob> => {
      if (imageQuality >= 1.0) return file; // Bypass if 100%

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          return await processPdf(file);
      }
      if (!file.type.startsWith('image/')) return file;
      
      const options = {
          maxSizeMB: 50, 
          useWebWorker: true,
          initialQuality: imageQuality,
      };
      
      return await imageCompression(file, options);
  };

  const handleFiles = (files: File[]) => {
      setUploadError(null);
      
      const validFiles: File[] = [];
      const invalidFiles: File[] = [];

      files.forEach(f => {
          let isValid = true;
          if (mode === 'media') {
              // Only allow images and PDFs
              const isImage = f.type.startsWith('image/');
              const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
              if (!isImage && !isPdf) isValid = false;
          } else if (mode === 'analyst') {
              // Only allow text/data logs
              const ext = f.name.split('.').pop()?.toLowerCase();
              if (!['csv', 'json', 'log', 'txt'].includes(ext || '')) isValid = false;
          }
          
          if (isValid) validFiles.push(f);
          else invalidFiles.push(f);
      });

      if (invalidFiles.length > 0) {
          const names = invalidFiles.slice(0, 3).map(f => f.name).join(', ');
          const suffix = invalidFiles.length > 3 ? ` and ${invalidFiles.length - 3} more` : '';
          const modeName = mode === 'media' ? "Media" : "Analyst";
          setUploadError(`Skipped ${invalidFiles.length} file(s) incompatible with ${modeName} mode: ${names}${suffix}`);
          
          // Clear error automatically after 5 seconds
          setTimeout(() => setUploadError(null), 5000);
      }

      if (validFiles.length === 0) return;

      const newItems = validFiles.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          file: f,
          status: 'idle' as const,
          originalSize: f.size,
          mode
      }));
      setQueue(prev => [...prev, ...newItems]);
  };

  const removeFromQueue = (id: string) => {
      setQueue(prev => prev.filter(item => item.id !== id));
  };

  const executeCompression = async () => {
      setIsProcessing(true);
      setUploadError(null);
      
      if (mode === 'general') {
          const pending = queue.filter(q => q.status === 'idle' && q.mode === 'general');
          if (pending.length === 0) { setIsProcessing(false); return; }

          setQueue(prev => prev.map(q => pending.find(p => p.id === q.id) ? { ...q, status: 'processing' } : q));

          try {
              const files = pending.map(p => p.file);
              const blob = await processGeneral(files);
              const url = URL.createObjectURL(blob);
              
              setQueue(prev => prev.map(q => {
                  if (!pending.find(p => p.id === q.id)) return q;
                  return {
                      ...q,
                      status: 'done',
                      newSize: blob.size / pending.length, 
                      resultBlob: blob, 
                      resultUrl: url 
                  };
              }));

          } catch (e: any) {
              setQueue(prev => prev.map(q => pending.find(p => p.id === q.id) ? { ...q, status: 'error', error: e.message } : q));
          }
      } 
      else {
          const pending = queue.filter(q => q.status === 'idle' && q.mode === mode);
          
          for (const item of pending) {
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
              
              try {
                  let blob: Blob;
                  
                  if (mode === 'analyst') {
                      blob = await processAnalyst(item.file);
                  } else {
                      blob = await processMedia(item.file);
                  }

                  // Strict No-Growth Policy:
                  // If the compressed version is larger than original, discard it.
                  if (blob.size >= item.file.size) {
                      blob = item.file; 
                  }

                  const url = URL.createObjectURL(blob);
                  
                  setQueue(prev => prev.map(q => q.id === item.id ? { 
                      ...q, 
                      status: 'done', 
                      newSize: blob.size,
                      resultBlob: blob,
                      resultUrl: url 
                  } : q));

              } catch (e: any) {
                  setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q));
              }
          }
      }
      
      setIsProcessing(false);
  };

  const handleDownloadAll = async () => {
      if (mode === 'general') {
          const doneItem = queue.find(q => q.status === 'done' && q.resultUrl);
          if (doneItem) {
              const link = document.createElement('a');
              link.href = doneItem.resultUrl!;
              link.download = `archive_${Date.now()}.zip`;
              link.click();
          }
          return;
      }

      const completed = queue.filter(q => q.status === 'done' && q.resultBlob);
      if (completed.length === 0) return;

      const zip = new JSZip();
      completed.forEach(item => {
          let name = item.file.name;
          if (mode === 'analyst' && !name.endsWith('.gz')) name += '.gz';
          zip.file(name, item.resultBlob!);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compressed_files_${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
  };

  // Improved savings data logic to handle growth
  const getSavingsData = (original: number, newS: number) => {
      if (original === 0) return { pct: 0, text: '0%', color: 'text-gray-500', isGrowth: false, isOptimal: true };
      
      const diff = original - newS;
      const pct = (diff / original) * 100;
      
      // Exact match or extremely close
      if (Math.abs(diff) < 10 || pct === 0) {
          return { pct: 0, text: 'No Change', color: 'text-gray-400', isGrowth: false, isOptimal: true };
      }

      if (pct > 0) {
          // Reduction (Good)
          return { 
              pct, 
              text: `-${pct.toFixed(1)}%`, 
              color: 'text-emerald-400', 
              bg: 'bg-emerald-500',
              isGrowth: false, 
              isOptimal: false 
          };
      } else {
          // Growth (Bad)
          return { 
              pct: Math.abs(pct), 
              text: `+${Math.abs(pct).toFixed(1)}%`, 
              color: 'text-red-400', 
              bg: 'bg-red-500',
              isGrowth: true, 
              isOptimal: false 
          };
      }
  };

  // Aggregated Stats
  const totalStats = useMemo(() => {
      const activeItems = queue.filter(q => q.mode === mode);
      const totalSize = activeItems.reduce((acc, q) => acc + q.originalSize, 0);
      
      // Use actual newSize if available, otherwise estimatedSize
      const estimatedTotal = activeItems.reduce((acc, q) => {
          if (q.status === 'done' && q.newSize) return acc + q.newSize;
          if (q.estimatedSize) return acc + q.estimatedSize;
          return acc + q.originalSize; // Fallback
      }, 0);

      return {
          original: totalSize,
          estimated: estimatedTotal,
          savings: getSavingsData(totalSize, estimatedTotal)
      };
  }, [queue, mode]);

  const getModeDescription = () => {
      switch(mode) {
          case 'general': return "Combines all files into a single standard .zip archive. Best for bundling multiple files for sharing.";
          case 'analyst': return "Compresses each file individually to .gz format. Best for log rotation, data pipelines, and server backups.";
          case 'media': return "Optimizes images and PDFs using lossy compression to reduce file size while maintaining visual quality.";
          default: return "";
      }
  };

  return (
    <div className="space-y-6">
      <ToolHeader 
        title="Compressor"
        description="Secure, offline file reduction. Compress logs (GZIP), archives (ZIP), and media (Images/PDF) entirely on your device."
        instructions={[
          "Select a mode: General (ZIP), Analyst (GZIP), or Media (Image/PDF)",
          "Upload files (Processing stays 100% offline)",
          "Adjust compression slider to see real-time size estimates",
          "Click Compress to process the queue"
        ]}
        icon={Minimize2}
        colorClass="text-violet-400"
        onReset={() => setQueue([])}
      />

      {/* Mode Switcher */}
      <div className="flex flex-col items-center mb-8 gap-4">
        <div className="bg-gray-900/50 p-1.5 rounded-2xl border border-gray-700 flex gap-2">
          <button 
            onClick={() => { setMode('general'); setQueue([]); setUploadError(null); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'general' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <Archive size={16} /> Archive (ZIP)
          </button>
          <button 
            onClick={() => { setMode('analyst'); setQueue([]); setUploadError(null); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'analyst' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <Database size={16} /> Stream (GZIP)
          </button>
          <button 
            onClick={() => { setMode('media'); setQueue([]); setUploadError(null); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'media' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <ImageIcon size={16} /> Media (Img/PDF)
          </button>
        </div>
        
        {/* Mode Description Helper */}
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900/30 px-4 py-2 rounded-full border border-gray-800 animate-in fade-in">
            <Info size={12} className="text-violet-400" />
            <span>{getModeDescription()}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2">
          {/* Uploader */}
          <FileUploader 
              onFilesSelected={handleFiles} 
              multiple={true} 
              disabled={isProcessing} 
              theme="violet"
              accept={mode === 'media' ? "image/*,.pdf" : mode === 'analyst' ? ".csv,.json,.log,.txt" : "*"}
              limitText={mode === 'media' ? "Images (JPG, PNG, WEBP) & PDF" : mode === 'analyst' ? "Data Logs (CSV, JSON)" : "Any Files"}
          />

          {/* Upload Error Display */}
          {uploadError && (
              <div className="flex items-center gap-2 justify-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle size={14} />
                  {uploadError}
              </div>
          )}

          {/* Privacy Badge */}
          {queue.length > 0 && (
              <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-900/20 border border-violet-500/20 rounded-full text-[10px] font-bold text-violet-300 uppercase tracking-widest">
                      <ShieldCheck size={12} /> Local Processing Only
                  </div>
              </div>
          )}

          {/* Settings & Global Stats */}
          {queue.some(q => q.status === 'idle') && (
              <div className="bg-gray-900/80 border border-violet-500/20 rounded-2xl overflow-hidden shadow-xl">
                  {/* Header */}
                  <div className="px-6 py-4 bg-violet-500/5 border-b border-violet-500/10 flex items-center gap-2">
                      <BarChart3 size={16} className="text-violet-400" />
                      <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Config & Estimate</span>
                  </div>

                  <div className="p-6 flex flex-col md:flex-row gap-8 items-center">
                      {/* Media Slider (Only for Media Mode) */}
                      {mode === 'media' ? (
                          <div className="w-full space-y-6">
                              <div className="flex justify-between items-end">
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Quality Level</span>
                                  <span className="text-2xl font-black text-violet-400">{Math.round(imageQuality * 100)}%</span>
                              </div>
                              <div className="relative h-2 bg-gray-800 rounded-full">
                                  <input 
                                      type="range" 
                                      min="0.1" max="1.0" step="0.05" 
                                      value={imageQuality} 
                                      onChange={(e) => setImageQuality(parseFloat(e.target.value))}
                                      className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  <div className="absolute top-0 left-0 h-full bg-violet-500 rounded-full transition-all duration-100" style={{ width: `${imageQuality * 100}%` }}></div>
                                  <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-violet-600 transition-all duration-100 pointer-events-none" style={{ left: `calc(${imageQuality * 100}% - 8px)` }}></div>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                                  <span>Smaller Size</span>
                                  <span>Better Quality</span>
                              </div>
                          </div>
                      ) : (
                          <div className="w-full text-center text-gray-500 text-sm italic">
                              Standard lossless compression ({mode === 'analyst' ? 'GZIP' : 'ZIP'}) applied.
                          </div>
                      )}

                      {/* Total Batch Estimate Box */}
                      <div className="md:w-64 w-full shrink-0 flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-800 pt-6 md:pt-0 md:pl-8">
                          <div className="space-y-3 animate-in fade-in duration-300">
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">Total Batch Estimate</span>
                              </div>
                              
                              <div className="h-2 flex rounded-full overflow-hidden bg-gray-800 relative mt-1">
                                  <div 
                                    className={`absolute top-0 left-0 h-full transition-all duration-500 ${totalStats.savings.isOptimal ? 'bg-gray-600' : totalStats.savings.bg}`}
                                    style={{ width: `${Math.min(100, (totalStats.estimated / totalStats.original) * 100)}%` }}
                                  ></div>
                              </div>

                              <div className="flex justify-between items-end mt-1">
                                  <div className="flex flex-col">
                                      <span className="text-[10px] text-gray-500 strike-through line-through decoration-red-500/50">{formatFileSize(totalStats.original)}</span>
                                      <span className={`text-sm font-bold ${totalStats.savings.isOptimal ? 'text-gray-300' : 'text-white'}`}>{formatFileSize(totalStats.estimated)}</span>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-1 rounded ${totalStats.savings.isOptimal ? 'text-gray-400 bg-gray-800' : `${totalStats.savings.color} ${totalStats.savings.bg}/10`}`}>
                                      {totalStats.savings.text}
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Queue List */}
          {queue.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="px-6 py-4 border-b border-gray-800 bg-gray-950/50 flex justify-between items-center">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Processing Queue ({queue.length})</span>
                      <button onClick={() => setQueue([])} className="text-gray-600 hover:text-red-400 transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                          <Trash2 size={14} /> Clear All
                      </button>
                  </div>
                  <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {queue.map(item => {
                          const currentSize = item.status === 'done' ? item.newSize! : (item.estimatedSize || item.originalSize);
                          const savings = getSavingsData(item.originalSize, currentSize);
                          const isEst = item.status !== 'done';

                          return (
                              <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02]">
                                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-violet-400 shrink-0">
                                      {mode === 'media' && item.file.type === 'application/pdf' ? <FileText size={20} /> :
                                       mode === 'media' ? <ImageIcon size={20} /> : 
                                       mode === 'analyst' ? <Database size={20} /> : <FileCode size={20} />}
                                  </div>
                                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <p className="text-sm font-medium text-gray-200 truncate max-w-[200px]">{item.file.name}</p>
                                              {/* Target Format Badge */}
                                              <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 rounded border border-gray-700">
                                                  {mode === 'general' ? '→ .zip' : mode === 'analyst' ? '→ .gz' : '→ opt'}
                                              </span>
                                          </div>
                                          <p className="text-xs text-gray-500">{formatFileSize(item.originalSize)}</p>
                                      </div>
                                      
                                      <div className="flex items-center gap-4">
                                          {item.isEstimating ? (
                                              <div className="flex items-center gap-2 text-violet-400/50 text-xs">
                                                  <RefreshCw size={12} className="animate-spin"/> estimating...
                                              </div>
                                          ) : (
                                              <>
                                                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden relative">
                                                      <div 
                                                        className={`absolute inset-y-0 left-0 rounded-full ${savings.isOptimal ? 'bg-gray-600' : savings.bg}`} 
                                                        style={{ width: `${Math.min(100, (currentSize / item.originalSize) * 100)}%` }}
                                                      ></div>
                                                  </div>
                                                  <div className="text-right min-w-[80px]">
                                                      <p className={`text-sm font-bold ${savings.isOptimal ? 'text-gray-400' : 'text-violet-400'}`}>
                                                          {isEst && !savings.isOptimal && "~"}{formatFileSize(currentSize)}
                                                      </p>
                                                      {savings.isOptimal ? (
                                                          <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 font-mono">
                                                              <Check size={10} /> No Change
                                                          </div>
                                                      ) : (
                                                          <p className={`text-[10px] font-mono ${savings.color}`}>
                                                              {savings.text}
                                                          </p>
                                                      )}
                                                  </div>
                                              </>
                                          )}
                                      </div>
                                  </div>

                                  <div className="shrink-0 flex items-center gap-2">
                                      {/* Download Single Button */}
                                      {item.status === 'done' && item.resultUrl && mode !== 'general' && (
                                          <a 
                                            href={item.resultUrl} 
                                            download={mode === 'analyst' ? `${item.file.name}.gz` : item.file.name} 
                                            className="p-2 bg-violet-600/20 text-violet-400 rounded-lg hover:bg-violet-600 hover:text-white transition-colors"
                                            title="Download"
                                          >
                                              <Download size={16} />
                                          </a>
                                      )}
                                      
                                      {/* Success/Status Icons */}
                                      {item.status === 'done' && mode === 'general' && (
                                          <div className="text-emerald-500 px-2" title="Added to Archive"><CheckCircle2 size={20} /></div>
                                      )}
                                      {item.status === 'processing' && <RefreshCw size={16} className="animate-spin text-violet-500 mx-2" />}
                                      
                                      {/* Remove Button */}
                                      <button 
                                        onClick={() => removeFromQueue(item.id)} 
                                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                                        title="Remove from queue"
                                        disabled={item.status === 'processing'}
                                      >
                                          <X size={16} />
                                      </button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  
                  <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end gap-3">
                      {/* Download All Button - Only shows when items are done */}
                      {queue.some(q => q.status === 'done') && (
                          <button
                              onClick={handleDownloadAll}
                              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-3 rounded-xl font-bold transition-all border border-gray-700"
                          >
                              <Archive size={18} />
                              <span>Download All (.zip)</span>
                          </button>
                      )}

                      <button 
                          onClick={executeCompression} 
                          disabled={isProcessing || queue.every(q => q.status === 'done')}
                          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                      >
                          {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
                          <span>Compress All</span>
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default CompressorTool;
