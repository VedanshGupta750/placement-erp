"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, LogOut, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Member = { userId: string; name: string; email: string; avatarUrl: string | null };
type Person = { id: string; name: string; email: string; userType: string };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

export function GroupMembersPanel({
  conversationId,
  members,
  currentUserId,
  isCreator,
  canAddMembers,
}: {
  conversationId: string;
  members: Member[];
  currentUserId: string;
  isCreator: boolean;
  canAddMembers: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Person[]>([]);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const memberIds = new Set(members.map((m) => m.userId));

  useEffect(() => {
    if (!addOpen) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/messages/search-people?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults((data.people ?? []).filter((p: Person) => !memberIds.has(p.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // memberIds is derived fresh from members every render — including it
    // would re-run the search on every keystroke's parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, addOpen]);

  function toggleSelected(person: Person) {
    setSelected((prev) => (prev.some((p) => p.id === person.id) ? prev.filter((p) => p.id !== person.id) : [...prev, person]));
  }

  async function addMembers() {
    if (selected.length === 0) return;
    setPending(true);
    try {
      const res = await fetch(`/api/messages/${conversationId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selected.map((p) => p.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Couldn't add members.");
        return;
      }
      setAddOpen(false);
      setQuery("");
      setSelected([]);
      setResults([]);
      router.refresh();
      toast.success("Members added.");
    } finally {
      setPending(false);
    }
  }

  async function removeMember(userId: string) {
    setRemovingId(userId);
    try {
      const res = await fetch(`/api/messages/${conversationId}/participants/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Couldn't remove member.");
        return;
      }
      router.refresh();
      toast.success("Member removed.");
    } finally {
      setRemovingId(null);
    }
  }

  async function leaveGroup() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/messages/${conversationId}/leave`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Couldn't leave the group.");
        setLeaving(false);
        return;
      }
      toast.success("You left the group.");
      router.push("/messages");
      router.refresh();
    } catch {
      setLeaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Group members</h2>
        {canAddMembers && (
          <Dialog open={addOpen} onOpenChange={(next) => { setAddOpen(next); if (!next) { setQuery(""); setSelected([]); setResults([]); } }}>
            <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add members" />}>
              <UserPlus className="size-4" />
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add members</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.map((p) => (
                      <span key={p.id} className="bg-accent/70 flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs">
                        {p.name}
                        <button type="button" onClick={() => toggleSelected(p)} aria-label={`Remove ${p.name}`}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people by name" className="pl-8" />
                </div>
                {query.trim() && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border">
                    {searching ? (
                      <div className="text-muted-foreground p-3 text-center text-xs">Searching…</div>
                    ) : results.length === 0 ? (
                      <div className="text-muted-foreground p-3 text-center text-xs">No people found.</div>
                    ) : (
                      <ul className="divide-y">
                        {results.map((person) => {
                          const checked = selected.some((p) => p.id === person.id);
                          return (
                            <li key={person.id}>
                              <button
                                type="button"
                                onClick={() => toggleSelected(person)}
                                className="hover:bg-accent/60 flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleSelected(person)} />
                                <Avatar size="sm">
                                  <AvatarFallback className="bg-accent text-accent-foreground">{initials(person.name)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">{person.name}</div>
                                  <div className="text-muted-foreground truncate text-xs">{person.email}</div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={selected.length === 0 || pending} onClick={addMembers}>
                  {pending ? "Adding…" : `Add ${selected.length || ""}`.trim()}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5">
            <Avatar size="sm">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
              <AvatarFallback>{initials(m.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {m.name}
                {m.userId === currentUserId && <span className="text-muted-foreground font-normal"> (you)</span>}
              </div>
              <div className="text-muted-foreground truncate text-xs">{m.email}</div>
            </div>
            {isCreator && m.userId !== currentUserId && (
              <button
                type="button"
                onClick={() => removeMember(m.userId)}
                disabled={removingId === m.userId}
                className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
                aria-label={`Remove ${m.name}`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={leaving} onClick={leaveGroup}>
        <LogOut className="size-3.5" /> {leaving ? "Leaving…" : "Leave group"}
      </Button>
    </div>
  );
}
