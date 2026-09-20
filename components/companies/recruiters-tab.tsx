import Link from "next/link";
import { Mail, Phone, ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/validators/contact";
import { AddRecruiterDialog } from "@/components/companies/add-recruiter-dialog";
import { PortalAccountsPanel } from "@/components/companies/portal-accounts-panel";

// Company-scoped recruiter directory — a lightweight roster + entry point
// into the full Contact CRM at /contacts/[id], not a rebuild of it.
export async function RecruitersTab({ companyId }: { companyId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [contacts, canEdit, portalAccounts] = await Promise.all([
    db.contact.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    hasPermission(session, "company.edit"),
    prisma.companyUser.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
  ]);

  const lastContactedAt = new Map<string, Date | null>();
  await Promise.all(
    contacts.map(async (c: { id: string }) => {
      const last = await db.contactCommunication.findFirst({
        where: { contactId: c.id },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      });
      lastContactedAt.set(c.id, last?.occurredAt ?? null);
    })
  );

  return (
    <div className="flex flex-col gap-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recruiters ({contacts.length})</CardTitle>
        {canEdit && <AddRecruiterDialog companyId={companyId} />}
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No recruiters added yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Last contact</TableHead>
                <TableHead className="text-right">Profile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c: {
                id: string;
                name: string | null;
                designation: string | null;
                contactType: string | null;
                relationshipStage: string;
                email: string | null;
                phone: string | null;
              }) => {
                const lastAt = lastContactedAt.get(c.id) ?? null;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name ?? "—"}</div>
                      {c.designation && <div className="text-muted-foreground text-xs">{c.designation}</div>}
                    </TableCell>
                    <TableCell>
                      {c.contactType ? <Badge variant="outline">{c.contactType}</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="border-none">
                        {RELATIONSHIP_STAGE_LABELS[c.relationshipStage as keyof typeof RELATIONSHIP_STAGE_LABELS] ?? c.relationshipStage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-muted-foreground hover:text-foreground" title={c.email}>
                            <Mail className="size-4" />
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-muted-foreground hover:text-foreground" title={c.phone}>
                            <Phone className="size-4" />
                          </a>
                        )}
                        {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {lastAt ? new Date(lastAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/contacts/${c.id}`} className="text-primary inline-flex items-center gap-1 text-sm hover:underline">
                        View <ExternalLink className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>

    {canEdit && (
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <PortalAccountsPanel
            companyId={companyId}
            accounts={portalAccounts.map((a: { id: string; name: string; email: string; status: string; isOwner: boolean; createdAt: Date }) => ({
              id: a.id,
              name: a.name,
              email: a.email,
              status: a.status,
              isOwner: a.isOwner,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    )}
    </div>
  );
}
