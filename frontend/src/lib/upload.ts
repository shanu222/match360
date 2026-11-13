import { API_URL, ApiError, getToken } from './api';

type Kind = 'photo' | 'id_doc' | 'selfie' | 'proof';

/** Uploads an image through our API (the server stores it in R2). Retries once on network errors. */
export async function uploadBlob(kind: Kind, blob: Blob): Promise<{ publicUrl?: string; key?: string }> {
  const attempt = async () => {
    const token = await getToken();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(`${API_URL}/api/uploads/file?kind=${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: blob,
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data?.error || 'Upload failed. Please try again.', data?.code);
      return data as { publicUrl?: string; key?: string };
    } catch (e: any) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, e?.name === 'AbortError' ? 'The upload took too long. Check your connection and try again.' : 'Upload failed. Check your connection and try again.', 'network');
    } finally {
      clearTimeout(t);
    }
  };
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) return attempt();
    throw e;
  }
}

/** Reads one of your own photos through the API (no storage CORS needed). */
export async function fetchOwnPhoto(url: string): Promise<Blob> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/uploads/mine?url=${encodeURIComponent(url)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Could not read photo');
  return res.blob();
}
