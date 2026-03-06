import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Lock, Zap, Shield, Code, Key, Loader2, MessageCircle } from 'lucide-react';

const API_BASE = 'https://api.localdatatools.com';

const NAV_SECTIONS = [
  {
    group: 'Getting Started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'api-key', label: 'API Key' },
    ],
  },
  {
    group: 'CSV',
    items: [
      { id: 'csv-merge-join', label: 'Merge & Join' },
      { id: 'csv-compare', label: 'Compare' },
      { id: 'csv-anonymize', label: 'Anonymize' },
    ],
  },
  {
    group: 'Conversion',
    items: [
      { id: 'convert-spreadsheet', label: 'Spreadsheet' },
      { id: 'convert-image', label: 'Image' },
      { id: 'convert-document', label: 'Document' },
      { id: 'convert-audio', label: 'Audio' },
    ],
  },
  {
    group: 'Compression',
    items: [
      { id: 'compression', label: 'Compress' },
    ],
  },
  {
    group: '',
    items: [
      { id: 'examples', label: 'Code Examples' },
    ],
  },
];

// ─── Reusable components ───

const CodeBlock = ({ children }: { children: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-gray-950 border border-white/[0.06] rounded-xl p-4 overflow-x-auto text-sm text-gray-300 font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
      <button onClick={copy} className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-800 border border-white/10 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
};

const Badge = ({ type }: { type: 'json' | 'file' | 'csv' }) => {
  const styles = {
    json: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    file: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    csv: 'bg-green-500/10 text-green-400 border-green-500/20',
  };
  const labels = { json: 'JSON', file: 'Binary', csv: 'CSV' };
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border ${styles[type]}`}>{labels[type]}</span>;
};

const Endpoint = ({ method, path, responseType }: { method: string; path: string; responseType?: 'json' | 'file' | 'csv' }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider ${method === 'POST' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{method}</span>
    <code className="text-white font-mono text-sm">{path}</code>
    {responseType && <Badge type={responseType} />}
  </div>
);

const ParamTable = ({ params }: { params: { name: string; type: string; required?: boolean; desc: string }[] }) => (
  <div className="mb-5">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Parameters</p>
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      {params.map(({ name, type, required, desc }, i) => (
        <div key={name} className={`flex items-start gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
          <div className="w-36 shrink-0 flex items-center gap-2">
            <code className="text-cyan-400 text-xs">{name}</code>
            {required && <span className="text-[9px] text-red-400 font-bold">REQUIRED</span>}
          </div>
          <span className="text-gray-600 text-xs w-16 shrink-0">{type}</span>
          <span className="text-gray-400 text-xs">{desc}</span>
        </div>
      ))}
    </div>
  </div>
);

