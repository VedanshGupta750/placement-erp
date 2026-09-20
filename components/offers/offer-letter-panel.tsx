"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LetterFile = { originalName: string; dataUrl: string | null } | null;

export function OfferLetterPanel({ offerId, file, canUpload }: { offerId: string; file: LetterFile; canUpload: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/offers/${offerId}/letter`, { method: "POST", body: fd });
    setPending(false);
    if (res.ok) {
      formRef.current?.reset();
      toast.success("Offer letter uploaded.");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Upload failed.");
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Offer letter</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {file ? (
          file.dataUrl ? (
            <a href={file.dataUrl} download={file.originalName} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:underline">
              <FileText className="text-muted-foreground size-4" /> {file.originalName}
            </a>
          ) : (
            <p className="text-muted-foreground text-sm">A letter was attached before file download was wired up, so it isn&apos;t downloadable.</p>
          )
        ) : (
          <p className="text-muted-foreground text-sm">No offer letter uploaded yet.</p>
        )}
        {canUpload && (
          <form ref={formRef} onSubmit={handleUpload} className="flex items-center gap-2">
            <Input type="file" name="file" required className="max-w-xs" />
            <Button type="submit" size="sm" disabled={pending}>
              <Upload className="size-3.5" /> {pending ? "Uploading…" : file ? "Replace" : "Upload"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
