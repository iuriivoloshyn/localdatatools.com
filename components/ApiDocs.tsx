import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Lock, Zap, FileText, ArrowRightLeft, Search, Download, Shield, Code, Terminal } from 'lucide-react';

const API_BASE = 'https://localdatatools-api-674880939500.us-south1.run.app';

const CodeBlock = ({ children, language = 'bash' }: { children: string; language?: string }) => {
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

const ApiDocs: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <Code size={28} className="text-cyan-400" />
          </div>
        </div>
        <h1 className="text-4xl font-black text-white">API Documentation</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Privacy-first CSV processing via simple HTTP calls. Merge, join, and analyze files programmatically. Large files encrypted with AES-256-GCM.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <a href={`${API_BASE}/docs`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all">
            <Terminal size={16} /> Interactive Docs <ExternalLink size={14} />
          </a>
          <a href="https://github.com/iuriivoloshyn/localdatatools.com/tree/api/api" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl border border-white/10 transition-all">
            GitHub <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Zap, title: 'Fast', desc: 'Direct streaming for files under 50MB' },
          { icon: Shield, title: 'Encrypted', desc: 'AES-256-GCM for large files — zero-knowledge storage' },
          { icon: Lock, title: 'Authenticated', desc: 'API key auth + 30 req/min rate limiting' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-gray-900/50 border border-white/[0.06] rounded-xl p-5 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-cyan-500/10"><Icon size={18} className="text-cyan-400" /></div>
            <div>
              <h3 className="text-white font-bold text-sm">{title}</h3>
              <p className="text-gray-500 text-xs mt-1">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <Zap size={20} className="text-cyan-400" /> Quick Start
        </h2>
        <CodeBlock>{`# Set your API key
API_KEY="your-api-key"

# Merge two CSV files
curl -H "X-API-Key: $API_KEY" \\
  -F "files=@orders_jan.csv" \\
  -F "files=@orders_feb.csv" \\
  ${API_BASE}/v1/csv/merge > merged.csv`}</CodeBlock>
      </div>

      {/* Authentication */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <Lock size={20} className="text-cyan-400" /> Authentication
        </h2>
        <p className="text-gray-400">Pass your API key via the <code className="text-cyan-400 bg-gray-900 px-2 py-0.5 rounded">X-API-Key</code> header with every request.</p>
        <CodeBlock>{`curl -H "X-API-Key: your-key" ${API_BASE}/v1/csv/analyze`}</CodeBlock>
        <p className="text-gray-500 text-sm">Rate limit: 30 requests per minute per key.</p>
      </div>

      {/* Direct Endpoints */}
      <div className="space-y-6">
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
      </div>

      {/* Encrypted Jobs */}
      <div className="space-y-6">
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
      </div>

      {/* Code Examples */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <Code size={20} className="text-cyan-400" /> Code Examples
        </h2>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Python</h3>
          <CodeBlock language="python">{`import requests

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
    f.write(r.text)`}</CodeBlock>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">JavaScript / Node.js</h3>
          <CodeBlock language="javascript">{`const form = new FormData();
form.append("files", new Blob([csv1]), "file1.csv");
form.append("files", new Blob([csv2]), "file2.csv");

const res = await fetch("${API_BASE}/v1/csv/merge", {
  method: "POST",
  headers: { "X-API-Key": "your-key" },
  body: form,
});
const merged = await res.text();`}</CodeBlock>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-8 border-t border-white/[0.06]">
        <p className="text-gray-500 text-sm">
          Built with <a href="https://hono.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Hono</a> · Hosted on Google Cloud Run · Encrypted storage via Cloudflare R2
        </p>
      </div>
    </div>
  );
};

export default ApiDocs;