const KeyGenerator = ({ onKeyGenerated }: { onKeyGenerated: (key: string) => void }) => {
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setError('');
    setApiKey('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `email=${encodeURIComponent(email)}`,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to generate key.'); return; }
      setApiKey(data.apiKey);
      onKeyGenerated(data.apiKey);
    } catch { setError('Network error. Try again.'); }
    finally { setLoading(false); }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900/50 border border-white/[0.06] rounded-2xl p-6 space-y-4">
      {!apiKey ? (
        <div className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder="you@example.com"
            className="flex-1 bg-gray-950 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
          />
          <button
            onClick={generate}
            disabled={loading}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
            Generate Key
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Your API key:</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-gray-950 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-cyan-400 font-mono select-all">{apiKey}</code>
            <button onClick={copyKey} className="p-3 rounded-xl bg-gray-800 border border-white/10 text-gray-400 hover:text-white transition-all">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-amber-400/80">Save this key now — it won't be shown again.</p>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

// ─── Page sections ───

const OverviewPage = () => (
  <div className="space-y-6">
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-white">API Reference</h1>
      <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
        The Local Data Tools API lets you process files programmatically — merge CSVs, convert between formats (images, audio, documents, spreadsheets), compress files, and anonymize data. All processing happens server-side with no data retained after the response.
      </p>
    </div>

    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">How it works</p>
      <p className="text-gray-400 text-sm leading-relaxed">
        Upload files via <code className="text-cyan-400 bg-gray-900 px-1.5 py-0.5 rounded">multipart/form-data</code>, get results back — either as a downloadable file (CSV, XLSX, PNG, MP3, etc.) or JSON metadata. Authenticate with an API key in the <code className="text-cyan-400 bg-gray-900 px-1.5 py-0.5 rounded">X-API-Key</code> header.
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4">
        <p className="text-white font-bold text-xs mb-1">Base URL</p>
        <code className="text-cyan-400 text-xs">{API_BASE}</code>
      </div>
      <div className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4">
        <p className="text-white font-bold text-xs mb-1">Rate Limit</p>
        <p className="text-gray-400 text-xs">30 requests per minute per key</p>
      </div>
      <div className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4">
        <p className="text-white font-bold text-xs mb-1">Max File Size</p>
        <p className="text-gray-400 text-xs">50MB per request</p>
      </div>
      <div className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4">
        <p className="text-white font-bold text-xs mb-1">Endpoints</p>
        <p className="text-gray-400 text-xs">14 across CSV, conversion, compression</p>
      </div>
    </div>

    <div className="bg-gray-950 border border-white/[0.06] rounded-xl p-4 space-y-2">
      <p className="text-white font-bold text-xs">Errors</p>
      <p className="text-gray-400 text-xs">All errors return JSON with an <code className="text-cyan-400">error</code> field and an HTTP status code.</p>
      <CodeBlock>{`{"error": "Invalid API key."}     // 401
{"error": "Rate limit exceeded."} // 429
{"error": "File exceeds 50MB."}   // 400`}</CodeBlock>
    </div>
  </div>
);

const ApiKeyPage = ({ generatedKey, setGeneratedKey }: { generatedKey: string; setGeneratedKey: (k: string) => void }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">API Key</h1>
    <p className="text-gray-400">Every request requires an API key passed via the <code className="text-cyan-400 bg-gray-900 px-2 py-0.5 rounded text-sm">X-API-Key</code> header. Generate one for free below — no sign-up required.</p>

    <KeyGenerator onKeyGenerated={setGeneratedKey} />
    {generatedKey && <p className="text-xs text-cyan-400/60">Key applied to all code examples across the docs.</p>}
  </div>
);

const CsvMergeJoinPage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-12">
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-white">CSV Merge & Join</h1>
      <p className="text-gray-400">Combine CSV files — stack them vertically (merge) or link them on a key column (join). Analyze headers and inspect metadata before combining.</p>
    </div>

    {/* Analyze */}
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white border-b border-white/[0.06] pb-3">Analyze</h2>
      <p className="text-gray-400 text-sm">Check if multiple CSV files have compatible headers before merging.</p>
      <Endpoint method="POST" path="/v1/csv/analyze" responseType="json" />
      <ParamTable params={[
        { name: 'files', type: 'file[]', required: true, desc: 'Two or more CSV files to check compatibility' },
      ]} />
      <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "files=@file1.csv" -F "files=@file2.csv" \\
  ${API_BASE}/v1/csv/analyze`)}</CodeBlock>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Response</p>
      <CodeBlock>{`{
  "primary": "file1.csv",
  "primaryHeaders": ["id", "name", "age"],
  "results": [{"file": "file2.csv", "compatible": true, "reason": "Compatible"}],
  "canMerge": true
}`}</CodeBlock>
    </div>

    {/* Metadata */}
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white border-b border-white/[0.06] pb-3">Metadata</h2>
      <p className="text-gray-400 text-sm">Extract column types, row counts, null rates, and summary statistics from a CSV file.</p>
      <Endpoint method="POST" path="/v1/csv/metadata" responseType="json" />
      <ParamTable params={[
        { name: 'file', type: 'file', required: true, desc: 'CSV file to inspect' },
      ]} />
      <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "file=@data.csv" \\
  ${API_BASE}/v1/csv/metadata`)}</CodeBlock>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Response</p>
      <CodeBlock>{`{
  "fileName": "data.csv",
  "rowCount": 1000,
  "columnCount": 4,
  "columns": [
    {"header": "age", "type": "integer", "min": 18, "max": 65, "mean": 34.2},
    {"header": "email", "type": "string", "nullRate": 0.02, "unique": 980}
  ]
}`}</CodeBlock>
    </div>

    {/* Merge */}
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white border-b border-white/[0.06] pb-3">Merge</h2>
      <p className="text-gray-400 text-sm">Stack multiple CSV files vertically. The first file's headers are used for the output.</p>
      <Endpoint method="POST" path="/v1/csv/merge" responseType="csv" />
      <ParamTable params={[
        { name: 'files', type: 'file[]', required: true, desc: 'Two or more CSV files to merge' },
      ]} />
      <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "files=@file1.csv" -F "files=@file2.csv" \\
  ${API_BASE}/v1/csv/merge > merged.csv`)}</CodeBlock>
    </div>

    {/* Join */}
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white border-b border-white/[0.06] pb-3">Join</h2>
      <p className="text-gray-400 text-sm">Left or inner join two CSV files on a key column.</p>
      <Endpoint method="POST" path="/v1/csv/join" responseType="csv" />
      <ParamTable params={[
        { name: 'left', type: 'file', required: true, desc: 'Left CSV file' },
        { name: 'right', type: 'file', required: true, desc: 'Right CSV file' },
        { name: 'left_key', type: 'string', required: true, desc: 'Join column in left file' },
        { name: 'right_key', type: 'string', required: true, desc: 'Join column in right file' },
        { name: 'join_type', type: 'string', desc: 'left (default) or inner' },
        { name: 'case_sensitive', type: 'string', desc: 'true (default) or false' },
      ]} />
      <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "left=@employees.csv" -F "right=@salaries.csv" \\
  -F "left_key=id" -F "right_key=emp_id" \\
  ${API_BASE}/v1/csv/join > joined.csv`)}</CodeBlock>
    </div>

    {/* Large Files */}
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white border-b border-white/[0.06] pb-3">Large Files (50MB–1GB)</h2>
      <p className="text-gray-400 text-sm">For files over 50MB, use the encrypted job endpoints. Same parameters as merge/join above — results are encrypted with AES-256-GCM and the key is only returned to you.</p>

      <div className="space-y-4">
        <div>
          <Endpoint method="POST" path="/v1/jobs/merge" responseType="json" />
          <p className="text-gray-400 text-sm">Same as <code className="text-cyan-400">/v1/csv/merge</code> — returns a job with download URL and decryption key.</p>
        </div>
        <div>
          <Endpoint method="POST" path="/v1/jobs/join" responseType="json" />
          <p className="text-gray-400 text-sm">Same as <code className="text-cyan-400">/v1/csv/join</code> — same parameters, encrypted result.</p>
        </div>
        <div>
          <Endpoint method="GET" path="/v1/jobs/:id/download?key=FILE_KEY" responseType="file" />
          <p className="text-gray-400 text-sm">Download and decrypt. One-time — file is deleted after retrieval or expires in 24h.</p>
        </div>
      </div>

      <CodeBlock>{k(`# 1. Submit large merge job
curl -H "X-API-Key: your-api-key" \\
  -F "files=@huge1.csv" -F "files=@huge2.csv" \\
  ${API_BASE}/v1/jobs/merge

# Response: {"jobId": "...", "fileKey": "...", "downloadUrl": "...", "expiresIn": "24 hours"}

# 2. Download the result
curl -H "X-API-Key: your-api-key" \\
  "${API_BASE}/v1/jobs/JOB_ID/download?key=FILE_KEY" > result.csv`)}</CodeBlock>

      <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200/70 space-y-1">
        <p className="font-bold text-amber-400">Important</p>
        <p>Save the <code className="text-amber-400">fileKey</code> — it is not stored on the server and cannot be recovered.</p>
        <p>Downloads are one-time. The file is deleted after the first successful download.</p>
      </div>
    </div>
  </div>
);

