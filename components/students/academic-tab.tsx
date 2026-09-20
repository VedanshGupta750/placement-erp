import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcademicDetailClient } from "@/components/students/academic-detail-client";

export async function AcademicTab({ studentId, canViewSensitive }: { studentId: string; canViewSensitive: boolean }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [student, backlogs, semesterResults, canEdit] = await Promise.all([
    db.student.findUniqueOrThrow({ where: { id: studentId } }),
    db.studentBacklog.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
    db.studentSemesterResult.findMany({ where: { studentId } }),
    hasPermission(session, "student.edit"),
  ]);

  if (!canViewSensitive) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          You don&apos;t have permission to view detailed academic records.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Board & Diploma Scores</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ScoreItem label="10th" value={student.tenthScore} type={student.tenthScoreType} />
          <ScoreItem label="12th" value={student.twelfthScore} type={student.twelfthScoreType} />
          <ScoreItem label="Diploma" value={student.diplomaScore} type={student.diplomaScoreType} />
          <ScoreItem label="CGPA" value={student.aggregate} type={student.aggregateType} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <AcademicDetailClient
            studentId={studentId}
            backlogs={backlogs.map((b: { id: string; subjectName: string; subjectCode: string | null; semester: number | null; attempt: number; status: string }) => ({
              id: b.id,
              subjectName: b.subjectName,
              subjectCode: b.subjectCode,
              semester: b.semester,
              attempt: b.attempt,
              status: b.status as "ACTIVE" | "CLEARED",
            }))}
            semesterResults={semesterResults.map((s: { semester: number; sgpa: number; credits: number | null }) => ({ semester: s.semester, sgpa: s.sgpa, credits: s.credits }))}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreItem({ label, value, type }: { label: string; value: number | null; type: string | null }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value ?? "—"}</div>
      {type && <div className="text-muted-foreground text-xs">{type}</div>}
    </div>
  );
}
