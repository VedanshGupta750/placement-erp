"use client";

// Client-side interactivity for the Communication tab (components/events/
// communication-tab.tsx, which stays a server component). Split into its
// own file for the same reason event-register-button.tsx and
// create-event-dialog.tsx already are in this directory: a "use client"
// directive is file-scoped, so the async server tab component and its
// interactive form can't live in one module.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Audience = "REGISTERED" | "WAITLISTED" | "ELIGIBLE";

const AUDIENCE_LABEL: Record<Audience, string> = {
  REGISTERED: "Registered students",
  WAITLISTED: "Waitlisted students",
  ELIGIBLE: "Eligible students (not yet registered)",
};

export function SendAnnouncementForm({
  eventId,
  audienceCounts,
}: {
  eventId: string;
  audienceCounts: Record<Audience, number>;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("REGISTERED");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const res = await fetch(`/api/events/${eventId}/announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, body }),
    });
    setPending(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Sent to ${data.recipientCount} recipient${data.recipientCount === 1 ? "" : "s"}.`);
      setSubject("");
      setBody("");
      router.refresh();
    } else {
      toast.error("Couldn't send announcement.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Audience</Label>
        <Select value={audience} onValueChange={(v) => v && setAudience(v as Audience)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(AUDIENCE_LABEL) as [Audience, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label} ({audienceCounts[value]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announce-subject">Subject</Label>
        <Input id="announce-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="announce-body">Message</Label>
        <Textarea id="announce-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
      </div>

      <Button type="submit" disabled={pending || audienceCounts[audience] === 0} className="w-fit">
        {pending ? "Sending…" : "Send announcement"}
      </Button>
      {audienceCounts[audience] === 0 && (
        <p className="text-muted-foreground text-xs">No recipients in this audience right now.</p>
      )}
    </form>
  );
}

// Honest "send now" reminders — there is no background job runner anywhere
// in this app, so nothing here is ever "scheduled": each button fires an
// announcement to registered students immediately, on click.
const REMINDER_PRESETS = [
  {
    key: "registration_confirmation",
    label: "Registration confirmation",
    subject: (t: string) => `You're registered for ${t}`,
    body: (t: string) => `This confirms your registration for "${t}". We'll see you there!`,
  },
  {
    key: "24h_before",
    label: "24 hours before",
    subject: (t: string) => `Reminder: ${t} starts in 24 hours`,
    body: (t: string) => `This is a reminder that "${t}" starts in about 24 hours. Please plan to arrive on time.`,
  },
  {
    key: "1h_before",
    label: "1 hour before",
    subject: (t: string) => `Reminder: ${t} starts in 1 hour`,
    body: (t: string) => `This is a reminder that "${t}" starts in about 1 hour.`,
  },
  {
    key: "event_start",
    label: "Event starting now",
    subject: (t: string) => `${t} is starting now`,
    body: (t: string) => `"${t}" is starting now. Join us!`,
  },
  {
    key: "feedback_request",
    label: "Post-event feedback request",
    subject: (t: string) => `Share your feedback on ${t}`,
    body: (t: string) => `Thanks for attending "${t}". We'd love to hear your feedback — please take a moment to share it.`,
  },
];

export function ReminderButtons({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function sendReminder(preset: (typeof REMINDER_PRESETS)[number]) {
    setPendingKey(preset.key);
    const res = await fetch(`/api/events/${eventId}/announce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "REGISTERED", subject: preset.subject(eventTitle), body: preset.body(eventTitle) }),
    });
    setPendingKey(null);
    if (res.ok) {
      const data = await res.json();
      toast.success(`"${preset.label}" sent to ${data.recipientCount} recipient${data.recipientCount === 1 ? "" : "s"}.`);
      router.refresh();
    } else {
      toast.error("Couldn't send reminder.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {REMINDER_PRESETS.map((preset) => (
        <Button
          key={preset.key}
          type="button"
          variant="outline"
          size="sm"
          disabled={pendingKey !== null}
          onClick={() => sendReminder(preset)}
        >
          {pendingKey === preset.key ? "Sending…" : `Send now: ${preset.label}`}
        </Button>
      ))}
    </div>
  );
}