const CsvComparePage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">CSV Compare</h1>
    <p className="text-gray-400">Diff two CSV files. Returns added, removed, and changed rows.</p>
    <Endpoint method="POST" path="/v1/csv/diff" responseType="json" />
    <ParamTable params={[
      { name: 'left', type: 'file', required: true, desc: 'Original CSV file' },
      { name: 'right', type: 'file', required: true, desc: 'Updated CSV file' },
      { name: 'key', type: 'string', desc: 'Key column for row matching (enables change detection)' },
    ]} />
    <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "left=@v1.csv" -F "right=@v2.csv" -F "key=id" \\
  ${API_BASE}/v1/csv/diff`)}</CodeBlock>
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Response</p>
    <CodeBlock>{`{
  "summary": {"added": 5, "removed": 2, "changed": 3, "unchanged": 100},
  "added": [["4", "Diana", "28"]],
  "removed": [["3", "Charlie", "35"]],
  "changed": [{"key": "1", "left": ["1","Alice","30"], "right": ["1","Alice","31"]}]
}`}</CodeBlock>
  </div>
);

const CsvAnonymizePage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">CSV Anonymize</h1>
    <p className="text-gray-400">Auto-detect and mask PII — emails, phones, names, SSNs, addresses.</p>
    <Endpoint method="POST" path="/v1/csv/anonymize" responseType="csv" />
    <ParamTable params={[
      { name: 'file', type: 'file', required: true, desc: 'CSV file with PII data' },
      { name: 'columns', type: 'string', desc: 'Comma-separated column names (auto-detect if omitted)' },
      { name: 'mode', type: 'string', desc: 'mask (default) — partial masking, or redact — full replacement' },
    ]} />
    <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "file=@users.csv" -F "mode=mask" \\
  ${API_BASE}/v1/csv/anonymize > anonymized.csv`)}</CodeBlock>
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Output</p>
    <CodeBlock>{`# mode=mask
alice@test.com → a***@test.com
555-123-4567   → 5**********7
Alice Smith    → A***e S***h

# mode=redact
alice@test.com → [REDACTED]
555-123-4567   → [REDACTED]`}</CodeBlock>
  </div>
);

