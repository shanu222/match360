import { api } from './api';

type Kind = 'photo' | 'id_doc' | 'selfie' | 'proof';

/** Uploads an already-prepared JPEG to storage through a short-lived signed URL. */
export async function uploadBlob(kind: Kind, blob: Blob): Promise<{ publicUrl?: string; key?: string }> {
  const s = await api.post<{ uploadUrl: string; publicUrl?: string; key?: string }>('/uploads/sign', { kind, contentType: 'image/jpeg', size: blob.size });
  const put = await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  if (!put.ok) throw new Error('Upload failed. Please try again.');
  return { publicUrl: s.publicUrl, key: s.key };
}
