import { Megaphone, Users2 } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ComposeBroadcastDialog } from "@/components/broadcasts/compose-broadcast-dialog";
import { CreateTemplateDialog } from "@/components/broadcasts/create-template-dialog";
import { DeleteTemplateButton } from "@/components/broadcasts/delete-template-button";

const AUDIENCE_LABEL: Record<string, string> = {
  ALL_STUDENTS: "All students",
  ALL_STAFF: "All staff",
  BATCH: "Batch",
  DEPARTMENT: "Department",
  COURSE: "Course",
  ROLE: "Role",
};

export default async function BroadcastsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);
  const canView = await hasPermission(session, "broadcast.view");

  if (!canView) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">You don&apos;t have access to broadcasts.</CardContent>
      </Card>
    );
  }

  const [broadcasts, templates, batches, departments, courses, roles] = await Promise.all([
    db.broadcast.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { recipients: true } } } }),
    db.messageTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    db.batch.findMany({ orderBy: { year: "desc" } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.course.findMany({ orderBy: { name: "asc" } }),
    db.role.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
          <p className="text-muted-foreground text-sm">Send targeted announcements to students or staff.</p>
        </div>
        <ComposeBroadcastDialog
          templates={templates.map((t: { id: string; name: string; subject: string; body: string }) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body }))}
          batches={batches.map((b: { id: string; year: number }) => ({ id: b.id, year: b.year }))}
          departments={departments.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))}
          courses={courses.map((c: { id: string; name: string; degree: string }) => ({ id: c.id, name: c.name, degree: c.degree }))}
          roleNames={roles.map((r: { name: string }) => r.name)}
        />
      </div>

      <Tabs defaultValue="sent">
        <TabsList>
          <TabsTrigger value="sent">Sent ({broadcasts.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-4 flex flex-col gap-3">
          {broadcasts.map((b: { id: string; subject: string; body: string; audienceType: string; status: string; sentAt: Date | null; createdAt: Date; _count: { recipients: number } }) => (
            <Card key={b.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline">{AUDIENCE_LABEL[b.audienceType]}</Badge>
                    {b.status === "SENT" ? (
                      <Badge className="border-none bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Sent</Badge>
                    ) : (
                      <Badge variant="outline">Draft</Badge>
                    )}
                  </div>
                  <div className="font-medium">{b.subject}</div>
                  <div className="text-muted-foreground line-clamp-2 text-sm">{b.body}</div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><Users2 className="size-3" /> {b._count.recipients} recipients</span>
                    {b.sentAt && <span>{b.sentAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                </div>
                <Megaphone className="text-muted-foreground size-4 shrink-0" />
              </CardContent>
            </Card>
          ))}
          {broadcasts.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">No broadcasts sent yet.</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 flex flex-col gap-3">
          <div className="flex justify-end">
            <CreateTemplateDialog />
          </div>
          {templates.map((t: { id: string; name: string; subject: string; body: string }) => (
            <Card key={t.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div className="min-w-0">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-muted-foreground text-sm">{t.subject}</div>
                  <div className="text-muted-foreground line-clamp-2 text-xs">{t.body}</div>
                </div>
                <DeleteTemplateButton templateId={t.id} />
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">No templates yet.</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
