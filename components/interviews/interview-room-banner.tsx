"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// A live-updating elapsed-time banner for an interview that's actually
// IN_PROGRESS — real data (startedAt), not a decorative pause/resume
// "Interview Room" screen. There's nothing to pause/resume: the interview
// either is or isn't happening, tracked by two real timestamps
// (startedAt/endedAt) set by the Start/End actions.
export function InterviewRoomBanner({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = now - new Date(startedAt).getTime();

  return (
    <div className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium">
      <Radio className="size-4 animate-pulse" />
      Interview in progress — {formatElapsed(elapsed)} elapsed
    </div>
  );
}
