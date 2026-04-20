
import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { ScanText, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../App';

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

  // Basic Mode State
  const [basicImages, setBasicImages] = useState<any[]>([]);
  const [isProcessingBasic, setIsProcessingBasic] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      const tessLang = lang === 'ru' ? 'rus' : 'eng';
      let worker: any = null;
      try {
          worker = await createWorker(tessLang, 1, {
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
        description="Fast and secure local OCR engine. Extract plain text from images or screenshots using Tesseract technology running entirely in your browser."
        icon={ScanText}
        colorClass="text-blue-400"
        onReset={handleReset}
        instructions={[]}
      />

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="max-w-2xl mx-auto">
              <FileUploader onFilesSelected={handleIncomingFiles} multiple={true} disabled={isProcessingBasic || pdfLoading} theme="blue" accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.pdf" limitText="Images & PDF files" />
          </div>
          {pdfLoading && (
              <div className="flex justify-center items-center gap-2 text-blue-400">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-sm font-medium">Converting PDF pages to images...</span>
              </div>
          )}
          {basicImages.length > 0 && !pdfLoading && (
              <div className="flex justify-center gap-3">
                  <button onClick={processBasic} disabled={isProcessingBasic} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl">
                      {isProcessingBasic ? <Loader2 className="animate-spin" size={20} /> : <ScanText size={20} />}
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
                              <div className="h-full flex flex-col items-center justify-center text-blue-400"><Loader2 className="animate-spin mb-2" />Analyzing...</div>
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
