import { MessageSquare } from "lucide-react";

export default function MessagesIndexPage() {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-center">
      <MessageSquare className="size-8" />
      <div>
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="text-xs">Pick someone from the list, or start a new message.</p>
      </div>
    </div>
  );
}
