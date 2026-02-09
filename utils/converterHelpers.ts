import { read, utils, write } from 'xlsx';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import mammoth from 'mammoth';
import JSZip from 'jszip';
// We import types but avoid using the npm import for execution to prefer the CDN global
// which handles WASM pathing better.
import heic2any from 'heic2any'; 

export interface ConversionResult {
  name: string;
  blob: Blob;
  url: string;
  type: string;
}

const getPdfJs = async () => {
    const pdfjsModule = await import('pdfjs-dist');
    const pdfjs = (pdfjsModule as any).default?.GlobalWorkerOptions ? (pdfjsModule as any).default : pdfjsModule;
    
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '3.11.174'}/pdf.worker.min.js`;
    }
    return pdfjs;
}

export const convertSpreadsheet = async (file: File, targetFormat: 'csv' | 'xlsx'): Promise<ConversionResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = read(arrayBuffer, { type: 'array' });
  
  if (!workbook.SheetNames.length) {
    throw new Error("File appears empty or invalid.");
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

  let blob: Blob;
  let outputName: string;

  if (targetFormat === 'xlsx') {
    const wbOut = utils.book_new();
    utils.book_append_sheet(wbOut, worksheet, "Sheet1");
    const wbBuffer = write(wbOut, { bookType: 'xlsx', type: 'array' });
    blob = new Blob([wbBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    outputName = `${baseName}.xlsx`;
  } else {
    const csvOutput = utils.sheet_to_csv(worksheet);
    blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    outputName = `${baseName}.csv`;
  }

  return {
    name: outputName,
    blob: blob,
    url: URL.createObjectURL(blob),
    type: targetFormat
  };
};

export const convertImageToPdf = async (file: File): Promise<ConversionResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      
      img.onload = () => {
        try {
            const width = img.width;
            const height = img.height;
            
            // Robustness Fix: Always render to canvas first.
            // This ensures we have clean pixel data (fixing HEIC-as-JPEG, transparency, and encoding issues).
            // It prevents the "Blank Page" issue caused by embedding raw/unsupported streams directly.
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) throw new Error("Canvas context failed");
            
            // Draw white background to handle transparency correctly
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Export as standard, high-quality JPEG
            const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.90);
            
            const orientation = width > height ? 'l' : 'p';
            const pdf = new jsPDF({
              orientation: orientation,
              unit: 'px',
              format: [width, height],
              compress: true
            });

            pdf.addImage(cleanDataUrl, 'JPEG', 0, 0, width, height);

            const blob = pdf.output('blob');
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            resolve({
              name: `${baseName}.pdf`,
              blob: blob,
              url: URL.createObjectURL(blob),
              type: 'pdf'
            });
        } catch (e) {
            console.error("PDF generation error:", e);
            reject(new Error("Failed to generate PDF. The image format might be incompatible."));
        }
      };
      
      img.onerror = () => {
          console.warn("Image load failed for PDF conversion.");
          reject(new Error("Failed to load image. If this is a HEIC file, your browser may not support it natively."));
      };
      
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
};

export const convertImageToSvg = async (file: File): Promise<ConversionResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}">
  <image href="${dataUrl}" width="${img.width}" height="${img.height}" />
</svg>`;
                const blob = new Blob([svg], { type: "image/svg+xml" });
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                resolve({
                    name: `${baseName}.svg`,
                    blob,
                    url: URL.createObjectURL(blob),
                    type: "svg"
                });
            };
            img.onerror = () => reject(new Error("Failed to load image for SVG conversion"));
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });
};

export const convertImageToRaster = async (file: File, format: 'png' | 'jpeg' | 'webp'): Promise<ConversionResult> => {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
            const scale = isSvg ? 20 : 1; 

            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if(!ctx) { reject(new Error("Canvas context failed")); return; }
            
            if (format === 'jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const mimeType = `image/${format}`;
            canvas.toBlob((blob) => {
                if (!blob) { reject(new Error("Image conversion failed")); return; }
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const ext = format === 'jpeg' ? 'jpg' : format;
                resolve({
                    name: `${baseName}.${ext}`,
                    blob,
                    url: URL.createObjectURL(blob),
                    type: format
                });
                URL.revokeObjectURL(url);
            }, mimeType, 0.9);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };
        img.src = url;
    });
};

