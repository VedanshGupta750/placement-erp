import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CardGrid } from "@/components/network/card-grid";
import type { NetworkGroup } from "@/lib/network/groups";

export function GroupsTab({ batchGroups, driveGroups, departmentGroups }: { batchGroups: NetworkGroup[]; driveGroups: NetworkGroup[]; departmentGroups: NetworkGroup[] }) {
  const sections = [
    { title: "Batch & course", groups: batchGroups },
    { title: "Active drives", groups: driveGroups },
    { title: "Departments", groups: departmentGroups },
  ];
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-sm font-medium">{section.title}</h3>
          <CardGrid>
            {section.groups.map((g) => (
              <Link key={g.id} href={g.href}>
                <Card className="min-w-0 transition-colors hover:bg-accent/40">
                  <CardContent className="flex min-w-0 items-center justify-between gap-3 pt-6">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{g.label}</div>
                      <div className="text-muted-foreground line-clamp-2 break-words text-xs">{g.sublabel}</div>
                    </div>
                    <span className="shrink-0 text-lg font-semibold tabular-nums">{g.count}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {section.groups.length === 0 && <p className="text-muted-foreground col-span-full text-sm">Nothing here yet.</p>}
          </CardGrid>
        </div>
      ))}
    </div>
  );
}
