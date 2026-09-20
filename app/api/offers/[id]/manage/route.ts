import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { editOfferSchema } from "@/lib/validators/offer";

// Staff-side actions on an offer — deliberately a SEPARATE route from
// PATCH /api/offers/[id], which is the student's own self-service
// accept/decline endpoint (self-scoped to session.userId, no `action`
// field the way this route uses one). Reusing that path here would repeat
// the exact route-overwrite bug found and fixed during the Applications
// module build this session.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const db = getTenantDb(session.collegeId);

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  const offer = await db.offer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "withdraw") {
    try {
      await requirePermission(session, "offer.edit");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (!["DRAFT", "ISSUED"].includes(offer.status)) {
      return NextResponse.json({ error: "invalid_transition", message: "Only a draft or issued offer can be withdrawn." }, { status: 409 });
    }
    await db.offer.update({ where: { id }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === "edit") {
    try {
      await requirePermission(session, "offer.edit");
    } catch (e) {
      if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      throw e;
    }
    if (offer.status !== "DRAFT") {
      return NextResponse.json({ error: "invalid_transition", message: "Only a draft offer can be edited — withdraw and recreate it otherwise." }, { status: 409 });
    }
    const parsed = editOfferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const data = parsed.data;
    await db.offer.update({
      where: { id },
      data: {
        offerType: data.offerType,
        totalCompensation: data.totalCompensation,
        fixedCompensation: data.fixedCompensation,
        variableCompensation: data.variableCompensation,
        stipend: data.stipend,
        joiningBonus: data.joiningBonus,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "validation_error", message: "Unknown action." }, { status: 400 });
}
