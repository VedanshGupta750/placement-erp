import { FileText, CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResumeUploadDialog } from "@/components/resumes/resume-upload-dialog";
import { ResumeRowActions } from "@/components/resumes/resume-row-actions";

export default async function ResumesPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const student = await db.student.findUnique({ where: { userId: session.userId }, select: { id: true } });

  const resumes = student
    ? await db.resume.findMany({
        where: { studentId: student.id },
        include: {
          usages: { include: { drive: { include: { company: true } } } },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My resumes</h1>
          <p className="text-muted-foreground text-sm">{resumes.length} resume{resumes.length === 1 ? "" : "s"} on file.</p>
        </div>
        <ResumeUploadDialog />
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y pt-6">
          {resumes.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-start gap-3">
                <div className="bg-accent text-accent-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <FileText className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    {r.isDefault && (
                      <Badge className="border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Default
                      </Badge>
                    )}
                    {!r.isValid && <Badge variant="destructive">Needs review</Badge>}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Uploaded {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    {r.usages.length > 0 && ` · Used for: ${r.usages.map((u) => u.drive.company.name).join(", ")}`}
                  </div>
                </div>
              </div>
              <ResumeRowActions id={r.id} isDefault={r.isDefault} />
            </div>
          ))}

          {resumes.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
              <FileText className="size-6" />
              No resumes uploaded yet. Add one to start applying.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
