# Local Data Tools

**Secure, offline-first data processing suite.**

Local Data Tools is a powerful web application designed for data professionals who need to process sensitive information without uploading it to the cloud. All operations—merging, cleaning, analyzing, and AI processing—happen entirely within your browser using WebAssembly and WebGPU technologies.

## 🚀 Features

### 🛠️ Data Utilities
- **Dashboard**: Auto-generate BI dashboards with interactive charts from any CSV file.
- **CSV Fusion**: Merge massive CSV files (1GB+) via column join (SQL-style) or row append.
- **CSV Diff**: Compare two datasets to identify added, removed, or modified rows instantly.
- **Smart CSV Editor**: Use natural language instructions (powered by local Gemma 2 AI) to clean and transform data.
- **Image to Text (OCR)**: Extract text from images and screenshots using Tesseract.js.
- **Converter**: Convert between CSV, Excel, PDF, DOCX, and Image formats.
- **File Viewer**: Securely preview spreadsheets, documents, and code files locally.
- **Anonymizer**: Sanitize sensitive columns with reversible logic and generate a restoration key.
- **Metadata & Hash**: View EXIF data, hidden metadata, and scramble file hashes for privacy.
- **Compressor**: Optimize files for storage using ZIP, GZIP, or lossy media compression.
- **AI Chat**: Interact with Google's Gemma 2 LLM running locally via WebGPU for analysis and coding assistance.

### 🔒 Security & Privacy
- **100% Offline Capable**: All tools work without an internet connection after initial load.
- **Zero Data Upload**: Your files never leave your device; processing is performed locally using WebAssembly and WebGPU.

## 💻 Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **AI/ML**: WebLLM (@mlc-ai/web-llm), Tesseract.js
- **Data Processing**: SheetJS (XLSX), PapaParse (custom implementation), Diff engines
- **Rendering**: PDF.js, Mammoth.js, html2canvas
- **UI Components**: Lucide React, Custom Glassmorphism UI

## 📄 License

MIT License