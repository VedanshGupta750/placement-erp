// Creates (or updates the password of) a platform admin — the operator
// account that signs in at /platform/sign-in and can create colleges.
//
// There is deliberately no UI for this: the first admin has to come from
// somewhere outside the app, and exposing "create a superuser" on the web
// would defeat the point. Run it on the server, with the DB reachable.
//
//   npx tsx scripts/create-platform-admin.ts <email> <name> [password]
//
// Omit the password and one is generated and printed once. Re-running with
// an existing email resets that admin's password rather than erroring, so
// this doubles as the recovery path if you lock yourself out.
import "dotenv/config";
import { prisma } from "@/lib/db";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const [emailArg, nameArg, passwordArg] = process.argv.slice(2);

  if (!emailArg || !nameArg) {
    fail("Usage: npx tsx scripts/create-platform-admin.ts <email> <name> [password]");
  }

  const email = emailArg.toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`"${emailArg}" is not a valid email address.`);

  const password = passwordArg ?? generateTempPassword();
  if (password.length < 8) fail("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(password);
  const existing = await prisma.platformAdmin.findUnique({ where: { email }, select: { id: true } });

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, name: nameArg.trim(), passwordHash },
    update: { name: nameArg.trim(), passwordHash },
    select: { id: true, email: true, name: true },
  });

  console.log(existing ? "Platform admin password reset." : "Platform admin created.");
  console.log(`  name:  ${admin.name}`);
  console.log(`  email: ${admin.email}`);
  if (!passwordArg) console.log(`  password: ${password}   <- shown once, store it now`);
  console.log("\nSign in at /platform/sign-in");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
