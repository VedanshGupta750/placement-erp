"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

export type ParsedJd = {
  title: string;
  companyName: string;
  positionType: "JOB" | "INTERNSHIP" | "JOB_AND_INTERNSHIP";
  employmentType: "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "INTERNSHIP_PLUS_PPO";
  locationCategory: "ON_CAMPUS" | "OFF_CAMPUS" | "POOL_CAMPUS" | "VIRTUAL";
  minCtc: number | null;
  maxCtc: number | null;
  maxStipend: number | null;
  expectedOpenings: number | null;
  eligibilityCriteria: string;
  selectionProcessDetails: string;
  skillNames: string[];
  courseNames: string[];
};

export function ParseJdDialog({ onParsed }: { onParsed: (parsed: ParsedJd) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function handleParse() {
    setPending(true);
    const res = await fetch("/api/ai/parse-jd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Couldn't parse that job description.");
      return;
    }
    const data: ParsedJd & { stub: boolean } = await res.json();
    onParsed(data);
    if (data.stub) toast.info("AI isn't configured — filled in a best-effort draft, please review every field.");
    else toast.success("Drive details filled in — review before saving.");
    setOpen(false);
    setText("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Fill from job description
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fill from job description</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">Paste the recruiter&apos;s job description — we&apos;ll draft the drive fields below for you to review.</p>
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste job description here…" />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="button" disabled={pending || text.trim().length < 20} onClick={handleParse}>
              {pending ? "Parsing…" : "Parse & fill form"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
