
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { 
  Eye, Upload, FileSpreadsheet, FileText, FileCode, FileType, File, Image as ImageIcon, 
  Trash2, Plus, X, ChevronsLeft, Menu, Minimize2, Maximize2, Loader2, RefreshCw, 
  AlertCircle, CheckSquare, Download, ChevronLeft, ChevronRight, Database,
  Search, ExternalLink
} from 'lucide-react';
import { useLanguage } from '../../App';
import { read, utils, write } from 'xlsx';
import mammoth from 'mammoth';
import { renderAsync } from 'docx-preview';
import { convertImageToPdf, convertDocxToPdf, convertPdfToImages, convertPdfToDocx } from '../../utils/converterHelpers';
import { countFileLines } from '../../utils/csvHelpers';

interface ViewerFile {
  id: string;
  name: string;
  sizeFormatted: string;
  type: 'spreadsheet' | 'large_csv' | 'image' | 'pdf' | 'text' | 'code' | 'html' | 'docx' | 'unknown';
  content: any;
  url?: string;
  file: File;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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

// ... (Renderers remain same: PdfPage, PdfRenderer, DocxRenderer, HtmlRenderer)
const PdfPage: React.FC<{ pdf: any, pageNumber: number }> = ({ pdf, pageNumber }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRendering, setIsRendering] = useState(true);
    const scale = 1.4; 
    
    useEffect(() => {
        let renderTask: any = null;
        let isCancelled = false;

        const render = async () => {
            if (!pdf || !canvasRef.current) return;
            setIsRendering(true);

            try {
                const page = await pdf.getPage(pageNumber);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                if (!context) return;

                // HiDPI Scaling
                const dpr = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * dpr);
                canvas.height = Math.floor(viewport.height * dpr);
                canvas.style.width = Math.floor(viewport.width) + "px";
                canvas.style.height = Math.floor(viewport.height) + "px";

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
                };

                renderTask = page.render(renderContext);
                
                await renderTask.promise;
                if (!isCancelled) setIsRendering(false);
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException' && !isCancelled) {
                    console.error("Page render error", err);
                }
            }
        };

        render();

        return () => {
            isCancelled = true;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdf, pageNumber]);

    return (
      <div className="relative mb-6 shadow-xl shrink-0" style={{ minHeight: '200px' }}>
        <canvas ref={canvasRef} className="block bg-white rounded-sm" />
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/10 backdrop-blur-[1px]">
             <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
};

const PdfRenderer: React.FC<{ url: string }> = ({ url }) => {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      let active = true;
      const loadPdf = async () => {
          setLoading(true);
          setPdf(null);
          try {
              const pdfjsModule = await import('pdfjs-dist');
              const pdfjs = (pdfjsModule as any).default?.GlobalWorkerOptions ? (pdfjsModule as any).default : pdfjsModule;
              if (!pdfjs.GlobalWorkerOptions.workerSrc) {
                  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
              }
              
              const loadingTask = pdfjs.getDocument(url);
              const doc = await loadingTask.promise;
              
              if (!active) return;

              setPdf(doc);
              setNumPages(doc.numPages);
              setLoading(false);

          } catch (e) {
              console.error("PDF Load Error", e);
              if (active) setLoading(false);
          }
      };
      loadPdf();
      return () => { active = false; };
  }, [url]);

  return (
      <div className="w-full h-full relative flex flex-col bg-[#2e3238]">
          <div ref={containerRef} className="flex-1 w-full overflow-auto custom-scrollbar relative">
              <div className="w-fit min-w-full mx-auto pt-10 pb-16 px-10 flex flex-col items-center">
                {loading && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20 w-full">
                        <Loader2 className="animate-spin mb-4 text-lime-400" size={32} />
                        <p className="text-sm font-medium">Rendering PDF...</p>
                    </div>
                )}
                {!loading && !pdf && (
                    <div className="flex flex-col items-center justify-center h-full text-red-400 py-20 w-full">
                        <AlertCircle size={32} className="mb-2" />
                        <p className="text-sm">Failed to load PDF document.</p>
                    </div>
                )}
                {pdf && Array.from({ length: numPages }, (_, i) => (
                    <PdfPage key={i} pdf={pdf} pageNumber={i + 1} />
                ))}
                <div className="h-16 shrink-0 w-full" />
              </div>
          </div>
      </div>
  );
};

