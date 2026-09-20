// Shared by every "upload a small image, no object storage backend"
// endpoint (college logo, user avatar, user cover photo). Converts to a
// data URI stored directly on the owning row — see app/api/settings/college/logo/route.ts
// for why: real object storage isn't wired up in this repo yet, and a data
// URI needs no storage backend and survives redeploys, unlike writing to
// the local filesystem would on most hosts.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — client-side callers downscale first (see resize-image-client.ts), this is the backstop
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export type ImageUploadResult = { ok: true; dataUri: string } | { ok: false; message: string };

export async function readImageAsDataUri(file: File): Promise<ImageUploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: "Image must be a PNG, JPEG, WebP, or SVG file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Image must be under 5MB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return { ok: true, dataUri: `data:${file.type};base64,${bytes.toString("base64")}` };
}
