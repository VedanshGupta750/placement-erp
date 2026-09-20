"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

type Member = { id: string; name: string; role: string; score: number | null; feedback: string | null };

// Supplementary interviewer input — see the ScorecardTemplate/panel schema
// comment for why panel scores don't automatically become the official
// result. interviewerName on RoundCandidate stays the primary/lead
// interviewer shown on the info card; this is everyone else on the panel.
export function InterviewPanelCard({ candidateId, members, canManage, canScore }: { candidateId: string; members: Member[]; canManage: boolean; canScore: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Panel Member");
  const [editing, setEditing] = useState<Record<string, { score: string; feedback: string }>>({});

  async function addMember() {
    if (!name.trim()) return;
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidateId}/panel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), role }),
    });
    setPending(false);
    if (res.ok) {
      toast.success("Panel member added.");
      setAddOpen(false);
      setName("");
      router.refresh();
    } else toast.error("Couldn't add panel member.");
  }

  async function removeMember(memberId: string) {
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidateId}/panel/${memberId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) { toast.success("Removed."); router.refresh(); } else toast.error("Couldn't remove panel member.");
  }

  async function saveScore(memberId: string) {
    const draft = editing[memberId];
    setPending(true);
    const res = await fetch(`/api/round-candidates/${candidateId}/panel/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: draft?.score || undefined, feedback: draft?.feedback || undefined }),
    });
    setPending(false);
    if (res.ok) { toast.success("Saved."); router.refresh(); } else toast.error("Couldn't save.");
  }

  const scored = members.filter((m) => m.score !== null);
  const avg = scored.length > 0 ? Math.round((scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length) * 10) / 10 : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Interview Panel</CardTitle>
        {canManage && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}><UserPlus className="size-3.5" /> Add interviewer</DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add panel member</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Interviewer name" />
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. Panel Member, Lead Interviewer)" />
              </div>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button disabled={pending || !name.trim()} onClick={addMember}>{pending ? "Adding…" : "Add"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-muted-foreground text-xs">{m.role}</div>
              </div>
              <div className="flex items-center gap-2">
                {m.score !== null && <span className="font-semibold tabular-nums">{m.score}/100</span>}
                {canManage && (
                  <Button variant="ghost" size="icon" disabled={pending} onClick={() => removeMember(m.id)} aria-label="Remove">
                    <Trash2 className="text-muted-foreground size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {m.feedback && <p className="text-muted-foreground text-xs">{m.feedback}</p>}
            {canScore && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Score"
                  className="w-20"
                  defaultValue={m.score ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: { score: e.target.value, feedback: prev[m.id]?.feedback ?? m.feedback ?? "" } }))}
                />
                <Input
                  placeholder="Feedback"
                  defaultValue={m.feedback ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: { score: prev[m.id]?.score ?? String(m.score ?? ""), feedback: e.target.value } }))}
                />
                <Button size="sm" variant="outline" disabled={pending} onClick={() => saveScore(m.id)}>Save</Button>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-muted-foreground text-sm">No additional panel members added.</p>}
        {avg !== null && (
          <div className="text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
            <span>Panel average (informational — official result is set via Evaluate)</span>
            <span className="font-medium tabular-nums">{avg}/100</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
