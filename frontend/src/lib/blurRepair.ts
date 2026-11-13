import { api } from './api';
import { makeBlurred } from './image';
import { fetchOwnPhoto, uploadBlob } from './upload';
import type { Me } from './types';

const needsCopy = (u: Pick<Me, 'photos' | 'photosBlur'>, i: number) => !u.photosBlur?.[i] || u.photosBlur[i] === u.photos[i];

/** Creates blurred copies for any photo that doesn't have one yet (photos uploaded before blur existed). */
export async function ensureBlurCopies(u: Pick<Me, 'photos' | 'photosBlur'>): Promise<Me | null> {
  const missing = u.photos.map((url, i) => (needsCopy(u, i) ? url : null)).filter(Boolean) as string[];
  if (!missing.length) return null;
  const pairs: { url: string; blurUrl: string }[] = [];
  for (const url of missing) {
    try {
      const blurred = await makeBlurred(await fetchOwnPhoto(url));
      const up = await uploadBlob('photo', blurred);
      if (up.publicUrl) pairs.push({ url, blurUrl: up.publicUrl });
    } catch {
      /* try again next session */
    }
  }
  if (!pairs.length) return null;
  const r = await api.post<{ user: Me }>('/me/photos/blur', { pairs });
  return r.user;
}
export { needsCopy };
