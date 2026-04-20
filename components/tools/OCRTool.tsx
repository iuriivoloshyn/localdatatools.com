
import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { ScanText, Loader2, FileText, Copy, CheckCircle2, Sparkles, Download, Cpu } from 'lucide-react';
import { useLanguage } from '../../App';
import { useGemma } from '../../contexts/GemmaContext';

const pdfToImages = async (file: File): Promise<File[]> => {
  const pdfjsModule = await import('pdfjs-dist');
  const pdfjs = (pdfjsModule as any).default?.GlobalWorkerOptions ? (pdfjsModule as any).default : pdfjsModule;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
  }
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const imageFiles: File[] = [];
  const baseName = file.name.replace(/\.pdf$/i, '');

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const scale = 2; // 2x for better OCR quality
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'));
    imageFiles.push(new File([blob], `${baseName}_page${i}.png`, { type: 'image/png' }));
  }
  return imageFiles;
};

const OCRTool: React.FC = () => {
  const { t, lang, consumePendingFile, pendingFile } = useLanguage();
  const {
    engine: gemmaEngine,
    isModelLoaded: gemmaLoaded,
    isLoading: gemmaLoading,
    progress: gemmaProgress,
    progressVal: gemmaProgressVal,
    error: gemmaError,
    initGemma,
  } = useGemma();

  // Basic Mode State
  const [basicImages, setBasicImages] = useState<any[]>([]);
  const [isProcessingBasic, setIsProcessingBasic] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Engine: 'tesseract' is the fast, specialized OCR default; 'gemma' uses
  // Gemma 4 vision for handwriting, context, and natural-language queries
  const [ocrEngine, setOcrEngine] = useState<'tesseract' | 'gemma'>('tesseract');
  const [gemmaPrompt, setGemmaPrompt] = useState('');

  useEffect(() => {
    const file = consumePendingFile('ocr');
    if (file) {
      handleIncomingFiles([file]);
    }
  }, [pendingFile]);

  const handleReset = () => {
      setBasicImages([]);
  };

  const handleIncomingFiles = async (files: File[]) => {
    const imageFiles: File[] = [];
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const nonPdfFiles = files.filter(f => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'));

    imageFiles.push(...nonPdfFiles);

    if (pdfFiles.length > 0) {
      setPdfLoading(true);
      try {
        for (const pdf of pdfFiles) {
          const pages = await pdfToImages(pdf);
          imageFiles.push(...pages);
        }
      } catch (e) {
        console.error('PDF conversion failed:', e);
      } finally {
        setPdfLoading(false);
      }
    }

    if (imageFiles.length > 0) {
      handleBasicFiles(imageFiles);
    }
  };

  const handleBasicFiles = (files: File[]) => {
      const newImgs = files.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          file: f,
          preview: URL.createObjectURL(f),
          text: null,
          status: 'idle'
      }));
      setBasicImages(prev => [...prev, ...newImgs]);
  };

  const processBasic = async () => {
      setIsProcessingBasic(true);
      try {
          if (ocrEngine === 'gemma') {
              if (!gemmaEngine) throw new Error('Gemma 4 not loaded');
              for (const img of basicImages) {
                  if (img.status === 'completed') continue;
                  const startedAt = Date.now();
                  setBasicImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing', text: '', elapsedMs: 0 } : i));
                  const elapsedTicker = window.setInterval(() => {
                      setBasicImages(prev => prev.map(i => i.id === img.id && i.status === 'processing' ? { ...i, elapsedMs: Date.now() - startedAt } : i));
                  }, 500);
                  try {
                      const completion = await gemmaEngine.chat.completions.create({
                          messages: [{
                              role: 'user',
                              content: [
                                  { type: 'image', image: img.file },
                                  { type: 'text', text: gemmaPrompt.trim() || 'Extract all text visible in this image. Preserve line breaks and reading order. Output only the extracted text, with no commentary, preamble, or explanation.' },
                              ],
                          }],
                          max_tokens: 2048,
                          onPartial: (partial) => {
                              setBasicImages(prev => prev.map(i => i.id === img.id ? { ...i, text: partial } : i));
                          },
                      });
                      const text = completion.choices[0]?.message?.content || '';
                      setBasicImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', text } : i));
                  } finally {
                      window.clearInterval(elapsedTicker);
                  }
              }
          } else {
              const tessLang = lang === 'ru' ? 'rus' : 'eng';
              const worker = await createWorker(tessLang, 1, {
                  workerPath: 'https://models.localdatatools.com/tesseract/worker.min.js',
                  corePath: 'https://models.localdatatools.com/tesseract/tesseract-core.wasm.js',
                  langPath: 'https://models.localdatatools.com/tesseract/',
                  gzip: true,
              });
              for (const img of basicImages) {
                  if (img.status === 'completed') continue;
                  setBasicImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing' } : i));
                  const ret = await worker.recognize(img.file);
                  setBasicImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'completed', text: ret.data.text } : i));
              }
              await worker.terminate();
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessingBasic(false);
      }
  };

  return (
    <div className="space-y-6 pb-12">
      <ToolHeader
        title="Image to Text"
        description="Extract text from images. Tesseract is fast and specialized for printed text; Gemma 4 vision handles handwriting, tables, and context."
        icon={ScanText}
        colorClass="text-blue-400"
        onReset={handleReset}
        instructions={[]}
      />

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex gap-2 bg-gray-900/60 p-1 rounded-xl border border-white/5">
                  <button
                      onClick={() => setOcrEngine('tesseract')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${ocrEngine === 'tesseract' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      <ScanText size={14} /> Tesseract <span className="opacity-60 font-normal">(fast, printed text)</span>
                  </button>
                  <button
                      onClick={() => setOcrEngine('gemma')}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${ocrEngine === 'gemma' ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      <Sparkles size={14} /> Gemma 4 <span className="opacity-60 font-normal">(handwriting, context)</span>
                  </button>
              </div>
              <FileUploader onFilesSelected={handleIncomingFiles} multiple={true} disabled={isProcessingBasic || pdfLoading || (ocrEngine === 'gemma' && gemmaLoading)} theme="blue" accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.pdf" limitText="Images & PDF files" />
              {ocrEngine === 'gemma' && (
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={12} className="text-rose-400" /> Custom prompt (optional)
                      </label>
                      <textarea
                          value={gemmaPrompt}
                          onChange={(e) => setGemmaPrompt(e.target.value)}
                          placeholder="e.g. 'Extract only the prices as a list' or 'Describe what's in this image' — leave empty for a plain text extraction."
                          className="w-full h-20 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-gray-300 focus:border-rose-500/30 outline-none resize-none"
                      />
                  </div>
              )}
          </div>

          {ocrEngine === 'gemma' && !gemmaLoaded && (
              <div className="max-w-2xl mx-auto bg-gray-900 border border-rose-500/20 p-6 rounded-2xl text-center">
                  <Cpu size={32} className="mx-auto mb-3 text-rose-400" />
                  <h3 className="text-base font-bold text-white mb-1">Gemma 4 not loaded</h3>
                  <p className="text-xs text-gray-400 mb-4">~2 GB download runs once, then cached on your device. Enables handwriting recognition and contextual extraction.</p>
                  {!gemmaLoading ? (
                      <button onClick={initGemma} className="bg-gradient-to-br from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 shadow-lg active:scale-95">
                          <Download size={16} /> Load Gemma 4 E2B
                      </button>
                  ) : (
                      <div className="space-y-2 max-w-sm mx-auto">
                          <div className="flex justify-between text-[10px] font-black text-rose-400 uppercase tracking-widest"><span>{gemmaProgress}</span><span>{Math.round(gemmaProgressVal * 100)}%</span></div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${gemmaProgressVal * 100}%` }} /></div>
                      </div>
                  )}
                  {gemmaError && <div className="mt-4 p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-left text-red-400 text-[10px] font-mono leading-relaxed">{gemmaError}</div>}
              </div>
          )}
          {pdfLoading && (
              <div className="flex justify-center items-center gap-2 text-blue-400">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-sm font-medium">Converting PDF pages to images...</span>
              </div>
          )}
          {basicImages.length > 0 && !pdfLoading && (
              <div className="flex justify-center gap-3">
                  <button onClick={processBasic} disabled={isProcessingBasic || (ocrEngine === 'gemma' && !gemmaLoaded)} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl">
                      {isProcessingBasic ? <Loader2 className="animate-spin" size={20} /> : ocrEngine === 'gemma' ? <Sparkles size={20} /> : <ScanText size={20} />}
                      Extract Text From {basicImages.length} {basicImages.length === 1 ? 'Image' : 'Images'}
                  </button>
                  {basicImages.some(img => img.text) && (
                      <button onClick={() => {
                          const allText = basicImages.filter(img => img.text).map(img => img.text).join('\n\n---\n\n');
                          navigator.clipboard.writeText(allText);
                          setCopiedAll(true);
                          setTimeout(() => setCopiedAll(false), 2000);
                      }} className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-3 rounded-xl font-bold flex items-center gap-2 border border-gray-700">
                          {copiedAll ? <CheckCircle2 size={18} className="text-green-400" /> : <Copy size={18} />}
                          {copiedAll ? 'Copied!' : 'Copy All'}
                      </button>
                  )}
              </div>
          )}
          <div className="grid grid-cols-1 gap-4">
              {basicImages.map(img => (
                  <div key={img.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col md:flex-row min-h-[200px]">
                      <div className="w-full md:w-48 bg-black flex items-center justify-center p-2">
                          <img src={img.preview} className="max-w-full max-h-40 object-contain" />
                      </div>
                      <div className="flex-1 p-4 bg-gray-950/50 relative">
                          {img.status === 'processing' ? (
                              <div className="h-full flex flex-col gap-2">
                                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold">
                                      <Loader2 className="animate-spin" size={14} />
                                      <span>Analyzing</span>
                                      {typeof img.elapsedMs === 'number' && <span className="text-gray-500 font-mono">{(img.elapsedMs / 1000).toFixed(1)}s</span>}
                                      {ocrEngine === 'gemma' && typeof img.elapsedMs === 'number' && img.elapsedMs > 15000 && !img.text && (
                                          <span className="text-amber-400 font-normal italic">encoding image…</span>
                                      )}
                                  </div>
                                  {img.text ? (
                                      <pre className="whitespace-pre-wrap font-mono text-xs text-gray-400 flex-1">{img.text}<span className="animate-pulse text-rose-400">▋</span></pre>
                                  ) : (
                                      <p className="text-[10px] text-gray-600 italic">
                                          {ocrEngine === 'gemma' ? 'Gemma 4 needs ~20s to encode the image before generating. For crisp printed text, Tesseract is 10× faster.' : 'Loading Tesseract worker…'}
                                      </p>
                                  )}
                              </div>
                          ) : img.text ? (
                              <div className="h-full relative group/copy">
                                  <button onClick={() => { navigator.clipboard.writeText(img.text); setCopiedId(img.id); setTimeout(() => setCopiedId(null), 1500); }} className="absolute top-0 right-0 p-1.5 rounded-lg text-gray-600 hover:text-gray-200 hover:bg-gray-800 transition-colors opacity-0 group-hover/copy:opacity-100" title="Copy">
                                      {copiedId === img.id ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                                  </button>
                                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 h-full">{img.text}</pre>
                              </div>
                          ) : (
                              <div className="h-full flex items-center justify-center text-gray-600 italic">Ready to process</div>
                          )}
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default OCRTool;
