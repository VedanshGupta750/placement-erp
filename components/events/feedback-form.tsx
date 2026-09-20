"use client";

// Client-side interactivity for the Feedback tab (components/events/
// feedback-tab.tsx, which stays a server component). Split into its own
// file for the same reason event-register-button.tsx / create-event-dialog.tsx
// already are in this directory: "use client" is file-scoped, so it can't
// share a module with the async server tab component.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function FeedbackForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [usefulness, setUsefulness] = useState("");
  const [wouldAttendAnother, setWouldAttendAnother] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please pick a rating.");
      return;
    }
    if (wouldAttendAnother === null) {
      toast.error("Please answer whether you'd attend another session.");
      return;
    }
    setPending(true);
    const res = await fetch(`/api/events/${eventId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, usefulness, wouldAttendAnother, suggestions, anonymous }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Feedback submitted. Thank you!");
      router.refresh();
    } else {
      toast.error("Couldn't submit feedback.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
              <Star className={`size-6 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-usefulness">How useful was the session?</Label>
        <Textarea id="feedback-usefulness" rows={3} value={usefulness} onChange={(e) => setUsefulness(e.target.value)} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Would you attend another session?</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={wouldAttendAnother === true ? "default" : "outline"}
            onClick={() => setWouldAttendAnother(true)}
          >
            Yes
          </Button>
          <Button
            type="button"
            size="sm"
            variant={wouldAttendAnother === false ? "default" : "outline"}
            onClick={() => setWouldAttendAnother(false)}
          >
            No
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-suggestions">Suggestions (optional)</Label>
        <Textarea id="feedback-suggestions" rows={2} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="feedback-anonymous" checked={anonymous} onCheckedChange={(c) => setAnonymous(c === true)} />
        <Label htmlFor="feedback-anonymous" className="font-normal">
          Submit anonymously
        </Label>
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Submitting…" : "Submit feedback"}
      </Button>
    </form>
  );
}
