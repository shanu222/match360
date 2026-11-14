import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { config, r2Enabled } from './config.js';

let client: S3Client | null = null;
function s3() {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
    });
  }
  return client;
}

export const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function signPhotoUpload(uid: string, contentType: string, size: number) {
  const ext = ALLOWED_TYPES[contentType];
  const key = `photos/${uid}/${randomUUID()}.${ext}`;
  const cmd = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: 'public, max-age=31536000, immutable',
  });
  const uploadUrl = await getSignedUrl(s3(), cmd, { expiresIn: 300 });
  return { uploadUrl, publicUrl: `${config.r2.publicUrl}/${key}`, key };
}

export function isOwnPhotoUrl(uid: string, url: string) {
  return r2Enabled() && url.startsWith(`${config.r2.publicUrl}/photos/${uid}/`);
}

export async function deletePhotos(urls: string[]) {
  if (!r2Enabled()) return;
  for (const url of urls) {
    if (!url.startsWith(config.r2.publicUrl + '/')) continue;
    const key = url.slice(config.r2.publicUrl.length + 1);
    await s3()
      .send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: key }))
      .catch((e) => console.warn('[r2] delete failed', key, e?.message));
  }
}

/* ---------- Private files: ID documents, selfies and payment proofs ----------
 * Stored in R2_PRIVATE_BUCKET when set (a bucket with NO public access). If that bucket can't be written
 * (missing bucket or token permission), they fall back to the main bucket under an unguessable key,
 * marked with a "main:" prefix so we always know where to read them from. They are only ever shown to
 * the admin through short-lived signed URLs. */
export type PrivateKind = 'id_doc' | 'selfie' | 'proof';
const MAIN = 'main:';
const bucketFor = (key: string) => (key.startsWith(MAIN) ? config.r2.bucket : config.r2Private || config.r2.bucket);
const objectKey = (key: string) => (key.startsWith(MAIN) ? key.slice(MAIN.length) : key);

export async function signPrivateUpload(uid: string, kind: PrivateKind, contentType: string, size: number) {
  const ext = ALLOWED_TYPES[contentType];
  const key = `private/${kind}/${uid}/${randomUUID()}-${randomUUID()}.${ext}`;
  const cmd = new PutObjectCommand({ Bucket: config.r2Private || config.r2.bucket, Key: key, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(s3(), cmd, { expiresIn: 300 });
  return { uploadUrl, key };
}
export const isOwnPrivateKey = (uid: string, kind: PrivateKind, key: string) =>
  typeof key === 'string' && objectKey(key).startsWith(`private/${kind}/${uid}/`) && !key.includes('..');

export async function signPrivateGet(key: string | null | undefined) {
  if (!key || !r2Enabled()) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucketFor(key), Key: objectKey(key) }), { expiresIn: 600 });
}
/** Reads a private file into memory. Only used for small images (payment slips are capped at 5 MB on upload). */
export async function getPrivateBytes(key: string | null | undefined): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!key || !r2Enabled()) return null;
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucketFor(key), Key: objectKey(key) }));
    if (!r.Body) return null;
    return { bytes: Buffer.from(await r.Body.transformToByteArray()), contentType: r.ContentType || 'image/jpeg' };
  } catch {
    return null;
  }
}
export async function deletePrivate(keys: (string | null | undefined)[]) {
  if (!r2Enabled()) return;
  for (const key of keys) {
    if (!key) continue;
    await s3().send(new DeleteObjectCommand({ Bucket: bucketFor(key), Key: objectKey(key) })).catch(() => {});
  }
}

/* ---------- Server-side uploads (no browser → R2 CORS needed) ---------- */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

export async function putPhoto(uid: string, body: Buffer, contentType: string) {
  const key = `photos/${uid}/${randomUUID()}.${ALLOWED_TYPES[contentType]}`;
  await s3().send(new PutObjectCommand({ Bucket: config.r2.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
  return { publicUrl: `${config.r2.publicUrl}/${key}` };
}

let privateBucketBroken = false;
export async function putPrivate(uid: string, kind: PrivateKind, body: Buffer, contentType: string) {
  const key = `private/${kind}/${uid}/${randomUUID()}-${randomUUID()}.${ALLOWED_TYPES[contentType]}`;
  if (config.r2Private && !privateBucketBroken) {
    try {
      await s3().send(new PutObjectCommand({ Bucket: config.r2Private, Key: key, Body: body, ContentType: contentType }));
      return { key };
    } catch (e: any) {
      const code = e?.name || e?.Code || '';
      console.error(`[r2] private bucket "${config.r2Private}" write failed (${code}: ${e?.message}). Falling back to the main bucket. Check the bucket name and that the R2 token can write to it.`);
      if (/NoSuchBucket|AccessDenied|Forbidden|InvalidAccessKeyId|Unauthorized/i.test(`${code} ${e?.message}`)) privateBucketBroken = true;
    }
  }
  await s3().send(new PutObjectCommand({ Bucket: config.r2.bucket, Key: key, Body: body, ContentType: contentType }));
  return { key: config.r2Private ? `${MAIN}${key}` : key };
}

/** For the admin dashboard: whether storage is reachable. */
export async function storageHealth() {
  const out: { publicBucket: string; privateBucket: string } = { publicBucket: 'not configured', privateBucket: 'not configured' };
  if (!r2Enabled()) return out;
  const probe = async (bucket: string) => {
    const key = `health/${randomUUID()}.txt`;
    try {
      await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'ok', ContentType: 'text/plain' }));
      await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
      return 'working';
    } catch (e: any) {
      return `error: ${e?.name || ''} ${e?.message || ''}`.trim();
    }
  };
  out.publicBucket = await probe(config.r2.bucket);
  out.privateBucket = config.r2Private ? await probe(config.r2Private) : 'not set (using main bucket)';
  if (out.privateBucket === 'working') privateBucketBroken = false;
  return out;
}
