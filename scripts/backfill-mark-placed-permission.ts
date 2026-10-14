// One-off: new permissions only auto-grant to newly-provisioned colleges
// (see lib/provisioning.ts), so existing colleges' system roles need their
// RolePermission rows backfilled by hand — same as finance.* and
// external_job.* before it.
//
// student.mark_placed goes to TPO and College Admin only. The coordinator roles
// keep student.edit without it on purpose: correcting a record and erasing
// one are different levels of trust.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac/permissions";

const KEY: PermissionKey = "student.mark_placed";
const ROLES_TO_GRANT = new Set(["TPO", "College Admin", "Placement Coordinator"]);

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

  const permission = await prisma.permission.findUnique({ where: { key: KEY } });
  if (!permission) throw new Error(`${KEY} missing from the permission catalog after upsert.`);

  const roles = await prisma.role.findMany({ where: { isSystem: true, name: { in: [...ROLES_TO_GRANT] } } });
  let grants = 0;
  for (const role of roles) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      create: { roleId: role.id, permissionId: permission.id },
      update: {},
    });
    grants++;
  }

  console.log(`Granted ${KEY} to ${grants} role(s): ${roles.map((r) => r.name).join(", ") || "none found"}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
