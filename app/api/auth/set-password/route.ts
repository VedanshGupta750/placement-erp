import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordStrengthSchema } from "@/lib/validators/auth";
import { hashPassword } from "@/lib/auth/password";
import { verifyPasswordToken, consumePasswordToken } from "@/lib/auth/password-reset";
import { clearLoginAttempts } from "@/lib/auth/rate-limit";

const schema = z.object({
  token: z.string().min(1),
  password: passwordStrengthSchema,
});

// Checks a link without spending it, so the page can show "this link has
// expired" before the user types a password rather than after.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const row = await verifyPasswordToken(token);
  if (!row) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({ valid: true, name: row.user.name, email: row.user.email, purpose: row.purpose });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const row = await verifyPasswordToken(parsed.data.token);
  if (!row) {
    return NextResponse.json(
      { error: "invalid_token", message: "This link has expired or has already been used. Request a new one." },
      { status: 400 },
    );
  }

  await consumePasswordToken(row.id, row.userId, await hashPassword(parsed.data.password));

  // Someone who just proved control of their inbox shouldn't then be locked
  // out by failed attempts from before the reset.
  clearLoginAttempts(row.user.email);
  clearLoginAttempts(`forgot:${row.user.email}`);

  // Deliberately no session is created — the user signs in with the password
  // they just chose, which confirms it works while they still remember it.
  return NextResponse.json({ ok: true, email: row.user.email });
}
