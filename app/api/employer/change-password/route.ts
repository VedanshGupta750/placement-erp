import { NextResponse } from "next/server";
import { requireCompanySession } from "@/lib/auth/company-session";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validators/profile";

export async function POST(request: Request) {
  const session = await requireCompanySession();

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const user = await prisma.companyUser.findUniqueOrThrow({ where: { id: session.companyUserId }, select: { passwordHash: true } });
  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "invalid_password", message: "Current password is incorrect." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.companyUser.update({ where: { id: session.companyUserId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
