"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpTip } from "@/components/ui/help-tip";

function toList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function ProfileEditForm({
  summary,
  expertise,
  areasOfInterest,
  values,
  languagesSpeaking,
  languagesProgramming,
  awards,
}: {
  summary: string;
  expertise: string[];
  areasOfInterest: string[];
  values: string[];
  languagesSpeaking: string[];
  languagesProgramming: string[];
  awards: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      summary: (fd.get("summary") as string) || "",
      expertise: toList((fd.get("expertise") as string) || ""),
      areasOfInterest: toList((fd.get("areasOfInterest") as string) || ""),
      values: toList((fd.get("values") as string) || ""),
      languagesSpeaking: toList((fd.get("languagesSpeaking") as string) || ""),
      languagesProgramming: toList((fd.get("languagesProgramming") as string) || ""),
      awardsJson: toList((fd.get("awards") as string) || ""),
    };

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Something went wrong.");
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="summary">Summary</Label>
        <Textarea id="summary" name="summary" rows={3} defaultValue={summary} placeholder="A short intro recruiters will see first." />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expertise" className="flex items-center gap-1">
            Expertise <HelpTip text="Comma-separated, e.g. React, Node.js, SQL" />
          </Label>
          <Input id="expertise" name="expertise" defaultValue={expertise.join(", ")} placeholder="React, Node.js, SQL" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="areasOfInterest" className="flex items-center gap-1">
            Areas of interest <HelpTip text="Comma-separated" />
          </Label>
          <Input id="areasOfInterest" name="areasOfInterest" defaultValue={areasOfInterest.join(", ")} placeholder="Backend, Product" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="values" className="flex items-center gap-1">
            Values <HelpTip text="Comma-separated" />
          </Label>
          <Input id="values" name="values" defaultValue={values.join(", ")} placeholder="Ownership, Curiosity" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="languagesSpeaking" className="flex items-center gap-1">
            Languages spoken <HelpTip text="Comma-separated" />
          </Label>
          <Input id="languagesSpeaking" name="languagesSpeaking" defaultValue={languagesSpeaking.join(", ")} placeholder="English, Hindi" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="languagesProgramming" className="flex items-center gap-1">
            Programming languages <HelpTip text="Comma-separated" />
          </Label>
          <Input id="languagesProgramming" name="languagesProgramming" defaultValue={languagesProgramming.join(", ")} placeholder="TypeScript, Python" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="awards" className="flex items-center gap-1">
            Awards <HelpTip text="Comma-separated, e.g. 3rd position in IISc Bangalore Hackathon" />
          </Label>
          <Input id="awards" name="awards" defaultValue={awards.join(", ")} placeholder="3rd position in IISc Bangalore Hackathon" />
        </div>
      </div>

      {error && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
