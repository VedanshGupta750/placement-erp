import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { updateCompanySchema } from "@/lib/validators/company";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: companyId } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  // Company is a global entity — confirm this college actually partners
  // with it before allowing an edit, same pattern as the existing
  // /notes route. Without this, a TPO could edit a company that only some
  // OTHER college has a partnership with.
  const partnership = await db.collegePartnership.findFirst({ where: { companyId } });
  if (!partnership) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.legalName !== undefined ? { legalName: data.legalName } : {}),
      ...(data.website !== undefined ? { website: data.website } : {}),
      ...(data.industryType !== undefined ? { industryType: data.industryType } : {}),
      ...(data.companyType !== undefined ? { companyType: data.companyType } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.about !== undefined ? { about: data.about } : {}),
      ...(data.size !== undefined ? { size: data.size } : {}),
      ...(data.headquarters !== undefined ? { headquarters: data.headquarters } : {}),
      ...(data.foundedYear !== undefined ? { foundedYear: data.foundedYear } : {}),
      ...(data.linkedinUrl !== undefined ? { linkedinUrl: data.linkedinUrl } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.hiringType !== undefined ? { hiringType: data.hiringType } : {}),
      ...(data.preferredCourseIds !== undefined ? { preferredCourseIds: data.preferredCourseIds } : {}),
      ...(data.minCgpaPreference !== undefined ? { minCgpaPreference: data.minCgpaPreference } : {}),
      ...(data.backlogPolicy !== undefined ? { backlogPolicy: data.backlogPolicy } : {}),
      ...(data.preferredSkillIds !== undefined ? { preferredSkillIds: data.preferredSkillIds } : {}),
    },
  });

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.updated",
    resourceType: "Company",
    resourceId: company.id,
    after: { fields: Object.keys(data) },
  });

  return NextResponse.json({ ok: true });
}
