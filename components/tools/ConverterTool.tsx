
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { RefreshCw, Upload, Download, FileSpreadsheet, FileText, ArrowRight, Loader2, AlertCircle, FileType, Image as ImageIcon, Trash2, X, Plus, Archive, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../App';
import { detectAndConvert, ConversionResult } from '../../utils/converterHelpers';
import { countFileLines } from '../../utils/csvHelpers';
import JSZip from 'jszip';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface QueueItem {
    id: string;
    file: File;
    status: 'idle' | 'processing' | 'completed' | 'error';
    result?: ConversionResult;
    error?: string;
    targetFormat?: string; // Optional specific target
}

const ConverterTool: React.FC = () => {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  // Master switch state persistence (Images only for now)
  const [formatPreference, setFormatPreference] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = (name: string) => {
      const ext = name.split('.').pop()?.toLowerCase() || '';
      return ['jpg', 'jpeg', 'png', 'webp', 'svg', 'heic'].includes(ext);
  }

  // --- Master Switch Logic ---

  const hasImagesInQueue = queue.some(q => isImage(q.file.name));
  const hasPdfsInQueue = queue.some(q => q.file.name.toLowerCase().endsWith('.pdf'));

  // Image Master State
  const displayMasterImageFormat = useMemo(() => {
      const pendingImages = queue.filter(q => q.status === 'idle' && isImage(q.file.name));
      if (pendingImages.length === 0) return formatPreference; // Fallback to pref if queue empty/no images
      
      const firstFmt = pendingImages[0].targetFormat;
      const allSame = pendingImages.every(img => img.targetFormat === firstFmt);
      
      return allSame ? firstFmt : ''; // Empty string means "Mixed"
  }, [queue, formatPreference]);

  // PDF Master State
  const displayMasterPdfFormat = useMemo(() => {
      const pendingPdfs = queue.filter(q => q.status === 'idle' && q.file.name.toLowerCase().endsWith('.pdf'));
      if (pendingPdfs.length === 0) return '';
      
      const firstFmt = pendingPdfs[0].targetFormat;
      const allSame = pendingPdfs.every(item => item.targetFormat === firstFmt);
      
      return allSame ? firstFmt : '';
  }, [queue]);

  const addToQueue = (files: File[]) => {
      if (!files) return;
      const newItems: QueueItem[] = files.map(f => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          
          // Determine default target
          let target = undefined;
          
          if (isImage(f.name)) {
              // If we have a master preference, use it
              if (formatPreference) {
                  target = formatPreference;
              } else {
                  // Standard defaults
                  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext || '')) target = 'pdf';
                  if (ext === 'heic') target = 'jpg'; // Override HEIC default to JPG
                  if (ext === 'svg') target = 'png';
              }
          } else {
              // Document defaults
              if (ext === 'pdf') target = 'image';
          }
          
          return {
              id: Math.random().toString(36).substr(2, 9),
              file: f,
              status: 'idle',
              targetFormat: target
          };
      });
      setQueue(prev => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
      setQueue(prev => prev.filter(item => item.id !== id));
  };

  const processQueue = async () => {
      setIsProcessing(true);
      const itemsToProcess = queue.filter(q => q.status === 'idle' || q.status === 'error');
      
      // Sequential Processing to avoid WASM memory crash with HEIC
      for (const item of itemsToProcess) {
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', error: undefined } : q));
          try {
              // Safety check for massive CSVs to prevent freezing
              if (item.file.name.toLowerCase().endsWith('.csv')) {
                  // Only check files > 20MB to be fast
                  if (item.file.size > 20 * 1024 * 1024) {
                      const lines = await countFileLines(item.file);
                      if (lines > 1048576) {
                          throw new Error(`Row count (${lines.toLocaleString()}) exceeds XLSX limit (1,048,576). Conversion aborted to prevent crash.`);
                      }
                  }
              }

              const result = await detectAndConvert(item.file, item.targetFormat);
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', result } : q));
          } catch (e: any) {
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q));
          }
          // Small delay between items to let GC catch up
          await new Promise(r => setTimeout(r, 100));
      }
      setIsProcessing(false);
  };

  const downloadAllAsZip = async () => {
    const completedItems = queue.filter(item => item.status === 'completed' && item.result);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      completedItems.forEach(item => {
        if (item.result) {
          zip.file(item.result.name, item.result.blob);
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "converted_files.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Zip generation failed", e);
    } finally {
      setIsZipping(false);
    }
  };

  const setItemTarget = (id: string, format: string) => {
      setQueue(prev => prev.map(q => q.id === id ? { ...q, targetFormat: format } : q));
  };

  const handleMasterImageChange = (format: string) => {
      setFormatPreference(format); // Remember for new files
      if (!format) return;
      
      // Update all existing idle images in the queue
      setQueue(prev => prev.map(item => {
          if (item.status === 'idle' && isImage(item.file.name)) {
              return { ...item, targetFormat: format };
          }
          return item;
      }));
  };

  const handleMasterPdfChange = (format: string) => {
      if (!format) return;
      setQueue(prev => prev.map(item => {
          if (item.status === 'idle' && item.file.name.toLowerCase().endsWith('.pdf')) {
              return { ...item, targetFormat: format };
          }
          return item;
      }));
  };

  const getIconForFile = (name: string) => {
      const ext = name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'csv', 'xls'].includes(ext || '')) return <FileSpreadsheet size={20} className="text-green-400" />;
      if (['pdf'].includes(ext || '')) return <FileText size={20} className="text-red-400" />;
      if (['docx'].includes(ext || '')) return <FileText size={20} className="text-blue-400" />;
      if (['jpg', 'png', 'jpeg', 'webp', 'svg', 'heic'].includes(ext || '')) return <ImageIcon size={20} className="text-purple-400" />;
      return <FileText size={20} className="text-gray-400" />;
  };

  const hasCompleted = queue.some(q => q.status === 'completed');

  return (
    <div className="space-y-6">
      <ToolHeader 
        title="File Converter"
        description="Universal format transformation engine. Convert spreadsheets, documents, and images (including HEIC/SVG/PNG/JPG) entirely in your browser."
        instructions={[
          "Drag & Drop files (CSV, XLSX, PDF, DOCX, Images, HEIC, SVG)",
          "For Images & PDFs, select your desired output format",
          "Use the master switch in the queue to update all files at once",
          "Download results individually or as a ZIP archive"
        ]}
        icon={RefreshCw}
        colorClass="text-green-400"
        onReset={() => { setQueue([]); setFormatPreference(''); }}
      />

      <div className="max-w-2xl mx-auto space-y-6">
        <FileUploader 
            onFilesSelected={addToQueue} 
            multiple={true}
            disabled={isProcessing}
            theme="green"
            limitText="Spreadsheets, Docs, Images (incl HEIC), PDF"
            accept=".csv, .xlsx, .xls, .pdf, .docx, .png, .jpg, .jpeg, .webp, .svg, .heic"
        />

        {queue.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-2">
                <div className="px-4 py-3 bg-gray-950/50 border-b border-gray-800 flex justify-between items-center flex-wrap gap-y-2">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Queue ({queue.length})</span>
                        
                        {hasImagesInQueue && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 pl-4 border-l border-gray-800">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:inline">Images:</span>
                                <div className="relative group">
                                    <select 
                                        onChange={(e) => handleMasterImageChange(e.target.value)}
                                        value={displayMasterImageFormat || ''}
                                        className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-purple-400 focus:outline-none appearance-none pr-6 cursor-pointer hover:border-purple-500/50 transition-colors uppercase tracking-wide min-w-[80px]"
                                    >
                                        <option value="" className="text-gray-500">Mixed</option>
                                        <option value="jpg">To JPG</option>
                                        <option value="png">To PNG</option>
                                        <option value="webp">To WebP</option>
                                        <option value="pdf">To PDF</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-purple-400 transition-colors" />
                                </div>
                            </div>
                        )}

                        {hasPdfsInQueue && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 pl-4 border-l border-gray-800">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:inline">PDFs:</span>
                                <div className="relative group">
                                    <select 
                                        onChange={(e) => handleMasterPdfChange(e.target.value)}
                                        value={displayMasterPdfFormat || ''}
                                        className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-red-400 focus:outline-none appearance-none pr-6 cursor-pointer hover:border-red-500/50 transition-colors uppercase tracking-wide min-w-[80px]"
                                    >
                                        <option value="" className="text-gray-500">Mixed</option>
                                        <option value="image">To Images</option>
                                        <option value="docx">To DOCX</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-red-400 transition-colors" />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-1 ml-auto">
                        <button 
                            onClick={() => { setQueue([]); setFormatPreference(''); }} 
                            disabled={isProcessing} 
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 hover:text-red-400 rounded-lg text-gray-500 transition-colors disabled:opacity-50"
                            title="Clear All"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isProcessing} 
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
                            title="Add Files"
                        >
                            <Plus size={14} />
                        </button>
                        {/* Hidden input for add button */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            multiple
                            accept=".csv, .xlsx, .xls, .pdf, .docx, .png, .jpg, .jpeg, .webp, .svg, .heic"
                            onChange={(e) => {if (e.target.files) addToQueue(Array.from(e.target.files))}}
                            disabled={isProcessing}
                        />
                    </div>
                </div>
                <div className="divide-y divide-gray-800 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {queue.map((item) => (
                        <div key={item.id} className="p-4 flex flex-col gap-2 hover:bg-gray-800/30 transition-colors group relative">
                            <div className="flex items-center gap-4">
                                <div className="shrink-0">{getIconForFile(item.file.name)}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-200 truncate">{item.file.name}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(item.file.size)}</p>
                                    
                                    {/* PDF Options */}
                                    {item.file.name.endsWith('.pdf') && item.status === 'idle' && (
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => setItemTarget(item.id, 'image')} className={`text-[10px] px-2 py-1 rounded border ${!item.targetFormat || item.targetFormat === 'image' ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>To Images</button>
                                            <button onClick={() => setItemTarget(item.id, 'docx')} className={`text-[10px] px-2 py-1 rounded border ${item.targetFormat === 'docx' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>To DOCX</button>
                                        </div>
                                    )}

                                    {/* Image Options */}
                                    {isImage(item.file.name) && item.status === 'idle' && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {['jpg', 'png', 'webp', 'svg', 'pdf'].map(fmt => (
                                                <button 
                                                    key={fmt}
                                                    onClick={() => setItemTarget(item.id, fmt)} 
                                                    className={`text-[10px] px-2 py-1 rounded border uppercase transition-colors 
                                                        ${item.targetFormat === fmt || (fmt === 'jpg' && item.targetFormat === 'jpeg') 
                                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold shadow-sm shadow-purple-900/20' 
                                                            : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
                                                >
                                                    {fmt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="shrink-0 flex items-center gap-4">
                                    {item.status === 'idle' && (
                                        <span className="text-xs text-gray-500">Ready</span>
                                    )}
                                    {item.status === 'processing' && (
                                        <div className="flex items-center gap-2 text-green-400">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span className="text-xs">Converting...</span>
                                        </div>
                                    )}
                                    {item.status === 'completed' && item.result && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500 uppercase font-bold">{item.result.type === 'jpeg' ? 'JPG' : item.result.type}</span>
                                            <ArrowRight size={14} className="text-gray-600" />
                                            <a 
                                                href={item.result.url} 
                                                download={item.result.name}
                                                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-green-900/20 transition-all"
                                            >
                                                <Download size={14} /> Download
                                            </a>
                                        </div>
                                    )}
                                    {item.status === 'error' && (
                                        <div className="flex items-center gap-2 text-red-400">
                                            <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
                                        </div>
                                    )}

                                    {/* Remove Button - Always visible unless processing */}
                                    {item.status !== 'processing' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} 
                                            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                                            title="Remove"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Expanded Error View */}
                            {item.error && (
                                <div className="flex items-start gap-3 mt-1 text-red-300 bg-red-950/30 p-3 rounded-lg border border-red-500/20 animate-in fade-in">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                                    <div className="flex-1">
                                        <p className="text-[11px] font-medium leading-relaxed opacity-90">{item.error}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex justify-end gap-3">
                    {hasCompleted && (
                        <button 
                            onClick={downloadAllAsZip} 
                            disabled={isProcessing || isZipping}
                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-2.5 rounded-lg font-bold border border-gray-700 transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
                        >
                            {isZipping ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />}
                            <span>Download All (.zip)</span>
                        </button>
                    )}
                    <button 
                        onClick={processQueue} 
                        disabled={isProcessing || queue.filter(q => q.status === 'idle' || q.status === 'error').length === 0}
                        className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    >
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        <span>Convert All</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ConverterTool;
