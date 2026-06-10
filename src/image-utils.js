/**
 * IMAGE UTILS — prepare phone photos for the OCR vision call.
 *
 * Two jobs, one canvas pass:
 *  - TRANSCODE: Android can deliver HEIC/HEIF from the gallery (iOS Safari
 *    usually transcodes to JPEG itself); the vision API wants jpeg/png/webp.
 *  - DOWNSCALE: a 12MP camera photo is ~4000px on the long edge; capping at
 *    2000px keeps the base64 payload small and the vision call fast without
 *    hurting printed-text OCR.
 */

export const OCR_SAFE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Does this mime type need a canvas transcode before the OCR call? */
export const needsTranscode = (mime) => !OCR_SAFE_TYPES.includes((mime || "").toLowerCase());

/** Target dimensions capped at `max` on the long edge (aspect preserved). */
export function downscaleDims(width, height, max = 2000) {
  if (!width || !height || (width <= max && height <= max)) {
    return { width, height, scaled: false };
  }
  const ratio = max / Math.max(width, height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio), scaled: true };
}

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error("file read failed"));
  r.readAsDataURL(file);
});

/**
 * Decode → (downscale/transcode if needed) → { dataUrl, mediaType }.
 * Already-safe, already-small images pass through byte-identical (no
 * recompression). Throws when the image is genuinely undecodable AND not a
 * type the API could handle raw — callers show the visible error idiom.
 */
export async function prepareImageForOCR(file, max = 2000) {
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    bitmap = null;
  }

  if (!bitmap) {
    // Couldn't decode locally. A safe type may still be readable by the API —
    // fall through raw. An unsafe type (HEIC we can't decode) is a dead end.
    if (!needsTranscode(file.type)) {
      return { dataUrl: await readAsDataUrl(file), mediaType: file.type || "image/jpeg" };
    }
    throw new Error("undecodable image");
  }

  const { width, height, scaled } = downscaleDims(bitmap.width, bitmap.height, max);
  if (!scaled && !needsTranscode(file.type)) {
    if (bitmap.close) bitmap.close();
    return { dataUrl: await readAsDataUrl(file), mediaType: file.type };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), mediaType: "image/jpeg" };
}
