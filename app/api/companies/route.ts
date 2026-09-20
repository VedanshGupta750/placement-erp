import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { createCompanySchema } from "@/lib/validators/company";
import { findPossibleDuplicateCompany } from "@/lib/companies/dedupe";
import { recordAudit } from "@/lib/audit";

// Creates a Company (a global entity, not tenant-scoped) plus the
// CollegePartnership row that actually connects it to the caller's college
// — a Company with no partnership row is invisible to every college-scoped
// query in this app (list page, Company 360, drive creation), so the two
// must always be created together.
export async function POST(request: Request) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.create");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const body = await request.json().catch(() => null);
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  if (!data.force) {
    const possibleMatch = await findPossibleDuplicateCompany(prisma, data.name);
    if (possibleMatch) {
      return NextResponse.json({ error: "possible_duplicate", match: possibleMatch }, { status: 409 });
    }
  }

  // A company with this exact name might already exist globally (partnered
  // with another college) — reuse it and just add this college's
  // partnership rather than violating the unique(name) constraint.
  const existing = await prisma.company.findUnique({ where: { name: data.name } });

  const company = existing
    ? await prisma.company.update({
        where: { id: existing.id },
        data: {
          legalName: data.legalName || existing.legalName,
          website: data.website || existing.website,
          industryType: data.industryType || existing.industryType,
          companyType: data.companyType || existing.companyType,
          logoUrl: data.logoUrl || existing.logoUrl,
          about: data.about || existing.about,
          size: data.size || existing.size,
          headquarters: data.headquarters || existing.headquarters,
          foundedYear: data.foundedYear ?? existing.foundedYear,
          linkedinUrl: data.linkedinUrl || existing.linkedinUrl,
          tags: data.tags?.length ? data.tags : existing.tags,
          hiringType: data.hiringType || existing.hiringType,
          preferredCourseIds: data.preferredCourseIds?.length ? data.preferredCourseIds : existing.preferredCourseIds,
          minCgpaPreference: data.minCgpaPreference ?? existing.minCgpaPreference,
          backlogPolicy: data.backlogPolicy || existing.backlogPolicy,
          preferredSkillIds: data.preferredSkillIds?.length ? data.preferredSkillIds : existing.preferredSkillIds,
        },
      })
    : await prisma.company.create({
        data: {
          name: data.name,
          legalName: data.legalName,
          website: data.website,
          industryType: data.industryType,
          companyType: data.companyType,
          logoUrl: data.logoUrl,
          about: data.about,
          size: data.size,
          headquarters: data.headquarters,
          foundedYear: data.foundedYear,
          linkedinUrl: data.linkedinUrl,
          tags: data.tags ?? [],
          hiringType: data.hiringType,
          preferredCourseIds: data.preferredCourseIds ?? [],
          minCgpaPreference: data.minCgpaPreference,
          backlogPolicy: data.backlogPolicy,
          preferredSkillIds: data.preferredSkillIds ?? [],
        },
      });

  const partnership = await db.collegePartnership.upsert({
    where: { collegeId_companyId: { collegeId: session.collegeId, companyId: company.id } },
    create: { collegeId: session.collegeId, companyId: company.id, status: "PENDING" },
    update: {},
  });

  if (data.recruiter?.name) {
    await db.contact.create({
      data: {
        collegeId: session.collegeId,
        companyId: company.id,
        name: data.recruiter.name,
        email: data.recruiter.email || null,
        phone: data.recruiter.phone || null,
        designation: data.recruiter.designation || null,
        contactType: "Campus Recruiter",
        addedById: session.userId,
        relationshipStage: "NEW",
      },
    });
  }

  await recordAudit(db, {
    collegeId: session.collegeId,
    actorId: session.userId,
    action: "company.created",
    resourceType: "Company",
    resourceId: company.id,
    after: { name: company.name, reusedExisting: !!existing },
  });

  return NextResponse.json({ ok: true, id: company.id, partnershipId: partnership.id });
}