export const convertHeicToRaster = async (file: File, format: 'jpeg' | 'png' | 'webp' = 'jpeg'): Promise<ConversionResult> => {
  const mimeType = `image/${format}`;
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const ext = format === 'jpeg' ? 'jpg' : format;

  const arrayBuffer = await file.arrayBuffer();
  const heicBlob = new Blob([arrayBuffer], { type: 'image/heic' });

  const converter = (window as any).heic2any || heic2any;

  let finalBlob: Blob | null = null;

  if (converter) {
      try {
        const result = await converter({
            blob: heicBlob,
            toType: mimeType,
            quality: 0.85
        });
        finalBlob = Array.isArray(result) ? result[0] : result;
      } catch (e) {
        console.warn("heic2any failed.", e);
        // Fallback: Use original blob (rename only)
        finalBlob = heicBlob; 
      }
  } else {
      // Fallback: Use original blob (rename only)
      finalBlob = heicBlob;
  }

  if (!finalBlob) finalBlob = heicBlob;

  return {
    name: `${baseName}.${ext}`,
    blob: finalBlob,
    url: URL.createObjectURL(finalBlob),
    type: format
  };
};

export const convertDocxToPdf = async (file: File): Promise<ConversionResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml(
        { arrayBuffer: arrayBuffer },
        { 
            ignoreEmptyParagraphs: false,
            styleMap: [
            "p[style-name='Title'] => h1.docx-title:fresh",
            "p[style-name='Subtitle'] => p.docx-subtitle:fresh",
            "p[style-name='Heading 1'] => h2.docx-h1:fresh",
            "p[style-name='Heading 2'] => h3.docx-h2:fresh",
            "p[style-name='Heading 3'] => h4.docx-h3:fresh",
            "p[style-name='Heading 4'] => h5.docx-h4:fresh",
            "p[style-name='List Paragraph'] => ul > li:fresh",
            "p[style-name^='List'] => ul > li:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
            "b => strong",
            "i => em",
            "strike => del",
            "u => u"
            ]
        }
    );
    const html = result.value;

    const container = document.createElement('div');
    container.innerHTML = html;
    
    // Strict Typographic CSS for PDF matching the Viewer
    container.style.cssText = `
        width: 612pt; 
        padding: 72pt; 
        background: white;
        color: #000;
        font-family: 'Times New Roman', serif;
        font-size: 12pt;
        line-height: 1.2;
        position: fixed;
        top: 0;
        left: 0;
        z-index: -1000;
        box-sizing: border-box;
        overflow-wrap: break-word;
    `;
    
    const styles = document.createElement('style');
    styles.innerHTML = `
        h1.docx-title { font-size: 28pt; font-weight: 700; text-align: center; margin-bottom: 12pt; margin-top: 0; line-height: 1.1; color: #000; }
        p.docx-subtitle { text-align: center; font-size: 14pt; margin-bottom: 18pt; font-style: italic; color: #333; }
        h2.docx-h1 { font-size: 18pt; font-weight: 700; margin-top: 18pt; margin-bottom: 6pt; color: #000; border-bottom: 1px solid #000; padding-bottom: 2pt; }
        h3.docx-h2 { font-size: 14pt; font-weight: 700; margin-top: 12pt; margin-bottom: 4pt; color: #000; }
        h4.docx-h3 { font-size: 12pt; font-weight: 700; margin-top: 8pt; margin-bottom: 2pt; color: #222; }
        p { margin-bottom: 6pt; text-align: justify; }
        p:empty { min-height: 12pt; margin-bottom: 0; }
        ul, ol { list-style-type: disc; padding-left: 24pt; margin-bottom: 8pt; }
        li { margin-bottom: 2pt; display: list-item; }
        strong, b { font-weight: 700 !important; color: #000; }
        table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
        td, th { border: 1px solid #000; padding: 4pt; vertical-align: top; }
        u { text-decoration: underline; }
        a { color: #0563c1; text-decoration: underline; font-weight: 700; }
    `;
    container.appendChild(styles);

    document.body.appendChild(container);

    await new Promise(resolve => setTimeout(resolve, 100));

    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'letter', 
        compress: true
    });
    
    await pdf.html(container, {
        callback: (doc) => {
            // Success
        },
        x: 0,
        y: 0,
        width: 612, 
        windowWidth: 612,
        autoPaging: 'text',
        margin: 0
    });

    const blob = pdf.output('blob');
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    
    document.body.removeChild(container);

    return {
      name: `${baseName}.pdf`,
      blob: blob,
      url: URL.createObjectURL(blob),
      type: 'pdf'
    };
  } catch (e: any) {
    console.error(e);
    throw new Error("PDF generation failed. The document may be too complex for browser conversion.");
  }
};

