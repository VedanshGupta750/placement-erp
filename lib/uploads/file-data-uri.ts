// General-purpose sibling to image-data-uri.ts for non-image attachments
// (resumes, MOUs, contracts). Same rationale: no object storage backend in
// this repo, so the file is stored as a data URI directly on its owning row.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type FileUploadResult = { ok: true; dataUri: string } | { ok: false; message: string };

export async function readFileAsDataUri(file: File): Promise<FileUploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: "File must be a PDF, Word, Excel, or image file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "File must be under 5MB." };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return { ok: true, dataUri: `data:${file.type};base64,${bytes.toString("base64")}` };
}
