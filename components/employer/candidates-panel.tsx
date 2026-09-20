"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileText, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Round = {
  roundName: string;
  roundType: string;
  status: string;
  mode: string;
  scheduledAt: string | null;
  venue: string | null;
  meetingUrl: string | null;
  score: number | null;
  resultPublished: boolean;
};

type Offer = {
  status: string;
  totalCompensation: number;
  offerDate: string | null;
  joiningDate: string | null;
  joiningStatus: string | null;
};

type Candidate = {
  id: string;
  status: string;
  matchScore: number | null;
  matchedSkills: string[];
  student: {
    enrollmentNumber: string;
    course: { specialization: string | null; name: string };
    aggregate: number | null;
    aggregateType: string;
    user: { name: string; email: string; phone: string | null };
    skills: string[];
  };
  resume: { name: string; originalName: string | null; dataUrl: string | null } | null;
  rounds: Round[];
  offer: Offer | null;
};

const STATUS_FILTERS = ["ALL", "APPLIED", "COLLEGE_APPROVED", "SCREENING", "SHORTLISTED", "ROUND_IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"];

export function CandidatesPanel({ applications }: { applications: Candidate[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (!q) return true;
      return a.student.user.name.toLowerCase().includes(q) || a.student.enrollmentNumber.toLowerCase().includes(q);
    });
  }, [applications, search, statusFilter]);

  async function act(applicationId: string, action: string) {
    setPendingId(applicationId);
    const res = await fetch(`/api/employer/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPendingId(null);
    if (res.ok) {
      toast.success("Candidate updated");
      router.refresh();
    } else {
      toast.error("Couldn't update candidate.");
    }
  }

  if (applications.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">No candidates have applied yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search by name or enrollment no…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-accent border-transparent"
              }`}
            >
              {s === "ALL" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col divide-y">
        {filtered.map((a) => {
          const expanded = expandedId === a.id;
          return (
            <div key={a.id} className="py-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : a.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(expanded ? null : a.id); } }}
                className="hover:bg-accent/40 -mx-2 flex w-full flex-wrap items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expanded ? <ChevronDown className="text-muted-foreground size-4 shrink-0" /> : <ChevronRight className="text-muted-foreground size-4 shrink-0" />}
                  <div>
                    <div className="font-medium">{a.student.user.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.student.course.specialization ?? a.student.course.name} · {a.student.enrollmentNumber}
                      {a.matchScore !== null ? ` · ${a.matchScore}% skill match` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <StatusBadge status={a.status} />
                  {["APPLIED", "COLLEGE_APPROVED", "SCREENING"].includes(a.status) && (
                    <>
                      <Button size="sm" disabled={pendingId === a.id} onClick={() => act(a.id, "shortlist")}>Shortlist</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={pendingId === a.id} onClick={() => act(a.id, "reject")}>Reject</Button>
                    </>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="bg-muted/30 mt-1 flex flex-col gap-4 rounded-md p-4 text-sm">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-muted-foreground text-xs font-medium">Contact</div>
                      <a href={`mailto:${a.student.user.email}`} className="flex items-center gap-1.5 hover:underline">
                        <Mail className="size-3.5" /> {a.student.user.email}
                      </a>
                      {a.student.user.phone && (
                        <a href={`tel:${a.student.user.phone}`} className="flex items-center gap-1.5 hover:underline">
                          <Phone className="size-3.5" /> {a.student.user.phone}
                        </a>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="text-muted-foreground text-xs font-medium">Academics</div>
                      <div>{a.student.aggregateType}: {a.student.aggregate ?? "—"}</div>
                      {a.resume && (
                        a.resume.dataUrl ? (
                          <a href={a.resume.dataUrl} download={a.resume.originalName ?? undefined} className="text-primary flex items-center gap-1.5 hover:underline">
                            <FileText className="size-3.5" /> {a.resume.name}
                          </a>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <FileText className="size-3.5" /> {a.resume.name} (not downloadable)
                          </span>
                        )
                      )}
                      {!a.resume && <span className="text-muted-foreground">No resume attached.</span>}
                    </div>
                  </div>

                  {a.student.skills.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-muted-foreground text-xs font-medium">Skills</div>
                      <div className="flex flex-wrap gap-1">
                        {a.student.skills.map((s) => (
                          <Badge key={s} variant={a.matchedSkills.includes(s) ? "default" : "outline"} className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.rounds.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-muted-foreground text-xs font-medium">Interview rounds</div>
                      <div className="flex flex-col gap-2">
                        {a.rounds.map((r, i) => (
                          <div key={i} className="bg-background flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                            <div>
                              <div className="font-medium">{r.roundName}</div>
                              <div className="text-muted-foreground text-xs">
                                {r.mode}
                                {r.scheduledAt ? ` · ${new Date(r.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                                {r.venue ? ` · ${r.venue}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.meetingUrl && (
                                <a href={r.meetingUrl} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">Join link</a>
                              )}
                              {r.resultPublished && r.score !== null && <span className="text-xs font-medium">Score: {r.score}</span>}
                              <StatusBadge status={r.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.offer && (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-muted-foreground text-xs font-medium">Offer</div>
                      <div className="bg-background flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                        <div>
                          <div className="font-medium">₹{(a.offer.totalCompensation / 100000).toFixed(1)}L CTC</div>
                          <div className="text-muted-foreground text-xs">
                            {a.offer.offerDate ? `Offered ${new Date(a.offer.offerDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}
                            {a.offer.joiningDate ? ` · Joining ${new Date(a.offer.joiningDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={a.offer.status} />
                          {a.offer.joiningStatus && <StatusBadge status={a.offer.joiningStatus} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-muted-foreground py-8 text-center text-sm">No candidates match your search.</p>}
      </div>
    </div>
  );
}
