import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { NotesComposer } from "@/components/students/notes-composer";

export async function NotesTab({ studentId }: { studentId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [notes, canEdit] = await Promise.all([
    db.studentNote.findMany({ where: { studentId }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    hasPermission(session, "student.edit"),
  ]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {canEdit && <NotesComposer studentId={studentId} />}
        <div className="flex flex-col divide-y">
          {notes.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">No internal notes yet.</p>}
          {notes.map((n: { id: string; body: string; createdAt: Date; author: { name: string } }) => (
            <div key={n.id} className="py-2.5 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-muted-foreground mt-1 text-xs">{n.author.name} · {n.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
