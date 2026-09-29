import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordLink } from "@/lib/auth/password-reset";
import { checkLoginRateLimit, recordFailedLogin } from "@/lib/auth/rate-limit";

const schema = z.object({ email: z.email("Enter a valid email address.").trim() });

// Replaces the static "contact your TPO" page. Self-service reset is what
// makes bulk-created accounts workable at all: importing 800 students used
// to mean 800 manual password resets, because the generated password was
// hashed and discarded without anyone ever seeing it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const rateKey = `forgot:${email}`;

  // Rate limited per address so this can't be used to hammer one account
  // or to spray reset mail at someone else's inbox.
  const limit = checkLoginRateLimit(rateKey);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts", message: `Too many requests. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  recordFailedLogin(rateKey);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, collegeId: true, status: true },
  });

  // Always the same answer, whether or not the address exists and whether
  // or not mail actually went out. Otherwise this endpoint becomes a way to
  // enumerate every student and staff address in the college.
  const genericResponse = NextResponse.json({
    ok: true,
    message: "If that email is registered, a reset link is on its way. Check your inbox and spam folder.",
  });

  if (!user || user.status === "DEACTIVATED" || user.status === "SUSPENDED") return genericResponse;

  await sendPasswordLink({
    userId: user.id,
    name: user.name,
    email: user.email,
    purpose: "RESET_PASSWORD",
    collegeId: user.collegeId,
  });

  return genericResponse;
}
