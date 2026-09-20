"use client";

import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string | null;
  senderName: string | null;
  systemGenerated: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSizeBytes: number | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// "Today" / "Yesterday" / "12 Aug 2026" separator label for a day-group.
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function MessageThread({
  messages,
  currentUserId,
  isGroup,
  otherLastReadAt,
}: {
  messages: ThreadMessage[];
  currentUserId: string;
  isGroup: boolean;
  // The other participant's lastReadAt (1:1 only) — used for a single
  // honest "Seen" marker on your own latest message. The schema tracks one
  // timestamp per participant, not per-message read state, so we don't show
  // per-message delivery ticks that would imply more precision than we have.
  otherLastReadAt: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const myLastMessage = [...messages].reverse().find((m) => m.senderId === currentUserId && !m.systemGenerated);
  const seenAt =
    !isGroup && myLastMessage && otherLastReadAt && new Date(otherLastReadAt) >= new Date(myLastMessage.createdAt)
      ? otherLastReadAt
      : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
      {messages.length === 0 && (
        <p className="text-muted-foreground py-10 text-center text-sm">No messages yet — say hello.</p>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((m, index) => {
          const mine = m.senderId === currentUserId;
          const thisDay = dayLabel(m.createdAt);
          const previousDay = index > 0 ? dayLabel(messages[index - 1].createdAt) : "";
          const showDay = thisDay !== previousDay;

          return (
            <div key={m.id} className="flex flex-col gap-3">
              {showDay && (
                <div className="flex justify-center">
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px]">{thisDay}</span>
                </div>
              )}

              {m.systemGenerated ? (
                <div className="text-muted-foreground text-center text-xs">{m.body}</div>
              ) : (
                <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  {isGroup && !mine && m.senderName && (
                    <span className="text-muted-foreground mb-0.5 px-1 text-[11px] font-medium">{m.senderName}</span>
                  )}

                  <div
                    className={cn(
                      "max-w-[88%] overflow-hidden rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap sm:max-w-[75%]",
                      mine ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {m.body && <span>{m.body}</span>}

                    {m.attachmentUrl && (
                      <a
                        href={m.attachmentUrl}
                        download={m.attachmentName ?? "attachment"}
                        className={cn(
                          "mt-2 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:underline",
                          mine ? "border-primary-foreground/25" : "border-border bg-background/60",
                          !m.body && "mt-0",
                        )}
                      >
                        <FileText className="size-3.5 shrink-0" />
                        <span className="min-w-0 max-w-40 truncate font-medium">{m.attachmentName ?? "Attachment"}</span>
                        {m.attachmentSizeBytes != null && (
                          <span className="opacity-70">{formatSize(m.attachmentSizeBytes)}</span>
                        )}
                      </a>
                    )}
                  </div>

                  <span className="text-muted-foreground mt-0.5 px-1 text-[10px]">{formatTime(m.createdAt)}</span>

                  {seenAt && myLastMessage?.id === m.id && (
                    <span className="text-muted-foreground px-1 text-[10px]">Seen {formatTime(seenAt)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
