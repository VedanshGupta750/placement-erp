// No "server-only" guard here: this module is also imported directly by
// prisma/seed.ts, which runs as a plain Node script outside Next.js's
// bundler. Only import this raw client for platform-level code
// (provisioning, prisma/seed.ts, app/platform-admin/**) — everywhere else
// use getTenantDb() from lib/tenant/scoped-db.ts.
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