const DocxRenderer: React.FC<{ file: File }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const render = async () => {
            if (containerRef.current && file) {
                setLoading(true);
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    containerRef.current.innerHTML = '';
                    await renderAsync(arrayBuffer, containerRef.current, undefined, {
                        inWrapper: false, 
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        useBase64URL: true,
                        experimental: true
                    });
                } catch (e) {
                    console.error("Docx render error", e);
                    containerRef.current.innerHTML = `<div class="text-red-400 p-4">Error rendering document.</div>`;
                } finally {
                    setLoading(false);
                }
            }
        };
        render();
    }, [file]);

    return (
        <div className="w-full h-full relative flex flex-col bg-[#2e3238]">
             <style>{`
                #docx-container-root {
                    font-family: 'Times New Roman', Times, serif !important; 
                    font-size: 11pt;
                    line-height: 1.15;
                    color: black;
                }

                #docx-container-root > section,
                #docx-container-root > article,
                #docx-container-root > div.docx {
                    background-color: white !important;
                    color: black !important;
                    margin-bottom: 30px !important;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
                    display: block !important;
                    box-sizing: border-box !important;
                }
                
                #docx-container-root * {
                    font-family: 'Times New Roman', Times, serif !important;
                    color: inherit;
                }
                
                #docx-container-root h1, 
                #docx-container-root h2, 
                #docx-container-root h3, 
                #docx-container-root h4, 
                #docx-container-root h5, 
                #docx-container-root h6, 
                #docx-container-root p {
                    color: black;
                }

                #docx-container-root a {
                    color: #0563c1 !important;
                    text-decoration: underline !important;
                }
             `}</style>

            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                        <Loader2 className="animate-spin text-blue-400 mb-2" size={32} />
                        <span className="text-xs font-medium text-blue-200">Processing Layout...</span>
                    </div>
                )}
                <div className="w-fit min-w-full flex justify-center p-12 bg-[#2e3238]">
                    <div id="docx-container-root" ref={containerRef} className="flex flex-col items-center" />
                </div>
            </div>
        </div>
    );
};

const HtmlRenderer: React.FC<{ content: string }> = ({ content }) => {
    return (
        <div className="w-full h-full overflow-auto custom-scrollbar p-8 bg-white text-black flex justify-center">
             <div 
                className="w-full max-w-[800px] prose prose-sm sm:prose-base prose-headings:font-bold prose-a:text-blue-600"
                dangerouslySetInnerHTML={{ __html: content }} 
             />
        </div>
    );
};