const ConvertSpreadsheetPage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">Spreadsheet Conversion</h1>
    <p className="text-gray-400">CSV to Excel or Excel to CSV. Auto-detects direction from file extension.</p>
    <Endpoint method="POST" path="/v1/convert/spreadsheet" responseType="file" />
    <ParamTable params={[
      { name: 'file', type: 'file', required: true, desc: '.csv, .tsv, .xlsx, or .xls file' },
      { name: 'sheet', type: 'string', desc: 'Sheet name when converting from Excel (defaults to first sheet)' },
    ]} />
    <CodeBlock>{k(`# CSV → Excel
curl -H "X-API-Key: your-api-key" \\
  -F "file=@data.csv" \\
  ${API_BASE}/v1/convert/spreadsheet > data.xlsx

# Excel → CSV
curl -H "X-API-Key: your-api-key" \\
  -F "file=@report.xlsx" -F "sheet=Sales" \\
  ${API_BASE}/v1/convert/spreadsheet > report.csv`)}</CodeBlock>
    <p className="text-gray-500 text-xs">Response headers: <code className="text-cyan-400">X-Rows</code>, <code className="text-cyan-400">X-Columns</code>, <code className="text-cyan-400">X-Sheet-Name</code></p>
  </div>
);

const ConvertImagePage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">Image Conversion</h1>
    <p className="text-gray-400">Convert between PNG, JPEG, WebP, AVIF, TIFF, GIF with optional resize.</p>
    <Endpoint method="POST" path="/v1/convert/image" responseType="file" />
    <ParamTable params={[
      { name: 'file', type: 'file', required: true, desc: 'Image file to convert' },
      { name: 'format', type: 'string', required: true, desc: 'png, jpeg, webp, avif, tiff, or gif' },
      { name: 'quality', type: 'number', desc: '1–100 (default 80). Applies to jpeg, webp, avif, tiff.' },
      { name: 'width', type: 'number', desc: 'Resize width in pixels (maintains aspect ratio)' },
      { name: 'height', type: 'number', desc: 'Resize height in pixels (maintains aspect ratio)' },
    ]} />
    <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "file=@photo.png" -F "format=webp" -F "quality=85" \\
  ${API_BASE}/v1/convert/image > photo.webp

# Resize to 800px wide
curl -H "X-API-Key: your-api-key" \\
  -F "file=@banner.jpg" -F "format=png" -F "width=800" \\
  ${API_BASE}/v1/convert/image > banner.png`)}</CodeBlock>
    <p className="text-gray-500 text-xs">Response headers: <code className="text-cyan-400">X-Original-Size</code>, <code className="text-cyan-400">X-Output-Size</code>, <code className="text-cyan-400">X-Original-Dimensions</code></p>
  </div>
);

const ConvertDocumentPage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">Document Conversion</h1>
    <p className="text-gray-400">Extract text from PDF files. Output as plain text, DOCX, or structured JSON.</p>
    <Endpoint method="POST" path="/v1/convert/document" responseType="file" />
    <ParamTable params={[
      { name: 'file', type: 'file', required: true, desc: 'PDF file to convert' },
      { name: 'format', type: 'string', desc: 'txt (default), docx, or json' },
    ]} />
    <CodeBlock>{k(`# PDF → plain text
