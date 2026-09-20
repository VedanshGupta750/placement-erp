"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bot, Send, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CopilotAction = { label: string; href: string };
type Message = { role: "user" | "assistant"; text: string; actions?: CopilotAction[] };

export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Ask me anything about your placement drives, students, or offers — e.g. \"which department has the highest placement rate?\"" },
  ]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const openCopilot = () => setOpen(true);
    window.addEventListener("open-tpo-copilot", openCopilot);
    return () => window.removeEventListener("open-tpo-copilot", openCopilot);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setPending(true);
    const res = await fetch("/api/ai/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    setPending(false);
    if (res.ok) {
      const { answer, actions } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: answer, actions }]);
    } else {
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, something went wrong answering that." }]);
    }
  }

  if (!open) return null;

  return (
    <div className="bg-card fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex h-[min(28rem,calc(100dvh-8rem))] w-[calc(100vw-2rem)] max-w-80 flex-col overflow-hidden rounded-xl border shadow-xl sm:right-6 lg:bottom-6">
      <div className="bg-primary text-primary-foreground flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4" /> TPO Copilot
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex max-w-[85%] flex-col gap-1.5", m.role === "user" ? "ml-auto items-end" : "items-start")}>
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            >
              {m.text}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.actions.map((a, j) => (
                  <Link
                    key={j}
                    href={a.href}
                    className="border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    {a.label} <ArrowRight className="size-3" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {pending && <div className="bg-accent text-accent-foreground max-w-[85%] rounded-lg px-3 py-2 text-sm">Thinking…</div>}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-2">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question…" disabled={pending} />
        <Button type="submit" size="icon" disabled={pending || !question.trim()} aria-label="Send">
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
