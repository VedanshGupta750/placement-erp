"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORY_LABEL: Record<string, string> = {
  BROCHURE: "Brochure",
  AGENDA: "Agenda",
  SPEAKER_PPT: "Speaker PPT",
  ATTENDANCE_SHEET: "Attendance Sheet",
  CERTIFICATE_TEMPLATE: "Certificate Template",
  RECORDING: "Recording",
  PHOTO: "Photo",
  FEEDBACK_REPORT: "Feedback Report",
  OTHER: "Other",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL);

type EventFileRow = {
  id: string;
  name: string;
  url: string;
  category: string;
  uploadedByName: string;
  createdAt: string;
};

// Client island for the Files tab — upload form + list + delete, rendered
// by files-tab.tsx (server) which does all the data fetching and permission
// checks up front. Mirrors components/contacts/contact-documents-panel.tsx.
export function FilesManager({ eventId, canEdit, files }: { eventId: string; canEdit: boolean; files: EventFileRow[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState("OTHER");
  const [filter, setFilter] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("category", uploadCategory);
    const res = await fetch(`/api/events/${eventId}/files`, { method: "POST", body: formData });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) {
      router.refresh();
      toast.success("File uploaded.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't upload file.");
    }
  }

  async function handleDelete(fileId: string) {
    setDeletingId(fileId);
    const res = await fetch(`/api/events/${eventId}/files/${fileId}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      router.refresh();
      toast.success("File removed.");
    } else {
      toast.error("Couldn't remove file.");
    }
  }

  const visibleFiles = filter === "ALL" ? files : files.filter((f) => f.category === filter);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Files &amp; Documents</CardTitle>
        <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={uploadCategory} onValueChange={(v) => v && setUploadCategory(v)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {visibleFiles.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <a href={f.url} download={f.name} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{f.name}</span>
                <Badge variant="outline" className="shrink-0">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
                <Download className="text-muted-foreground size-3.5 shrink-0" />
              </a>
              <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                <span>
                  {f.uploadedByName} · {new Date(f.createdAt).toLocaleDateString("en-IN")}
                </span>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon-sm" disabled={deletingId === f.id} onClick={() => handleDelete(f.id)}>
                    <Trash2 className="text-destructive size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {visibleFiles.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">No files uploaded yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
