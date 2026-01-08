
import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import ToolHeader from '../layout/ToolHeader';
import FileUploader from '../FileUploader';
import { ScanText, Loader2 } from 'lucide-react';
import { useLanguage } from '../../App';

const OCRTool: React.FC = () => {
  const { t, lang } = useLanguage();
  
  // Basic Mode State
  const [basicImages, setBasicImages] = useState<any[]>([]);
  const [isProcessingBasic, setIsProcessingBasic] = useState(false);

  const handleReset = () => {
      setBasicImages([]);
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
        description="Extract text from images using local Tesseract OCR. Processing happens entirely on your device."
        icon={ScanText}
        colorClass="text-blue-400"
        onReset={handleReset}
        instructions={[]}
      />

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="max-w-2xl mx-auto">
              <FileUploader onFilesSelected={handleBasicFiles} multiple={true} disabled={isProcessingBasic} theme="blue" />
          </div>
          {basicImages.length > 0 && (
              <div className="flex justify-center">
                  <button onClick={processBasic} disabled={isProcessingBasic} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl">
                      {isProcessingBasic ? <Loader2 className="animate-spin" size={20} /> : <ScanText size={20} />}
                      Extract Text From {basicImages.length} Images
                  </button>
              </div>
          )}
          <div className="grid grid-cols-1 gap-4">
              {basicImages.map(img => (
                  <div key={img.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col md:flex-row min-h-[200px]">
                      <div className="w-full md:w-48 bg-black flex items-center justify-center p-2">
                          <img src={img.preview} className="max-w-full max-h-40 object-contain" />
                      </div>
                      <div className="flex-1 p-4 bg-gray-950/50">
                          {img.status === 'processing' ? (
                              <div className="h-full flex flex-col items-center justify-center text-blue-400"><Loader2 className="animate-spin mb-2" />Analyzing...</div>
                          ) : img.text ? (
                              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 h-full">{img.text}</pre>
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
