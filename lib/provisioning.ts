// No "server-only" guard — see lib/db.ts for why (shared with prisma/seed.ts).
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  PERMISSIONS,
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  COLLEGE_PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/rbac/permissions";
import { PLAN_DEFS, TRIAL_LENGTH_DAYS } from "@/lib/billing/plans";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 48) || "college"
  );
}

async function ensurePermissionCatalog() {
  await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        create: { key: p.key, resource: p.resource, action: p.action, description: p.description },
        update: { description: p.description },
      }),
    ),
  );
}

// `features`/`maxStudents`/`maxRecruiters` are intentionally excluded from
// `update` after the first seed — plan limits are owned by platform admins,
// not silently reset every time another college signs up.
async function ensurePlanCatalog() {
  await Promise.all(
    PLAN_DEFS.map((p) =>
      prisma.plan.upsert({
        where: { code: p.code },
        create: p,
        update: { name: p.name, priceInPaise: p.priceInPaise },
      }),
    ),
  );
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 0;
  while (await prisma.college.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
  return candidate;
}

export type ProvisionCollegeInput = {
  collegeName: string;
  tpoName: string;
  tpoEmail: string;
  tpoPassword: string;
};

export type ProvisionCollegeResult = {
  collegeId: string;
  userId: string;
  roleId: string;
  campusId: string;
  departmentId: string;
  batchId: string;
};

/**
 * Creates a brand-new tenant: the College, a default Campus, its system
 * Roles (TPO/College Admin/Placement Coordinator/Department Coordinator/
 * Faculty/Management/Student/Auditor) with default permission grants, the
 * first User as TPO, a default "Placement" Department, the current-year
 * Batch, and a trial Subscription. Shared by the signup route and
 * prisma/seed.ts so both paths can never drift.
 */
export async function provisionCollege(input: ProvisionCollegeInput): Promise<ProvisionCollegeResult> {
  await ensurePermissionCatalog();
  await ensurePlanCatalog();
  const slug = await uniqueSlug(input.collegeName);
  const passwordHash = await hashPassword(input.tpoPassword);

  return prisma.$transaction(async (tx) => {
    const college = await tx.college.create({
      data: { name: input.collegeName, slug },
    });

    const campus = await tx.campus.create({
      data: { collegeId: college.id, code: "MAIN", name: "Main Campus", isDefault: true },
    });

    const allPermissions = await tx.permission.findMany({ select: { id: true, key: true } });
    const permissionIdByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

    const roleByName = new Map<string, string>();
    for (const roleName of SYSTEM_ROLES) {
      const role = await tx.role.create({
        data: { collegeId: college.id, name: roleName },
      });
      roleByName.set(roleName, role.id);

      // TPO gets every COLLEGE-scoped permission — deliberately not
      // PERMISSIONS in full, which would hand a tenant role the platform
      // tier's api.*/billing.* keys (see lib/rbac/permissions.ts).
      const grantedKeys: readonly PermissionKey[] =
        roleName === "TPO" ? COLLEGE_PERMISSION_KEYS : DEFAULT_ROLE_PERMISSIONS[roleName];

      await tx.rolePermission.createMany({
        data: grantedKeys
          .map((key) => permissionIdByKey.get(key))
          .filter((id): id is string => Boolean(id))
          .map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }

    const tpoRoleId = roleByName.get("TPO")!;
    const tpo = await tx.user.create({
      data: {
        collegeId: college.id,
        email: input.tpoEmail.toLowerCase().trim(),
        name: input.tpoName,
        passwordHash,
        status: "ACTIVE",
        userType: "PLACEMENT_TEAM",
        roleId: tpoRoleId,
      },
    });

    const department = await tx.department.create({
      data: { collegeId: college.id, campusId: campus.id, name: "Placement" },
    });
    await tx.departmentMembership.create({
      data: {
        departmentId: department.id,
        userId: tpo.id,
        designation: "TPO",
        title: "TPO",
        isAdmin: true,
      },
    });

    const currentYear = new Date().getFullYear();
    const batch = await tx.batch.create({
      data: { collegeId: college.id, campusId: campus.id, year: currentYear },
    });

    const starterPlan = await tx.plan.findUniqueOrThrow({ where: { code: "STARTER" } });
    const trialEndsAt = new Date();
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + TRIAL_LENGTH_DAYS);
    await tx.subscription.create({
      data: {
        collegeId: college.id,
        planId: starterPlan.id,
        status: "TRIALING",
        currentPeriodEnd: trialEndsAt,
      },
    });

    return {
      collegeId: college.id,
      userId: tpo.id,
      roleId: tpoRoleId,
      campusId: campus.id,
      departmentId: department.id,
      batchId: batch.id,
    };
  });
}
