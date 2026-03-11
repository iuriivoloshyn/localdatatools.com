# Local Data Tools

**Secure, offline-first data processing suite.**

Local Data Tools is a web application for data professionals who need to process sensitive information without uploading it to the cloud. All operations happen entirely within your browser using WebAssembly and WebGPU.

**Live:** [localdatatools.com](https://localdatatools.com)

## Features

### CSV Suite
- **Dashboard** — Auto-generate BI dashboards with interactive charts from any CSV.
- **CSV Fusion** — Merge massive CSV files (1GB+) via column join (SQL-style) or row append.
- **CSV Diff** — Compare two datasets to identify added, removed, or modified rows.
- **Smart CSV Editor** — Natural language instructions (local Gemma 2 AI) to clean and transform data.
- **CSV Generator** — Generate synthetic CSV data with 30+ data types, up to 20M rows (~1GB), powered by Web Workers.
- **Anonymizer** — NATO phonetic alphabet encoding with auto-scaling digit precision. Reversible with key file.

### Other Tools
- **File Viewer** — Preview spreadsheets, documents, images, audio, and video locally. "Open in" sends files to any other tool.
- **Image to Text (OCR)** — Extract text from images and PDFs (page-to-image conversion) using Tesseract.js.
- **Converter** — Convert between CSV, Excel, PDF, DOCX, Image, and Audio formats using FFmpeg WASM.
- **Metadata & Hash** — View EXIF data, hidden metadata, and scramble file hashes.
- **Compressor** — ZIP, GZIP, or lossy media compression.
- **AI Chat** — Gemma 2 LLM running locally via WebGPU.

## API

RESTful API for server-side processing. Endpoints for CSV merge/join/diff/anonymize, file conversion (spreadsheet, image, document, audio), and compression. Supports files up to 1GB via encrypted R2 storage. Zero data retention — files are processed in memory and discarded after the response.

See [API docs](https://localdatatools.com/api-docs).

## Security & Privacy
- **100% Offline Capable** — All browser tools work without internet after initial load.
- **Zero Data Upload** — Files never leave your device for browser tools.
- **Encrypted at Rest** — API large file results use AES-256 encryption via R2.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **API**: Hono, Node.js, Sharp, FFmpeg, SheetJS
- **AI/ML**: WebLLM (@mlc-ai/web-llm), Tesseract.js
- **Data**: SheetJS (XLSX), PDF.js, Mammoth.js
- **Media**: FFmpeg WebAssembly (@ffmpeg/ffmpeg)
- **Infra**: Google Cloud Run, Cloudflare R2

## License

MIT License