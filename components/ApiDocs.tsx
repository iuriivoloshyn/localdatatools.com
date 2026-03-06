import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Lock, Zap, FileText, Shield, Code, Key, Loader2 } from 'lucide-react';

const API_BASE = 'https://api.localdatatools.com';

const NAV_SECTIONS = [
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'direct', label: 'Direct Processing' },
  { id: 'encrypted', label: 'Encrypted Jobs' },
  { id: 'coming-soon', label: 'Coming Soon' },
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
    <div className="p-6 border-b border-white/[0.06]">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider ${method === 'POST' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{method}</span>
        <code className="text-white font-mono text-sm">{path}</code>
      </div>
      <p className="text-gray-400 text-sm mt-2">{description}</p>
    </div>
    {children && <div className="p-6">{children}</div>}
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

  // Helper: replace placeholder key in code examples with real key
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
            Privacy-first file processing via simple HTTP calls. Merge, join, and analyze files programmatically. Large files encrypted with AES-256-GCM.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { icon: Zap, title: 'Fast', desc: 'Streaming for files under 50MB' },
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
  ${API_BASE}/v1/csv/merge > merged.csv`)}</CodeBlock>
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

        {/* Direct Processing */}
        <section id="direct" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <FileText size={20} className="text-cyan-400" /> Direct Processing
            <span className="text-xs font-medium text-gray-500 bg-gray-900 px-3 py-1 rounded-full">&lt; 50MB</span>
          </h2>

          <EndpointCard method="POST" path="/v1/csv/merge" description="Stack multiple CSV files vertically. First file's headers are kept; subsequent headers are skipped.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "files=@file1.csv" \\
  -F "files=@file2.csv" \\
  -F "files=@file3.csv" \\
  ${API_BASE}/v1/csv/merge`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/join" description="Left or inner join on a key column. Supports case-insensitive matching.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-950 rounded-lg p-3 border border-white/[0.06]">
                  <span className="text-gray-500">left_key</span>
                  <span className="text-white ml-2">Column name in left file</span>
                </div>
                <div className="bg-gray-950 rounded-lg p-3 border border-white/[0.06]">
                  <span className="text-gray-500">right_key</span>
                  <span className="text-white ml-2">Column name in right file</span>
                </div>
                <div className="bg-gray-950 rounded-lg p-3 border border-white/[0.06]">
                  <span className="text-gray-500">join_type</span>
                  <span className="text-white ml-2">left (default) | inner</span>
                </div>
                <div className="bg-gray-950 rounded-lg p-3 border border-white/[0.06]">
                  <span className="text-gray-500">case_sensitive</span>
                  <span className="text-white ml-2">true (default) | false</span>
                </div>
              </div>
              <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "left=@employees.csv" \\
  -F "right=@salaries.csv" \\
  -F "left_key=id" \\
  -F "right_key=emp_id" \\
  -F "join_type=left" \\
  ${API_BASE}/v1/csv/join`}</CodeBlock>
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/v1/csv/analyze" description="Check if files have compatible headers before merging.">
            <CodeBlock>{`curl -H "X-API-Key: $API_KEY" \\
  -F "files=@file1.csv" \\
  -F "files=@file2.csv" \\
  ${API_BASE}/v1/csv/analyze

# Response:
# {
#   "primary": "file1.csv",
#   "primaryHeaders": ["id", "name", "score"],
#   "results": [{ "file": "file2.csv", "compatible": true }],
#   "canMerge": true
# }`}</CodeBlock>
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
            <CodeBlock>{`# Step 1: Submit the job
curl -H "X-API-Key: $API_KEY" \\
  -F "files=@huge_file1.csv" \\
  -F "files=@huge_file2.csv" \\
  ${API_BASE}/v1/jobs/merge

# Response:
# {
#   "jobId": "86beaa3a...",
#   "fileKey": "a9cb85aa...",
#   "downloadUrl": "/v1/jobs/86beaa.../download?key=a9cb85...",
#   "expiresIn": "24 hours"
# }`}</CodeBlock>
          </EndpointCard>

          <EndpointCard method="GET" path="/v1/jobs/:id/download?key=..." description="Download and decrypt. One-time download — file is deleted after retrieval.">
            <CodeBlock>{`# Step 2: Download the decrypted result
curl -H "X-API-Key: $API_KEY" \\
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

        {/* Coming Soon */}
        <section id="coming-soon" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Zap size={20} className="text-cyan-400" /> Coming Soon
          </h2>
          <p className="text-gray-400 text-sm">These endpoints are in development. All tools available on <a href="https://localdatatools.com" className="text-cyan-400 hover:underline">localdatatools.com</a> are being brought to the API.</p>
          <div className="space-y-3">
            {[
              { category: 'File Conversion', endpoints: [
                { method: 'POST', path: '/v1/convert/spreadsheet', desc: 'CSV ↔ Excel (xlsx, xls) — bidirectional conversion' },
                { method: 'POST', path: '/v1/convert/document', desc: 'DOCX → PDF, PDF → DOCX, PDF → images (PNG)' },
                { method: 'POST', path: '/v1/convert/image', desc: 'Convert between PNG, JPEG, WebP, SVG, HEIC — or to PDF' },
                { method: 'POST', path: '/v1/convert/audio', desc: 'Convert between MP3, WAV, FLAC, AAC, OGG, WebM, WMA' },
                { method: 'POST', path: '/v1/compress', desc: 'Compress or decompress files (gzip, zip)' },
              ]},
              { category: 'Data Processing', endpoints: [
                { method: 'POST', path: '/v1/csv/diff', desc: 'Compare two CSV files — returns added, removed, and changed rows' },
                { method: 'POST', path: '/v1/csv/anonymize', desc: 'Mask or replace PII (emails, names, phone numbers) in CSV columns' },
                { method: 'POST', path: '/v1/csv/metadata', desc: 'Extract column types, row counts, null rates, and summary statistics' },
              ]},
            ].map(({ category, endpoints }) => (
              <div key={category}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">{category}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {endpoints.map(({ method, path, desc }) => (
                    <div key={path} className="bg-gray-900/30 border border-white/[0.04] rounded-xl p-4 opacity-50 hover:opacity-70 transition-opacity">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider bg-gray-800 text-gray-500 border border-white/[0.06]">{method}</span>
                        <code className="text-gray-400 font-mono text-xs">{path}</code>
                      </div>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

# Merge
files = [
    ("files", open("file1.csv", "rb")),
    ("files", open("file2.csv", "rb")),
]
r = requests.post(f"{BASE}/v1/csv/merge",
    headers={"X-API-Key": API_KEY}, files=files)

with open("merged.csv", "w") as f:
    f.write(r.text)

# Join
r = requests.post(f"{BASE}/v1/csv/join",
    headers={"X-API-Key": API_KEY},
    files={"left": open("a.csv", "rb"), "right": open("b.csv", "rb")},
    data={"left_key": "id", "right_key": "emp_id", "join_type": "left"})

with open("joined.csv", "w") as f:
    f.write(r.text)`)}</CodeBlock>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">JavaScript / Node.js</h3>
            <CodeBlock>{k(`const form = new FormData();
form.append("files", new Blob([csv1]), "file1.csv");
form.append("files", new Blob([csv2]), "file2.csv");

const res = await fetch("${API_BASE}/v1/csv/merge", {
  method: "POST",
  headers: { "X-API-Key": "your-key" },
  body: form,
});
const merged = await res.text();`)}</CodeBlock>
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
