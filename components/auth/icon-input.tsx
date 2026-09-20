"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function IconInput({
  icon: Icon,
  type = "text",
  className,
  ...props
}: React.ComponentProps<"input"> & { icon: LucideIcon }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="relative">
      <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
      <Input
        type={isPassword ? (show ? "text" : "password") : type}
        className={cn("h-12 pl-11 text-base", isPassword ? "pr-11" : "pr-4", className)}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      )}
    </div>
  );
}
