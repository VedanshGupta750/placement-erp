import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { CreateForumDialog } from "@/components/forums/create-forum-dialog";

export default async function ForumsPage() {
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const forums = await db.forum.findMany({
    include: { posts: { select: { id: true } }, createdBy: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forums</h1>
          <p className="text-muted-foreground text-sm">Discussions open to everyone on campus.</p>
        </div>
        <CreateForumDialog />
      </div>

      <div className="flex flex-col gap-3">
        {forums.map((f) => (
          <Link key={f.id} href={`/forums/${f.id}`}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <div className="font-medium">{f.title}</div>
                  {f.description && <div className="text-muted-foreground text-sm">{f.description}</div>}
                  <div className="text-muted-foreground mt-1 text-xs">Started by {f.createdBy.name}</div>
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <MessageCircle className="size-4" /> {f.posts.length}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {forums.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">No forums yet — start the first discussion.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
