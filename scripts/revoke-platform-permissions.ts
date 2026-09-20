// One-off: strips the platform-tier permissions (api.*, billing.*) from
// every college-side Role. lib/provisioning.ts used to grant the TPO role
// the FULL permission catalog, which swept up the four keys that
// lib/rbac/permissions.ts says belong to the platform/Super Admin layer
// only. The provisioning fix stops new colleges inheriting them; existing
// colleges keep the rows until this runs. Mirror of
// scripts/backfill-finance-permissions.ts, but revoking instead of adding.
//
// Safe to re-run: deleting rows that are already gone is a no-op.
// Pass --dry-run to see what would be removed without writing.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { PLATFORM_ONLY_PERMISSIONS } from "@/lib/rbac/permissions";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const permissionRows = await prisma.permission.findMany({
    where: { key: { in: [...PLATFORM_ONLY_PERMISSIONS] } },
    select: { id: true, key: true },
  });

  if (permissionRows.length === 0) {
    console.log("No platform-tier permissions found in the catalog — nothing to revoke.");
    return;
  }

  const permissionIds = permissionRows.map((p) => p.id);
  const keyById = new Map(permissionRows.map((p) => [p.id, p.key]));

  const affected = await prisma.rolePermission.findMany({
    where: { permissionId: { in: permissionIds } },
    select: { roleId: true, permissionId: true, role: { select: { name: true, college: { select: { name: true } } } } },
  });

  if (affected.length === 0) {
    console.log("No college role currently holds a platform-tier permission. Nothing to do.");
    return;
  }

  const byRole = new Map<string, { role: string; college: string; keys: string[] }>();
  for (const row of affected) {
    const entry = byRole.get(row.roleId) ?? { role: row.role.name, college: row.role.college.name, keys: [] };
    entry.keys.push(keyById.get(row.permissionId) ?? row.permissionId);
    byRole.set(row.roleId, entry);
  }

  console.log(`${affected.length} grant(s) across ${byRole.size} role(s):`);
  for (const entry of byRole.values()) {
    console.log(`  - ${entry.college} / ${entry.role}: ${entry.keys.sort().join(", ")}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing was deleted.");
    return;
  }

  const result = await prisma.rolePermission.deleteMany({ where: { permissionId: { in: permissionIds } } });
  console.log(`\nRevoked ${result.count} platform-tier grant(s) from college roles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
