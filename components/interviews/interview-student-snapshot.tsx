import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Snapshot = {
  id: string;
  name: string;
  enrollmentNumber: string;
  courseLabel: string;
  aggregate: number | null;
  aggregateType: string;
  tenthScore: number | null;
  twelfthScore: number | null;
  liveBacklogs: number;
  skills: string[];
  resumeName: string | null;
  resumeUrl: string | null;
};

export function InterviewStudentSnapshot({ student }: { student: Snapshot }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Student</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Link href={`/students/${student.id}`} className="font-semibold hover:underline">{student.name}</Link>
          <div className="text-muted-foreground text-xs">{student.courseLabel}</div>
          <div className="text-muted-foreground font-mono text-xs">{student.enrollmentNumber}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-muted-foreground text-xs">{student.aggregateType === "CGPA" ? "CGPA" : "Aggregate"}</div><div className="font-medium">{student.aggregate ?? "-"}</div></div>
          <div><div className="text-muted-foreground text-xs">Backlogs</div><div className="font-medium">{student.liveBacklogs}</div></div>
          <div><div className="text-muted-foreground text-xs">10th</div><div className="font-medium">{student.tenthScore !== null ? `${student.tenthScore}%` : "-"}</div></div>
          <div><div className="text-muted-foreground text-xs">12th</div><div className="font-medium">{student.twelfthScore !== null ? `${student.twelfthScore}%` : "-"}</div></div>
        </div>

        {student.skills.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-1.5 text-xs">Skills</div>
            <div className="flex flex-wrap gap-1.5">
              {student.skills.map((s) => (
                <Badge key={s} variant="outline">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t pt-3">
          {student.resumeUrl ? (
            <Button size="sm" variant="outline" render={<a href={student.resumeUrl} download={student.resumeName ?? undefined} />}>View Resume</Button>
          ) : (
            <span className="text-muted-foreground text-xs">{student.resumeName ? `${student.resumeName} — not downloadable (uploaded before file storage was wired up)` : "No resume attached"}</span>
          )}
          <Button size="sm" variant="outline" render={<Link href={`/students/${student.id}`} />}>View Student</Button>
        </div>
      </CardContent>
    </Card>
  );
}
