import "dotenv/config";
import { dispatchPendingPush } from "../lib/push/dispatch";
import { prisma } from "../lib/db";

let stopping = false;
const stop = () => {
  stopping = true;
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

async function main() {
  while (!stopping) {
    const summary = await dispatchPendingPush(100);
    if (!summary.configured) {
      throw new Error("Push worker requires NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.");
    }
    if (summary.claimed > 0) {
      console.info("Push delivery batch", summary);
    }
    await new Promise((resolve) => setTimeout(resolve, summary.claimed > 0 ? 250 : 2000));
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Push worker failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

