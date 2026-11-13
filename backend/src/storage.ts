import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
