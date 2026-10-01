import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { FilePreviewDialog } from "@/components/ui/file-preview-dialog";

// Read-only — skills/certifications/projects/resumes are owned and edited
// by the student themselves via /profile, not from a TPO's view of them.
export async function SkillsResumeTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [skills, certifications, projects, resumes] = await Promise.all([
    db.studentSkill.findMany({ where: { studentId }, include: { skill: true } }),
    db.studentCertification.findMany({ where: { studentId }, orderBy: { issueDate: "desc" } }),
    db.studentProject.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
    db.resume.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: { file: { select: { dataUrl: true, mimeType: true, originalName: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {skills.map((s: { skillId: string; skill: { name: string } }) => (
            <Badge key={s.skillId} variant="outline">{s.skill.name}</Badge>
          ))}
          {skills.length === 0 && <p className="text-muted-foreground text-sm">No skills added.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Certifications</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {certifications.length === 0 && <p className="text-muted-foreground text-sm">No certifications added.</p>}
          {certifications.map((c: { id: string; name: string; issuer: string | null; issueDate: Date | null; credentialUrl: string | null }) => (
            <div key={c.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-muted-foreground text-xs">{[c.issuer, c.issueDate?.toLocaleDateString("en-IN", { month: "short", year: "numeric" })].filter(Boolean).join(" · ")}</div>
              </div>
              {c.credentialUrl && (
                <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 text-xs hover:underline">
                  View <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Projects</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {projects.length === 0 && <p className="text-muted-foreground text-sm">No projects added.</p>}
          {projects.map((p: { id: string; title: string; description: string | null; techStack: string[]; url: string | null }) => (
            <div key={p.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.title}</span>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 text-xs hover:underline">
                    Link <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              {p.description && <p className="text-muted-foreground mt-0.5 text-xs">{p.description}</p>}
              {p.techStack.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.techStack.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumes</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {resumes.length === 0 && <p className="text-muted-foreground text-sm">No resume uploaded.</p>}
          {resumes.map((r: {
            id: string; name: string; isDefault: boolean; isValid: boolean; createdAt: Date;
            file: { dataUrl: string | null; mimeType: string | null; originalName: string } | null;
          }) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{r.name}</span>
                {r.isDefault && <Badge className="border-none bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">Default</Badge>}
                {!r.isValid && <Badge variant="outline" className="text-amber-600">Needs review</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <FilePreviewDialog
                  dataUrl={r.file?.dataUrl ?? null}
                  mimeType={r.file?.mimeType ?? null}
                  name={r.file?.originalName || r.name}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
