import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { requirePermission, ForbiddenError } from "@/lib/rbac/guard";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";

function toCsvValue(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  try {
    await requirePermission(session, "company.view");
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  const contacts = await db.contact.findMany({
    include: { company: true, owner: true },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Name", "Email", "Phone", "Company", "Contact Type", "Designation", "Relationship Stage", "Owner", "Status", "Tags"];
  const rows = contacts.map((c: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: { name: string } | null;
    contactType: string | null;
    designation: string | null;
    relationshipStage: string;
    owner: { name: string } | null;
    isActive: boolean;
    tags: string[];
  }) => [
    c.name ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.company?.name ?? "",
    c.contactType ?? "",
    c.designation ?? "",
    RELATIONSHIP_STAGE_LABELS[c.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? c.relationshipStage,
    c.owner?.name ?? "",
    c.isActive ? "Active" : "Inactive",
    c.tags.join("; "),
  ]);

  const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contacts-export.csv"`,
    },
  });
}
