import { Tags } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddCategoryForm } from "@/components/people/add-category-form";

export default async function CategoriesPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  // No gate at all before — see app/(dashboard)/roles/page.tsx for the full
  // writeup of this finding across 6 sibling pages.
  const canView = await hasPermission(session, "settings.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to placement categories.</CardContent>
      </Card>
    );
  }

  const categories = await db.placementCategory.findMany({
    include: { _count: { select: { drives: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Placement categories</h1>
        <p className="text-muted-foreground text-sm">
          Package-tier buckets (Dream, Super Dream, Core…) that cap how many offers a student can hold within each tier.
        </p>
      </div>

      <StatCard icon={Tags} label="Total categories" value={categories.length} color="violet" />

      <AddCategoryForm />

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Minimum package</TableHead>
                <TableHead>Maximum package</TableHead>
                <TableHead>Max offers / student</TableHead>
                <TableHead>Drives tagged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="tabular-nums">{c.minPackage !== null ? `₹${(Number(c.minPackage) / 100000).toFixed(1)}L` : "-"}</TableCell>
                  <TableCell className="tabular-nums">{c.maxPackage !== null ? `₹${(Number(c.maxPackage) / 100000).toFixed(1)}L` : "-"}</TableCell>
                  <TableCell className="tabular-nums">{c.maxOffersPerStudent ?? "-"}</TableCell>
                  <TableCell className="tabular-nums">{c._count.drives}</TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                    No categories created yet. Add one above to start tagging drives by package tier.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
