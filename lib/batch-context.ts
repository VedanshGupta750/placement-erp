import "server-only";
import { cookies } from "next/headers";

export const BATCH_CONTEXT_COOKIE = "active_batch_id";

// Soft default only — pages that read this should still let an explicit
// ?batchId= query param override it. Not a tenant boundary; see
// app/api/batch-context/route.ts.
export async function getActiveBatchId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(BATCH_CONTEXT_COOKIE)?.value ?? null;
}