curl -H "X-API-Key: your-api-key" \\
  -F "file=@document.pdf" \\
  ${API_BASE}/v1/convert/document > document.txt

# PDF → DOCX
curl -H "X-API-Key: your-api-key" \\
  -F "file=@document.pdf" -F "format=docx" \\
  ${API_BASE}/v1/convert/document > document.docx

# PDF → JSON (includes metadata)
curl -H "X-API-Key: your-api-key" \\
  -F "file=@document.pdf" -F "format=json" \\
  ${API_BASE}/v1/convert/document`)}</CodeBlock>
    <p className="text-gray-500 text-xs">Response headers: <code className="text-cyan-400">X-Pages</code></p>
  </div>
);

const ConvertAudioPage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">Audio Conversion</h1>
    <p className="text-gray-400">Convert between audio formats using FFmpeg.</p>
    <Endpoint method="POST" path="/v1/convert/audio" responseType="file" />
    <ParamTable params={[
      { name: 'file', type: 'file', required: true, desc: 'Audio file to convert' },
      { name: 'format', type: 'string', required: true, desc: 'mp3, wav, flac, aac, ogg, webm, wma, or m4a' },
    ]} />
    <CodeBlock>{k(`curl -H "X-API-Key: your-api-key" \\
  -F "file=@recording.wav" -F "format=mp3" \\
  ${API_BASE}/v1/convert/audio > recording.mp3`)}</CodeBlock>
    <p className="text-gray-500 text-xs">Response headers: <code className="text-cyan-400">X-Original-Size</code>, <code className="text-cyan-400">X-Output-Size</code></p>
  </div>
);

const CompressionPage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-5">
    <h1 className="text-3xl font-black text-white">Compression</h1>
    <p className="text-gray-400">Three modes in one endpoint: gzip for single files, zip for archives, image for lossy optimization.</p>
    <Endpoint method="POST" path="/v1/compress" responseType="file" />
    <ParamTable params={[
      { name: 'mode', type: 'string', required: true, desc: 'gzip, zip, or image' },
      { name: 'file', type: 'file', desc: 'Single file (for gzip and image modes)' },
      { name: 'files', type: 'file[]', desc: 'Multiple files (for zip mode)' },
      { name: 'action', type: 'string', desc: 'compress (default) or decompress (gzip only)' },
      { name: 'quality', type: 'number', desc: '1–100 (image mode only, default 70)' },
    ]} />
    <CodeBlock>{k(`# Gzip a file
curl -H "X-API-Key: your-api-key" \\
  -F "file=@access.log" -F "mode=gzip" \\
  ${API_BASE}/v1/compress > access.log.gz

# Decompress
curl -H "X-API-Key: your-api-key" \\
  -F "file=@access.log.gz" -F "mode=gzip" -F "action=decompress" \\
  ${API_BASE}/v1/compress > access.log

# Zip multiple files
curl -H "X-API-Key: your-api-key" \\
  -F "files=@file1.csv" -F "files=@file2.csv" -F "mode=zip" \\
  ${API_BASE}/v1/compress > archive.zip

# Lossy image compression
curl -H "X-API-Key: your-api-key" \\
  -F "file=@photo.jpg" -F "mode=image" -F "quality=60" \\
  ${API_BASE}/v1/compress > photo_small.jpg`)}</CodeBlock>
  </div>
);

const ExamplesPage = ({ k }: { k: (s: string) => string }) => (
  <div className="space-y-6">
    <h1 className="text-3xl font-black text-white">Code Examples</h1>

    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white">Python</h3>
      <CodeBlock>{k(`import requests

API_KEY = "your-key"
BASE = "${API_BASE}"
headers = {"X-API-Key": API_KEY}

# Merge CSVs
r = requests.post(f"{BASE}/v1/csv/merge", headers=headers,
    files=[("files", open("f1.csv","rb")), ("files", open("f2.csv","rb"))])
open("merged.csv","w").write(r.text)

# Convert image
r = requests.post(f"{BASE}/v1/convert/image", headers=headers,
    files={"file": open("photo.png","rb")}, data={"format": "webp"})
open("photo.webp","wb").write(r.content)

# Anonymize CSV
r = requests.post(f"{BASE}/v1/csv/anonymize", headers=headers,
    files={"file": open("users.csv","rb")}, data={"mode": "redact"})
open("safe.csv","w").write(r.text)

