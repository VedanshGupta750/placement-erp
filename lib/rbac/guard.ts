import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { PermissionKey } from "@/lib/rbac/permissions";

// Resolves a role's permission keys fresh per request (memoized within the
// request via React's cache()). Permissions are intentionally NOT embedded
// in the JWT — see lib/auth/jwt.ts for why.
export const getPermissionsForRole = cache(async (roleId: string | null) => {
  if (!roleId) return new Set<PermissionKey>();
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { key: true } } },
  });
  return new Set(rolePermissions.map((rp) => rp.permission.key as PermissionKey));
});

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing required permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

type Session = { userId: string; collegeId: string; roleId: string | null };

export async function hasPermission(session: Session, key: PermissionKey) {
  const keys = await getPermissionsForRole(session.roleId);
  return keys.has(key);
}

// Throws ForbiddenError if the session's role lacks the permission. Callers
// (route handlers) should catch this and return a 403.
export async function requirePermission(session: Session, key: PermissionKey) {
  if (!(await hasPermission(session, key))) {
    throw new ForbiddenError(key);
  }
}

// User ids in a college whose role grants `key` — for fanning out a
// notification to "whoever can act on this" without hardcoding a role name.
export async function getUserIdsWithPermission(collegeId: string, key: PermissionKey) {
  const users = await prisma.user.findMany({
    where: { collegeId, role: { rolePermissions: { some: { permission: { key } } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
