import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes, createHash } from 'crypto';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'localdatatools';
const KEYS_FILE = 'api-keys.json';

let s3: S3Client | null = null;

function getClient(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    });
  }
  return s3;
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

interface KeyEntry {
  keyHash: string;
  email: string;
  createdAt: string;
}

// In-memory cache of hashed keys, refreshed from R2 periodically
let cachedKeyHashes: Set<string> = new Set();
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

async function loadKeys(): Promise<KeyEntry[]> {
  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: KEYS_FILE }));
    if (!res.Body) return [];
    const text = await res.Body.transformToString();
    const entries = JSON.parse(text);

    // Auto-migrate: if any entry still has plaintext 'key' field, hash it
    let migrated = false;
    for (const entry of entries) {
      if ((entry as any).key && !(entry as any).keyHash) {
        entry.keyHash = hashKey((entry as any).key);
        delete (entry as any).key;
        (entry as any).migratedAt = new Date().toISOString();
        migrated = true;
      }
    }
    if (migrated) {
      await saveKeys(entries);
    }

    return entries;
  } catch (e: any) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return [];
    throw e;
  }
}

async function saveKeys(entries: KeyEntry[]): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: KEYS_FILE,
    Body: JSON.stringify(entries, null, 2),
    ContentType: 'application/json',
  }));
}

export async function getValidKeyHashes(): Promise<Set<string>> {
  const now = Date.now();
  if (now - lastFetch > CACHE_TTL) {
    const entries = await loadKeys();
    cachedKeyHashes = new Set(entries.map(e => e.keyHash));
    lastFetch = now;
  }
  return cachedKeyHashes;
}

export async function createKey(email: string): Promise<string> {
  const entries = await loadKeys();

  // Check if email already has a key — can't return it since we only store hashes
  const existing = entries.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return ''; // Signal that a key already exists for this email
  }

  const key = `ldt_${randomBytes(24).toString('hex')}`;
  entries.push({ keyHash: hashKey(key), email: email.toLowerCase(), createdAt: new Date().toISOString() });
  await saveKeys(entries);

  // Update cache immediately
  cachedKeyHashes.add(hashKey(key));

  return key;
}
