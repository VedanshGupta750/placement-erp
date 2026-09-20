import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export function ViewToggle({ view, hrefWith }: { view: "grid" | "list"; hrefWith: (overrides: Record<string, string | undefined>) => string }) {
  return (
    <div className="flex gap-1 rounded-lg border p-1">
      <Link href={hrefWith({ view: undefined })} scroll={false} className={cn("rounded-md p-1.5", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} aria-label="Grid view">
        <LayoutGrid className="size-4" />
      </Link>
      <Link href={hrefWith({ view: "list" })} scroll={false} className={cn("rounded-md p-1.5", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")} aria-label="List view">
        <List className="size-4" />
      </Link>
    </div>
  );
}
