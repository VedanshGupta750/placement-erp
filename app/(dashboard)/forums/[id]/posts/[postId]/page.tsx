import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getTenantDb } from "@/lib/tenant/scoped-db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ReplyForm } from "@/components/forums/reply-form";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ForumPostPage({ params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id: forumId, postId } = await params;
  const session = await requireSession();
  const db = getTenantDb(session.collegeId);

  const forum = await db.forum.findUnique({ where: { id: forumId }, select: { id: true, title: true } });
  if (!forum) notFound();

  const post = await db.forumPost.findFirst({
    where: { id: postId, forumId },
    include: { author: true, replies: { include: { author: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!post) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href={`/forums/${forumId}`} />}>
        <ArrowLeft className="size-3.5" /> Back to {forum.title}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Avatar className="size-8"><AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials(post.author.name)}</AvatarFallback></Avatar>
            <div>
              <div className="font-medium">{post.author.name}</div>
              <div className="text-muted-foreground text-xs">{new Date(post.createdAt).toLocaleString("en-IN")}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <h1 className="mb-2 text-xl font-semibold">{post.title}</h1>
          <p className="whitespace-pre-wrap text-sm">{post.body}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {post.replies.map((r) => (
          <div key={r.id} className="flex gap-3 rounded-md border p-3">
            <Avatar className="size-7"><AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials(r.author.name)}</AvatarFallback></Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{r.author.name}</span>
                <span className="text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReplyForm postId={post.id} />
        </CardContent>
      </Card>
    </div>
  );
}
