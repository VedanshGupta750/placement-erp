import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Conversation = { id: string; name: string | null; isGroup: boolean; createdAt: Date };

// Threads linked to this drive via Conversation.driveId (set from a
// conversation's "Link to drive" action in Messages) — this tab is a
// drive-scoped entry point into the real Messages module, not a second
// messaging system.
export function CommunicationsPanel({ conversations }: { conversations: Conversation[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Communications ({conversations.length})</CardTitle>
        <Button variant="outline" size="sm" render={<Link href="/messages" />}>
          <MessageSquare className="size-3.5" /> Open Messages
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {conversations.map((c) => (
          <Link key={c.id} href={`/messages/${c.id}`} className="hover:bg-accent/40 -mx-2 flex items-center justify-between rounded-md px-2 py-2.5 text-sm transition-colors">
            <span>{c.name ?? (c.isGroup ? "Group conversation" : "Conversation")}</span>
            <span className="text-muted-foreground text-xs">{c.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
          </Link>
        ))}
        {conversations.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No conversations linked to this drive yet — link one from a conversation&apos;s &quot;Link to drive&quot; action in Messages.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
