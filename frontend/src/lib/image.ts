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

/** A heavily blurred, tiny copy of an image — what others see when photo blur is on. */
export async function makeBlurred(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not process the image.'));
      i.src = url;
    });
    // Downscale hard (destroys detail), then blur while scaling back up.
    const small = document.createElement('canvas');
    const sw = 24;
    small.width = sw;
    small.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * sw));
    small.getContext('2d')!.drawImage(img, 0, 0, small.width, small.height);
    const out = document.createElement('canvas');
    out.width = 480;
    out.height = Math.round((small.height / small.width) * 480);
    const ctx = out.getContext('2d')!;
    ctx.filter = 'blur(18px)';
    ctx.drawImage(small, -20, -20, out.width + 40, out.height + 40);
    const b = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/jpeg', 0.7));
    if (!b) throw new Error('Could not process the image.');
    return b;
  } finally {
    URL.revokeObjectURL(url);
  }
}
