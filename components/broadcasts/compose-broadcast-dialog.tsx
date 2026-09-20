"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Template = { id: string; name: string; subject: string; body: string };
type Batch = { id: string; year: number };
type Department = { id: string; name: string };
type Course = { id: string; name: string; degree: string };

const AUDIENCE_LABEL: Record<string, string> = {
  ALL_STUDENTS: "All students",
  ALL_STAFF: "All staff",
  BATCH: "A specific batch",
  DEPARTMENT: "A specific department",
  COURSE: "A specific course",
  ROLE: "A specific role",
};

export function ComposeBroadcastDialog({
  templates,
  batches,
  departments,
  courses,
  roleNames,
}: {
  templates: Template[];
  batches: Batch[];
  departments: Department[];
  courses: Course[];
  roleNames: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState("ALL_STUDENTS");
  const [audienceBatchId, setAudienceBatchId] = useState("");
  const [audienceDepartmentId, setAudienceDepartmentId] = useState("");
  const [audienceCourseId, setAudienceCourseId] = useState("");
  const [audienceRole, setAudienceRole] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  useEffect(() => {
    if (!open) return;
    const audience = { audienceType, audienceBatchId, audienceDepartmentId, audienceCourseId, audienceRole };
    if (audienceType === "BATCH" && !audienceBatchId) return setAudienceCount(null);
    if (audienceType === "DEPARTMENT" && !audienceDepartmentId) return setAudienceCount(null);
    if (audienceType === "COURSE" && !audienceCourseId) return setAudienceCount(null);
    if (audienceType === "ROLE" && !audienceRole) return setAudienceCount(null);

    const t = setTimeout(async () => {
      const res = await fetch("/api/broadcasts/preview-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(audience),
      });
      if (res.ok) setAudienceCount((await res.json()).count);
    }, 200);
    return () => clearTimeout(t);
  }, [open, audienceType, audienceBatchId, audienceDepartmentId, audienceCourseId, audienceRole]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const createRes = await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, audienceType, audienceBatchId: audienceBatchId || undefined, audienceDepartmentId: audienceDepartmentId || undefined, audienceCourseId: audienceCourseId || undefined, audienceRole: audienceRole || undefined }),
    });
    if (!createRes.ok) {
      setPending(false);
      toast.error("Couldn't create broadcast.");
      return;
    }
    const { id } = await createRes.json();
    const sendRes = await fetch(`/api/broadcasts/${id}/send`, { method: "POST" });
    setPending(false);
    if (sendRes.ok) {
      const { recipientCount } = await sendRes.json();
      toast.success(`Sent to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}.`);
      setOpen(false);
      setSubject("");
      setBody("");
      router.refresh();
    } else {
      toast.error("Broadcast saved as draft but sending failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Send className="size-4" /> New broadcast
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compose broadcast</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {templates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Start from a template</Label>
              <Select onValueChange={(v: string | null) => v && applyTemplate(v)}>
                <SelectTrigger><SelectValue placeholder="Choose a template (optional)" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Audience</Label>
            <Select value={audienceType} onValueChange={(v) => v && setAudienceType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(AUDIENCE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {audienceType === "BATCH" && (
            <Select value={audienceBatchId} onValueChange={(v) => v && setAudienceBatchId(v)}>
              <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {audienceType === "DEPARTMENT" && (
            <Select value={audienceDepartmentId} onValueChange={(v) => v && setAudienceDepartmentId(v)}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {audienceType === "COURSE" && (
            <Select value={audienceCourseId} onValueChange={(v) => v && setAudienceCourseId(v)}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.degree})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {audienceType === "ROLE" && (
            <Select value={audienceRole} onValueChange={(v) => v && setAudienceRole(v)}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {roleNames.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {audienceCount !== null && (
            <p className="text-muted-foreground text-sm">Will reach {audienceCount} recipient{audienceCount === 1 ? "" : "s"}.</p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || !audienceCount}>{pending ? "Sending…" : "Send now"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
