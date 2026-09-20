import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NewDriveForm } from "@/components/drives/new-drive-form";
import { hasPermission } from "@/lib/rbac/guard";

export default async function NewDrivePage({ searchParams }: { searchParams: Promise<{ companyName?: string; type?: string }> }) {
  const { companyName, type } = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // drive.create isn't held by Student — this authoring form had no gate
  // at all before this fix (same low-priv-role-test sweep that caught
  // drives/page.tsx, drives/[id], and companies/[id]).
  const canCreate = await hasPermission(session, "drive.create");
  if (!canCreate) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to this page.</CardContent>
      </Card>
    );
  }

  const [courses, skills] = await Promise.all([
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.skill.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/drives" />}>
          <ArrowLeft className="size-3.5" /> Back to drives
</Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New placement drive</h1>
        <p className="text-muted-foreground text-sm">Saved as a draft — publish it when you&apos;re ready for students to see it.</p>
      </div>
      <NewDriveForm courses={courses} skills={skills} initialCompanyName={companyName} initialPositionType={type} />
    </div>
  );
}
