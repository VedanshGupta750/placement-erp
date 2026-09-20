import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS, COLLEGE_PERMISSION_GROUPS } from "@/lib/rbac/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RolePermissionEditor } from "@/components/people/role-permission-editor";

export default async function RolesPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // This page (and its 5 siblings under Settings — settings, people,
  // departments, courses, categories) had no gate at all: any authenticated
  // session, including a Student, could load it. The mutating API routes
  // these pages post to were always correctly gated on settings.edit, so
  // this was never a privilege-escalation hole — but the view itself leaked
  // the full RBAC permission matrix (here), staff emails (people), and
  // college settings (settings) to anyone with a session. settings.view
  // already existed in the permission catalog for exactly this purpose,
  // just never wired to any of the 6 pages it was meant to gate.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to roles &amp; permissions.</CardContent>
      </Card>
    );
  }

  const roles = await db.role.findMany({
    include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  const groups = COLLEGE_PERMISSION_GROUPS.map((resource) => ({
    resource,
    permissions: PERMISSIONS.filter((p) => p.resource === resource).map((p) => ({ key: p.key, description: p.description })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; permissions</h1>
        <p className="text-muted-foreground text-sm">Every college starts with 8 system roles — adjust what each can do.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-6">
              <div className="font-semibold">{r.name}</div>
              <div className="text-muted-foreground text-xs">{r._count.users} member{r._count.users === 1 ? "" : "s"}</div>
              <Badge variant="outline" className="mt-2">{r.rolePermissions.length} permissions</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit a role</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 px-3 sm:px-6">
          <Tabs defaultValue={roles[0]?.id}>
            <TabsList className="w-full justify-start">
              {roles.map((r) => (
                <TabsTrigger key={r.id} value={r.id} className="px-3">{r.name}</TabsTrigger>
              ))}
            </TabsList>
            {roles.map((r) => (
              <TabsContent key={r.id} value={r.id} className="mt-4">
                <RolePermissionEditor
                  roleId={r.id}
                  roleName={r.name}
                  groups={groups}
                  granted={r.rolePermissions.map((rp) => rp.permission.key)}
                  editable={r.name !== "TPO"}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
