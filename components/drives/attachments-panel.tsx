"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Document = { id: string; label: string | null; originalName: string; sizeBytes: number; createdAt: string; dataUrl: string | null };

export function AttachmentsPanel({ driveId, documents, canEdit }: { driveId: string; documents: Document[]; canEdit: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/drives/${driveId}/documents`, { method: "POST", body: fd });
    setPending(false);
    if (res.ok) {
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error("Upload failed.");
    }
  }

  async function handleDelete(docId: string) {
    const res = await fetch(`/api/drives/${driveId}/documents/${docId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <form ref={formRef} onSubmit={handleUpload} className="flex items-center gap-2">
          <Input type="file" name="file" required className="max-w-xs" />
          <Input type="text" name="label" placeholder="Label (optional)" className="max-w-40" />
          <Button type="submit" size="sm" disabled={pending}>
            <Upload className="size-3.5" /> {pending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      )}
      <div className="flex flex-col gap-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="text-muted-foreground size-4" />
              <div>
                {d.dataUrl ? (
                  <a href={d.dataUrl} download={d.originalName} className="font-medium hover:underline">{d.label || d.originalName}</a>
                ) : (
                  <div className="font-medium">{d.label || d.originalName}</div>
                )}
                <div className="text-muted-foreground text-xs">{d.originalName} · {formatSize(d.sizeBytes)}</div>
              </div>
            </div>
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} aria-label="Delete attachment">
                <Trash2 className="text-muted-foreground size-3.5" />
              </Button>
            )}
          </div>
        ))}
        {documents.length === 0 && <p className="text-muted-foreground text-sm">No attachments uploaded yet.</p>}
      </div>
    </div>
  );
}
