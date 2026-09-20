"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

type ParsedExperience = { organisation: string; role: string; experienceType?: string; description?: string };
type ParsedProject = { title: string; description?: string; techStack: string[] };
type ParseResult = { skills: string[]; experiences: ParsedExperience[]; projects: ParsedProject[]; stub: boolean };

export function ParseResumeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  async function handleParse() {
    setParsing(true);
    const res = await fetch("/api/ai/parse-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setParsing(false);
    if (!res.ok) {
      toast.error("Couldn't parse that text.");
      return;
    }
    const data: ParseResult = await res.json();
    setResult(data);
    setSelectedSkills(new Set(data.skills));
    if (data.stub) toast.info("AI isn't configured — showing best-effort matches against your college's known skill list.");
  }

  function toggleSkill(name: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleApply() {
    if (!result) return;
    setApplying(true);
    const requests: Promise<Response>[] = [];
    if (selectedSkills.size > 0) {
      requests.push(fetch("/api/profile/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillNames: [...selectedSkills] }) }));
    }
    for (const exp of result.experiences) {
      requests.push(fetch("/api/profile/experiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exp) }));
    }
    for (const proj of result.projects) {
      requests.push(fetch("/api/profile/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(proj) }));
    }
    await Promise.all(requests);
    setApplying(false);
    toast.success("Profile updated from resume.");
    setOpen(false);
    setResult(null);
    setText("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setResult(null);
          setText("");
        }
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" /> Import from resume
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from resume</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">Paste your resume text below — we&apos;ll pull out skills, experience and projects for you to review before adding them to your profile.</p>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste resume text here…" />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="button" disabled={parsing || text.trim().length < 20} onClick={handleParse}>
                {parsing ? "Parsing…" : "Parse resume"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            <div>
              <div className="mb-1.5 text-sm font-medium">Skills ({selectedSkills.size} selected)</div>
              <div className="flex flex-wrap gap-1.5">
                {result.skills.length === 0 && <p className="text-muted-foreground text-sm">No skills detected.</p>}
                {result.skills.map((s) => (
                  <button key={s} type="button" onClick={() => toggleSkill(s)}>
                    <Badge variant={selectedSkills.has(s) ? "default" : "outline"} className="cursor-pointer border-none">{s}</Badge>
                  </button>
                ))}
              </div>
            </div>

            {result.experiences.length > 0 && (
              <div>
                <div className="mb-1.5 text-sm font-medium">Experience</div>
                <div className="flex flex-col gap-2">
                  {result.experiences.map((e, i) => (
                    <div key={i} className="rounded-md border p-2 text-sm">
                      <div className="font-medium">{e.role} — {e.organisation}</div>
                      {e.experienceType && <div className="text-muted-foreground text-xs">{e.experienceType}</div>}
                      {e.description && <div className="text-muted-foreground mt-1 text-xs">{e.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.projects.length > 0 && (
              <div>
                <div className="mb-1.5 text-sm font-medium">Projects</div>
                <div className="flex flex-col gap-2">
                  {result.projects.map((p, i) => (
                    <div key={i} className="rounded-md border p-2 text-sm">
                      <div className="font-medium">{p.title}</div>
                      {p.description && <div className="text-muted-foreground mt-1 text-xs">{p.description}</div>}
                      {p.techStack.length > 0 && <div className="text-muted-foreground mt-1 text-xs">{p.techStack.join(", ")}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResult(null)}>Back</Button>
              <Button type="button" disabled={applying} onClick={handleApply}>{applying ? "Adding…" : "Add to profile"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
