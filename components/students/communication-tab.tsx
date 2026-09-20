import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { hasPermission } from "@/lib/rbac/guard";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { CommunicationComposer } from "@/components/students/communication-composer";

// Reuses the existing Messages module rather than building a second
// messaging system — POST /api/messages already finds-or-creates the 1:1
// conversation between the caller and a recipient.
export async function CommunicationTab({ studentId: _studentId, userId }: { studentId: string; userId: string }) {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const [canMessage, conversation] = await Promise.all([
    hasPermission(session, "message.send"),
    db.conversation.findFirst({
      where: { isGroup: false, AND: [{ participants: { some: { userId: session.userId } } }, { participants: { some: { userId } } }] },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 5, include: { sender: true } } },
    }),
  ]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {canMessage && <CommunicationComposer recipientUserId={userId} />}

        {conversation ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent messages</h3>
              <Link href={`/messages/${conversation.id}`} className="text-primary flex items-center gap-1 text-xs hover:underline">
                Open in Messages <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="flex flex-col divide-y">
              {conversation.messages.slice().reverse().map((m: { id: string; body: string; createdAt: Date; sender: { name: string } | null; systemGenerated: boolean }) => (
                <div key={m.id} className="py-2 text-sm">
                  {!m.systemGenerated && <span className="text-muted-foreground text-xs">{m.sender?.name ?? "System"} · </span>}
                  <span className={m.systemGenerated ? "text-muted-foreground text-xs" : ""}>{m.body}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No conversation history yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
