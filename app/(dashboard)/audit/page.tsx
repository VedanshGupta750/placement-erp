import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { AUDIT_LABELS } from "@/lib/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

// The only surface where `audit.view` actually means something. Everything
// else recordAudit() writes (see lib/audit.ts) was previously only visible
// inside a single conversation's Activity tab, which requires being a
// participant of that specific conversation — an Auditor (who has
// audit.view but no message.view, per the RBAC freeze matrix) had no way to
// see any audit entry at all. This page fixes that: college-wide, gated on
// the permission the entries were always meant to be gated on.
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  const { page: pageParam, type } = await searchParams;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const canView = await hasPermission(session, "audit.view");
  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to the audit log.</CardContent>
      </Card>
    );
  }

  const page = Math.max(1, Number(pageParam) || 1);
  const resourceTypes = await db.auditLog.findMany({
    distinct: ["resourceType"],
    select: { resourceType: true },
    orderBy: { resourceType: "asc" },
  });

  const where = type ? { resourceType: type } : undefined;
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function detailFor(after: unknown) {
    const a = (after ?? {}) as { fileName?: string; driveId?: string; names?: string[] };
    return a.fileName ?? (a.names ? a.names.join(", ") : null);
  }

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    params.set("page", String(p));
    return `/audit?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm">{total} recorded event{total === 1 ? "" : "s"} across the college.</p>
      </div>

      <div className="flex max-w-full w-fit gap-1 overflow-x-auto overscroll-x-contain rounded-lg border p-1 [scrollbar-width:thin]">
        <Link
          href="/audit"
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            !type ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          All
        </Link>
        {resourceTypes.map((r: { resourceType: string }) => (
          <Link
            key={r.resourceType}
            href={`/audit?type=${encodeURIComponent(r.resourceType)}`}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              type === r.resourceType ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {r.resourceType}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto overscroll-x-contain pt-6 [scrollbar-width:thin]">
          <Table className="min-w-[60rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead className="w-40">Actor</TableHead>
                <TableHead className="w-52">Event</TableHead>
                <TableHead className="w-52">Resource</TableHead>
                <TableHead className="w-64">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                    No audit events recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e: {
                  id: string;
                  action: string;
                  resourceType: string;
                  resourceId: string | null;
                  after: unknown;
                  createdAt: Date;
                  actor: { name: string } | null;
                }) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {e.createdAt.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words text-sm">{e.actor?.name ?? "System"}</TableCell>
                    <TableCell className="whitespace-normal break-words text-sm">{AUDIT_LABELS[e.action] ?? e.action}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-normal break-all text-xs">
                      {e.resourceType}
                      {e.resourceId ? ` · ${e.resourceId.slice(0, 10)}…` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-normal break-words text-xs">{detailFor(e.after) ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={cn("rounded-md border px-3 py-1.5", page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted")}
          >
            Previous
          </Link>
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={cn("rounded-md border px-3 py-1.5", page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted")}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
