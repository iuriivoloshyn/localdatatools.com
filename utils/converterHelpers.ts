
import { read, utils, write } from 'xlsx';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface ConversionResult {
  name: string;
  blob: Blob;
  url: string;
  type: string;
}

const getPdfJs = async () => {
    const pdfjsModule = await import('pdfjs-dist');
    // Fix for module export structure variations
    const pdfjs = (pdfjsModule as any).default?.GlobalWorkerOptions ? (pdfjsModule as any).default : pdfjsModule;
    
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        // Fallback to CDN if worker is not configured by bundler
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
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'l' : 'p',
          unit: 'px',
          format: [img.width, img.height]
        });
        pdf.addImage(img, 'JPEG', 0, 0, img.width, img.height);
        const blob = pdf.output('blob');
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        resolve({
          name: `${baseName}.pdf`,
          blob: blob,
          url: URL.createObjectURL(blob),
          type: 'pdf'
        });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
    };
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
                // Embed the raster image into an SVG container
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
            // Check if file is SVG to apply scaling
            const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
            const scale = isSvg ? 20 : 1; // 20x scale for SVG to ensure high quality rasterization

            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if(!ctx) { reject(new Error("Canvas context failed")); return; }
            
            // Fill white background for JPEG to handle transparency
            if (format === 'jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const mimeType = `image/${format}`;
            canvas.toBlob((blob) => {
                if (!blob) { reject(new Error("Image conversion failed")); return; }
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                // Fix extension for jpeg
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

    // Images
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    if (imageExts.includes(ext || '')) {
        const target = targetFormat || (ext === 'svg' ? 'png' : 'pdf'); // Default SVG->PNG, Raster->PDF
        
        if (target === 'pdf') return convertImageToPdf(file);
        if (target === 'svg') return convertImageToSvg(file);
        if (['png', 'jpeg', 'jpg', 'webp'].includes(target)) return convertImageToRaster(file, target as any);
        
        // Fallback
        return convertImageToPdf(file); 
    }
    
    throw new Error(`Unsupported file type: .${ext}`);
};
