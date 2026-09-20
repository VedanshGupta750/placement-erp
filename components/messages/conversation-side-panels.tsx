"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Briefcase, ArrowUpRight, History, NotebookPen, X } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

export type SharedFile = {
  id: string;
  url: string;
  name: string;
  sizeBytes: number | null;
  createdAt: string;
  senderName: string | null;
};

export type DriveContext = {
  id: string;
  title: string;
  status: string;
  companyName: string | null;
  applications: number;
  shortlisted: number;
  interviews: number;
  offers: number;
};

export type ActivityEvent = {
  id: string;
  label: string;
  detail: string | null;
  actorName: string | null;
  at: string;
};

export type Draft = { id: string; body: string; createdAt: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Right-hand rail for a conversation: an Info tab (drive context, the
// recruitment-request detector, and whatever profile panel the page passes
// in) and a Files tab listing every attachment shared in the thread.
export function ConversationSidePanels({
  driveContext,
  files,
  activity,
  drafts,
  conversationId,
  requestDetector,
  driveLinker,
  children,
}: {
  driveContext: DriveContext | null;
  files: SharedFile[];
  activity: ActivityEvent[];
  drafts: Draft[];
  conversationId: string;
  requestDetector: ReactNode;
  driveLinker: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"info" | "files" | "activity">("info");

  async function discardDraft(draftId: string) {
    const res = await fetch(`/api/messages/${conversationId}/drafts/${draftId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      toast.success("Draft discarded.");
    } else {
      toast.error("Couldn't discard the draft.");
    }
  }

  return (
    <div className="flex h-auto min-h-0 flex-col gap-3 xl:h-full">
      <div className="flex items-center gap-1 rounded-lg border p-1">
        {(["info", "files", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t}
            {((t === "files" && files.length > 0) || (t === "activity" && activity.length > 0)) && (
              <span
                className={cn(
                  "ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px]",
                  tab === t ? "bg-primary-foreground/20" : "bg-muted-foreground/20",
                )}
              >
                {t === "files" ? files.length : activity.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-visible xl:overflow-y-auto">
        {tab === "info" ? (
          <div className="flex flex-col gap-3">
            {!driveContext && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Briefcase className="size-3.5" /> Related drive
                </div>
                <p className="text-muted-foreground mt-1 mb-2 text-xs">
                  Link this conversation to a drive to see live application and offer counts here.
                </p>
                {driveLinker}
              </div>
            )}

            {driveContext && (
              <div className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Briefcase className="size-3.5" /> Related drive
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{driveContext.title}</p>
                    {driveContext.companyName && (
                      <p className="text-muted-foreground truncate text-xs">{driveContext.companyName}</p>
                    )}
                  </div>
                  <StatusBadge status={driveContext.status} />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                  {[
                    ["Applications", driveContext.applications],
                    ["Shortlisted", driveContext.shortlisted],
                    ["Interviews", driveContext.interviews],
                    ["Offers", driveContext.offers],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border py-1.5">
                      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                      <dt className="text-muted-foreground text-[11px]">{label}</dt>
                    </div>
                  ))}
                </dl>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <Link
                    href={`/drives/${driveContext.id}`}
                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    View drive <ArrowUpRight className="size-3" />
                  </Link>
                  {driveLinker}
                </div>
              </div>
            )}

            {drafts.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <NotebookPen className="size-3.5" /> Your drafts
                </div>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Saved for you to send yourself — nothing goes out automatically.
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {drafts.map((d) => (
                    <li key={d.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-3 block">{d.body}</span>
                        <span className="text-muted-foreground block">
                          {new Date(d.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => discardDraft(d.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label="Discard draft"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requestDetector}
            {children}
          </div>
        ) : tab === "files" ? (
          <div className="flex flex-col gap-2">
            {files.length === 0 ? (
              <p className="text-muted-foreground text-xs">No files shared in this conversation yet.</p>
            ) : (
              files.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  download={f.name}
                  className="hover:bg-accent/50 flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors"
                >
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-muted-foreground block truncate">
                      {[f.senderName, f.sizeBytes != null ? formatSize(f.sizeBytes) : null, new Date(f.createdAt).toLocaleDateString("en-IN")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activity.length === 0 ? (
              <p className="text-muted-foreground text-xs">No recorded activity for this conversation yet.</p>
            ) : (
              activity.map((e) => (
                <div key={e.id} className="flex gap-2 rounded-md border px-2.5 py-2 text-xs">
                  <History className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{e.label}</p>
                    {e.detail && <p className="text-muted-foreground truncate">{e.detail}</p>}
                    <p className="text-muted-foreground">
                      {[e.actorName, new Date(e.at).toLocaleString("en-IN")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