# Get CSV stats
r = requests.post(f"{BASE}/v1/csv/metadata", headers=headers,
    files={"file": open("data.csv","rb")})
print(r.json()["columns"])`)}</CodeBlock>
    </div>

    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white">JavaScript / Node.js</h3>
      <CodeBlock>{k(`const API_KEY = "your-key";
const BASE = "${API_BASE}";

// Merge CSVs
const form = new FormData();
form.append("files", new Blob([csv1]), "f1.csv");
form.append("files", new Blob([csv2]), "f2.csv");
const res = await fetch(\`\${BASE}/v1/csv/merge\`, {
  method: "POST",
  headers: { "X-API-Key": API_KEY },
  body: form,
});
const merged = await res.text();

// Convert audio
const audioForm = new FormData();
audioForm.append("file", audioBlob, "recording.wav");
audioForm.append("format", "mp3");
const mp3 = await fetch(\`\${BASE}/v1/convert/audio\`, {
  method: "POST",
  headers: { "X-API-Key": API_KEY },
  body: audioForm,
}).then(r => r.blob());`)}</CodeBlock>
    </div>
  </div>
);

// ─── Page map ───

const PAGES: Record<string, React.FC<{ k: (s: string) => string; generatedKey: string; setGeneratedKey: (k: string) => void }>> = {
  'overview': () => <OverviewPage />,
  'api-key': ({ generatedKey, setGeneratedKey }) => <ApiKeyPage generatedKey={generatedKey} setGeneratedKey={setGeneratedKey} />,
  'csv-merge-join': ({ k }) => <CsvMergeJoinPage k={k} />,
  'csv-compare': ({ k }) => <CsvComparePage k={k} />,
  'csv-anonymize': ({ k }) => <CsvAnonymizePage k={k} />,
  'convert-spreadsheet': ({ k }) => <ConvertSpreadsheetPage k={k} />,
  'convert-image': ({ k }) => <ConvertImagePage k={k} />,
  'convert-document': ({ k }) => <ConvertDocumentPage k={k} />,
  'convert-audio': ({ k }) => <ConvertAudioPage k={k} />,
  'compression': ({ k }) => <CompressionPage k={k} />,
  'examples': ({ k }) => <ExamplesPage k={k} />,
};

// ─── Main component ───

const ApiDocs: React.FC = () => {
  const getPageFromUrl = () => {
    const path = window.location.pathname.replace(/^\/api-docs\/?/, '').replace(/\/$/, '');
    return path || 'overview';
  };

  const [activePage, setActivePage] = useState(getPageFromUrl);
  const [generatedKey, setGeneratedKey] = useState('');

  const k = (code: string) => generatedKey ? code.replace(/your-api-key|your-key/g, generatedKey) : code;

  const navigate = (id: string) => {
    const path = id === 'overview' ? '/api-docs' : `/api-docs/${id}`;
    window.history.pushState(null, '', path);
    setActivePage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPopState = () => setActivePage(getPageFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const PageComponent = PAGES[activePage] || PAGES['overview'];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex gap-8">
      {/* Sidebar */}
      <nav className="hidden lg:block w-48 shrink-0">
        <div className="sticky top-24 space-y-5">
          {NAV_SECTIONS.map(({ group, items }) => (
            <div key={group || 'ungrouped'}>
              {group && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 px-3">{group}</p>}
              <div className="space-y-0.5">
                {items.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className={`block w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition-all ${activePage === id ? 'text-cyan-400 bg-cyan-500/5 font-medium' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-white/[0.06] pt-3">
            <a href="https://github.com/iuriivoloshyn/localdatatools.com/tree/api/api" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-500 hover:text-gray-300 transition-all">
              GitHub <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <PageComponent k={k} generatedKey={generatedKey} setGeneratedKey={setGeneratedKey} />

        {/* Footer */}
        <div className="flex flex-col items-center gap-4 pt-12 mt-16 border-t border-white/[0.06]">
          <a
            href="https://t.me/localdatatoolsfr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/50 border border-white/[0.06] text-gray-400 hover:text-white hover:border-cyan-500/30 transition-all text-sm"
          >
            <MessageCircle size={14} /> Request a feature or report a bug
          </a>
          <p className="text-gray-500 text-sm">
            Built with <a href="https://hono.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Hono</a> · Hosted on Google Cloud Run · Encrypted storage via Cloudflare R2
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
