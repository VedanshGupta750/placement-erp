"use client";

// Real camera/phone photos routinely land at 3-10MB, well past what's sane
// to store as a base64 data URI on a user row (see image-data-uri.ts for
// why there's no object storage backend). Rather than reject those photos
// outright, downscale to a display-appropriate size before upload — every
// avatar/cover render at well under 1600px, so there's no quality loss a
// user would notice. SVGs pass through untouched (already tiny, and canvas
// rasterizing would defeat the point of them being vector).
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export async function resizeImageForUpload(file: File): Promise<File> {
  if (file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob || blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
