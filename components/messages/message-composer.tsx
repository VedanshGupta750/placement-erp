"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, FileText, X, LayoutTemplate, Smile, AtSign, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Template = { id: string; name: string; subject: string; body: string };
export type MentionablePerson = { id: string; name: string };

const EMOJIS = ["👍", "🙏", "✅", "🎉", "📌", "⏰", "📄", "🚀", "😊", "👏", "❗", "❓"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Template bodies can carry {{placeholders}}; the ones we can fill from the
// current conversation get substituted on insert, and anything left over is
// surfaced to the user rather than silently sent as literal "{{...}}" text.
function applyTemplateVariables(body: string, vars: Record<string, string>) {
  const filled = body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
  const remaining = [...filled.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
  return { filled, remaining: [...new Set(remaining)] };
}

export function MessageComposer({
  conversationId,
  templateVariables = {},
  mentionablePeople = [],
}: {
  conversationId: string;
  templateVariables?: Record<string, string>;
  mentionablePeople?: MentionablePerson[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Templates are shared with Broadcasts — fetched lazily the first time the
  // picker is opened so the composer doesn't pay for them on every render.
  useEffect(() => {
    if (!templatesOpen || templates.length > 0) return;
    fetch("/api/message-templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
        else if (Array.isArray(data?.templates)) setTemplates(data.templates);
      })
      .catch(() => {});
  }, [templatesOpen, templates.length]);

  async function submit() {
    if (pending) return;
    if (!body.trim() && !file) return;
    setPending(true);

    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("body", body.trim());
    if (file) formData.set("file", file);

    const res = await fetch("/api/messages", { method: "POST", body: formData });
    setPending(false);

    if (res.ok) {
      setBody("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.message ?? "Couldn't send message.");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  // Insert at the caret rather than always appending, so emoji/mentions land
  // where the user is actually typing.
  //
  // The focus call is deferred past the popover's own close animation: Base
  // UI restores focus to the trigger button when a popover closes, and a
  // same-frame focus() here loses that race — leaving the trigger focused, so
  // the user's next keystrokes re-activate it instead of typing. A short
  // timeout lets the restore finish first, then we take focus back.
  function insertAtCaret(text: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + text + body.slice(end));
    setTimeout(() => {
      el.focus();
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    }, 80);
  }

  async function saveDraft() {
    if (!body.trim()) return;
    setSavingDraft(true);
    const res = await fetch(`/api/messages/${conversationId}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setSavingDraft(false);
    if (res.ok) {
      setBody("");
      router.refresh();
      toast.success("Saved as a draft.");
    } else {
      toast.error("Couldn't save the draft.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t p-3">
      {file && (
        <div className="mb-2 flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs sm:w-fit">
          <FileText className="text-muted-foreground size-3.5" />
          <span className="min-w-0 max-w-50 truncate font-medium">{file.name}</span>
          <span className="text-muted-foreground">{formatSize(file.size)}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Remove attachment"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-end">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message…"
          rows={2}
          className="max-h-40 min-h-10 min-w-0 flex-1 resize-none"
          disabled={pending}
        />
        <div className="flex items-center justify-end gap-1 overflow-x-auto pb-1 lg:shrink-0 lg:pb-0">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            aria-label="Attach a file"
          >
            <Paperclip className="size-4" />
          </Button>

          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Insert a template" />}>
              <LayoutTemplate className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="border-b px-3 py-2 text-xs font-medium">Message templates</div>
              {templates.length === 0 ? (
                <p className="text-muted-foreground p-3 text-xs">
                  No templates yet — create them under Broadcasts.
                </p>
              ) : (
                <ul className="max-h-64 divide-y overflow-y-auto">
                  {templates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const { filled, remaining } = applyTemplateVariables(t.body, templateVariables);
                          setBody(filled);
                          setTemplatesOpen(false);
                          if (remaining.length > 0) {
                            toast.info(`Fill in manually: ${remaining.map((r) => `{{${r}}}`).join(", ")}`);
                          }
                        }}
                        className="hover:bg-accent/60 w-full px-3 py-2 text-left"
                      >
                        <div className="truncate text-xs font-medium">{t.name}</div>
                        <div className="text-muted-foreground line-clamp-2 text-xs">{t.body}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>

          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Insert an emoji" />}>
              <Smile className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertAtCaret(emoji);
                      setEmojiOpen(false);
                    }}
                    className="hover:bg-accent rounded-md p-1.5 text-base leading-none transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {mentionablePeople.length > 0 && (
            <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
              <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Mention someone" />}>
                <AtSign className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0">
                <div className="border-b px-3 py-2 text-xs font-medium">Mention</div>
                <ul className="max-h-56 divide-y overflow-y-auto">
                  {mentionablePeople.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          insertAtCaret(`@${p.name} `);
                          setMentionOpen(false);
                        }}
                        className="hover:bg-accent/60 w-full truncate px-3 py-2 text-left text-xs"
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={savingDraft || !body.trim()}
            onClick={saveDraft}
            aria-label="Save as draft"
            title="Save as draft to send later yourself"
          >
            <NotebookPen className="size-4" />
          </Button>

          <Button type="submit" size="icon-sm" disabled={pending || (!body.trim() && !file)} aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
