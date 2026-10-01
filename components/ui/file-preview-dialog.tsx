"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isIosDevice } from "@/lib/pwa/push-client";

type Props = {
  /** data: URI as stored on File.dataUrl. */
  dataUrl: string | null;
  /** Shown as the dialog title and used as the download filename. */
  name: string;
  mimeType?: string | null;
  /** Rendered in place of the default "Preview" button. */
  trigger?: React.ReactNode;
};

// Reads a file inline instead of downloading it. Files are stored as data:
// URIs, and Chrome refuses to render a data: URL for a PDF inside an iframe,
// so the URI is converted to a blob: URL first — same bytes, an origin the
// PDF viewer will accept, and revoked again when the dialog closes.
export function FilePreviewDialog({ dataUrl, name, mimeType, trigger }: Props) {
  const [open, setOpen] = useState(false);
  // iOS has no inline PDF viewer for iframes — on iPhone and iPad, including
  // the installed PWA, the frame renders blank. Detected when the dialog
  // opens (not during render, which must stay pure and SSR-safe) so those
  // devices get a working "open it" path instead of an empty box.
  const [isIos, setIsIos] = useState(false);

  const type = mimeType ?? (dataUrl ? dataUrl.slice(5, dataUrl.indexOf(";")) : "");
  const isPdf = type === "application/pdf";
  const isImage = type.startsWith("image/");
  const canPreviewInline = isPdf || isImage;

  // Derived rather than stored: building the blob in an effect and then
  // setState-ing it causes a second render for no reason, and is the
  // cascading-render pattern the React lint rule warns about.
  const preview = useMemo(() => {
    if (!open || !dataUrl || !canPreviewInline) return null;
    try {
      const [meta, b64] = dataUrl.split(",");
      const binary = atob(b64 ?? "");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return { url: URL.createObjectURL(new Blob([bytes], { type: meta.slice(5).replace(";base64", "") })), error: null };
    } catch {
      return { url: null, error: "This file couldn't be read. It may be corrupted." };
    }
  }, [open, dataUrl, canPreviewInline]);

  const blobUrl = preview?.url ?? null;
  const error = preview?.error ?? null;

  // The only job left for an effect: release the blob when the dialog closes,
  // so it doesn't sit in memory for the rest of the session.
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  if (!dataUrl) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <FileText className="size-3.5" /> No file attached
      </span>
    );
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Eye className="size-3.5" /> Preview
          </Button>
        )}
      </span>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setIsIos(isIosDevice());
          setOpen(next);
        }}
      >
        <DialogContent className="flex h-[85dvh] max-w-[calc(100%-1rem)] flex-col gap-3 sm:h-[90dvh] sm:max-w-5xl">
          <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pr-8">
            <DialogTitle className="truncate text-base">{name}</DialogTitle>
            <Button variant="outline" size="sm" render={<a href={dataUrl} download={name} />}>
              <Download className="size-3.5" /> Download
            </Button>
          </DialogHeader>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {!error && canPreviewInline && blobUrl && (
            isPdf && isIos ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <FileText className="text-muted-foreground size-10" />
                <div>
                  <p className="text-sm font-medium">Open this PDF in a new tab</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    iPhone and iPad can&apos;t show a PDF inside the app, so it opens in the system viewer.
                  </p>
                </div>
                <Button render={<a href={blobUrl} target="_blank" rel="noreferrer" />}>
                  <Eye className="size-3.5" /> Open {name}
                </Button>
              </div>
            ) : isPdf ? (
              <iframe src={blobUrl} title={name} className="min-h-0 w-full flex-1 rounded-md border" />
            ) : (
              <div className="min-h-0 flex-1 overflow-auto rounded-md border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={blobUrl} alt={name} className="mx-auto max-w-full" />
              </div>
            )
          )}

          {!error && !canPreviewInline && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <FileText className="text-muted-foreground size-10" />
              <div>
                <p className="text-sm font-medium">This format can&apos;t be shown in the browser</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Word documents have no built-in viewer. Download it to open, or ask the student to upload a PDF.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
