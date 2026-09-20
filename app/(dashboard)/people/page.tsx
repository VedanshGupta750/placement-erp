import { Users, UserCheck, Clock3 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "@/components/people/invite-form";

export default async function PeoplePage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // No gate at all before — see app/(dashboard)/roles/page.tsx for the full
  // writeup of this finding across 6 sibling pages.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to people &amp; invites.</CardContent>
      </Card>
    );
  }

  const [users, invited, active] = await Promise.all([
    db.user.findMany({ where: { userType: { not: "STUDENT" } }, include: { role: true }, orderBy: { createdAt: "desc" } }),
    db.user.count({ where: { status: "INVITED" } }),
    db.user.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People &amp; invites</h1>
        <p className="text-muted-foreground text-sm">Manage staff, faculty and management accounts.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total accounts" value={users.length} color="blue" />
        <StatCard icon={UserCheck} label="Active" value={active} color="emerald" />
        <StatCard icon={Clock3} label="Pending invite" value={invited} color="amber" />
      </div>

      <InviteForm />

      <Card>
        <CardContent className="flex flex-col divide-y pt-6">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col items-start gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium">{u.name}</div>
                <div className="text-muted-foreground break-all text-xs">{u.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant="outline">{u.userType.replaceAll("_", " ")}</Badge>
                <Badge variant="outline">{u.role?.name ?? "No role"}</Badge>
                <Badge className={u.status === "ACTIVE" ? "border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "border-none bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"}>
                  {u.status}
                </Badge>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No team members yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
