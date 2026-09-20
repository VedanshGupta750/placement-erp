import { NextResponse } from "next/server";
import { getCompanySession, deleteCompanySession } from "@/lib/auth/company-session";
import { logger } from "@/lib/logger";
import { authRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  // Logged rather than stored, for the same reason as employer sign-in:
  // a CompanyUser has no single collegeId for an AuditLog row.
  const session = await getCompanySession();
  await deleteCompanySession();

  if (session) {
    logger.info("employer.logout", {
      companyUserId: session.companyUserId,
      companyId: session.companyId,
      ip: authRequestContext(request).ip,
    });
  }

  return NextResponse.json({ ok: true });
}
