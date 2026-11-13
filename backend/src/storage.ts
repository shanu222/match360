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
 * Stored in R2_PRIVATE_BUCKET when set (recommended: a bucket with NO public access).
 * Otherwise they go to the main bucket under an unguessable key. They are only ever shown to the admin
 * through short-lived signed URLs, never through the public URL. */
const privateBucket = () => config.r2Private || config.r2.bucket;
export type PrivateKind = 'id_doc' | 'selfie' | 'proof';

export async function signPrivateUpload(uid: string, kind: PrivateKind, contentType: string, size: number) {
  const ext = ALLOWED_TYPES[contentType];
  const key = `private/${kind}/${uid}/${randomUUID()}-${randomUUID()}.${ext}`;
  const cmd = new PutObjectCommand({ Bucket: privateBucket(), Key: key, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(s3(), cmd, { expiresIn: 300 });
  return { uploadUrl, key };
}
export const isOwnPrivateKey = (uid: string, kind: PrivateKind, key: string) => typeof key === 'string' && key.startsWith(`private/${kind}/${uid}/`) && !key.includes('..');

export async function signPrivateGet(key: string | null | undefined) {
  if (!key || !r2Enabled()) return null;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: privateBucket(), Key: key }), { expiresIn: 600 });
}
export async function deletePrivate(keys: (string | null | undefined)[]) {
  if (!r2Enabled()) return;
  for (const key of keys) {
    if (!key) continue;
    await s3().send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key })).catch(() => {});
  }
}
