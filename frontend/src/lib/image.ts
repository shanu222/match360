/** Downscale + re-encode an image file to JPEG so uploads are small and EXIF (GPS) data is stripped. */
export async function prepareImage(file: File, max = 1280, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is too large (max 25 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read that image. Try a JPEG or PNG.'));
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process the image.');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not process the image.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
