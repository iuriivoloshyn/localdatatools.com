import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Lock, Zap, FileText, Shield, Code, Key, Loader2, FileSpreadsheet, Image, Music, Archive } from 'lucide-react';

const API_BASE = 'https://api.localdatatools.com';

const NAV_SECTIONS = [
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'csv', label: 'CSV Processing' },
  { id: 'convert', label: 'File Conversion' },
  { id: 'compress', label: 'Compression' },
  { id: 'encrypted', label: 'Encrypted Jobs' },
  { id: 'examples', label: 'Code Examples' },
];

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

const EndpointCard = ({ method, path, description, children }: { method: string; path: string; description: string; children?: React.ReactNode }) => (
  <div className="bg-gray-900/50 border border-white/[0.06] rounded-2xl overflow-hidden">
    <div className="p-5 border-b border-white/[0.06]">
      <div className="flex items-center gap-3 mb-1.5">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider ${method === 'POST' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{method}</span>
        <code className="text-white font-mono text-sm">{path}</code>
      </div>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
    {children && <div className="p-5">{children}</div>}
  </div>
);

const ParamGrid = ({ params }: { params: { name: string; desc: string }[] }) => (
  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
    {params.map(({ name, desc }) => (
      <div key={name} className="bg-gray-950 rounded-lg p-2.5 border border-white/[0.06]">
        <span className="text-gray-500">{name}</span>
        <span className="text-white ml-2">{desc}</span>
      </div>
    ))}
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

const ApiDocs: React.FC = () => {
  const [activeSection, setActiveSection] = useState('quick-start');
  const [generatedKey, setGeneratedKey] = useState('');

  const k = (code: string) => generatedKey ? code.replace(/your-api-key|your-key/g, generatedKey) : code;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex gap-12">
      {/* Sidebar */}
      <nav className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-24 space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-3">On this page</p>
          {NAV_SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={`block px-3 py-1.5 rounded-lg text-sm transition-all ${activeSection === id ? 'text-cyan-400 bg-cyan-500/5 font-medium' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {label}
            </a>
          ))}
          <div className="border-t border-white/[0.06] mt-4 pt-4">
            <a href="https://github.com/iuriivoloshyn/localdatatools.com/tree/api/api" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-all">
              GitHub <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-16">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Code size={24} className="text-cyan-400" />
            </div>
            <h1 className="text-3xl font-black text-white">API Documentation</h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">
            Privacy-first file processing via simple HTTP calls. CSV tools, file conversion, compression, and encrypted large file storage.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { icon: Zap, title: '14 Endpoints', desc: 'CSV, images, audio, documents, compression' },
              { icon: Shield, title: 'Encrypted', desc: 'AES-256-GCM zero-knowledge storage' },
              { icon: Lock, title: 'Authenticated', desc: 'API key + 30 req/min rate limit' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-4 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-cyan-500/10"><Icon size={14} className="text-cyan-400" /></div>
                <div>
                  <h3 className="text-white font-bold text-xs">{title}</h3>
                  <p className="text-gray-500 text-[11px] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <KeyGenerator onKeyGenerated={setGeneratedKey} />
          {generatedKey && <p className="text-xs text-cyan-400/60">Your key has been applied to all code examples below.</p>}
        </div>

        {/* Quick Start */}
        <section id="quick-start" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Zap size={20} className="text-cyan-400" /> Quick Start
          </h2>
          <CodeBlock>{k(`# Set your API key
API_KEY="your-api-key"

# Merge two CSV files
curl -H "X-API-Key: $API_KEY" \\
  -F "files=@orders_jan.csv" \\
  -F "files=@orders_feb.csv" \\
  ${API_BASE}/v1/csv/merge > merged.csv

# Convert PNG to WebP
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@photo.png" -F "format=webp" \\
  ${API_BASE}/v1/convert/image > photo.webp

# Compress a log file
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@access.log" -F "mode=gzip" \\
  ${API_BASE}/v1/compress > access.log.gz`)}</CodeBlock>
        </section>

        {/* Authentication */}
        <section id="authentication" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Lock size={20} className="text-cyan-400" /> Authentication
          </h2>
          <p className="text-gray-400">Pass your key via the <code className="text-cyan-400 bg-gray-900 px-2 py-0.5 rounded">X-API-Key</code> header with every request.</p>
          <CodeBlock>{k(`curl -H "X-API-Key: your-key" ${API_BASE}/v1/csv/analyze`)}</CodeBlock>
          <p className="text-gray-500 text-sm">Rate limit: 30 requests per minute per key.</p>
        </section>

        {/* CSV Processing */}
        <section id="csv" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <FileText size={20} className="text-cyan-400" /> CSV Processing
            <span className="text-xs font-medium text-gray-500 bg-gray-900 px-3 py-1 rounded-full">6 endpoints</span>
          </h2>

          <EndpointCard method="POST" path="/v1/csv/merge" description="Stack multiple CSV files vertically. First file's headers are kept.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "files=@file1.csv" -F "files=@file2.csv" \\
  ${API_BASE}/v1/csv/merge > merged.csv`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/join" description="Left or inner join two CSVs on a key column.">
            <ParamGrid params={[
              { name: 'left_key', desc: 'Column in left file' },
              { name: 'right_key', desc: 'Column in right file' },
              { name: 'join_type', desc: 'left | inner' },
              { name: 'case_sensitive', desc: 'true | false' },
            ]} />
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "left=@employees.csv" -F "right=@salaries.csv" \\
  -F "left_key=id" -F "right_key=emp_id" \\
  ${API_BASE}/v1/csv/join > joined.csv`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/diff" description="Compare two CSV files. Returns added, removed, and changed rows.">
            <ParamGrid params={[
              { name: 'left', desc: 'Original CSV file' },
              { name: 'right', desc: 'Updated CSV file' },
              { name: 'key', desc: 'Optional key column for row matching' },
            ]} />
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "left=@v1.csv" -F "right=@v2.csv" -F "key=id" \\
  ${API_BASE}/v1/csv/diff

# {"summary": {"added": 5, "removed": 2, "changed": 3, "unchanged": 100}}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/metadata" description="Extract column types, row counts, null rates, and summary statistics.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "file=@data.csv" \\
  ${API_BASE}/v1/csv/metadata

# {"rowCount": 1000, "columns": [
#   {"header": "age", "type": "integer", "min": 18, "max": 65, "mean": 34.2},
#   {"header": "email", "type": "string", "nullRate": 0.02, "unique": 980}
# ]}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/anonymize" description="Auto-detect and mask PII — emails, phones, names, SSNs, addresses.">
            <ParamGrid params={[
              { name: 'columns', desc: 'Comma-separated columns (auto-detect if omitted)' },
              { name: 'mode', desc: 'mask (default) | redact' },
            ]} />
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "file=@users.csv" -F "mode=mask" \\
  ${API_BASE}/v1/csv/anonymize > anonymized.csv

# alice@test.com → a***@test.com
# 555-123-4567  → 5**********7`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/analyze" description="Check if files have compatible headers before merging.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "files=@file1.csv" -F "files=@file2.csv" \\
  ${API_BASE}/v1/csv/analyze`}</CodeBlock>
          </EndpointCard>
        </section>

        {/* File Conversion */}
        <section id="convert" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-cyan-400" /> File Conversion
            <span className="text-xs font-medium text-gray-500 bg-gray-900 px-3 py-1 rounded-full">4 endpoints</span>
          </h2>

          <EndpointCard method="POST" path="/v1/convert/spreadsheet" description="CSV to Excel or Excel to CSV. Auto-detects direction from file extension.">
            <ParamGrid params={[
              { name: 'file', desc: '.csv, .tsv, .xlsx, or .xls' },
              { name: 'sheet', desc: 'Sheet name for Excel input (optional)' },
            ]} />
            <CodeBlock>{`# CSV → Excel
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@data.csv" \\
  ${API_BASE}/v1/convert/spreadsheet > data.xlsx

# Excel → CSV
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@report.xlsx" -F "sheet=Sales" \\
  ${API_BASE}/v1/convert/spreadsheet > report.csv`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/convert/image" description="Convert between PNG, JPEG, WebP, AVIF, TIFF, GIF. Optional resize.">
            <ParamGrid params={[
              { name: 'format', desc: 'png, jpeg, webp, avif, tiff, gif' },
              { name: 'quality', desc: '1-100 (default 80)' },
              { name: 'width', desc: 'Resize width (optional)' },
              { name: 'height', desc: 'Resize height (optional)' },
            ]} />
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "file=@photo.png" -F "format=webp" -F "quality=85" \\
  ${API_BASE}/v1/convert/image > photo.webp

# Resize to 800px wide
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@banner.jpg" -F "format=png" -F "width=800" \\
  ${API_BASE}/v1/convert/image > banner.png`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/convert/document" description="Extract text from PDF. Output as plain text, DOCX, or structured JSON.">
            <ParamGrid params={[
              { name: 'file', desc: 'PDF file' },
              { name: 'format', desc: 'txt (default), docx, json' },
            ]} />
            <CodeBlock>{`# PDF → text
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@document.pdf" -F "format=txt" \\
  ${API_BASE}/v1/convert/document > document.txt

# PDF → DOCX
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@document.pdf" -F "format=docx" \\
  ${API_BASE}/v1/convert/document > document.docx`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/convert/audio" description="Convert between MP3, WAV, FLAC, AAC, OGG, WebM, WMA, M4A via FFmpeg.">
            <ParamGrid params={[
              { name: 'file', desc: 'Audio file' },
              { name: 'format', desc: 'mp3, wav, flac, aac, ogg, webm, wma, m4a' },
            ]} />
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "file=@recording.wav" -F "format=mp3" \\
  ${API_BASE}/v1/convert/audio > recording.mp3`}</CodeBlock>
          </EndpointCard>
        </section>

        {/* Compression */}
        <section id="compress" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Archive size={20} className="text-cyan-400" /> Compression
          </h2>
          <p className="text-gray-400 text-sm">Three modes in one endpoint: <code className="text-cyan-400 bg-gray-900 px-1.5 py-0.5 rounded">gzip</code> for single files, <code className="text-cyan-400 bg-gray-900 px-1.5 py-0.5 rounded">zip</code> for archives, <code className="text-cyan-400 bg-gray-900 px-1.5 py-0.5 rounded">image</code> for lossy image optimization.</p>

          <EndpointCard method="POST" path="/v1/compress" description="Compress or decompress files. Mode determines behavior.">
            <ParamGrid params={[
              { name: 'mode', desc: 'gzip | zip | image' },
              { name: 'file', desc: 'File (for gzip/image)' },
              { name: 'files', desc: 'Multiple files (for zip)' },
              { name: 'action', desc: 'compress | decompress (gzip only)' },
              { name: 'quality', desc: '1-100 (image mode, default 70)' },
            ]} />
            <CodeBlock>{`# GZIP a file
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@access.log" -F "mode=gzip" \\
  ${API_BASE}/v1/compress > access.log.gz

# Decompress
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@access.log.gz" -F "mode=gzip" -F "action=decompress" \\
  ${API_BASE}/v1/compress > access.log

# ZIP multiple files
curl -H "X-API-Key: $API_KEY" \\
  -F "files=@file1.csv" -F "files=@file2.csv" -F "mode=zip" \\
  ${API_BASE}/v1/compress > archive.zip

# Lossy image compression
curl -H "X-API-Key: $API_KEY" \\
  -F "file=@photo.jpg" -F "mode=image" -F "quality=60" \\
  ${API_BASE}/v1/compress > photo_small.jpg`}</CodeBlock>
          </EndpointCard>
        </section>

        {/* Encrypted Jobs */}
        <section id="encrypted" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Shield size={20} className="text-cyan-400" /> Encrypted Large Files
            <span className="text-xs font-medium text-gray-500 bg-gray-900 px-3 py-1 rounded-full">up to 1GB</span>
          </h2>
          <p className="text-gray-400">For files over 50MB. Results are encrypted with AES-256-GCM and stored temporarily in Cloudflare R2. The decryption key is only returned to you — never stored on the server.</p>

          <EndpointCard method="POST" path="/v1/jobs/merge" description="Submit a large merge job. Returns a jobId and fileKey for download.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "files=@huge1.csv" -F "files=@huge2.csv" \\
  ${API_BASE}/v1/jobs/merge

# {"jobId": "86beaa3a...", "fileKey": "a9cb85aa...",
#  "downloadUrl": "/v1/jobs/86beaa.../download?key=a9cb85...",
#  "expiresIn": "24 hours"}`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/jobs/join" description="Large file join via encrypted storage. Same params as /v1/csv/join.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "left=@big_left.csv" -F "right=@big_right.csv" \\
  -F "left_key=id" -F "right_key=emp_id" \\
  ${API_BASE}/v1/jobs/join`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="GET" path="/v1/jobs/:id/download?key=..." description="Download and decrypt. One-time download — file is deleted after retrieval.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  "${API_BASE}/v1/jobs/JOB_ID/download?key=FILE_KEY" > result.csv`}</CodeBlock>
          </EndpointCard>

          <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-5 space-y-2">
            <h4 className="text-cyan-400 font-bold text-sm flex items-center gap-2"><Lock size={14} /> Privacy Guarantees</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>Files encrypted with per-file random key (AES-256-GCM)</li>
              <li>Encryption key only returned to you — never stored on our servers</li>
              <li>Stored files are unreadable without the key, even by the server operator</li>
              <li>Files deleted after download (one-time download)</li>
              <li>Undownloaded files expire after 24 hours</li>
            </ul>
          </div>
        </section>

        {/* Code Examples */}
        <section id="examples" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Code size={20} className="text-cyan-400" /> Code Examples
          </h2>

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
        </section>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/[0.06]">
          <p className="text-gray-500 text-sm">
            Built with <a href="https://hono.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Hono</a> · Hosted on Google Cloud Run · Encrypted storage via Cloudflare R2
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;
