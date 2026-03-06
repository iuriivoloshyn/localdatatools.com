import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { encryptBuffer, decryptBuffer } from '../utils/crypto.js';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'localdatatools';

let s3: S3Client | null = null;

function getClient(): S3Client {
  if (!s3) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
      throw new Error('R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY env vars.');
    }
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
  }
  return s3;
}

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);
}

export interface StoredFile {
  jobId: string;       // random ID for the stored file
  fileKey: string;     // encryption key (returned to user, never stored in R2)
}

// Encrypt and store a file in R2. Returns jobId + fileKey.
export async function storeEncrypted(data: Buffer): Promise<StoredFile> {
  const client = getClient();
  const jobId = randomBytes(16).toString('hex');
  const { encrypted, fileKey } = encryptBuffer(data);

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `jobs/${jobId}.enc`,
    Body: encrypted,
    ContentType: 'application/octet-stream',
    // Auto-expire metadata (R2 lifecycle rules handle actual deletion)
    Metadata: { 'expires': new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
  }));

  return { jobId, fileKey };
}

// Fetch and decrypt a file from R2
export async function fetchDecrypted(jobId: string, fileKey: string): Promise<Buffer> {
  const client = getClient();

  const response = await client.send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: `jobs/${jobId}.enc`,
  }));

  if (!response.Body) throw new Error('File not found or expired.');

  const encrypted = Buffer.from(await response.Body.transformToByteArray());
  return decryptBuffer(encrypted, fileKey);
}

// Delete a file from R2 (called after download or on expiry)
export async function deleteFile(jobId: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: `jobs/${jobId}.enc`,
  }));
}
