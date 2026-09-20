"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; email: string; userType: string };

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function NewMessageDialog({ canCreateGroup }: { canCreateGroup: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [groupName, setGroupName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
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
          setResults(data.people ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  function reset() {
    setMode("direct");
    setQuery("");
    setResults([]);
    setSelectedPerson(null);
    setSelectedPeople([]);
    setGroupName("");
    setMessageBody("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function togglePersonInGroup(person: Person) {
    setSelectedPeople((prev) =>
      prev.some((p) => p.id === person.id) ? prev.filter((p) => p.id !== person.id) : [...prev, person],
    );
  }

  const canSubmitDirect = !!selectedPerson && messageBody.trim().length > 0;
  const canSubmitGroup = groupName.trim().length > 0 && selectedPeople.length > 0 && messageBody.trim().length > 0;

  async function handleStartDirect() {
    if (!selectedPerson) return;
    setPending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserId: selectedPerson.id, body: messageBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Couldn't start conversation.");
        return;
      }
      handleOpenChange(false);
      router.push(`/messages/${data.conversationId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleCreateGroup() {
    setPending(true);
    try {
      const res = await fetch("/api/messages/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          participantUserIds: selectedPeople.map((p) => p.id),
          body: messageBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Couldn't create group.");
        return;
      }
      handleOpenChange(false);
      router.push(`/messages/${data.conversationId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> New
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>

        {canCreateGroup ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "direct" | "group")}>
            <TabsList className="w-full">
              <TabsTrigger value="direct" className="flex-1">
                Direct message
              </TabsTrigger>
              <TabsTrigger value="group" className="flex-1">
                Create group
              </TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="mt-3">
              <DirectForm
                query={query}
                setQuery={setQuery}
                results={results}
                searching={searching}
                selectedPerson={selectedPerson}
                setSelectedPerson={setSelectedPerson}
                messageBody={messageBody}
                setMessageBody={setMessageBody}
              />
            </TabsContent>

            <TabsContent value="group" className="mt-3">
              <GroupForm
                query={query}
                setQuery={setQuery}
                results={results}
                searching={searching}
                selectedPeople={selectedPeople}
                togglePersonInGroup={togglePersonInGroup}
                groupName={groupName}
                setGroupName={setGroupName}
                messageBody={messageBody}
                setMessageBody={setMessageBody}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <DirectForm
            query={query}
            setQuery={setQuery}
            results={results}
            searching={searching}
            selectedPerson={selectedPerson}
            setSelectedPerson={setSelectedPerson}
            messageBody={messageBody}
            setMessageBody={setMessageBody}
          />
        )}

        <div className="flex justify-end">
          {mode === "direct" ? (
            <Button size="sm" disabled={!canSubmitDirect || pending} onClick={handleStartDirect}>
              {pending ? "Starting…" : "Start conversation"}
            </Button>
          ) : (
            <Button size="sm" disabled={!canSubmitGroup || pending} onClick={handleCreateGroup}>
              {pending ? "Creating…" : "Create group"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonResults({
  query,
  setQuery,
  results,
  searching,
  renderRow,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Person[];
  searching: boolean;
  renderRow: (person: Person) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name"
          className="pl-8"
        />
      </div>
      {query.trim() && (
        <div className="max-h-40 overflow-y-auto rounded-lg border">
          {searching ? (
            <div className="text-muted-foreground p-3 text-center text-xs">Searching…</div>
          ) : results.length === 0 ? (
            <div className="text-muted-foreground p-3 text-center text-xs">No people found.</div>
          ) : (
            <ul className="divide-y">{results.map((person) => <li key={person.id}>{renderRow(person)}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

function DirectForm({
  query,
  setQuery,
  results,
  searching,
  selectedPerson,
  setSelectedPerson,
  messageBody,
  setMessageBody,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Person[];
  searching: boolean;
  selectedPerson: Person | null;
  setSelectedPerson: (p: Person | null) => void;
  messageBody: string;
  setMessageBody: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {selectedPerson ? (
        <div className="bg-accent/50 flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
          <Avatar size="sm">
            <AvatarFallback className="bg-accent text-accent-foreground">{initials(selectedPerson.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{selectedPerson.name}</div>
            <div className="text-muted-foreground truncate text-xs">{selectedPerson.email}</div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPerson(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Change recipient"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <PersonResults
          query={query}
          setQuery={setQuery}
          results={results}
          searching={searching}
          renderRow={(person) => (
            <button
              type="button"
              onClick={() => {
                setSelectedPerson(person);
                setQuery("");
              }}
              className="hover:bg-accent/60 flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-accent text-accent-foreground">{initials(person.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{person.name}</div>
                <div className="text-muted-foreground truncate text-xs">{person.email}</div>
              </div>
            </button>
          )}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="direct-message">Message</Label>
        <Textarea
          id="direct-message"
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          placeholder="Write your first message…"
          rows={3}
        />
      </div>
    </div>
  );
}

function GroupForm({
  query,
  setQuery,
  results,
  searching,
  selectedPeople,
  togglePersonInGroup,
  groupName,
  setGroupName,
  messageBody,
  setMessageBody,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Person[];
  searching: boolean;
  selectedPeople: Person[];
  togglePersonInGroup: (p: Person) => void;
  groupName: string;
  setGroupName: (v: string) => void;
  messageBody: string;
  setMessageBody: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Group name</Label>
        <Input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Placement Committee" />
      </div>

      {selectedPeople.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPeople.map((p) => (
            <span key={p.id} className="bg-accent/70 flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs">
              {p.name}
              <button type="button" onClick={() => togglePersonInGroup(p)} aria-label={`Remove ${p.name}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <PersonResults
        query={query}
        setQuery={setQuery}
        results={results}
        searching={searching}
        renderRow={(person) => {
          const checked = selectedPeople.some((p) => p.id === person.id);
          return (
            <button
              type="button"
              onClick={() => togglePersonInGroup(person)}
              className={cn("hover:bg-accent/60 flex w-full items-center gap-2 px-2.5 py-1.5 text-left", checked && "bg-accent/40")}
            >
              <Checkbox checked={checked} onCheckedChange={() => togglePersonInGroup(person)} />
              <Avatar size="sm">
                <AvatarFallback className="bg-accent text-accent-foreground">{initials(person.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{person.name}</div>
                <div className="text-muted-foreground truncate text-xs">{person.email}</div>
              </div>
            </button>
          );
        }}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-message">First message</Label>
        <Textarea
          id="group-message"
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          placeholder="Write your first message…"
          rows={3}
        />
      </div>
    </div>
  );
}
