"use client";

import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Drop-in "?" icon for a field label, page heading, or table column that
// needs one sentence of explanation a new user wouldn't otherwise get —
// not a replacement for real docs, just enough context to not block someone
// mid-task. Keep the text to one sentence; anything longer belongs in a
// proper help page instead.
export function HelpTip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn("text-muted-foreground hover:text-foreground inline-flex align-middle outline-none", className)}
        aria-label="Help"
      >
        <CircleHelp className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
