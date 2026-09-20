import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionStudent } from "@/lib/dashboard/get-attention-students";

const FLAG_BADGE_CLASSES: Record<AttentionStudent["flag"], string> = {
  "At Risk": "text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-400",
  "Resume Missing": "text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400",
  "Documents Pending": "text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-400",
  "Low Applications": "text-orange-600 bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400",
  "No Activity": "text-slate-600 bg-slate-100 dark:bg-slate-500/15 dark:text-slate-400",
};

export function AttentionStudentsCard({ students }: { students: AttentionStudent[] }) {
  return (
    <Card className="flex h-[22rem] flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Who needs attention?</CardTitle>
        <Link href="/students?needsAttention=1" className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-y-auto">
        {students.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No students currently flagged — nice work.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <Avatar>
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {student.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{student.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{student.courseLabel}</div>
                </div>
                <Badge variant="outline" className={`hidden w-fit shrink-0 border-none sm:inline-flex ${FLAG_BADGE_CLASSES[student.flag]}`}>
                  {student.flag}
                </Badge>
                <div className="hidden shrink-0 flex-col gap-0.5 text-right text-xs text-muted-foreground md:flex">
                  <span>Eligible: {student.eligibleDrivesCount}</span>
                  <span>Applied: {student.appliedCount}</span>
                </div>
                <Link
                  href={student.href}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
