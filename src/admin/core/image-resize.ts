// Shrinks an uploaded photo so it is small enough to keep in products.json.
export async function resizeToWebp(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', quality);
  // Older Safari versions can't encode WebP and fall back to PNG; use JPEG instead.
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}
