import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger, describeError } from "@/lib/logger";

// Liveness + readiness probe for load balancers, uptime monitors and
// container orchestrators. Deliberately unauthenticated — the thing
// checking it is infrastructure, not a user — so it returns only a verdict
// and a latency number, never schema details, row counts or error text
// that would help someone map the system.
//
// 200 = serving traffic. 503 = take this instance out of rotation.
//
// `SELECT 1` rather than a real query: this answers "can the app reach the
// database", which is the failure that actually takes the app down. It
// stays cheap enough to poll every few seconds.

export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const checkStart = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
    dbLatencyMs = Date.now() - checkStart;
  } catch (error) {
    logger.error("health.db_unreachable", describeError(error));
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    checks: { database: { ok: dbOk, latencyMs: dbLatencyMs } },
    // Set by most platforms automatically; useful for confirming which
    // build is actually live during an incident.
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.APP_VERSION ?? "unknown",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
