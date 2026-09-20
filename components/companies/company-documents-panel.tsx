"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CompanyDocumentCategory =
  | "MOU"
  | "NDA"
  | "JOB_DESCRIPTION"
  | "OFFER_TEMPLATE"
  | "BROCHURE"
  | "HIRING_POLICY"
  | "SALARY_STRUCTURE"
  | "OTHER";

const CATEGORY_LABEL: Record<CompanyDocumentCategory, string> = {
  MOU: "MOU",
  NDA: "NDA",
  JOB_DESCRIPTION: "Job Description",
  OFFER_TEMPLATE: "Offer Template",
  BROCHURE: "Brochure",
  HIRING_POLICY: "Hiring Policy",
  SALARY_STRUCTURE: "Salary Structure",
  OTHER: "Other",
};

type Document = {
  id: string;
  fileName: string;
  category: CompanyDocumentCategory;
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

export function CompanyDocumentsPanel({
  companyId,
  documents,
  canEdit,
}: {
  companyId: string;
  documents: Document[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<CompanyDocumentCategory>("OTHER");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setPendingFile(e.target.files?.[0] ?? null);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!pendingFile) {
      toast.error("Choose a file to upload.");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.set("file", pendingFile);
    formData.set("category", category);
    const res = await fetch(`/api/companies/${companyId}/documents`, { method: "POST", body: formData });
    setUploading(false);
    if (res.ok) {
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
      toast.success("Document uploaded.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't upload document.");
    }
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    const res = await fetch(`/api/companies/${companyId}/documents/${docId}`, { method: "DELETE" });
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
        <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Paperclip className="size-3.5" /> {pendingFile ? pendingFile.name : "Choose file"}
          </Button>
          <Select value={category} onValueChange={(v) => v && setCategory(v as CompanyDocumentCategory)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(CATEGORY_LABEL) as [CompanyDocumentCategory, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={uploading || !pendingFile}>
            <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </form>
      )}
      <div className="flex flex-col gap-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <a href={d.dataUrl} download={d.fileName} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate font-medium">{d.fileName}</span>
              <Badge variant="outline" className="shrink-0">{CATEGORY_LABEL[d.category] ?? d.category}</Badge>
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
            <Paperclip className="size-4" /> No documents uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}
