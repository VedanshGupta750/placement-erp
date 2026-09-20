"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, ShieldCheck, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type StudentDoc = {
  id: string;
  fileName: string;
  url: string;
  category: string;
  sizeBytes: number;
  uploadedByName: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  RESUME: "Resume",
  TENTH_MARKSHEET: "10th Marksheet",
  TWELFTH_MARKSHEET: "12th Marksheet",
  DIPLOMA_MARKSHEET: "Diploma Marksheet",
  SEMESTER_MARKSHEET: "Semester Marksheet",
  ID_PROOF: "ID Proof",
  CERTIFICATE: "Certificate",
  OFFER_LETTER: "Offer Letter",
  JOINING_LETTER: "Joining Letter",
  OTHER: "Other",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsManager({ studentId, docs, canEdit }: { studentId: string; docs: StudentDoc[]; canEdit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("OTHER");
  const [uploading, setUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const res = await fetch(`/api/students/${studentId}/documents`, { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      toast.success("Document uploaded.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Upload failed.");
    }
  }

  async function remove(id: string) {
    setPendingId(id);
    const res = await fetch(`/api/students/${studentId}/documents/${id}`, { method: "DELETE" });
    setPendingId(null);
    if (res.ok) {
      toast.success("Document removed.");
      router.refresh();
    } else {
      toast.error("Couldn't remove document.");
    }
  }

  async function verify(id: string) {
    setPendingId(id);
    const res = await fetch(`/api/students/${studentId}/documents/${id}`, { method: "PATCH" });
    setPendingId(null);
    if (res.ok) {
      toast.success("Marked verified.");
      router.refresh();
    } else {
      toast.error("Couldn't verify document.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => v && setCategory(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}

      <div className="flex flex-col divide-y">
        {docs.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No documents uploaded yet.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <a href={d.url} download={d.fileName} className="truncate text-sm font-medium hover:underline">{d.fileName}</a>
              <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline">{CATEGORY_LABEL[d.category] ?? d.category}</Badge>
                <span>{formatSize(d.sizeBytes)}</span>
                {d.uploadedByName && <span>· {d.uploadedByName}</span>}
                {d.verifiedAt ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="size-3" /> Verified</span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-0.5"><ShieldQuestion className="size-3" /> Unverified</span>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-1">
                {!d.verifiedAt && (
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={pendingId === d.id} onClick={() => verify(d.id)}>
                    Verify
                  </Button>
                )}
                <button type="button" disabled={pendingId === d.id} onClick={() => remove(d.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete document">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
