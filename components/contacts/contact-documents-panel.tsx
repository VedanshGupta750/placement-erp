"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Document = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
  uploadedBy: { name: string } | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContactDocumentsPanel({
  contactId,
  documents,
  canEdit,
}: {
  contactId: string;
  documents: Document[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch(`/api/contacts/${contactId}/documents`, { method: "POST", body: formData });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) {
      router.refresh();
      toast.success("Document uploaded.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't upload document.");
    }
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    const res = await fetch(`/api/contacts/${contactId}/documents/${docId}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      router.refresh();
      toast.success("Document removed.");
    } else {
      toast.error("Couldn't remove document.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload document"}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <a href={d.dataUrl} download={d.fileName} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate font-medium">{d.fileName}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{formatSize(d.sizeBytes)}</span>
            </a>
            <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
              <span>{d.uploadedBy?.name ?? "Unknown"} · {new Date(d.createdAt).toLocaleDateString("en-IN")}</span>
              {canEdit && (
                <Button type="button" variant="ghost" size="icon-sm" disabled={deletingId === d.id} onClick={() => handleDelete(d.id)}>
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Paperclip className="size-4" /> No documents attached yet.
          </p>
        )}
      </div>
    </div>
  );
}
