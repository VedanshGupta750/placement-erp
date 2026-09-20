import { NextResponse } from "next/server";
import { dispatchPendingPush } from "@/lib/push/dispatch";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured", message: "CRON_SECRET isn't set." }, { status: 501 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const summary = await dispatchPendingPush(100);
  return NextResponse.json(summary, { status: summary.configured ? 200 : 501 });
}

