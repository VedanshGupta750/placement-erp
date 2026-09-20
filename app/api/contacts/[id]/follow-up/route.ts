import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { setFollowUpSchema } from "@/lib/validators/contact";
import { logContactHistory } from "@/lib/contacts/history";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = setFollowUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await db.contact.update({
    where: { id },
    data: {
      nextFollowUpAt: new Date(parsed.data.nextFollowUpAt),
      nextFollowUpNote: parsed.data.nextFollowUpNote || undefined,
    },
  });
  await logContactHistory(db, id, session.userId, `Follow-up scheduled for ${new Date(parsed.data.nextFollowUpAt).toLocaleDateString("en-IN")}`);

  return NextResponse.json({ ok: true });
}
