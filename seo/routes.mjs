// Single source of truth for per-route SEO. Consumed by the build-time
// prerender plugin (seo/prerender-plugin.mjs) to emit one static HTML file
// per route and to regenerate sitemap.xml. Keep slugs in sync with the
// TOOL_SLUGS map in App.tsx.
export const SITE = { origin: 'https://localdatatools.com' };

const PRIORITY = {
  '': '1.0',
  'csv-fusion': '0.9',
  ocr: '0.9',
  dashboard: '0.8',
  'csv-diff': '0.8',
  'smart-csv-editor': '0.8',
  'csv-generator': '0.8',
  converter: '0.8',
  anonymizer: '0.8',
  viewer: '0.7',
  metadata: '0.7',
  compressor: '0.7',
  'ai-chat': '0.7',
};

const DATA = [
  {
    "slug": "",
    "title": "Local Data Tools — Private In-Browser CSV & File Toolkit",
    "metaDescription": "Merge and compare CSVs, convert files, run OCR, compress, and anonymize data right in your browser. No uploads, works offline, free and no sign-up.",
    "h1": "Data tools that run in your browser, not on someone's server",
    "intro": "Every tool here does its work locally: your files are read by JavaScript and WebAssembly inside the tab and never leave your machine. Merge or diff two CSVs, clean and edit rows, convert between document, image, audio, and video formats, pull text out of scans with OCR, strip metadata, hash files, compress, or anonymize columns before you share them. There's also a local Gemma AI chat that runs on your GPU via WebGPU, so even the AI features stay offline. Close the tab and nothing is left behind on any server.",
    "features": [
      "CSV suite: merge on a key, diff two files row by row, edit and filter, or generate realistic test data",
      "Convert documents, images, audio, and video, plus OCR to turn scans and photos into editable text",
      "Anonymize columns, strip file metadata, and generate hashes before you hand data to anyone else",
      "Runs offline after first load, including a local Gemma AI chat on your own GPU via WebGPU"
    ],
    "faqs": [
      { "q": "Are my files uploaded anywhere?", "a": "No. Every tool processes files inside your browser tab using WebAssembly. Nothing is sent to a server, so your data stays on your device even for the AI chat." },
      { "q": "Do I need to install anything or sign up?", "a": "No install and no account. Open the page in a modern browser and start working. After the first visit most tools keep working with no connection." },
      { "q": "Is it really free, and what's the catch?", "a": "It's free with no sign-up. Because processing happens on your machine, there are no per-file server costs to pass on and no reason to collect your data." }
    ],
    "keywords": ["merge csv files online","compare two csv files","offline csv tool","in-browser file converter","image to text ocr","anonymize csv data","private data tools no upload","local ai chat webgpu"]
  },
  {
    "slug": "dashboard",
    "title": "Instant Dashboard: Free CSV to BI Dashboard in Browser",
    "metaDescription": "Turn a CSV or Excel file into an interactive BI dashboard in your browser. KPI tiles, charts, and tables with zero uploads. Free, private, works offline.",
    "h1": "Instant Dashboard: Build BI Dashboards From a CSV, No Upload Needed",
    "intro": "Drop in a CSV or Excel file and get a working dashboard in seconds: KPI tiles for your key numbers, charts to spot trends, and a live data table to sift through rows. Instant Dashboard reads your columns, figures out which are numbers and which are categories, and suggests widgets you can tweak or rearrange. Everything runs on your machine, so a spreadsheet of sales figures or user data never leaves the browser tab. Save your layout as a config file and reload it later to rebuild the same view on new data.",
    "features": [
      "Automatic column analysis detects numeric, categorical, and date fields, then proposes matching charts and KPIs so you're not starting from a blank canvas",
      "Interactive KPI tiles, bar charts, and sortable data tables you can filter, edit, and drag into multiple dashboard spaces",
      "Handles up to 50,000 rows locally via WebAssembly, and takes CSV or Excel (.xlsx/.xls) without a database or account",
      "Export and re-import your dashboard config as a file to apply the same layout to fresh exports each week"
    ],
    "faqs": [
      { "q": "Is my data uploaded anywhere?", "a": "No. The file is parsed and charted entirely in your browser. Nothing is sent to a server, so it works with confidential data and even offline once the page has loaded." },
      { "q": "What file types can I turn into a dashboard?", "a": "CSV files plus Excel spreadsheets (.xlsx and .xls). It auto-detects the delimiter for CSVs, so semicolon or tab-separated files work too." },
      { "q": "How big a file can it handle?", "a": "It processes up to 50,000 rows for charts and stats. Larger files still load, but calculations use the first 50,000 rows to keep the dashboard responsive." }
    ],
    "keywords": ["CSV to dashboard","instant BI dashboard","dashboard from CSV in browser","Excel dashboard generator","free CSV visualization tool","offline dashboard maker","KPI dashboard from spreadsheet","no-upload data dashboard"]
  },
  {
    "slug": "csv-fusion",
    "title": "CSV Fusion — Merge & Append CSVs in Your Browser",
    "metaDescription": "Merge or append large CSV files right in your browser. No uploads, no sign-up, works offline. Join on a key column or stack rows, then export.",
    "h1": "CSV Fusion: Merge and Append CSV Files In-Browser",
    "intro": "CSV Fusion combines multiple CSV files without sending a single row to a server. Append files to stack their rows into one dataset, or merge on a shared key column to join records the way a VLOOKUP or SQL JOIN would. Because the parsing runs on WebAssembly in your own tab, files that choke a spreadsheet — hundreds of thousands of rows, mismatched headers, oddly delimited exports — process locally and stay on your machine.",
    "features": [
      "Two modes: append rows from many files into one, or merge on a key column to join matching records",
      "Handles mismatched headers and column order — map fields instead of forcing identical layouts",
      "Processes large files locally with WebAssembly, so nothing gets uploaded and it keeps working offline",
      "Preview the combined result and export a clean CSV in a couple of clicks"
    ],
    "faqs": [
      { "q": "What's the difference between merging and appending CSVs?", "a": "Appending stacks rows: two files with the same columns become one longer file. Merging joins on a key column, matching rows across files by a shared value like an ID or email — closer to a SQL JOIN or VLOOKUP." },
      { "q": "Can it merge CSVs with different column names or order?", "a": "Yes. You map which columns line up instead of needing identical headers, so exports from different tools can still be combined." },
      { "q": "Is there a file size or row limit?", "a": "No fixed cap. Processing happens in your browser, so the practical limit is your device's memory. Files with hundreds of thousands of rows work fine on most machines." }
    ],
    "keywords": ["merge csv files","append csv files","combine csv online","join csv on key column","csv merger in browser","merge large csv files","offline csv tool","concatenate csv"]
  },
  {
    "slug": "csv-diff",
    "title": "CSV Diff — Compare Two CSV Files in Your Browser",
    "metaDescription": "Compare two CSV files and see added, removed, and changed rows side by side. Runs entirely in your browser, no upload, free and private.",
    "h1": "CSV Diff: Compare Two CSV Files Row by Row",
    "intro": "Drop in two CSV files and CSV Diff shows exactly what changed between them: rows that were added, rows that disappeared, and rows where a cell value was edited. Pick a key column (like an ID or email) so matching rows line up even when the order differs between exports. Because the comparison happens locally in JavaScript, your files never leave the tab, which matters when you're diffing customer lists, financial exports, or anything you'd rather not hand to a random web app.",
    "features": [
      "Match rows by a key column so reordered or re-sorted exports still compare correctly",
      "Cell-level highlighting shows the old and new value for every modified field",
      "Handles large files without a server round-trip since parsing runs in your browser",
      "Export the added, removed, and changed rows as separate CSVs for follow-up work"
    ],
    "faqs": [
      { "q": "Are my CSV files uploaded anywhere?", "a": "No. Both files are read and compared entirely in your browser using WebAssembly and JavaScript. Nothing is sent to a server, so you can even run it offline." },
      { "q": "How does it match rows between the two files?", "a": "You choose a key column, such as an ID or email, and rows with the same key are paired up and compared cell by cell. Without a key it falls back to matching identical full rows." },
      { "q": "What's the difference between a modified row and an added or removed one?", "a": "A modified row exists in both files with the same key but has at least one different cell. Added rows appear only in the second file, removed rows only in the first." }
    ],
    "keywords": ["csv diff","compare two csv files","csv comparison tool","diff csv online","find changes between csv files","csv row comparison","compare csv in browser","free csv diff tool"]
  },
  {
    "slug": "smart-csv-editor",
    "title": "Smart CSV Editor — Edit CSVs by Typing Plain English",
    "metaDescription": "Clean and reshape CSV or Excel files by typing plain English. A local AI writes the transform and runs it in your browser. No uploads, free.",
    "h1": "Smart CSV Editor: Transform Datasets With Plain English",
    "intro": "Describe the change you want in plain English, like \"drop rows where status is empty\" or \"split full name into first and last,\" and a local AI writes the transformation and runs it on your data. The model (Gemma via WebGPU) and your file both stay on your machine, so even messy internal exports never touch a server. Every step is undoable, and you can read the generated code before applying it. Works on CSV and Excel files, including large ones that get processed in chunks so the tab stays responsive.",
    "features": [
      "Type instructions in normal language; the AI turns them into a column transform and runs it in a background worker",
      "See the exact generated code before it touches your data, and undo any step to walk back changes",
      "Handles CSV and Excel, with chunked parsing so files with hundreds of thousands of rows don't freeze the page",
      "Runs entirely offline on a local Gemma model over WebGPU, with nothing uploaded and no account required"
    ],
    "faqs": [
      { "q": "Does my CSV get uploaded to an AI service?", "a": "No. The Gemma model runs in your browser through WebGPU, and your file is parsed and edited locally. Nothing leaves your device, so it works with confidential data and even offline once the model is cached." },
      { "q": "Can I see what the AI does before it changes my data?", "a": "Yes. The tool shows the JavaScript transformation it generated for each instruction. You review it, apply it, and undo it if the result isn't what you wanted." },
      { "q": "How big a file can it handle?", "a": "Large CSVs are parsed and transformed in chunks inside a web worker, so files with hundreds of thousands of rows keep working without freezing the browser tab." }
    ],
    "keywords": ["smart csv editor","edit csv with ai","natural language csv transform","clean csv in browser","local ai data cleaning","offline csv editor","transform csv without uploading","ai spreadsheet editor"]
  },
  {
    "slug": "csv-generator",
    "title": "Free CSV Generator — Realistic Mock Data in Your Browser",
    "metaDescription": "Generate CSV test data with names, emails, dates, prices, and UUIDs. Set columns, row counts, null rates, and unique keys. Runs in your browser, no upload.",
    "h1": "CSV Generator: Build Realistic Mock Data Sets",
    "intro": "Need a CSV full of believable-looking records to test an import, seed a demo, or stress a query? Pick your columns from 25+ data types (first and last names, emails, phone numbers, addresses, dates, prices, UUIDs, IP addresses, sequences, and custom lists), set how many rows you want, and download the file. Every value is generated locally in your browser with JavaScript, so no real data is involved and nothing touches a server. Start from a ready-made preset like users, orders, or companies, then rename columns and adjust types to match your schema.",
    "features": [
      "Choose from 25+ field types across Person, Business, Location, Number, and DateTime categories, or feed your own comma-separated list of values",
      "Control the shape of each column: mark IDs as unique, add a null percentage to simulate missing data, and set min/max ranges for numbers and prices",
      "One-click presets for common tables (user accounts, e-commerce orders, company records) that you can rename and reshape",
      "Generates thousands of rows instantly in-browser with zero uploads, so mock data with fake PII never leaves your machine"
    ],
    "faqs": [
      { "q": "Is the generated data actually random or from a template?", "a": "It's freshly generated each run. Names, emails, addresses, and dates are assembled from realistic value pools, and numeric fields draw from the min/max range you set, so every download is a different data set." },
      { "q": "Can I make a column with unique values for use as a primary key?", "a": "Yes. Toggle 'unique' on any column and each row gets a distinct value. Use the sequence type for clean 1, 2, 3 IDs or UUID for globally unique keys." },
      { "q": "Does my mock data get uploaded anywhere?", "a": "No. The entire CSV is built in your browser and saved straight to your downloads. There's no server, no account, and it keeps working offline once the page has loaded." }
    ],
    "keywords": ["csv generator","mock data generator","fake csv data","test data generator","generate csv file","sample csv data","dummy data csv","random data generator"]
  },
  {
    "slug": "anonymizer",
    "title": "Data Anonymizer — Reversible Masking in Your Browser",
    "metaDescription": "Anonymize names, emails, and IDs in CSVs right in your browser. Reversible key mapping lets you restore originals later. No uploads, free, works offline.",
    "h1": "Data Anonymizer",
    "intro": "Replace real names, emails, phone numbers, and IDs with consistent placeholder values so you can share a dataset without exposing anyone. Each original value maps to the same token every time, so joins and grouping still work on the masked file. The tool saves a key file that lets you reverse the swap later — hand the anonymized data to a colleague, then re-identify records yourself when you get results back. Everything runs in your browser, so the sensitive column never leaves your machine.",
    "features": [
      "Reversible by design: export a key file and restore original values whenever you need them",
      "Consistent tokens — the same email always maps to the same placeholder, so lookups and joins survive",
      "Pick which columns to scrub and which to leave untouched",
      "Runs fully offline in your browser; the raw data and the key never touch a server"
    ],
    "faqs": [
      { "q": "Can I reverse the anonymization to get the original data back?", "a": "Yes. The tool generates a key file that maps each placeholder to its original value. Keep that file private, and you can restore the real data anytime. Without the key, the masked file can't be reversed." },
      { "q": "Is my data uploaded anywhere?", "a": "No. All masking and key generation happen locally in your browser using WebAssembly. Your file and the reversal key never get sent to any server, so it's safe for regulated or confidential data." },
      { "q": "Will the anonymized values stay consistent across rows?", "a": "Yes. Each unique input maps to one fixed token, so a customer that appears 50 times becomes the same placeholder 50 times. Counts, groupings, and joins on the masked column still work." }
    ],
    "keywords": ["data anonymizer","csv anonymization tool","reversible data masking","pseudonymization","anonymize csv online","in-browser data masking","gdpr data anonymization","de-identify csv"]
  },
  {
    "slug": "ocr",
    "title": "Image to Text (OCR) — Free In-Browser Extractor",
    "metaDescription": "Extract text from screenshots, photos, and scanned PDFs right in your browser with local Tesseract OCR. No uploads, no sign-up, fully private and free.",
    "h1": "Image to Text (OCR)",
    "intro": "Pull the text out of a screenshot, a photo of a receipt, or a scanned document without sending a single pixel to a server. This tool runs Tesseract OCR directly in your browser, so your images stay on your machine even when you're offline. Drop in PNGs, JPGs, or multi-page PDFs and copy the recognized text, page by page or all at once. For messy handwriting or low-contrast scans, an optional AI mode can sharpen the results.",
    "features": [
      "Runs Tesseract locally in your browser — no upload, works offline, nothing leaves your device",
      "Reads screenshots, photos, PNG/JPG images, and multi-page PDFs (rendered at 2x for cleaner recognition)",
      "Copy text per image or grab everything at once; English and Russian recognition built in",
      "Optional cloud AI mode for handwriting and low-quality scans when local OCR isn't enough"
    ],
    "faqs": [
      { "q": "Are my images uploaded anywhere?", "a": "No. Basic OCR runs entirely in your browser with Tesseract, so images never leave your computer. Only the optional AI mode sends data out, and that's clearly a separate choice." },
      { "q": "Can it extract text from a scanned PDF?", "a": "Yes. Drop in a PDF and each page is converted to a high-resolution image, then run through OCR so you get selectable, copyable text from every page." },
      { "q": "Does it work on handwriting?", "a": "Local Tesseract is built for printed text and struggles with handwriting. For handwritten notes or blurry scans, switch to the optional AI mode for better accuracy." }
    ],
    "keywords": ["image to text","OCR in browser","extract text from screenshot","free OCR tool","Tesseract OCR online","scanned PDF to text","offline OCR","picture to text converter"]
  },
  {
    "slug": "converter",
    "title": "File Converter — CSV, XLSX, PDF, Images, Free & In-Browser",
    "metaDescription": "Convert CSV, XLSX, PDF, DOCX, HEIC, and images right in your browser. No uploads, no sign-up, works offline. Batch convert files free with total privacy.",
    "h1": "Free File Converter — Convert CSV, XLSX, PDF & Images in Your Browser",
    "intro": "Drop in a file and get it back in the format you need — CSV to XLSX, XLSX to CSV, DOCX to PDF, HEIC to JPG, PNG to WebP, and more. Every conversion runs on your own machine using WebAssembly, so your spreadsheets and photos never leave the browser or touch a server. Drag in a whole batch and convert them in one pass; because there's no upload step, even large files finish as fast as your CPU allows. Works offline once the page has loaded.",
    "features": [
      "Convert between CSV, XLSX, XLS, PDF, DOCX, and Markdown without a spreadsheet app installed",
      "Turn HEIC iPhone photos into JPG, or swap between PNG, JPG, WebP, and SVG in seconds",
      "Batch-convert dozens of files at once and download them together as a zip",
      "Runs entirely in-browser via WebAssembly — nothing uploaded, works offline, no account"
    ],
    "faqs": [
      { "q": "Are my files uploaded anywhere when I convert them?", "a": "No. The converter runs completely inside your browser using WebAssembly. Your files are read and rewritten locally, and nothing is ever sent to a server — you can even disconnect from the internet and it still works." },
      { "q": "Can I convert HEIC photos from my iPhone to JPG?", "a": "Yes. Drop in HEIC files and convert them to JPG right in the browser. You can also convert between PNG, JPG, WebP, and SVG the same way." },
      { "q": "Is there a file size or row limit for spreadsheets?", "a": "You can convert large files, though XLSX caps out at 1,048,576 rows. If a CSV exceeds that, the tool warns you before converting instead of crashing halfway through." }
    ],
    "keywords": ["file converter","csv to xlsx converter","xlsx to csv","heic to jpg","docx to pdf converter","convert files in browser","offline file converter","batch file converter"]
  },
  {
    "slug": "viewer",
    "title": "File Viewer — Preview Files in Your Browser",
    "metaDescription": "Open CSV, Excel, PDF, DOCX, JSON, images, audio and video right in your browser. Nothing uploads, works offline, and no sign-up. Free and private.",
    "h1": "File Viewer: Preview Any File Locally, No Upload",
    "intro": "Drop in a spreadsheet, PDF, document, image, or media file and see it instantly without an app or a server round-trip. The File Viewer reads everything in your browser tab, so a confidential client XLSX or a sensitive PDF never leaves your machine. Switch between sheets in a workbook, scroll large tables, and export the view back out to CSV or XLSX when you need it. Handy when you get a file in an odd format and just want to look inside before deciding what to do with it.",
    "features": [
      "Handles CSV, XLSX, XLS, ODS, PDF, DOCX, TXT, Markdown, JSON, code, images, audio, and video from one page",
      "Multi-sheet workbooks show a tab per sheet, so you can jump between them without opening Excel",
      "Export what you see back to CSV or XLSX, or convert a spreadsheet between the two formats",
      "Every file is parsed locally in your browser, so nothing is uploaded and it keeps working offline"
    ],
    "faqs": [
      { "q": "Does the File Viewer upload my files anywhere?", "a": "No. Files are read and rendered entirely inside your browser tab using WebAssembly. Nothing is sent to a server, so it works offline and your data stays on your device." },
      { "q": "What file types can it open?", "a": "Spreadsheets (CSV, XLSX, XLS, ODS), documents (PDF, DOCX, TXT, Markdown), data and code (JSON, JS, TS, HTML, CSS, XML, logs), plus images, audio, and video." },
      { "q": "Can I open large spreadsheets without it freezing?", "a": "Yes. Big tables render in chunks and load more rows as you scroll, so wide multi-sheet workbooks stay responsive instead of locking up the tab." }
    ],
    "keywords": ["online file viewer","preview csv in browser","view xlsx without excel","open pdf online no upload","private file viewer","offline document viewer","view json file","local spreadsheet viewer"]
  },
  {
    "slug": "metadata",
    "title": "Metadata & Hash Inspector — View EXIF, Scramble Hashes",
    "metaDescription": "See the hidden EXIF data buried in your photos and give each file a fresh SHA-256 hash. Runs fully in your browser, no uploads, free.",
    "h1": "Metadata & Hash Inspector",
    "intro": "Every photo you take carries a trail you can't see: GPS coordinates, camera serial numbers, timestamps, and the software that touched it. This tool reads that EXIF data straight out of the file and shows you exactly what's in there. It also computes each file's SHA-256 hash and can scramble it, generating byte-different copies that no longer match the original fingerprint. Drop in one image or a whole batch and everything is processed locally by your browser.",
    "features": [
      "Reads full EXIF: GPS location, camera make and model, capture date, lens, and editing software",
      "Computes SHA-256 hashes and scrambles them so each copy has a unique fingerprint",
      "Batch mode: make multiple hash-unique copies at once with optional date randomization and renaming",
      "Nothing leaves your device. EXIF parsing and hashing happen in the browser, so location data stays private"
    ],
    "faqs": [
      { "q": "What metadata is hidden in my photos?", "a": "Images usually store EXIF data: the GPS coordinates where the shot was taken, camera make and model, serial number, exposure settings, the exact timestamp, and which app last edited the file. This tool surfaces all of it so you can see what you'd be sharing." },
      { "q": "Why would I want to change a file's hash?", "a": "A hash is a fingerprint. Two identical files share one, which is how systems detect duplicates. Scrambling the hash writes a tiny harmless change so each copy reads as a distinct file while looking visually identical." },
      { "q": "Are my images uploaded anywhere?", "a": "No. All EXIF reading, SHA-256 hashing, and scrambling run inside your browser using WebAssembly. Your files and their GPS data never touch a server, and it works offline." }
    ],
    "keywords": ["view exif data","photo metadata viewer","scramble file hash","sha-256 hash generator","remove gps from photo","change file hash online","make image unique","exif inspector browser"]
  },
  {
    "slug": "compressor",
    "title": "Free File Compressor — Zip & Shrink Files in Browser",
    "metaDescription": "Compress files and build ZIP archives right in your browser. Shrink images and bundle folders locally — no uploads, no sign-up, works offline. Free.",
    "h1": "File Compressor",
    "intro": "Bundle a pile of files into a single ZIP or squeeze down bloated images without sending anything to a server. Everything runs in your browser tab using WebAssembly, so a 200MB folder of photos never leaves your laptop. Drop in files, pick your compression level, and download the result — no account, no queue, no upload progress bar to babysit. It keeps working even with your Wi-Fi off.",
    "features": [
      "Build ZIP archives from multiple files or whole folders in one drag-and-drop",
      "Optimize JPEG, PNG, and WebP images with adjustable quality to cut file size",
      "Choose your compression level, from fast-and-light to maximum squeeze",
      "Runs fully offline in-browser — large files never touch a server"
    ],
    "faqs": [
      { "q": "Are my files uploaded anywhere when I compress them?", "a": "No. All compression happens inside your browser tab with WebAssembly. Your files stay on your device and are never sent to us or any server." },
      { "q": "What file types can I compress?", "a": "You can ZIP any file type — documents, PDFs, code, video, whatever. For image optimization, JPEG, PNG, and WebP are supported with adjustable quality settings." },
      { "q": "Is there a file size limit?", "a": "There's no server limit since nothing is uploaded. The practical ceiling is your device's available memory, so very large batches depend on your computer's RAM." }
    ],
    "keywords": ["file compressor","compress files in browser","create zip online","image optimizer","offline file compression","compress images no upload","zip files locally","private file compressor"]
  },
  {
    "slug": "ai-chat",
    "title": "Local AI Chat — Private In-Browser AI, No Uploads",
    "metaDescription": "Chat with a real AI model running entirely in your browser. Drop in images for local OCR, keep full conversation context, no uploads or sign-up. Free.",
    "h1": "Local AI Chat",
    "intro": "Local AI Chat runs a Gemma model directly on your machine through WebGPU, so every message and image you share stays on your device. Attach a screenshot or scanned page and it reads the text with in-browser OCR, then answers using the rest of your conversation as context. The model (about 1.9 GB) downloads once and is cached, so after that you can chat with no network connection at all. Nothing is sent to a server, logged, or used for training.",
    "features": [
      "Runs a full Gemma model locally via WebGPU — no API keys, no per-message cost, no data leaving your browser",
      "Drop in images and it extracts the text with on-device OCR, so you can ask questions about screenshots, receipts, or scanned docs",
      "Keeps the whole thread as context, so follow-up questions and references to earlier messages just work",
      "Works offline after the one-time model download, and you can set a custom system instruction to steer its tone and role"
    ],
    "faqs": [
      { "q": "Is my chat data private?", "a": "Yes. The model runs inside your browser tab on your own GPU. Your messages and any images you attach never touch a server, so there is nothing to leak, log, or train on." },
      { "q": "Do I need an internet connection to use it?", "a": "Only for the first load, which downloads the model (around 1.9 GB) and caches it. After that the chat works fully offline." },
      { "q": "What are the image uploads used for?", "a": "Images are processed locally with OCR to pull out their text, which the AI then uses to answer you. The files stay on your device and are never sent anywhere." }
    ],
    "keywords": ["local ai chat","in-browser ai","offline ai chat","private ai assistant","webgpu llm","gemma browser","ocr image chat","no upload ai"]
  }
];

export const ROUTES = DATA.map((r) => ({
  ...r,
  path: r.slug ? `/${r.slug}` : '/',
  priority: PRIORITY[r.slug] || '0.8',
}));
