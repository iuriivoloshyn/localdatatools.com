# LocalDataTools API

Privacy-first CSV processing API. Merge, join, and analyze CSV files via simple HTTP calls. Large files (up to 1GB) are encrypted at rest with AES-256-GCM — even the server operator cannot read stored files.

**Live API:** https://api.localdatatools.com
**Interactive Docs:** https://api.localdatatools.com/docs
**Web App:** https://localdatatools.com

## Quick Start

```bash
# Set your API key
API_KEY="your-api-key"
BASE="https://api.localdatatools.com"

# Merge two CSV files
curl -H "X-API-Key: $API_KEY" \
  -F "files=@orders_jan.csv" \
  -F "files=@orders_feb.csv" \
  $BASE/v1/csv/merge > merged.csv

# Join two CSV files on a key column
curl -H "X-API-Key: $API_KEY" \
  -F "left=@employees.csv" \
  -F "right=@salaries.csv" \
  -F "left_key=id" \
  -F "right_key=emp_id" \
  -F "join_type=left" \
  $BASE/v1/csv/join > joined.csv
```

## Endpoints

### Direct Processing (< 50MB, instant response)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/csv/merge` | Stack CSV files vertically (append rows) |
| POST | `/v1/csv/join` | Left or inner join on a key column |
| POST | `/v1/csv/analyze` | Check if files have compatible headers |

### Encrypted Jobs (up to 1GB, via Cloudflare R2)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/jobs/merge` | Large file merge → returns jobId + fileKey |
| POST | `/v1/jobs/join` | Large file join → returns jobId + fileKey |
| GET | `/v1/jobs/:id/download?key=...` | Download decrypted result (one-time) |

## Authentication

Pass your API key via the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-key" ...
```

Rate limit: 30 requests per minute per key.

## Examples

### Merge (Append Rows)

Upload multiple CSV files with the same headers. The first file's headers are kept; subsequent file headers are skipped.

```bash
curl -H "X-API-Key: $API_KEY" \
  -F "files=@file1.csv" \
  -F "files=@file2.csv" \
  -F "files=@file3.csv" \
  $BASE/v1/csv/merge
```

**Response:** merged CSV streamed directly.

### Join (SQL-style)

Join two CSV files on matching columns. Supports `left` (default) and `inner` joins.

```bash
curl -H "X-API-Key: $API_KEY" \
  -F "left=@customers.csv" \
  -F "right=@orders.csv" \
  -F "left_key=customer_id" \
  -F "right_key=cust_id" \
  -F "join_type=inner" \
  -F "case_sensitive=false" \
  $BASE/v1/csv/join
```

**Response:** joined CSV streamed directly.

### Analyze Compatibility

Check if files can be merged before actually merging them.

```bash
curl -H "X-API-Key: $API_KEY" \
  -F "files=@file1.csv" \
  -F "files=@file2.csv" \
  $BASE/v1/csv/analyze
```

**Response:**
```json
{
  "primary": "file1.csv",
  "primaryHeaders": ["id", "name", "score"],
  "results": [
    { "file": "file2.csv", "compatible": true, "reason": "Compatible" }
  ],
  "canMerge": true
}
```

### Large File Processing (Encrypted)

For files larger than 50MB, use the jobs endpoints. Results are encrypted with AES-256-GCM before storage.

```bash
# Step 1: Submit the job
curl -H "X-API-Key: $API_KEY" \
  -F "files=@huge_file1.csv" \
  -F "files=@huge_file2.csv" \
  $BASE/v1/jobs/merge

# Response:
# {
#   "jobId": "86beaa3aee34e7f6ab6aed0872c1d4cb",
#   "fileKey": "a9cb85aa...b75c7b",
#   "downloadUrl": "/v1/jobs/86bea.../download?key=a9cb8...",
#   "expiresIn": "24 hours"
# }

# Step 2: Download the result
curl -H "X-API-Key: $API_KEY" \
  "$BASE/v1/jobs/86beaa.../download?key=a9cb85aa..." > result.csv
```

**Privacy guarantees:**
- Files are encrypted with a per-file random key (AES-256-GCM)
- The encryption key (`fileKey`) is only returned to you — never stored on the server
- Stored files are unreadable without the key, even by the server operator
- Files are deleted after download (one-time download)
- Undownloaded files expire after 24 hours

### Python Example

```python
import requests

API_KEY = "your-key"
BASE = "https://api.localdatatools.com"

# Merge
files = [
    ("files", open("file1.csv", "rb")),
    ("files", open("file2.csv", "rb")),
]
r = requests.post(f"{BASE}/v1/csv/merge", headers={"X-API-Key": API_KEY}, files=files)
with open("merged.csv", "w") as f:
    f.write(r.text)

# Join
files = {
    "left": open("employees.csv", "rb"),
    "right": open("salaries.csv", "rb"),
}
data = {"left_key": "id", "right_key": "emp_id", "join_type": "left"}
r = requests.post(f"{BASE}/v1/csv/join", headers={"X-API-Key": API_KEY}, files=files, data=data)
with open("joined.csv", "w") as f:
    f.write(r.text)
```

### JavaScript/Node.js Example

```javascript
const form = new FormData();
form.append("files", new Blob([csv1]), "file1.csv");
form.append("files", new Blob([csv2]), "file2.csv");

const res = await fetch("https://api.localdatatools.com/v1/csv/merge", {
  method: "POST",
  headers: { "X-API-Key": "your-key" },
  body: form,
});
const merged = await res.text();
```

## Local Development

```bash
cd api
npm install
npm run dev    # starts on http://localhost:4000
```

## Tech Stack

- **Runtime:** Node.js 22
- **Framework:** [Hono](https://hono.dev)
- **Hosting:** Google Cloud Run
- **Storage:** Cloudflare R2 (encrypted)
- **Encryption:** AES-256-GCM (per-file random keys)