const ViewerTool: React.FC = () => {
  const { t } = useLanguage();
  const [files, setFiles] = useState<ViewerFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showConvertMenu, setShowConvertMenu] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Spreadsheet state
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [visibleRows, setVisibleRows] = useState(100);
  
  // Large CSV State
  const [largeCsvState, setLargeCsvState] = useState<{
    rows: string[][];
    page: number;
    offsets: number[]; 
    isLoading: boolean;
    pageSizeBytes: number;
  }>({ rows: [], page: 1, offsets: [0], isLoading: false, pageSizeBytes: 1024 * 256 }); 

  // Sheet selection for conversion
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const convertMenuRef = useRef<HTMLDivElement>(null);

  // SAFEGUARD: Ensure files is defined before calling find
  const activeFile = useMemo(() => (files || []).find(f => f.id === activeFileId), [files, activeFileId]);

  const activeSheetData = useMemo(() => {
    if (!activeFile || activeFile.type !== 'spreadsheet' || !activeSheet) return null;
    return activeFile.content.sheets[activeSheet];
  }, [activeFile, activeSheet]);

  // Handle mobile resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && sidebarOpen) {
        // Optional: decide if we want to auto-close on resize
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Close convert menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (convertMenuRef.current && !convertMenuRef.current.contains(event.target as Node)) {
        setShowConvertMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure active sheet is valid when switching files
  useEffect(() => {
    if (activeFile && activeFile.type === 'spreadsheet') {
        const sheetNames = activeFile.content.sheetNames;
        if (!activeSheet || !sheetNames.includes(activeSheet)) {
            setActiveSheet(sheetNames[0]);
            setVisibleRows(100);
        }
    } else if (activeFile && activeFile.type === 'large_csv') {
        const startOffset = activeFile.content.headerEndByte;
        setLargeCsvState({ rows: [], page: 1, offsets: [startOffset], isLoading: true, pageSizeBytes: 1024 * 256 });
        
        loadLargeCsvPage(activeFile.file, startOffset, 1024 * 256).then(res => {
            setLargeCsvState(prev => ({
                ...prev,
                rows: res.rows,
                isLoading: false,
                offsets: [startOffset, startOffset + res.bytesRead]
            }));
        }).catch(err => {
            setError("Failed to load CSV chunk: " + err.message);
            setLargeCsvState(prev => ({ ...prev, isLoading: false }));
        });

        if (activeFile.content.totalRows === null) {
            countTotalRows(activeFile.file, activeFile.id);
        }
    }
  }, [activeFileId]); 

  // ... (countTotalRows, loadLargeCsvPage, handleLargeCsvPageChange remain same)
  const countTotalRows = async (file: File, id: string) => {
      try {
          const lines = await countFileLines(file);
          const dataRows = Math.max(0, lines - 1);
          setFiles(prev => prev.map(f => {
              if (f.id === id && f.type === 'large_csv') {
                  return { ...f, content: { ...f.content, totalRows: dataRows } };
              }
              return f;
          }));
      } catch (e) {
          console.error("Failed to count rows", e);
      }
  };

  const loadLargeCsvPage = async (file: File, startByte: number, length: number) => {
      const chunk = file.slice(startByte, startByte + length);
      const text = await chunk.text();
      
      let endByte = length;
      let safeText = text;
      
      if (startByte + length < file.size) {
          const lastNewline = text.lastIndexOf('\n');
          if (lastNewline !== -1) {
              safeText = text.substring(0, lastNewline + 1);
              endByte = new TextEncoder().encode(safeText).length; 
          }
      } else {
          endByte = new TextEncoder().encode(safeText).length;
      }

      const rows = safeText.split(/\r?\n/)
          .filter(l => l.trim().length > 0)
          .map(l => parseCSVLine(l));
          
      return { rows, bytesRead: endByte };
  };

  const handleLargeCsvPageChange = async (direction: 'next' | 'prev') => {
      if (!activeFile || activeFile.type !== 'large_csv') return;
      
      const newPage = direction === 'next' ? largeCsvState.page + 1 : largeCsvState.page - 1;
      if (newPage < 1) return;
      
      setLargeCsvState(prev => ({ ...prev, isLoading: true }));
      
      try {
          const offsetIndex = newPage - 1;
          if (offsetIndex >= largeCsvState.offsets.length) {
             throw new Error("Page offset not found");
          }
          
          const startOffset = largeCsvState.offsets[offsetIndex];
          const res = await loadLargeCsvPage(activeFile.file, startOffset, largeCsvState.pageSizeBytes);
          
          setLargeCsvState(prev => {
              const newOffsets = [...prev.offsets];
              if (offsetIndex + 1 >= newOffsets.length) {
                  newOffsets[offsetIndex + 1] = startOffset + res.bytesRead;
              }
              
              return {
                  ...prev,
                  rows: res.rows,
                  page: newPage,
                  offsets: newOffsets,
                  isLoading: false
              };
          });
      } catch (err: any) {
          setError(err.message);
          setLargeCsvState(prev => ({ ...prev, isLoading: false }));
      }
  };

  const handleFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    setLoading(true);
    setError(null);

    const newFiles: ViewerFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const id = Math.random().toString(36).substr(2, 9);
      const ext = file.name.split('.').pop()?.toLowerCase();
      let type: ViewerFile['type'] = 'unknown';
      let content: any = null;
      let url: string | undefined = undefined;

      try {
        if (['csv', 'xlsx', 'xls', 'ods'].includes(ext || '')) {
            if (ext === 'csv' && file.size > 50 * 1024 * 1024) { 
                 type = 'large_csv';
                 const headerChunk = file.slice(0, 65536); 
                 const text = await headerChunk.text();
                 const firstLineEnd = text.indexOf('\n');
                 if (firstLineEnd === -1) {
                     const headers = parseCSVLine(text);
                     content = { headers, headerEndByte: text.length, totalSize: file.size, totalRows: null };
                 } else {
                     const headerStr = text.substring(0, firstLineEnd).trim();
                     const headers = parseCSVLine(headerStr);
                     const headerByteLen = new TextEncoder().encode(text.substring(0, firstLineEnd + 1)).length;
                     content = { headers, headerEndByte: headerByteLen, totalSize: file.size, totalRows: null };
                 }
            } else {
                type = 'spreadsheet';
                let workbook;
                if (ext === 'csv') {
                    const text = await file.text();
                    workbook = read(text, { type: 'string' });
                } else {
                    const arrayBuffer = await file.arrayBuffer();
                    workbook = read(arrayBuffer, { type: 'array' });
                }
                const sheets: Record<string, any> = {};
                workbook.SheetNames.forEach(name => {
                    const sheet = workbook.Sheets[name];
                    const jsonData = utils.sheet_to_json(sheet, { header: 1 });
                    if (jsonData.length > 0) {
                        const headers = jsonData[0] as string[];
                        const rows = jsonData.slice(1);
                        sheets[name] = { headers, rows };
                    }
                });
                content = { sheetNames: workbook.SheetNames, sheets };
            }
        } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) {
            type = 'image';
            url = URL.createObjectURL(file);
            content = url;
        } else if (ext === 'pdf') {
            type = 'pdf';
            url = URL.createObjectURL(file);
            content = url;
        } else if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'html', 'css', 'xml', 'log'].includes(ext || '')) {
            type = ['html', 'htm'].includes(ext || '') ? 'html' : 'text'; 
            if (['js', 'ts', 'tsx', 'json', 'css', 'html'].includes(ext || '')) type = 'code';
            content = await file.text();
        } else if (ext === 'docx') {
            type = 'docx'; 
            // Store file directly for docx-preview rendering
            content = null; 
        }

        newFiles.push({
            id,
            name: file.name,
            sizeFormatted: formatFileSize(file.size),
            type,
            content,
            url,
            file
        });
      } catch (e: any) {
          console.error("Failed to load file", file.name, e);
          setError(`Failed to load ${file.name}: ${e.message}`);
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
        if (newFiles[0].type === 'spreadsheet') {
            setActiveSheet(newFiles[0].content.sheetNames[0]);
        }
        // Auto-close sidebar on mobile after selection
        if (window.innerWidth < 1024) setSidebarOpen(false);
    }
    setLoading(false);
  };

  const removeFile = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setFiles(prev => {
          const newFiles = prev.filter(f => f.id !== id);
          if (activeFileId === id) {
              setActiveFileId(newFiles.length > 0 ? newFiles[0].id : null);
              if (newFiles.length > 0 && newFiles[0].type === 'spreadsheet') {
                  setActiveSheet(newFiles[0].content.sheetNames[0]);
              }
          }
          return newFiles;
      });
  };

  const clearAllFiles = () => {
      setFiles([]);
      setActiveFileId(null);
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 100) {
          if (activeSheetData && visibleRows < activeSheetData.rows.length) {
              setVisibleRows(prev => Math.min(prev + 50, activeSheetData.rows.length));
          }
      }
  };

  const handleConvert = async (target: string) => {
      if (!activeFile) return;
      if (activeFile.type === 'spreadsheet' && target === 'toggle') {
          setSelectedSheets(new Set(activeFile.content.sheetNames));
          setShowSheetModal(true);
          setShowConvertMenu(false);
          return;
      }
      setIsConverting(true);
      setShowConvertMenu(false);
      try {
          let result;
          if (activeFile.type === 'image' && target === 'pdf') {
             result = await convertImageToPdf(activeFile.file);
          } else if (activeFile.type === 'pdf' && target === 'image') {
             result = await convertPdfToImages(activeFile.file);
          } else if (activeFile.type === 'pdf' && target === 'docx') {
             result = await convertPdfToDocx(activeFile.file);
          } else if ((activeFile.type === 'html' || activeFile.type === 'docx') && target === 'pdf') {
             result = await convertDocxToPdf(activeFile.file);
          } else {
             throw new Error("Conversion not supported");
          }
          if (result) {
              const link = document.createElement('a');
              link.href = result.url;
              link.download = result.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
      } catch (e: any) {
          setError(e.message);
      } finally {
          setIsConverting(false);
      }
  };

  const processSelectedSheets = async () => {
      if (!activeFile || activeFile.type !== 'spreadsheet') return;
      setIsConverting(true);
      try {
          if (selectedSheets.size === 1) {
              const sheetName = Array.from(selectedSheets)[0];
              const worksheetData = activeFile.content.sheets[sheetName];
              const wb = utils.book_new();
              const ws = utils.aoa_to_sheet([worksheetData.headers, ...worksheetData.rows]);
              utils.book_append_sheet(wb, ws, sheetName);
              const targetExt = activeFile.name.toLowerCase().endsWith('.csv') ? 'xlsx' : 'csv';
              if (targetExt === 'xlsx') {
                  const wbBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
                  const blob = new Blob([wbBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `${activeFile.name.split('.')[0]}_${sheetName}.xlsx`; a.click();
              } else {
                  const csv = utils.sheet_to_csv(ws);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `${activeFile.name.split('.')[0]}_${sheetName}.csv`; a.click();
              }
          } else {
              const wb = utils.book_new();
              selectedSheets.forEach(sheetName => {
                  const worksheetData = activeFile.content.sheets[sheetName];
                  const ws = utils.aoa_to_sheet([worksheetData.headers, ...worksheetData.rows]);
                  utils.book_append_sheet(wb, ws, sheetName);
              });
               const wbBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
               const blob = new Blob([wbBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a'); a.href = url; a.download = `${activeFile.name.split('.')[0]}_selected.xlsx`; a.click();
          }
          setShowSheetModal(false);
      } catch(e: any) { setError(e.message); } finally { setIsConverting(false); }
  };

  const toggleSheetSelection = (sheet: string) => { const next = new Set(selectedSheets); if (next.has(sheet)) next.delete(sheet); else next.add(sheet); setSelectedSheets(next); };
  const selectAllSheets = () => { if (!activeFile?.content?.sheetNames) return; setSelectedSheets(new Set(activeFile.content.sheetNames)); };
  const deselectAllSheets = () => { setSelectedSheets(new Set()); };

  const formatCellValue = (value: any, header: string): string => {
    if (value === null || value === undefined) return '';
    const strHeader = String(header).toLowerCase();
    const isPercentCol = strHeader.includes('%') || strHeader.includes('percent') || strHeader.includes('rate');
    if (typeof value === 'number') {
        if (isPercentCol) {
            if (Math.abs(value) <= 1.0) return (value * 100).toFixed(2) + '%';
            return value.toFixed(2) + '%';
        }
        if (String(value).includes('.') && String(value).length > 8) return parseFloat(value.toFixed(4)).toString();
        return String(value);
    }
    if (typeof value === 'string' && !isNaN(parseFloat(value)) && isPercentCol) {
         if (value.includes('%')) return value;
         const num = parseFloat(value);
         if (Math.abs(num) <= 1.0) return (num * 100).toFixed(2) + '%';
         return num.toFixed(2) + '%';
    }
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  };

  const getIconForType = (type: string) => {
      switch(type) {
          case 'spreadsheet': return <FileSpreadsheet size={16} className="text-emerald-400" />;
          case 'large_csv': return <Database size={16} className="text-amber-400" />;
          case 'image': return <ImageIcon size={16} className="text-blue-400" />;
          case 'pdf': return <FileText size={16} className="text-red-400" />;
          case 'code': return <FileCode size={16} className="text-lime-400" />;
          case 'html': return <FileType size={16} className="text-blue-500" />;
          case 'docx': return <FileText size={16} className="text-blue-400" />;
          default: return <File size={16} className="text-gray-400" />;
      }
  };

  return (
    <div className={`space-y-6 ${files.length > 0 ? 'h-full flex flex-col' : ''}`}>
      {!isFullScreen && (
        <ToolHeader 
          title="File Viewer"
          description="Universal client-side preview tool. Instantly view spreadsheets, PDFs, Images, and text documents directly in the browser. Supports files >500MB via pagination."
          instructions={[
            "Drag & Drop multiple files (CSV, XLSX, PDF, DOCX, TXT, Images)",
            "Use the sidebar to switch between open files",
            "Large CSVs (50MB+) are loaded in chunks to prevent crashes",
            "Click the expand icon for an immersive Full-Screen experience"
          ]}
          icon={Eye}
          colorClass="text-lime-400"
          onReset={clearAllFiles}
        />
      )}

      {files.length === 0 ? (
        <div className="max-w-2xl mx-auto w-full">
            <FileUploader 
                onFilesSelected={handleFiles} 
                multiple={true}
                disabled={loading}
                theme="lime"
                limitText="Spreadsheets, Docs, Images, PDF"
                accept=".csv,.xlsx,.xls,.ods,.pdf,.docx,.txt,.md,.json,.js,.ts,.tsx,.html,.css,.xml,.log,.png,.jpg,.jpeg,.webp,.gif,.svg"
            />
        </div>
      ) : (
        <div 
            className={`
              flex flex-col lg:flex-row bg-gray-900 border border-gray-800 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 transition-all duration-500 overflow-hidden
              ${isFullScreen ? 'fixed inset-0 z-[100] rounded-none' : 'flex-1 min-h-[85vh] relative'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); }}
        >
            {isDraggingOver && (
                <div className="absolute inset-0 z-50 bg-lime-500/20 backdrop-blur-sm border-2 border-dashed border-lime-400 flex flex-col items-center justify-center animate-in fade-in pointer-events-none rounded-xl">
                    <Upload className="text-lime-400 w-16 h-16 mb-4 animate-bounce" />
                    <h3 className="text-2xl font-bold text-white drop-shadow-md">{t('drop_to_add')}</h3>
                </div>
            )}
            
            {/* Sidebar - Mobile Overlay or Desktop Column */}
            <div className={`
              flex-shrink-0 bg-gray-950 border-r border-gray-800 transition-all duration-300 flex flex-col overflow-hidden z-[60]
              ${isFullScreen ? '' : 'lg:rounded-l-xl'}
              ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-0'}
              lg:relative absolute inset-y-0 left-0 h-full shadow-2xl lg:shadow-none
            `}>
                <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Files ({files.length})</span>
                    <div className="flex gap-1">
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors"><ChevronsLeft size={14} /></button>
                        <button onClick={() => clearAllFiles()} className="p-1.5 bg-gray-900 hover:bg-gray-800 hover:text-red-400 rounded-lg text-gray-500 transition-colors" title="Clear All"><Trash2 size={14} /></button>
                        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors" title="Add File"><Plus size={14} /></button>
                    </div>
                </div>
                {/* Hidden input for sidebar add button */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple
                    accept=".csv,.xlsx,.xls,.ods,.pdf,.docx,.txt,.md,.json,.js,.ts,.tsx,.html,.css,.xml,.log,.png,.jpg,.jpeg,.webp,.gif,.svg"
                    onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); }}
                />
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {files.map(f => (
                        <div 
                            key={f.id} 
                            onClick={() => { setActiveFileId(f.id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${activeFileId === f.id ? 'bg-gray-800 text-white shadow-sm ring-1 ring-white/5' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'}`}
                        >
                            <div className="shrink-0">{getIconForType(f.type)}</div>
                            <span className="text-xs font-medium truncate flex-1">{f.name}</span>
                            <button onClick={(e) => removeFile(e, f.id)} className={`opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity ${activeFileId === f.id ? 'text-gray-400' : 'text-gray-600'}`}><X size={12} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sidebar Overlay for Mobile */}
            {sidebarOpen && window.innerWidth < 1024 && (
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-900 relative overflow-hidden h-full">
                <div className="h-12 border-b border-gray-800 flex items-center justify-between px-3 sm:px-4 bg-gray-900 z-[30] shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-gray-500 hover:text-white" title="Toggle Sidebar"><Menu size={18} /></button>
                        {activeFile ? (
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className="hidden xs:block">{getIconForType(activeFile.type)}</div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs sm:text-sm font-bold text-gray-200 truncate">{activeFile.name}</span>
                                    <span className="text-[9px] sm:text-[10px] text-gray-500 leading-none mt-0.5">{activeFile.sizeFormatted}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs sm:text-sm text-gray-500">{t('select_file_view') || "Select a file"}</span>
                        )}
                    </div>
                    {activeFile && (
                        <div className="flex items-center gap-1 sm:gap-2">
                            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>{isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
                            <div className="relative" ref={convertMenuRef}>
                                <button onClick={() => setShowConvertMenu(!showConvertMenu)} disabled={isConverting || activeFile.type === 'large_csv'} className="p-1.5 sm:p-2 text-lime-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed" title="Convert File">{isConverting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}<span className="text-xs font-bold hidden sm:block">Convert</span></button>
                                {showConvertMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1">
                                        <div className="p-1 bg-gray-800">
                                            {activeFile.type === 'spreadsheet' && (<button onClick={() => handleConvert('toggle')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">To {activeFile.name.toLowerCase().endsWith('.csv') ? 'XLSX' : 'CSV'}</button>)}
                                            {activeFile.type === 'image' && (<button onClick={() => handleConvert('pdf')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">To PDF</button>)}
                                            {activeFile.type === 'pdf' && (<><button onClick={() => handleConvert('image')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">To Images</button><button onClick={() => handleConvert('docx')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">To DOCX</button></>)}
                                            {(activeFile.type === 'html' || activeFile.type === 'docx') && (<button onClick={() => handleConvert('pdf')} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-lg transition-colors">To PDF</button>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {activeFile.url && (<a href={activeFile.url} target="_blank" rel="noreferrer" className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors hidden xs:block" title="Open in New Tab"><ExternalLink size={16} /></a>)}
                        </div>
                    )}
                </div>

                <div className="flex-1 relative bg-[#0b0e14] z-0 overflow-hidden flex flex-col min-h-0">
                    {activeFile ? (
                        <div className="flex flex-col flex-1 min-h-0">
                            {/* ... Content rendering remains identical ... */}
                            {activeFile.type === 'spreadsheet' && activeSheetData && (
                                <div className="flex flex-col flex-1 relative min-h-0">
                                    <div className="flex-1 overflow-auto custom-scrollbar min-h-0" onScroll={handleTableScroll}>
                                        <table className="w-full text-left text-sm text-gray-300 border-separate border-spacing-0">
                                            <thead className="text-xs text-gray-400 uppercase bg-gray-800/90 backdrop-blur sticky top-0 z-20 shadow-sm">
                                                <tr><th className="px-2 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] text-gray-600 border-b border-r border-gray-700 w-10 sm:w-12 bg-gray-800/90 text-center sticky left-0 z-30">#</th>{activeSheetData.headers.map((h: string, i: number) => (<th key={i} className="px-3 sm:px-4 py-2 font-semibold border-b border-r border-gray-700 whitespace-nowrap bg-gray-800/90 min-w-[80px] sm:min-w-[100px] text-[10px] sm:text-xs">{h || `Col ${i+1}`}</th>))}</tr>
                                            </thead>
                                            <tbody className="divide-gray-800">{activeSheetData.rows.slice(0, visibleRows).map((row: any[], i: number) => (<tr key={i} className="hover:bg-white/[0.02] transition-colors"><td className="px-2 sm:px-4 py-1 sm:py-1.5 font-mono text-[9px] sm:text-[10px] text-gray-600 border-b border-r border-gray-800 bg-gray-900/50 text-center sticky left-0 z-10">{i + 1}</td>{activeSheetData.headers.map((_: any, cIndex: number) => (<td key={cIndex} className="px-3 sm:px-4 py-1 sm:py-1.5 truncate max-w-[200px] sm:max-w-[300px] border-b border-r border-gray-800/50 text-[10px] sm:text-xs">{formatCellValue(row[cIndex], activeSheetData.headers[cIndex])}</td>))}</tr>))}</tbody>
                                        </table>
                                        {visibleRows < activeSheetData.rows.length && (<div className="p-4 text-center text-xs text-gray-500 italic pb-20">Scroll to load more...</div>)}
                                    </div>
                                    <div className="shrink-0 bg-[#0d1117] border-t border-gray-800 z-30 flex items-center justify-between h-10 overflow-hidden">
                                        <div className="flex h-full overflow-x-auto no-scrollbar flex-1">{activeFile.content.sheetNames.map((sheetName: string) => (<button key={sheetName} onClick={() => { setActiveSheet(sheetName); setVisibleRows(100); }} className={`px-3 sm:px-4 h-full flex items-center justify-center text-[10px] sm:text-xs font-medium border-r border-gray-800/50 min-w-[70px] max-w-[150px] truncate transition-colors select-none ${activeSheet === sheetName ? 'bg-[#1f2937] text-green-400 font-bold relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-green-400' : 'bg-transparent text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`} title={sheetName}>{sheetName}</button>))}</div>
                                        <div className="hidden xs:flex px-4 text-[9px] sm:text-[10px] text-gray-500 font-mono whitespace-nowrap border-l border-gray-800/50 h-full items-center bg-[#0d1117] z-20 shadow-[-10px_0_10px_#0d1117]">{activeSheetData.rows.length.toLocaleString()} rows</div>
                                    </div>
                                </div>
                            )}

                            {activeFile.type === 'large_csv' && (
                                <div className="flex flex-col flex-1 relative min-h-0">
                                    <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                                        <table className="w-full text-left text-sm text-gray-300 border-separate border-spacing-0">
                                            <thead className="text-xs text-gray-400 uppercase bg-gray-800/90 backdrop-blur sticky top-0 z-20 shadow-sm">
                                                <tr><th className="px-2 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] text-gray-600 border-b border-r border-gray-700 w-10 sm:w-12 bg-gray-800/90 text-center sticky left-0 z-30">#</th>{activeFile.content.headers.map((h: string, i: number) => (<th key={i} className="px-3 sm:px-4 py-2 font-semibold border-b border-r border-gray-700 whitespace-nowrap bg-gray-800/90 min-w-[80px] sm:min-w-[100px] text-[10px] sm:text-xs">{h || `Col ${i+1}`}</th>))}</tr>
                                            </thead>
                                            <tbody className="divide-gray-800">
                                                {largeCsvState.isLoading && largeCsvState.rows.length === 0 ? (
                                                     <tr><td colSpan={activeFile.content.headers.length + 1} className="p-8 text-center text-gray-500"><div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-amber-500" />Loading chunk...</div></td></tr>
                                                ) : (
                                                    largeCsvState.rows.map((row: any[], i: number) => (<tr key={i} className="hover:bg-white/[0.02] transition-colors"><td className="px-2 sm:px-4 py-1 sm:py-1.5 font-mono text-[9px] sm:text-[10px] text-gray-600 border-b border-r border-gray-800 bg-gray-900/50 text-center sticky left-0 z-10">{i + 1 + ((largeCsvState.page - 1) * 1000)}</td>{activeFile.content.headers.map((_: any, cIndex: number) => (<td key={cIndex} className="px-3 sm:px-4 py-1 sm:py-1.5 truncate max-w-[200px] sm:max-w-[300px] border-b border-r border-gray-800/50 text-[10px] sm:text-xs">{row[cIndex] || ''}</td>))}</tr>))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="shrink-0 bg-[#0d1117] border-t border-gray-800 z-30 flex items-center justify-between px-2 sm:px-4 h-11">
                                         <div className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-2 sm:gap-4 font-medium uppercase tracking-wide truncate">
                                            <span className="text-gray-400">Page {largeCsvState.page}</span>
                                            <span className="w-px h-3 bg-gray-800"></span>
                                            <span className={activeFile.content.totalRows === null ? "animate-pulse text-amber-500" : "text-gray-300"}>
                                                {activeFile.content.totalRows !== null ? `${activeFile.content.totalRows.toLocaleString()} rows` : 'Loading...'}
                                            </span>
                                            <span className="hidden xs:block w-px h-3 bg-gray-800"></span>
                                            <span className="hidden xs:block truncate">{activeFile.sizeFormatted}</span>
                                         </div>
                                         <div className="flex items-center gap-1 sm:gap-2">
                                             <button onClick={() => handleLargeCsvPageChange('prev')} disabled={largeCsvState.page === 1 || largeCsvState.isLoading} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={16} /></button>
                                             <button onClick={() => handleLargeCsvPageChange('next')} disabled={largeCsvState.isLoading || (largeCsvState.offsets[largeCsvState.page] >= activeFile.content.totalSize)} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
                                         </div>
                                    </div>
                                </div>
                            )}

                            {activeFile.type === 'pdf' && activeFile.url && <PdfRenderer url={activeFile.url} />}
                            {activeFile.type === 'image' && activeFile.url && (<div className="w-full h-full flex items-center justify-center p-2 sm:p-4 bg-gray-950 overflow-auto"><img src={activeFile.url} alt="Preview" className="max-w-full max-h-full object-contain rounded shadow-2xl" /></div>)}
                            {(activeFile.type === 'text' || activeFile.type === 'code') && (<div className="h-full overflow-auto custom-scrollbar p-3 sm:p-6"><pre className="font-mono text-[10px] sm:text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-w-5xl mx-auto">{activeFile.content}</pre></div>)}
                            {activeFile.type === 'html' && <HtmlRenderer content={activeFile.content} />}
                            {activeFile.type === 'docx' && <DocxRenderer file={activeFile.file} />}
                            {activeFile.type === 'unknown' && (<div className="flex flex-col items-center justify-center h-full text-center p-6"><AlertCircle className="text-gray-600 mb-4" size={48} /><h3 className="text-base sm:text-lg font-semibold text-gray-400">Preview Unavailable</h3><p className="text-xs sm:text-sm text-gray-500 max-w-xs mt-2 leading-relaxed">This file type cannot be previewed directly.</p></div>)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-50 px-6 text-center"><Eye size={48} className="mb-4" /><p className="text-xs sm:text-sm font-medium">Select a file from the sidebar to view content.</p></div>
                    )}
                </div>
            </div>
        </div>
      )}

      {showSheetModal && activeFile && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            {/* Modal Logic remains same */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 sm:p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><FileSpreadsheet className="text-green-400" size={18} />Select Sheets</h3>
                    <button onClick={() => setShowSheetModal(false)} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                <div className="p-3 sm:p-4 bg-gray-950/50 flex justify-between items-center border-b border-gray-800">
                    <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{selectedSheets.size} selected</span>
                    <div className="flex gap-4"><button onClick={selectAllSheets} className="text-[10px] sm:text-xs font-bold text-green-400 hover:text-green-300 uppercase tracking-wide">All</button><button onClick={deselectAllSheets} className="text-[10px] sm:text-xs font-bold text-gray-500 hover:text-gray-300 uppercase tracking-wide">None</button></div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 custom-scrollbar">
                    {activeFile.content.sheetNames.map((sheet: string) => (
                        <div key={sheet} onClick={() => toggleSheetSelection(sheet)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedSheets.has(sheet) ? 'bg-green-500/10 border-green-500/50' : 'bg-gray-800/30 border-gray-700 hover:bg-gray-800'}`}>
                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${selectedSheets.has(sheet) ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-500'}`}>{selectedSheets.has(sheet) && <CheckSquare size={14} strokeWidth={3} />}</div>
                            <span className={`text-sm font-medium truncate ${selectedSheets.has(sheet) ? 'text-white' : 'text-gray-400'}`}>{sheet}</span>
                        </div>
                    ))}
                </div>
                <div className="p-4 sm:p-5 border-t border-gray-800 bg-gray-900 flex justify-end gap-3">
                    <button onClick={() => setShowSheetModal(false)} className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
                    <button onClick={processSelectedSheets} disabled={selectedSheets.size === 0 || isConverting} className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all">{isConverting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Download</button>
                </div>
            </div>
        </div>
      )}

      {error && (
        <div className="max-w-3xl mx-auto mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="text-red-400 shrink-0" />
          <p className="text-red-300 text-xs sm:text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-200 px-2 py-1 rounded transition-colors">Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default ViewerTool;