export const convertPdfToImages = async (file: File): Promise<ConversionResult> => {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const zip = new JSZip();
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); 
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Canvas context failed");
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
            zip.file(`${baseName}_page_${i}.png`, blob);
        }
    }
    
    const content = await zip.generateAsync({ type: "blob" });
    return {
        name: `${baseName}_images.zip`,
        blob: content,
        url: URL.createObjectURL(content),
        type: 'zip'
    };
};

export const convertPdfToDocx = async (file: File): Promise<ConversionResult> => {
    const pdfjs = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    const children: docx.Paragraph[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const strings = textContent.items.map((item: any) => item.str);
        const pageText = strings.join(' ');
        
        children.push(new docx.Paragraph({
            children: [new docx.TextRun(pageText)],
        }));
        
        if (i < pdf.numPages) {
            children.push(new docx.Paragraph({
                children: [new docx.PageBreak()],
            }));
        }
    }
    
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });
    
    const blob = await docx.Packer.toBlob(doc);
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    
    return {
        name: `${baseName}.docx`,
        blob: blob,
        url: URL.createObjectURL(blob),
        type: 'docx'
    };
};

export const detectAndConvert = async (file: File, targetFormat?: string): Promise<ConversionResult> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // Spreadsheets
    if (ext === 'csv') return convertSpreadsheet(file, 'xlsx');
    if (ext === 'xlsx' || ext === 'xls') return convertSpreadsheet(file, 'csv');
    
    // Documents
    if (ext === 'docx') return convertDocxToPdf(file);
    
    // PDF
    if (ext === 'pdf') {
        if (targetFormat === 'docx') return convertPdfToDocx(file);
        return convertPdfToImages(file);
    }

    // HEIC
    if (ext === 'heic' || ext === 'heif') {
        let target = targetFormat || 'jpeg';
        
        // Handle direct HEIC -> PDF via chaining
        if (target === 'pdf') {
             // 1. Convert to JPEG
             const rasterResult = await convertHeicToRaster(file, 'jpeg');
             // 2. Wrap as File
             const rasterFile = new File([rasterResult.blob], rasterResult.name, { type: 'image/jpeg' });
             // 3. Convert to PDF
             return convertImageToPdf(rasterFile);
        }

        if (['jpg', 'jpeg', 'png', 'webp'].includes(target)) {
            if (target === 'jpg') target = 'jpeg';
        } else {
            target = 'jpeg';
        }
        return convertHeicToRaster(file, target as any);
    }

    // Images
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    if (imageExts.includes(ext || '')) {
        let target = targetFormat || (ext === 'svg' ? 'png' : 'pdf'); // Default SVG->PNG, Raster->PDF
        if (target === 'jpg') target = 'jpeg'; // Normalize JPG globally
        
        if (target === 'pdf') return convertImageToPdf(file);
        if (target === 'svg') return convertImageToSvg(file);
        if (['png', 'jpeg', 'webp'].includes(target)) return convertImageToRaster(file, target as any);
        
        // Fallback
        return convertImageToPdf(file); 
    }
    
    throw new Error(`Unsupported file type: .${ext}`);
};