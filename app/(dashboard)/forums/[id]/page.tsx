import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreatePostDialog } from "@/components/forums/create-post-dialog";

export default async function ForumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const forum = await db.forum.findUnique({
    where: { id },
    include: { posts: { include: { author: true, replies: { select: { id: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!forum) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/forums" />}>
        <ArrowLeft className="size-3.5" /> Back to forums
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{forum.title}</h1>
          {forum.description && <p className="text-muted-foreground text-sm">{forum.description}</p>}
        </div>
        <CreatePostDialog forumId={forum.id} />
      </div>

      <div className="flex flex-col gap-3">
        {forum.posts.map((p) => (
          <Link key={p.id} href={`/forums/${forum.id}/posts/${p.id}`}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-muted-foreground line-clamp-1 text-sm">{p.body}</div>
                  <div className="text-muted-foreground mt-1 text-xs">{p.author.name}</div>
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <MessageCircle className="size-4" /> {p.replies.length}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {forum.posts.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">No posts yet — be the first to write one.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
