import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Building2,
  Gauge,
  Briefcase,
  StickyNote,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

export type ContextPanelProps =
  | {
      kind: "contact";
      contact: {
        id: string;
        name: string | null;
        email: string | null;
        phone: string | null;
        location: string | null;
        linkedinUrl: string | null;
        designation: string | null;
        department: string | null;
        photoUrl: string | null;
        companyName: string | null;
        isActive: boolean;
        relationshipStage: string;
        ownerName: string | null;
        relationshipSince: string | null;
        relationshipScore: { score: number; label: "Strong" | "Moderate" | "Needs Attention" };
        activeDrives: { id: string; title: string; status: string }[];
        notes: { id: string; body: string; createdAt: string }[];
      };
    }
  | {
      kind: "user";
      user: { id: string; name: string; email: string; userType: string; avatarUrl: string | null };
      student?: {
        department: string | null;
        course: string | null;
        cgpa: number | null;
        applicationsCount: number;
        activeDrivesCount: number;
        interviewsCount: number;
        offersCount: number;
      };
    };

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function scoreTheme(label: "Strong" | "Moderate" | "Needs Attention") {
  if (label === "Strong") return "text-emerald-600 dark:text-emerald-400";
  if (label === "Moderate") return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-3">
      <CardHeader className="px-3 pb-1.5">
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pt-1.5">{children}</CardContent>
    </Card>
  );
}

export function ContextPanel(props: ContextPanelProps) {
  if (props.kind === "contact") {
    const c = props.contact;
    const name = c.name ?? "Unnamed contact";
    const stageLabel =
      RELATIONSHIP_STAGE_LABELS[c.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? c.relationshipStage;

    return (
      <div className="flex w-full flex-col gap-3 text-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 px-1 pt-1 text-center">
          <Avatar size="lg">
            {c.photoUrl && <AvatarImage src={c.photoUrl} alt={name} />}
            <AvatarFallback>{initials(c.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-semibold">{name}</span>
              <Badge
                className={
                  c.isActive
                    ? "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "border-none bg-zinc-100 text-zinc-500 dark:bg-zinc-500/15 dark:text-zinc-400"
                }
              >
                {c.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {(c.designation || c.companyName) && (
              <p className="text-muted-foreground text-xs">
                {[c.designation, c.companyName].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {c.email && (
              <Button variant="outline" size="xs" render={<a href={`mailto:${c.email}`} />}>
                <Mail className="size-3" /> Email
              </Button>
            )}
            {c.phone && (
              <Button variant="outline" size="xs" render={<a href={`tel:${c.phone}`} />}>
                <Phone className="size-3" /> Call
              </Button>
            )}
          </div>
        </div>

        {/* About */}
        <SectionCard title="About">
          <div className="flex flex-col gap-2">
            {c.email && (
              <div className="flex items-center gap-2 text-xs">
                <Mail className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{c.email}</span>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{c.phone}</span>
              </div>
            )}
            {c.location && (
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{c.location}</span>
              </div>
            )}
            {c.linkedinUrl && (
              <a
                href={c.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary flex items-center gap-2 text-xs hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" /> <span className="truncate">LinkedIn</span>
              </a>
            )}
            {c.companyName && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{c.companyName}</span>
              </div>
            )}
            {!c.email && !c.phone && !c.location && !c.linkedinUrl && !c.companyName && (
              <p className="text-muted-foreground text-xs">No contact details on file.</p>
            )}
          </div>
        </SectionCard>

        {/* Relationship */}
        <SectionCard title="Relationship">
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span>{c.ownerName ?? "Unassigned"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Since</span>
              <span>{c.relationshipSince ? new Date(c.relationshipSince).toLocaleDateString("en-IN") : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stage</span>
              <Badge variant="outline">{stageLabel}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 border-t pt-2">
              <div className="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 flex size-7 shrink-0 items-center justify-center rounded-full">
                <Gauge className="size-3.5" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-base font-bold tabular-nums ${scoreTheme(c.relationshipScore.label)}`}>
                    {c.relationshipScore.score}
                  </span>
                  <Badge variant="secondary" className="border-none">
                    {c.relationshipScore.label}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px]">System-generated relationship indicator</p>
          </div>
        </SectionCard>

        {/* Active Drives */}
        <SectionCard title="Active Drives">
          {c.activeDrives.length === 0 ? (
            <p className="text-muted-foreground text-xs">No active drives.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {c.activeDrives.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Briefcase className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate">{d.title}</span>
                  </span>
                  <StatusBadge status={d.status} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Notes">
          {c.notes.length === 0 ? (
            <p className="text-muted-foreground text-xs">No notes yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {c.notes.map((n) => (
                <div key={n.id} className="flex items-start gap-2 text-xs">
                  <StickyNote className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  // kind === "user"
  const u = props.user;
  const student = props.student;

  return (
    <div className="flex w-full flex-col gap-3 text-sm">
      <div className="flex flex-col items-center gap-2 px-1 pt-1 text-center">
        <Avatar size="lg">
          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
          <AvatarFallback>{initials(u.name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-semibold">{u.name}</span>
          </div>
          <Badge variant="outline" className="mt-1">
            {u.userType}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {u.email && (
            <Button variant="outline" size="xs" render={<a href={`mailto:${u.email}`} />}>
              <Mail className="size-3" /> Email
            </Button>
          )}
        </div>
      </div>

      <SectionCard title="About">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Mail className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{u.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <UserIcon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{u.userType}</span>
          </div>
          {student?.department && (
            <div className="flex items-center gap-2 text-xs">
              <Building2 className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{[student.department, student.course].filter(Boolean).join(" · ")}</span>
            </div>
          )}
        </div>
      </SectionCard>

      {student && (
        <SectionCard title="Placement Activity">
          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className="rounded-md border px-2 py-2">
              <div className="text-base font-semibold tabular-nums">{student.applicationsCount}</div>
              <div className="text-muted-foreground text-[11px]">Applications</div>
            </div>
            <div className="rounded-md border px-2 py-2">
              <div className="text-base font-semibold tabular-nums">{student.activeDrivesCount}</div>
              <div className="text-muted-foreground text-[11px]">Active Drives</div>
            </div>
            <div className="rounded-md border px-2 py-2">
              <div className="text-base font-semibold tabular-nums">{student.interviewsCount}</div>
              <div className="text-muted-foreground text-[11px]">Interviews</div>
            </div>
            <div className="rounded-md border px-2 py-2">
              <div className="text-base font-semibold tabular-nums">{student.offersCount}</div>
              <div className="text-muted-foreground text-[11px]">Offers</div>
            </div>
          </div>
          {student.cgpa != null && (
            <p className="text-muted-foreground mt-2 text-xs">CGPA: {student.cgpa}</p>
          )}
        </SectionCard>
      )}
    </div>
  );
}
