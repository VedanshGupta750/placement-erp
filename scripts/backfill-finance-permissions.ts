// One-off: new permissions only auto-grant to newly-provisioned colleges
// (see lib/provisioning.ts). Existing colleges' system roles need their
// RolePermission rows backfilled by hand, same as external_job.* was.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "@/lib/rbac/permissions";

async function main() {
  await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, resource: p.resource, action: p.action, description: p.description },
        update: { description: p.description },
      }),
    ),
  );

  const financePerms: PermissionKey[] = ["finance.view", "finance.manage"];
  const permissionRows = await prisma.permission.findMany({ where: { key: { in: financePerms } } });
  const permissionIdByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  const roles = await prisma.role.findMany({ where: { isSystem: true } });
  let grants = 0;
  for (const role of roles) {
    const keysToGrant: PermissionKey[] =
      role.name === "TPO" ? financePerms : (DEFAULT_ROLE_PERMISSIONS[role.name as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? []).filter((k) => financePerms.includes(k));
    for (const key of keysToGrant) {
      const permissionId = permissionIdByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
      grants++;
    }
  }
  console.log(`Backfilled ${grants} finance permission grants across ${roles.length} system roles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
