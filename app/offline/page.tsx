import Link from "next/link";
import { CloudOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-2xl">
          <CloudOff className="size-8" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
          <p className="text-muted-foreground text-sm">
            Reconnect to load your placement information. Private account data is not stored for offline access.
          </p>
        </div>
        <Button render={<Link href="/" />} size="lg">
          <RotateCcw className="size-4" /> Try again
        </Button>
      </div>
    </main>
  );
}

